import { Prisma, verifyReplayEnvelope } from '@ucell/database';
import { ExplainQuery, ExplainTool, ReadContractError, eventVisible } from '@ucell/shared';
import { verifySnapshot } from '../rules/parameter-snapshot';
import { readMemberActiveEvidence } from '../member/member-explain-source';

const missing = () => ({status:'UNAVAILABLE',result:null});
const invalid = (): never => {throw new ReadContractError('INVALID_EVIDENCE');};
const sha = (v: unknown): v is string => typeof v === 'string' && /^[a-f0-9]{64}$/.test(v);
const visible = (effective: Date, recorded: Date, q: ExplainQuery) => eventVisible(effective.toISOString(),recorded.toISOString(),q.time);
function envelope(q: ExplainQuery, result: unknown, ruleVersion: string, parameterVersion: string, updated: Date,
  through: Date, evidenceRefs: {type:string;id:string;revision:string}[], finality='FINALIZED') {
  return {status:'AVAILABLE',finality,scope:{qualificationId:q.qualificationId,binaryTreeId:q.binaryTreeId,resourceId:q.resourceId},
    time:q.time,updatedAt:updated.toISOString(),dataThrough:through.toISOString(),ruleVersion,parameterVersion,evidenceRefs,result};
}
/** Called only after authorization, within a repeatable-read transaction. Never invokes a calculation/posting service. */
export async function readStructuredExplanation(tx: Prisma.TransactionClient, tool: ExplainTool, q: ExplainQuery): Promise<unknown> {
  // A tree ID cannot be invented for the legacy graph. Tree-scoped reads wait for Train B membership evidence.
  if (q.binaryTreeId) return missing();
  const cutoff = new Date(q.time.knowledgeCutoff), asOf = new Date(q.time.asOf);
  if (tool === 'getActiveStatus' || tool === 'explainActive') {
    if (!q.qualificationId) return missing();
    const source=await readMemberActiveEvidence(tx,q.qualificationId,asOf);
    if(new Date(source.updatedAt)>cutoff) return missing();
    // Existing adapter rejects replay/ambiguous intervals. Explicitly reject records learned after known-at.
    const later=await tx.activeIntervalEvidence.findFirst({where:{qualificationId:q.qualificationId,createdAt:{gt:cutoff},activeFrom:{lte:asOf}}});
    if(later) return missing();
    return envelope(q,source.result,source.ruleVersion,source.parameterVersion,new Date(source.updatedAt),asOf,source.evidenceRefs,'NOT_APPLICABLE');
  }
  if(tool==='explainAward') {
    const row=await tx.bonusAward.findUnique({where:{bonusAwardId:q.resourceId!}});
    if(!row || row.recipientQualificationId!==q.qualificationId || !visible(row.occurredAt,row.createdAt,q)) return missing();
    let parameter=row.parameterSnapshotHash;
    if(!sha(parameter)) {
      const detail=row.calculationDetail as Record<string,unknown>;
      try {parameter=verifySnapshot(detail?.parameterSnapshot).hash;} catch {return missing();}
    }
    // This is the original immutable Award, not a recomputed or net-after-replay entitlement.
    return envelope(q,{theory:row.theoryAmount.toString(),k:row.kFactor.toString(),final:row.payableAmount.toString(),awardType:row.awardType},
      row.ruleVersionCode,parameter!,row.createdAt,row.occurredAt,[{type:'BonusAward',id:row.bonusAwardId,revision:parameter!}]);
  }
  if(tool==='explainSettlement' || tool==='explainBinaryCarry') {
    if(!q.resourceId || !q.qualificationId || (q.time.settlementId && q.time.settlementId!==q.resourceId)) return missing();
    const batch=await tx.settlementBatch.findUnique({where:{settlementBatchId:q.resourceId}});
    if(!batch || batch.status!=='FINALIZED' || !batch.finalizedAt || batch.finalizedAt>cutoff || batch.finalizedAt>asOf || batch.periodEnd>asOf
      || batch.periodStart.toISOString()!==q.time.periodStart || batch.periodEnd.toISOString()!==q.time.periodEnd || !sha(batch.calculationHash)) return missing();
    const snapshot=await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:batch.settlementType,sourceId:batch.settlementBatchId}}});
    if(!snapshot || snapshot.createdAt>cutoff) return missing();
    let stored:ReturnType<typeof verifyReplayEnvelope>;
    try {stored=verifyReplayEnvelope(snapshot);} catch {return invalid();}
    if(stored.ruleVersionCode!==batch.ruleVersionCode || stored.inputs?.periodStart!==q.time.periodStart || stored.inputs?.periodEnd!==q.time.periodEnd) return invalid();
    const refs=[{type:'SettlementBatch',id:batch.settlementBatchId,revision:batch.calculationHash},
      {type:'HistoricalReplaySnapshot',id:snapshot.snapshotId,revision:snapshot.hash}];
    if(tool==='explainSettlement') {
      const own=await tx.bonusAward.findFirst({where:{settlementBatchId:batch.settlementBatchId,recipientQualificationId:q.qualificationId,createdAt:{lte:cutoff}}});
      if(!own) return missing();
      // Only status is released to a Member, never other recipients or the global pool totals.
      return envelope(q,{settlementType:batch.settlementType,status:'FINALIZED'},batch.ruleVersionCode,stored.parameters.hash,batch.finalizedAt,batch.periodEnd,refs);
    }
    if(batch.settlementType!=='BINARY_K1') return missing();
    if(await tx.replayCarryProjection.findFirst({where:{settlementBatchId:batch.settlementBatchId,createdAt:{lte:cutoff}}})) return missing();
    const recipients=Array.isArray(stored.evidence?.carryRecipients)?stored.evidence.carryRecipients.filter((r:{qualificationId:string})=>r.qualificationId===q.qualificationId):[];
    if(recipients.length!==1) return missing();
    const own=recipients[0];
    return envelope(q,{pairPV:own.pairedPv,leftCarry:own.leftCarryOut,rightCarry:own.rightCarryOut},batch.ruleVersionCode,stored.parameters.hash,batch.finalizedAt,batch.periodEnd,refs);
  }
  if(tool==='explainPerformance') {
    if(!q.qualificationId) return missing();
    const rows=await tx.pvLedger.findMany({where:{qualificationId:q.qualificationId,pvType:{in:['GPV','RPV','EPV']},
      occurredAt:{gte:new Date(q.time.periodStart),lt:new Date(q.time.periodEnd<q.time.asOf?q.time.periodEnd:q.time.asOf)},recordedAt:{lte:cutoff}},take:101,orderBy:{recordedAt:'asc'}});
    // Bounded complete population, one parameter/rule version. Larger/mixed-version scopes need a versioned projection.
    if(!rows.length || rows.length>100 || rows.some(r=>!sha(r.parameterSnapshotHash))
      || new Set(rows.map(r=>r.ruleVersionCode+':'+r.parameterSnapshotHash)).size!==1) return missing();
    // Period restatement cannot silently attribute a later recorded reversal to the wrong original month.
    if(rows.some(r=>r.reversalOfEventId) || await tx.pvLedger.findFirst({where:{reversalOfEventId:{in:rows.map(r=>r.eventId)},recordedAt:{lte:cutoff}}})) return missing();
    const total=(type:string)=>rows.filter(r=>r.pvType===type).reduce((sum,r)=>sum.add(r.amount),new Prisma.Decimal(0)).toString();
    const updated=rows[rows.length-1].recordedAt;
    return envelope(q,{gpv:total('GPV'),rpv:total('RPV'),epv:total('EPV')},rows[0].ruleVersionCode,rows[0].parameterSnapshotHash!,updated,asOf,
      rows.map(r=>({type:'PvLedger',id:r.eventId,revision:r.parameterSnapshotHash!})));
  }
  if(tool==='explainReservoirB'){
    const effect=await tx.reservoirBEffect.findUnique({where:{effectId:q.resourceId!},include:{destination:{include:{binding:true,sourceBonusAward:{include:{settlementBatch:true}},sourceRpvAward:true,sourceGlobalAward:{include:{settlement:true}}}},replayPosting:true}});
    if(!effect||effect.effectiveAt>asOf||effect.recordedAt>cutoff)return missing();
    const d=effect.destination;
    if(d.recordedAt>cutoff||d.periodStart.toISOString()!==q.time.periodStart||d.periodEnd.toISOString()!==q.time.periodEnd)return missing();
    let params:ReturnType<typeof verifySnapshot>;try{params=verifySnapshot(d.parameterSnapshot);}catch{return invalid();}
    if(params.hash!==d.snapshotHash||params.ruleVersionCode!==d.ruleVersion)return invalid();
    const bonus=d.sourceBonusAward,rpv=d.sourceRpvAward,global=d.sourceGlobalAward;
    const source=bonus??rpv??global;if(!source||!source.payableAmount.eq(d.finalAmount))return invalid();
    if(bonus?.settlementBatch&&(bonus.settlementBatch.status!=='FINALIZED'||!bonus.settlementBatch.finalizedAt||bonus.settlementBatch.finalizedAt>cutoff))return missing();
    const refs=[{type:'ReservoirBEffect',id:effect.effectId,revision:effect.idempotencyKey},
      {type:'AwardEconomicDestination',id:d.destinationId,revision:d.snapshotHash},
      {type:bonus?'BonusAward':rpv?'RpvUplineAwardEvent':'GlobalPoolAward',id:(d.sourceBonusAwardId??d.sourceRpvAwardId??d.sourceGlobalAwardId)!,revision:d.snapshotHash}];
    if(d.binding){if(d.binding.snapshotHash!==d.snapshotHash||d.binding.recordedAt>cutoff)return invalid();refs.push({type:'CompanyBootstrapProfileBinding',id:d.binding.bindingId,revision:d.binding.snapshotHash});}
    if(effect.replayPosting){if(effect.replayPosting.createdAt>cutoff||!effect.replayPosting.delta.eq(effect.amountDelta))return invalid();refs.push({type:'EntitlementReplayPosting',id:effect.replayPosting.postingId,revision:effect.replayPosting.stateHash});}
    return envelope(q,{amount:effect.amountDelta.toString(),kind:effect.effectType==='ENTITLEMENT'?'ACCRUAL':'CORRECTION',
      theory:bonus?.theoryAmount.toString()??rpv?.theoryAmount.toString()??'NOT_APPLICABLE',k:bonus?.kFactor.toString()??'NOT_APPLICABLE',final:d.finalAmount.toString(),
      awardType:d.awardType,companyBall:d.qualificationId,profile:d.binding?.planCode??bonus?.planLevelSnapshot??'MEMBER_ORIGIN_ORIGINAL_PLAN',
      tree:d.binaryTreeId,position:d.companyPosition?String(d.companyPosition):'MEMBER_ORIGIN',economicDestination:d.destination,
      sourceRecognition:bonus?.sourceEventId??rpv?.recognitionId??'SETTLEMENT_SOURCE_SET',settlement:d.sourceSettlementId??'NOT_APPLICABLE',snapshotHash:d.snapshotHash},
      d.ruleVersion,d.parameterVersion,effect.recordedAt,d.effectiveAt,refs);
  }
  if(tool==='explainReservoirA') {
    const row=await tx.reservoirLedgerEffect.findUnique({where:{reservoirLedgerEffectId:q.resourceId!}});
    if(!row || row.reservoirCode!=='A' || row.createdAt>cutoff || row.sourcePeriodEnd>asOf
      || row.sourcePeriodStart.toISOString()!==q.time.periodStart || row.sourcePeriodEnd.toISOString()!==q.time.periodEnd || !sha(row.evidenceHash)) return missing();
    const source=await tx.globalPoolSettlement.findUnique({where:{globalPoolSettlementId:row.sourceGlobalSettlementId}});
    if(!source || source.createdAt>cutoff || source.ruleVersionCode!==row.ruleVersionCode) return missing();
    let params:ReturnType<typeof verifySnapshot>;try {params=verifySnapshot(source.parameterSnapshot);} catch {return missing();}
    return envelope(q,{amount:row.amount.toString(),kind:row.effectType==='GLOBAL_UNDISTRIBUTED'?'ACCRUAL':'CORRECTION'},row.ruleVersionCode,params.hash,
      row.createdAt,row.sourcePeriodEnd,[{type:'ReservoirLedgerEffect',id:row.reservoirLedgerEffectId,revision:row.evidenceHash}]);
  }
  if(tool==='explainPayout') {
    const line=await tx.payoutLine.findUnique({where:{payoutLineId:q.resourceId!},include:{payoutBatch:true,payableEntries:{take:101}}});
    if(!line || line.recipientQualificationId!==q.qualificationId || line.createdAt>cutoff) return missing();
    const batch=line.payoutBatch, entries=line.payableEntries;
    if(batch.status!=='PAID' || !batch.paidAt || !visible(batch.paidAt,line.createdAt,q)
      || !entries.length || entries.length>100 || entries.some(e=>e.sourceType!=='BONUS_AWARD' || e.qualificationId!==q.qualificationId || e.createdAt>cutoff)) return missing();
    // paidAt may be backdated: the immutable audit's recorded time independently controls known-at.
    const audits=await tx.auditEvent.findMany({where:{entityType:'PAYOUT_BATCH',entityId:batch.payoutBatchId,action:'PAYOUT_PAID',occurredAt:{lte:cutoff}},take:2});
    if(audits.length!==1 || (audits[0].afterData as Record<string,unknown>)?.paidAt!==batch.paidAt.toISOString()) return missing();
    const awards=await tx.bonusAward.findMany({where:{bonusAwardId:{in:entries.map(e=>e.sourceId)},recipientQualificationId:q.qualificationId,createdAt:{lte:cutoff}}});
    if(awards.length!==entries.length || awards.some(a=>!sha(a.parameterSnapshotHash))
      || new Set(awards.map(a=>a.ruleVersionCode+':'+a.parameterSnapshotHash)).size!==1
      || entries.some(e=>e.ruleVersionCode!==awards[0].ruleVersionCode)) return missing();
    // Read stored net; never subtract Recovery or reapply award rates here.
    return envelope(q,{amount:line.netAmount.toString(),status:'PAID'},awards[0].ruleVersionCode,awards[0].parameterSnapshotHash!,audits[0].occurredAt,batch.paidAt,
      [{type:'PayoutLine',id:line.payoutLineId,revision:line.createdAt.toISOString()},{type:'AuditEvent',id:audits[0].auditEventId,revision:audits[0].occurredAt.toISOString()}],'PAID');
  }
  if(tool==='explainReturnImpact') {
    const row=await tx.returnCase.findUnique({where:{returnCaseId:q.resourceId!},include:{order:true}});
    if(!row || row.order.qualificationId!==q.qualificationId || row.status!=='POSTED' || !row.postedAt
      || row.postedAt>cutoff || !visible(row.occurredAt,row.createdAt,q) || !sha(row.order.parameterSnapshotHash)) return missing();
    const audits=await tx.auditEvent.findMany({where:{entityType:'RETURN_CASE',entityId:row.returnCaseId,action:'RETURN_POSTED',occurredAt:{lte:cutoff}},take:2});
    if(audits.length!==1) return missing();
    const data=audits[0].afterData as Record<string,unknown>;
    if(data?.orderId!==row.orderId || typeof data.totalReturn!=='string' || !/^(0|[1-9]\d{0,17})(\.\d{1,8})?$/.test(data.totalReturn)) return invalid();
    // Posting is independently provable. Mutable recalculation-request status cannot prove historical Replay completion.
    return {...envelope(q,{postedAmount:data.totalReturn,replayStatus:'UNAVAILABLE'},row.order.ruleVersionCode,row.order.parameterSnapshotHash,
      audits[0].occurredAt,row.occurredAt,[{type:'ReturnCase',id:row.returnCaseId,revision:row.createdAt.toISOString()},
      {type:'AuditEvent',id:audits[0].auditEventId,revision:audits[0].occurredAt.toISOString()}]),quality:'PARTIAL'};
  }
  // Payout/return histories need a source adapter proving their original parameter and lifecycle revision.
  // A current mutable status is never used to answer an arbitrary as-of query.
  return missing();
}
