import {Prisma,SettlementReplayRun,SettlementReplayPeriod} from '@prisma/client';
import {pending,verifyReplayEnvelope} from '@ucell/database';
import {createHash} from 'node:crypto';

const ref=(kind:string,id:string)=>`${kind}:${createHash('sha256').update(`${kind}:${id}`).digest('hex')}`;
const corrupt=()=>pending('HISTORICAL_SNAPSHOT_CORRUPT','Replay posting evidence conflicts with its checkpoint');
function decimal(value:unknown){
  if(typeof value!=='string'||!/^[-+]?\d+(\.\d+)?$/.test(value))corrupt();
  return new Prisma.Decimal(value as string);
}

/** Exact persisted action/state links only; this does not assert payout. */
export async function orderReplayPostingEvidence(tx:Prisma.TransactionClient,run:SettlementReplayRun,periods:SettlementReplayPeriod[]){
  const source=run.calculationSnapshot as any;
  if(source?.format!=='UCELL_SETTLEMENT_REPLAY_RUN_V1')return {status:'SOURCE_LINK_UNAVAILABLE',actionCompleted:false,periods:[]};
  if(source.actionKey!==`RETURN:${run.sourceReturnCaseId}`||source.ruleVersionCode!==run.ruleVersionCode||typeof source.stateHash!=='string'||!/^[a-f0-9]{64}$/.test(source.stateHash))corrupt();
  const action=await tx.replayAction.findUnique({where:{actionKey:source.actionKey}});
  const result=action?.result as any;
  if(action&&(action.stateHash!==source.stateHash||result?.returnCaseId!==run.sourceReturnCaseId||result?.replayRunId!==run.settlementReplayRunId||result?.status!=='REPLAYED'||result?.stateHash!==source.stateHash))corrupt();
  const postings=await tx.entitlementReplayPosting.findMany({where:{actionKey:source.actionKey,snapshot:{kind:{in:['BINARY_K1','MATCHING_K2']}}},include:{snapshot:true,reservoirBEffect:{include:{destination:true}}},orderBy:{sequence:'asc'}});
  const carries=await tx.replayCarryProjection.findMany({where:{actionKey:source.actionKey},orderBy:{sequence:'asc'}});
  const batches=await tx.settlementBatch.findMany({where:{settlementBatchId:{in:carries.map(row=>row.settlementBatchId)}}});
  const output=periods.map(period=>({checkpointReference:ref('REPLAY_PERIOD',period.settlementReplayPeriodId),periodStart:period.periodStart.toISOString(),periodEnd:period.periodEnd.toISOString(),
    postings:[] as Array<Record<string,unknown>>,carryProjections:[] as Array<Record<string,unknown>>}));
  for(const posting of postings){
    const envelope=verifyReplayEnvelope(posting.snapshot);
    if(posting.stateHash!==source.stateHash||posting.snapshot.ruleVersionCode!==run.ruleVersionCode||envelope.kind!==posting.snapshot.kind||envelope.sourceId!==posting.snapshot.sourceId)corrupt();
    const index=periods.findIndex(period=>period.periodStart.toISOString()===envelope.inputs.periodStart&&period.periodEnd.toISOString()===envelope.inputs.periodEnd);
    if(index<0)corrupt();
    const sealed=envelope.recipients.filter(row=>row.key===posting.entitlementKey);
    const changes=(periods[index].awardDeltaSnapshot as any)?.[posting.snapshot.kind==='BINARY_K1'?'binary':'matching'];
    const matches=Array.isArray(changes)?changes.filter((row:any)=>row.entitlementKey===posting.entitlementKey):[];
    if(sealed.length!==1||matches.length!==1||sealed[0].qualificationId!==posting.recipientQualificationId||matches[0].qualificationId!==posting.recipientQualificationId||!posting.originallyPosted.eq(decimal(sealed[0].posted))||!posting.originallyPosted.eq(decimal(matches[0].original))||!posting.recalculatedEntitlement.eq(decimal(matches[0].recomputed)))corrupt();
    const correction=posting.correctionAwardId?await tx.bonusAward.findUnique({where:{bonusAwardId:posting.correctionAwardId}}):null;
    const recovery=posting.recoveryId?await tx.bonusRecoveryEvent.findUnique({where:{bonusRecoveryEventId:posting.recoveryId},include:{applications:{include:{payoutLine:{include:{payoutBatch:true}}},orderBy:[{createdAt:'asc'},{recoveryApplicationId:'asc'}]}}}):null;
    if(posting.correctionAwardId&&(!correction||correction.recipientQualificationId!==posting.recipientQualificationId||correction.sourceAwardId!==sealed[0].awardId||!posting.delta.gt(0)||!correction.payableAmount.eq(posting.delta)))corrupt();
    if(posting.recoveryId&&(!recovery||recovery.returnCaseId!==run.sourceReturnCaseId||recovery.bonusAwardId!==sealed[0].awardId||!posting.delta.lt(0)||!recovery.recoveryAmount.eq(posting.delta.abs())))corrupt();
    if(recovery?.applications.some(application=>application.amount.lte(0)||application.payoutLine.recipientQualificationId!==posting.recipientQualificationId))corrupt();
    const effect=posting.reservoirBEffect;
    if(effect&&(effect.effectType!=='REPLAY_ADJUSTMENT'||!effect.amountDelta.eq(posting.delta)||effect.destination.sourceBonusAwardId!==sealed[0].awardId||effect.destination.qualificationId!==posting.recipientQualificationId||correction||recovery))corrupt();
    const payables=correction?await tx.payableEntry.findMany({where:{sourceType:'BONUS_AWARD',sourceId:correction.bonusAwardId},include:{payoutLine:{include:{payoutBatch:true,paymentResults:{orderBy:[{createdAt:'asc'},{payoutPaymentResultId:'asc'}]}}}},orderBy:{payableEntryId:'asc'}}):[];
    const payableEvidence=payables.map(payable=>{
      if(payable.qualificationId!==posting.recipientQualificationId||!payable.grossAmount.eq(correction!.payableAmount))corrupt();
      const line=payable.payoutLine;
      if(line&&(line.recipientQualificationId!==payable.qualificationId||line.paymentResults.some(result=>result.payoutBatchId!==line.payoutBatchId)))corrupt();
      return {reference:ref('PAYABLE',payable.payableEntryId),grossAmount:payable.grossAmount.toString(),status:payable.status,availableAt:payable.availableAt.toISOString(),
        payout:line?{reference:ref('PAYOUT_LINE',line.payoutLineId),batchReference:ref('PAYOUT_BATCH',line.payoutBatchId),batchStatus:line.payoutBatch.status,
          attribution:'WHOLE_PAYOUT_LINE_NOT_CORRECTION_ALLOCATION',paymentAmountBasis:'CUMULATIVE_LINE_REPORTS_NOT_ADDITIVE',grossAmount:line.grossAmount.toString(),recoveryOffset:line.recoveryOffset.toString(),netAmount:line.netAmount.toString(),
          paymentResults:line.paymentResults.map(result=>({reference:ref('PAYMENT_RESULT',result.payoutPaymentResultId),status:result.resultStatus,reportedPaidAmount:result.paidAmount.toString(),occurredAt:result.occurredAt.toISOString()}))}:null};
    });
    output[index].postings.push({reference:ref('REPLAY_POSTING',posting.postingId),snapshotReference:ref('REPLAY_SNAPSHOT',posting.snapshotId),entitlementReference:ref('CHECKPOINT_ENTITLEMENT',posting.entitlementKey),recipientReference:ref('ECONOMIC_RECIPIENT',posting.recipientQualificationId),
      originallyPosted:posting.originallyPosted.toString(),recalculatedEntitlement:posting.recalculatedEntitlement.toString(),delta:posting.delta.toString(),
      correctionAward:correction?{reference:ref('AWARD',correction.bonusAwardId),amount:correction.payableAmount.toString(),payables:payableEvidence}:null,
      recovery:recovery?{reference:ref('RECOVERY',recovery.bonusRecoveryEventId),amount:recovery.recoveryAmount.toString(),recoveredAmount:recovery.recoveredAmount.toString(),outstandingAmount:recovery.outstandingAmount.toString(),status:recovery.status,applications:recovery.applications.map(application=>({reference:ref('RECOVERY_APPLICATION',application.recoveryApplicationId),amount:application.amount.toString(),payoutLineReference:ref('PAYOUT_LINE',application.payoutLineId),payoutBatchStatus:application.payoutLine.payoutBatch.status,basis:'RECOVERY_OFFSET_NOT_CASH_PAYMENT'}))}:null,
      reservoirBEffect:effect?{reference:ref('RESERVOIR_B_EFFECT',effect.effectId),amountDelta:effect.amountDelta.toString()}:null});
  }
  for(const carry of carries){
    const batch=batches.find(row=>row.settlementBatchId===carry.settlementBatchId);
    const index=periods.findIndex(period=>batch&&period.periodStart.getTime()===batch.periodStart.getTime()&&period.periodEnd.getTime()===batch.periodEnd.getTime());
    if(!batch||index<0||batch.settlementType!=='BINARY_K1'||batch.ruleVersionCode!==run.ruleVersionCode||carry.ruleVersionCode!==run.ruleVersionCode||carry.stateHash!==source.stateHash||carry.periodEnd.getTime()!==batch.periodEnd.getTime())corrupt();
    if(!carry.carry||typeof carry.carry!=='object'||Array.isArray(carry.carry))corrupt();
    const checkpoint=periods[index].carryDeltaSnapshot as any;
    const entries=Object.entries(carry.carry as Record<string,any>);
    if(!checkpoint||Object.keys(checkpoint).length!==entries.length)corrupt();
    const recipients=entries.sort(([a],[b])=>a.localeCompare(b)).map(([qid,value])=>{
      if(!decimal(value?.left).eq(decimal(checkpoint[qid]?.recomputed?.left))||!decimal(value?.right).eq(decimal(checkpoint[qid]?.recomputed?.right)))corrupt();
      return {recipientReference:ref('ECONOMIC_RECIPIENT',qid),left:decimal(value.left).toString(),right:decimal(value.right).toString(),pairedPv:decimal(value.pairedPv).toString()};
    });
    output[index].carryProjections.push({reference:ref('CARRY_PROJECTION',carry.sequence.toString()),stateHash:carry.stateHash,recipients});
  }
  return {status:postings.length||carries.length?'RECORDED_EFFECTS':'NO_RECORDED_EFFECTS',actionReference:action?ref('REPLAY_ACTION',action.actionKey):null,actionCompleted:!!action,evidenceType:'POSTED_LEDGER_EVIDENCE_NOT_BANK_PAYMENT',periods:output};
}
