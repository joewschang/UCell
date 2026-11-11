import {Controller,Get,Post,Param,Query,Req,ParseUUIDPipe,BadRequestException,UnauthorizedException} from '@nestjs/common';
import {ApiBearerAuth,ApiTags} from '@nestjs/swagger';
import {randomUUID} from 'node:crypto';
import {Prisma,PrismaService,verifyCompensationPeriod} from '@ucell/database';
import {Roles} from '../auth/roles.decorator';

function offset(page:string|undefined) {
  const n=Number(page??1);
  if(!Number.isSafeInteger(n)||n<1||n>1000000)throw new BadRequestException('頁碼無效');
  return (n-1)*25;
}

@ApiTags('Admin - Compensation Period Control')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/compensation-period-control/verification')
export class CompensationAuditController {
  constructor(private readonly db:PrismaService){}
  @Get()
  async periods(@Query('page') page?:string) {
    const rows=await this.db.$queryRaw<object[]>`SELECT b.settlement_batch_id id,b.settlement_type::text kind,b.period_start AS "periodStart",
      b.period_end AS "periodEnd",b.rule_version_code AS "ruleVersion",a.checked_at AS "checkedAt",a.checked_sources AS "checkedSources",
      a.checked_awards AS "checkedAwards",a.expected_amount::text AS expected,a.recorded_amount::text AS recorded,
      a.open_cases AS "openCases",a.evidence_hash='INCOMPLETE' AS incomplete FROM ledger.settlement_batch b
      LEFT JOIN ledger.compensation_audit_period a USING(settlement_batch_id) WHERE b.status='FINALIZED'
      ORDER BY b.period_end DESC,b.settlement_type,b.settlement_batch_id LIMIT 26 OFFSET ${offset(page)}`;
    return {data:{items:rows.slice(0,25),hasMore:rows.length>25}};
  }
  @Get(':id/cases')
  async cases(@Param('id',ParseUUIDPipe) id:string,@Query('q') input?:string,@Query('page') page?:string,@Query('status') status='open') {
    const search=(input??'').trim();
    if(search.length>120||!['open','verified','all'].includes(status))throw new BadRequestException('查詢條件無效');
    const term='%'+search.replace(/[\\%_]/g,'\\$&')+'%';
    const rows=await this.db.$queryRaw<object[]>`SELECT c.case_key AS key,c.reason,q.ball_no AS ball,
      coalesce(le.registered_name,p.legal_name,cp.display_name) AS name,o.order_no::text AS "orderNo",c.expected_amount::text AS expected,
      c.recorded_amount::text AS recorded,(c.expected_amount-c.recorded_amount)::text AS difference,c.evidence,c.verified_at AS "verifiedAt"
      FROM ledger.compensation_audit_case c LEFT JOIN membership.qualification q USING(qualification_id)
      JOIN ledger.settlement_batch b ON b.settlement_batch_id=c.settlement_batch_id
      LEFT JOIN LATERAL (SELECT h.person_id,h.legal_entity_id,h.company_principal_id FROM membership.qualification_owner_interval h
        WHERE h.qualification_id=q.qualification_id AND h.effective_from<=coalesce((c.evidence->>'earnedAt')::timestamptz,b.period_end)
        AND (h.effective_to IS NULL OR h.effective_to>coalesce((c.evidence->>'earnedAt')::timestamptz,b.period_end))
        ORDER BY h.effective_from DESC LIMIT 1) holder ON true
      LEFT JOIN identity.person p ON p.person_id=coalesce(holder.person_id,CASE WHEN holder.legal_entity_id IS NULL AND holder.company_principal_id IS NULL THEN q.current_holder_person_id END)
      LEFT JOIN identity.legal_entity le ON le.legal_entity_id=coalesce(holder.legal_entity_id,CASE WHEN holder.person_id IS NULL AND holder.company_principal_id IS NULL THEN q.current_holder_legal_entity_id END)
      LEFT JOIN membership.company_principal cp ON cp.company_principal_id=coalesce(holder.company_principal_id,CASE WHEN holder.legal_entity_id IS NULL AND holder.person_id IS NULL THEN q.current_company_principal_id END)
      LEFT JOIN commerce."order" o ON o.order_id=c.source_order_id
      WHERE c.settlement_batch_id=${id}::uuid AND ${status==='all'?Prisma.sql`true`:status==='open'?Prisma.sql`c.verified_at IS NULL`:Prisma.sql`c.verified_at IS NOT NULL`}
      AND (${search}='' OR q.ball_no ILIKE ${term} OR p.legal_name ILIKE ${term} OR p.preferred_name ILIKE ${term} OR p.mobile ILIKE ${term}
      OR le.registered_name ILIKE ${term} OR cp.display_name ILIKE ${term} OR o.order_no::text ILIKE ${term}
      OR EXISTS(SELECT 1 FROM identity.legal_entity_representative r JOIN identity.person rep ON rep.person_id=r.person_id
        WHERE r.legal_entity_id=le.legal_entity_id AND r.effective_to IS NULL AND rep.mobile ILIKE ${term}))
      ORDER BY c.opened_at DESC,c.case_key LIMIT 26 OFFSET ${offset(page)}`;
    return {data:{items:rows.slice(0,25),hasMore:rows.length>25}};
  }
  @Post(':id/reverify')
  async verify(@Param('id',ParseUUIDPipe) id:string,@Req() req:any) {
    if(!req.user?.personId)throw new UnauthorizedException();
    return this.db.$transaction(async tx=>{
      const batch=await tx.settlementBatch.findFirstOrThrow({where:{settlementBatchId:id,status:'FINALIZED'}});
      const summary=await verifyCompensationPeriod(tx,batch,true);
      await tx.auditEvent.create({data:{actorType:'USER',actorId:req.user.personId,actorRoleSnapshot:req.user.role,
        action:'COMPENSATION_AUDIT_REVERIFIED',entityType:'SETTLEMENT_BATCH',entityId:id,
        requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID(),afterData:JSON.parse(JSON.stringify(summary))}});
      return {data:summary};
    },{isolationLevel:'Serializable',timeout:120000});
  }
}
