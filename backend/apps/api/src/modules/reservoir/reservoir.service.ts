import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {parseAsOfContext} from '@ucell/shared';
import {authorizeTreePrincipal,TreePrincipal} from '../binary-tree/tree-authorization';
import {reportSnapshot} from './report-snapshot';
export const RESERVOIR_ROLES=['SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT'];
export type ReservoirFilters={tree?:string;position?:number;awardType?:string};
@Injectable()
export class ReservoirService{
 constructor(private readonly db:PrismaService){}
 async list(p:TreePrincipal,kind:'A'|'B',raw:unknown,filters:ReservoirFilters,after?:string,snapshotToken?:string){
  await authorizeTreePrincipal(this.db,p,RESERVOIR_ROLES);
  let time:ReturnType<typeof parseAsOfContext>;
  try{time=parseAsOfContext(raw);const now=new Date().toISOString();if(time.asOf>now||time.knowledgeCutoff>now)throw Error();}catch{throw new UnprocessableEntityException({code:'INVALID_AS_OF_CONTEXT'});}
  if(kind==='A'&&Object.values(filters).some(v=>v!==undefined))throw new UnprocessableEntityException({code:'RESERVOIR_A_FILTER_UNSUPPORTED'});
  if(after&&!snapshotToken)throw new ConflictException({code:'REPORT_SNAPSHOT_REQUIRED'});
  const result=await this.db.$transaction(async tx=>{
   const snapshot=await reportSnapshot(tx,p,{kind,time,filters:JSON.parse(JSON.stringify(filters)),definitionVersion:'RESERVOIR_CENTER_V1'},snapshotToken,async()=>{
    const cutoff=new Date(time.knowledgeCutoff),effective=new Date(time.asOf);
    // Conservative global completeness: a pending return can affect downstream company entitlements.
    const [pending]=await tx.$queryRaw<Array<{returns:string;replays:string}>>`SELECT
     (SELECT count(*)::text FROM commerce.return_case r WHERE r.status='POSTED' AND r.posted_at<=${cutoff} AND r.posted_at<=${effective}
      AND NOT EXISTS(SELECT 1 FROM audit.audit_event a WHERE a.action='RETURN_REVERSAL_PROCESSED' AND a.entity_id=r.return_case_id AND a.occurred_at<=${cutoff})) returns,
     (SELECT count(*)::text FROM ledger.settlement_recalculation_request WHERE created_at<=${cutoff}
      AND(processed_at IS NULL OR processed_at>${cutoff})) replays`;
    return {status:pending.returns==='0'&&pending.replays==='0'?'CURRENT':'STALE',pendingReturns:pending.returns,pendingReplays:pending.replays};
   });
   const at=new Date(time.asOf),known=new Date(time.knowledgeCutoff),start=new Date(time.periodStart),end=new Date(time.periodEnd),visibility=snapshot.databaseSnapshot;
   if(kind==='B'){
    const scope=Prisma.sql`e.effective_at<=${at} AND e.recorded_at<=${known} AND txid_visible_in_snapshot(e.recorded_transaction,${visibility}::txid_snapshot)
      ${filters.tree?Prisma.sql`AND d.binary_tree_id=${filters.tree}::uuid`:Prisma.empty}
      ${filters.position?Prisma.sql`AND d.company_position=${filters.position}`:Prisma.empty}
      ${filters.awardType?Prisma.sql`AND d.award_type=${filters.awardType}`:Prisma.empty}`;
    const period=Prisma.sql`d.period_start>=${start} AND d.period_start<${end}`;
    const [totals]=await tx.$queryRaw<Array<{cumulative:string;periodInflow:string;total:bigint;lastUpdated:Date|null}>>(Prisma.sql`
      SELECT coalesce(sum(e.amount_delta),0)::text AS cumulative,coalesce(sum(e.amount_delta) FILTER(WHERE ${period}),0)::text AS "periodInflow",
       count(*) FILTER(WHERE ${period}) AS total,max(e.recorded_at) AS "lastUpdated"
      FROM ledger.reservoir_b_effect e JOIN ledger.award_economic_destination d USING(destination_id) WHERE ${scope}`);
    const rows=await tx.$queryRaw<Array<Record<string,any>>>(Prisma.sql`
      SELECT e.effect_id AS id,e.effect_type AS "effectType",e.amount_delta::text AS amount,e.recorded_at AS "recordedAt",
       d.binary_tree_id AS tree,d.company_position AS position,d.qualification_id AS "qualificationId",d.award_type AS "awardType",d.source_settlement_id AS settlement,
       d.period_start AS "periodStart",d.period_end AS "periodEnd",d.rule_version AS "ruleVersion",d.parameter_version AS "parameterVersion",d.snapshot_hash AS "snapshotHash",
       e.replay_posting_id AS "replayPostingId"
      FROM ledger.reservoir_b_effect e JOIN ledger.award_economic_destination d USING(destination_id)
      WHERE ${scope} AND ${period} ${after?Prisma.sql`AND e.effect_id>${after}::uuid`:Prisma.empty} ORDER BY e.effect_id LIMIT 101`);
    return {sourceEvidence:snapshot.sourceEvidence,status:snapshot.sourceEvidence.status,...totals,total:Number(totals.total),items:rows.slice(0,100),nextCursor:rows.length>100?rows[99].id:null,snapshotToken:snapshot.snapshotId,snapshotExpiresAt:snapshot.expiresAt.toISOString()};
   }
   const scope=Prisma.sql`e.reservoir_code='A' AND e.source_period_end<=${at} AND e.created_at<=${known} AND txid_visible_in_snapshot(e.recorded_transaction,${visibility}::txid_snapshot)`;
   const period=Prisma.sql`e.source_period_start>=${start} AND e.source_period_start<${end}`;
   const [totals]=await tx.$queryRaw<Array<{cumulative:string;periodInflow:string;total:bigint;lastUpdated:Date|null}>>(Prisma.sql`
    SELECT coalesce(sum(e.amount),0)::text AS cumulative,coalesce(sum(e.amount) FILTER(WHERE ${period}),0)::text AS "periodInflow",count(*) FILTER(WHERE ${period}) AS total,max(e.created_at) AS "lastUpdated" FROM ledger.reservoir_ledger_effect e WHERE ${scope}`);
   const rows=await tx.$queryRaw<Array<Record<string,any>>>(Prisma.sql`
    SELECT e.reservoir_ledger_effect_id AS id,e.effect_type AS "effectType",e.amount::text AS amount,e.created_at AS "recordedAt",
     e.source_global_settlement_id AS settlement,e.source_period_start AS "periodStart",e.source_period_end AS "periodEnd",e.rule_version_code AS "ruleVersion",e.evidence_hash AS "snapshotHash"
    FROM ledger.reservoir_ledger_effect e WHERE ${scope} AND ${period} ${after?Prisma.sql`AND e.reservoir_ledger_effect_id>${after}::uuid`:Prisma.empty}
    ORDER BY e.reservoir_ledger_effect_id LIMIT 101`);
   return {sourceEvidence:snapshot.sourceEvidence,status:snapshot.sourceEvidence.status,...totals,total:Number(totals.total),items:rows.slice(0,100),nextCursor:rows.length>100?rows[99].id:null,snapshotToken:snapshot.snapshotId,snapshotExpiresAt:snapshot.expiresAt.toISOString()};
  },{isolationLevel:'RepeatableRead',timeout:15000});
  await authorizeTreePrincipal(this.db,p,RESERVOIR_ROLES);
  return {...result,kind,time,filters,definitionVersion:'RESERVOIR_CENTER_V1',dataThrough:time.knowledgeCutoff,dataClassification:'FINANCE_CONFIDENTIAL',flowPolicy:'INFLOW_ONLY',unit:'TWD'};
 }
}
