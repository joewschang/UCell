import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma, PrismaClient, SettlementBatch } from '@prisma/client';
import { inspectCompensationBatch } from './compensation-audit';

type Tx=Prisma.TransactionClient;
const manual=['DUPLICATE','OWNER','UNEXPECTED','MISSING'];

export async function verifyCompensationPeriod(tx:Tx,batch:SettlementBatch,review=false) {
  const id=batch.settlementBatchId;
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'compensation-audit/'+id},0))`;
  const result=await inspectCompensationBatch(tx,batch);
  const checkedAt=new Date(), keys=result.findings.map(f=>f.key);
  for(const f of result.findings) {
    await tx.$executeRaw`INSERT INTO ledger.compensation_audit_case
      (settlement_batch_id,case_key,reason,qualification_id,source_order_id,expected_amount,recorded_amount,evidence)
      VALUES (${id}::uuid,${f.key},${f.reason},${f.qid??null}::uuid,${f.order??null}::uuid,${f.expected??null},${f.actual??null},${JSON.stringify(f.evidence)}::jsonb)
      ON CONFLICT (settlement_batch_id,case_key) DO UPDATE SET reason=excluded.reason,expected_amount=excluded.expected_amount,
      recorded_amount=excluded.recorded_amount,evidence=excluded.evidence,verified_at=NULL`;
  }
  await tx.$executeRaw`UPDATE ledger.compensation_audit_case SET verified_at=${checkedAt} WHERE settlement_batch_id=${id}::uuid
    AND verified_at IS NULL AND (${review} OR reason NOT IN (${Prisma.join(manual)}))
    AND ${keys.length?Prisma.sql`case_key NOT IN (${Prisma.join(keys)})`:Prisma.sql`true`}`;
  const [{count}]=await tx.$queryRaw<{count:number}[]>`SELECT count(*)::int AS count FROM ledger.compensation_audit_case WHERE settlement_batch_id=${id}::uuid AND verified_at IS NULL`;
  await tx.$executeRaw`INSERT INTO ledger.compensation_audit_period VALUES
    (${id}::uuid,${checkedAt},${result.checkedSources},${result.checkedAwards},${result.expectedTotal},${result.recordedTotal},${count},${result.hash})
    ON CONFLICT (settlement_batch_id) DO UPDATE SET checked_at=excluded.checked_at,checked_sources=excluded.checked_sources,
    checked_awards=excluded.checked_awards,expected_amount=excluded.expected_amount,recorded_amount=excluded.recorded_amount,
    open_cases=excluded.open_cases,evidence_hash=excluded.evidence_hash`;
  return {checkedAt,checkedSources:result.checkedSources,checkedAwards:result.checkedAwards,openCases:count};
}

export async function pollCompensationAudits(db:PrismaClient) {
  // Commit each full batch independently. A restarted worker resumes at the oldest unchecked batch.
  const pending=await db.$queryRaw<{id:string}[]>`SELECT b.settlement_batch_id AS id FROM ledger.settlement_batch b
    LEFT JOIN ledger.compensation_audit_period a USING (settlement_batch_id)
    WHERE b.status='FINALIZED' AND (a.checked_at IS NULL OR a.checked_at<now()-interval '1 day' OR EXISTS (
      SELECT 1 FROM ledger.entitlement_replay_posting p JOIN ledger.historical_replay_snapshot s USING(snapshot_id)
      WHERE s.source_id=b.settlement_batch_id AND p.created_at>a.checked_at) OR EXISTS (
      SELECT 1 FROM ledger.pv_ledger v WHERE v.rule_version_code=b.rule_version_code AND v.occurred_at>=b.period_start AND v.occurred_at<b.period_end AND v.recorded_at>a.checked_at))
    ORDER BY a.checked_at NULLS FIRST,b.period_end,b.settlement_batch_id LIMIT 8`;
  for(const row of pending) {
    try {
      await db.$transaction(async tx=>verifyCompensationPeriod(tx,await tx.settlementBatch.findUniqueOrThrow({where:{settlementBatchId:row.id}})),{isolationLevel:'RepeatableRead',timeout:120000});
    } catch(err) {
      // One period with broken evidence must neither pass nor starve later periods.
      const code=err instanceof Error?err.message.slice(0,180):'AUDIT_ERROR';
      await db.$transaction(async tx=>{
        await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${'compensation-audit/'+row.id},0))`;
        await tx.$executeRaw`INSERT INTO ledger.compensation_audit_case(settlement_batch_id,case_key,reason,evidence)
          VALUES(${row.id}::uuid,'evidence','EVIDENCE',${JSON.stringify({code})}::jsonb)
          ON CONFLICT(settlement_batch_id,case_key) DO UPDATE SET evidence=excluded.evidence,verified_at=NULL`;
        await tx.$executeRaw`INSERT INTO ledger.compensation_audit_period VALUES(${row.id}::uuid,now(),0,0,0,0,1,'INCOMPLETE')
          ON CONFLICT(settlement_batch_id) DO UPDATE SET checked_at=now(),evidence_hash='INCOMPLETE',open_cases=greatest(1,ledger.compensation_audit_period.open_cases)`;
      });
    }
  }
}

export async function verifyPayoutSources(tx:Tx,batchId:string) {
  const batch=await tx.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:batchId}});
  const entries=await tx.payableEntry.findMany({where:{payoutLine:{payoutBatchId:batchId}}});
  const batches=new Set<string>();
  for(const entry of entries) {
    let at:Date, qid:string, amount:Prisma.Decimal;
    if(entry.sourceType==='BONUS_AWARD') {
      const award=await tx.bonusAward.findUniqueOrThrow({where:{bonusAwardId:entry.sourceId}});
      if(award.settlementBatchId)batches.add(award.settlementBatchId);
      at=award.occurredAt;qid=award.recipientQualificationId;amount=award.payableAmount;
    } else if(entry.sourceType==='RPV_UPLINE_AWARD') {
      const award=await tx.rpvUplineAwardEvent.findUniqueOrThrow({where:{rpvAwardEventId:entry.sourceId}});
      at=award.occurredAt;qid=award.recipientQualificationId;amount=award.payableAmount;
    } else if(entry.sourceType==='GLOBAL_POOL_AWARD') {
      const award=await tx.globalPoolAward.findUniqueOrThrow({where:{globalPoolAwardId:entry.sourceId},include:{settlement:true}});
      at=award.settlement.periodEnd;qid=award.qualificationId;amount=award.payableAmount;
    } else throw new ConflictException('未知應付來源，請覆核');
    if(qid!==entry.qualificationId||!amount.eq(entry.grossAmount))throw new ConflictException('應付分錄與獎金來源不符');
    const routed=await tx.awardEconomicDestination.findFirst({where:{OR:[{sourceBonusAwardId:entry.sourceId},{sourceRpvAwardId:entry.sourceId},{sourceGlobalAwardId:entry.sourceId}]}});
    if(routed)throw new ConflictException('公司球獎金不得列入會員撥款');
    const q=await tx.qualification.findUniqueOrThrow({where:{qualificationId:qid}});
    const holders=await tx.qualificationHolderHistory.findMany({where:{qualificationId:qid,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]}});
    const owners=await tx.qualificationOwnerInterval.findMany({where:{qualificationId:qid,effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]}});
    const person=owners[0]?.personId??holders[0]?.holderPersonId;
    const entity=owners[0]?.legalEntityId??holders[0]?.holderLegalEntityId;
    if(owners.length>1||holders.length>1||(!person&&!entity)||owners[0]?.ownerType==='COMPANY'||(person??null)!==q.currentHolderPersonId||(entity??null)!==q.currentHolderLegalEntityId)
      throw new ConflictException('受領身分需要覆核，請核對獎金發生時的持有人與撥款對象');
  }
  const periods=await tx.settlementBatch.findMany({where:{status:'FINALIZED',OR:[{settlementBatchId:{in:[...batches]}},{periodEnd:{gt:batch.periodStart,lte:batch.periodEnd},ruleVersionCode:{in:[...new Set(entries.map(e=>e.ruleVersionCode))]}}]}});
  for(const period of periods) {
    const r=await inspectCompensationBatch(tx,period);
    const awaiting=await tx.$queryRaw<{n:number}[]>`SELECT count(*)::int n FROM ledger.compensation_audit_case
      WHERE settlement_batch_id=${period.settlementBatchId}::uuid AND verified_at IS NULL AND reason IN (${Prisma.join(manual)})`;
    if(r.findings.length||awaiting[0].n)throw new ConflictException('獎金驗算仍有差異，請到獎金週期控制中心覆核');
  }
}

export function auditPeriodId(value:string){
  if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value))throw new BadRequestException('無效的結算批次');
  return value;
}
