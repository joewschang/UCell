import { Prisma, PvLedger } from '@prisma/client';
import { pending, verifyReplayEnvelope } from '@ucell/database';
import { createHash } from 'node:crypto';
import {orderReplayPostingEvidence} from './order-replay-posting-evidence';

// References join this projection without exposing internal UUIDs or identities.
const reference = (kind:string,id:string) => `${kind}:${createHash('sha256').update(`${kind}:${id}`).digest('hex')}`;

function amount(value:unknown):string{
  if(typeof value!=='string'||!/^[-+]?\d+(\.\d+)?$/.test(value))pending('HISTORICAL_SNAPSHOT_CORRUPT','Stored economic amount is invalid');
  return new Prisma.Decimal(value).toString();
}
function carryChanges(value:Prisma.JsonValue){
  if(!value||typeof value!=='object'||Array.isArray(value))pending('HISTORICAL_SNAPSHOT_CORRUPT','Stored carry evidence is invalid');
  return Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([qid,entry])=>{
    const row=entry as any;
    return {recipientReference:reference('ECONOMIC_RECIPIENT',qid),original:{left:amount(row?.original?.left),right:amount(row?.original?.right)},recomputed:{left:amount(row?.recomputed?.left),right:amount(row?.recomputed?.right)}};
  });
}
function awardChanges(value:Prisma.JsonValue){
  const snapshot=value as any;
  return (['binary','matching'] as const).flatMap(kind=>{
    if(!Array.isArray(snapshot?.[kind]))pending('HISTORICAL_SNAPSHOT_CORRUPT','Stored award checkpoint is invalid');
    return snapshot[kind].map((row:any)=>{
      if(typeof row?.entitlementKey!=='string'||typeof row?.qualificationId!=='string')pending('HISTORICAL_SNAPSHOT_CORRUPT','Stored award checkpoint recipient is invalid');
      return {kind,entitlementReference:reference('CHECKPOINT_ENTITLEMENT',row.entitlementKey),recipientReference:reference('ECONOMIC_RECIPIENT',row.qualificationId),original:amount(row.original),recomputed:amount(row.recomputed)};
    }).sort((a:any,b:any)=>a.entitlementReference.localeCompare(b.entitlementReference));
  });
}

/** A return run can reach periods that do not contain the original order PV. */
async function returnReplayEvidence(tx:Prisma.TransactionClient,returnIds:string[]){
  if(!returnIds.length)return [];
  const runs=await tx.settlementReplayRun.findMany({where:{sourceReturnCaseId:{in:returnIds}},include:{periods:{orderBy:[{periodNo:'asc'},{settlementReplayPeriodId:'asc'}]}},orderBy:[{createdAt:'asc'},{settlementReplayRunId:'asc'}]});
  return Promise.all(runs.map(async run=>({reference:reference('REPLAY_RUN',run.settlementReplayRunId),returnReference:reference('RETURN',run.sourceReturnCaseId),
    recordedEffects:await orderReplayPostingEvidence(tx,run,run.periods),
    status:run.status,ruleVersionCode:run.ruleVersionCode,processedWeeks:run.processedWeeks,maxWeeks:run.maxWeeks,convergedAt:run.convergedAt?.toISOString()??null,
    evidenceType:'CALCULATION_CHECKPOINT_NOT_PAYMENT',
    periods:run.periods.map(period=>({reference:reference('REPLAY_PERIOD',period.settlementReplayPeriodId),periodNo:period.periodNo,periodStart:period.periodStart.toISOString(),periodEnd:period.periodEnd.toISOString(),
      originalK1:period.originalK1.toString(),recomputedK1:period.recomputedK1.toString(),originalK2:period.originalK2?.toString()??null,recomputedK2:period.recomputedK2?.toString()??null,
      carryChanges:carryChanges(period.carryDeltaSnapshot),awardChanges:awardChanges(period.awardDeltaSnapshot)})),
  })));
}

/** Membership in a sealed period input cohort does not allocate its awards. */
async function periodContributions(tx:Prisma.TransactionClient,orderId:string,pv:PvLedger[]){
  const originals=pv.filter(row=>row.pvType==='GPV'&&row.eventType==='GPV_CREATED');
  if(!originals.length)return [];
  const snapshots=await tx.historicalReplaySnapshot.findMany({
    where:{kind:{in:['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL']},OR:originals.map(row=>({
      content:{path:['evidence','sources'],array_contains:[{kind:'GPV',sourceId:row.eventId}]},
    }))},include:{postings:{orderBy:{sequence:'asc'}}},orderBy:[{createdAt:'asc'},{snapshotId:'asc'}],
  });
  return snapshots.map(row=>{
    const envelope=verifyReplayEnvelope(row);
    const start=new Date(envelope.inputs.periodStart),end=new Date(envelope.inputs.periodEnd);
    if(envelope.kind!==row.kind||envelope.sourceId!==row.sourceId||!Number.isFinite(start.getTime())||!Number.isFinite(end.getTime())||start>=end||!Array.isArray(envelope.evidence.sources))
      pending('HISTORICAL_SNAPSHOT_CORRUPT','Period source identity or interval is invalid');
    const sources: Array<{sourcePvReference:string;originalGpv:string}>=[];
    for(const event of originals){
      const matches=envelope.evidence.sources.filter((source:any)=>source.sourceId===event.eventId);
      if(!matches.length)continue;
      const source=matches[0];
      if(matches.length!==1||source.kind!=='GPV'||source.inputs?.eventId!==event.eventId||source.inputs?.orderId!==orderId||source.ruleVersionCode!==event.ruleVersionCode||row.ruleVersionCode!==event.ruleVersionCode||source.at!==event.occurredAt.toISOString()||source.inputs?.volume!==event.amount.toString()||event.occurredAt<start||event.occurredAt>=end)
        pending('HISTORICAL_SNAPSHOT_CORRUPT','Period source does not match its original order PV evidence');
      sources.push({sourcePvReference:reference('PV',event.eventId),originalGpv:event.amount.toString()});
    }
    const recipientKeys=new Set<string>();
    const recipients=envelope.recipients.map(recipient=>{
      if(!recipient.key||!recipient.qualificationId||recipientKeys.has(recipient.key)||!['REFERRAL','EQUALIZATION','BINARY','MATCHING','EPV','RPV','GLOBAL'].includes(recipient.awardType))pending('HISTORICAL_SNAPSHOT_CORRUPT','Stored period recipient is invalid');
      recipientKeys.add(recipient.key);
      return {reference:reference('PERIOD_ENTITLEMENT',`${row.snapshotId}:${recipient.key}`),recipientReference:reference('ECONOMIC_RECIPIENT',recipient.qualificationId),awardReference:reference(recipient.awardType==='GLOBAL'?'GLOBAL_AWARD':'AWARD',recipient.awardId),awardType:recipient.awardType,active:recipient.active,eligible:recipient.eligible,theoryAmount:amount(recipient.theory),originallyPosted:amount(recipient.posted)};
    }).sort((a,b)=>a.reference.localeCompare(b.reference));
    const corrections=row.postings.map(posting=>{
      const recipient=envelope.recipients.find(item=>item.key===posting.entitlementKey);
      if(!recipient||recipient.qualificationId!==posting.recipientQualificationId||!posting.originallyPosted.eq(recipient.posted))pending('HISTORICAL_SNAPSHOT_CORRUPT','Replay posting conflicts with its sealed recipient');
      return {reference:reference('REPLAY_POSTING',posting.postingId),entitlementReference:reference('PERIOD_ENTITLEMENT',`${row.snapshotId}:${posting.entitlementKey}`),originallyPosted:posting.originallyPosted.toString(),recalculatedEntitlement:posting.recalculatedEntitlement.toString(),delta:posting.delta.toString(),stateHash:posting.stateHash};
    });
    return {reference:reference('REPLAY_SNAPSHOT',row.snapshotId),settlementReference:reference('SETTLEMENT',row.sourceId),
      kind:row.kind,periodStart:start.toISOString(),periodEnd:end.toISOString(),ruleVersionCode:row.ruleVersionCode,snapshotHash:row.hash,
      attribution:'SEALED_PERIOD_INPUT_ONLY',orderOriginalGpv:sources.reduce((sum,source)=>sum.add(source.originalGpv),new Prisma.Decimal(0)).toString(),sources,
      periodContext:{attribution:'WHOLE_PERIOD_NOT_ORDER_ALLOCATION',recipients,corrections}};
  });
}

/** Only explicit order/PV/award/return edges establish attribution. Period totals
 * and other awards belonging to the same recipient are deliberately excluded. */
export async function orderEconomicEvidence(tx:Prisma.TransactionClient,orderId:string,returnIds:string[]){
  const pv=await tx.pvLedger.findMany({where:{sourceType:'ORDER',sourceId:orderId},orderBy:[{occurredAt:'asc'},{eventId:'asc'}]});
  const direct=await tx.bonusAward.findMany({where:{sourceEventId:{in:pv.map(row=>row.eventId)}},orderBy:[{occurredAt:'asc'},{bonusAwardId:'asc'}]});
  const awards=new Map(direct.map(row=>[row.bonusAwardId,row]));
  let frontier=direct.map(row=>row.bonusAwardId);
  // Traverse sourceAward edges, including matching and correction awards. The
  // visited map makes malformed cycles safe; transaction timeout bounds work.
  while(frontier.length){
    const children=await tx.bonusAward.findMany({where:{sourceAwardId:{in:frontier}},orderBy:[{occurredAt:'asc'},{bonusAwardId:'asc'}]});
    frontier=[];
    for(const row of children) if(!awards.has(row.bonusAwardId)){awards.set(row.bonusAwardId,row);frontier.push(row.bonusAwardId);}
  }
  const ids=[...awards.keys()];
  const payables=await tx.payableEntry.findMany({where:{sourceType:'BONUS_AWARD',sourceId:{in:ids}},include:{payoutLine:{include:{payoutBatch:true}}},orderBy:[{createdAt:'asc'},{payableEntryId:'asc'}]});
  const recoveries=await tx.bonusRecoveryEvent.findMany({where:{OR:[{bonusAwardId:{in:ids}},{returnCaseId:{in:returnIds}}]},orderBy:[{occurredAt:'asc'},{bonusRecoveryEventId:'asc'}]});
  const subscriptions=await tx.subscription.findMany({where:{orderId},include:{plan:true,schedules:{orderBy:{installmentNo:'asc'}}},orderBy:{createdAt:'asc'}});
  const recognitions=[] as Array<Record<string,unknown>>;
  const rpvAwardIds:string[]=[];
  for(const subscription of subscriptions){
    for(const schedule of subscription.schedules){
      const [rpvEvent,rpvAwards,snapshot]=await Promise.all([
        tx.pvLedger.findFirst({where:{pvType:'RPV',sourceType:'SUBSCRIPTION',sourceId:subscription.subscriptionId,sourceLineId:schedule.recognitionId},orderBy:{occurredAt:'asc'}}),
        tx.rpvUplineAwardEvent.findMany({where:{recognitionId:schedule.recognitionId},orderBy:[{binaryGeneration:'asc'},{rpvAwardEventId:'asc'}]}),
        tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'RPV',sourceId:schedule.recognitionId}},include:{postings:{orderBy:{sequence:'asc'}}}}),
      ]);
      recognitions.push({
        reference:reference('RECOGNITION',schedule.recognitionId),
        planCode:subscription.plan.planCode,installmentNo:schedule.installmentNo,status:schedule.status,
        recognitionMonth:schedule.recognitionMonth.toISOString(),recognizedAt:schedule.recognizedAt?.toISOString()??null,
        recognizedAmount:schedule.recognizedAmount.toString(),rpvAmount:schedule.rpvAmount.toString(),
        ruleVersionCode:schedule.ruleVersionCode,parameterSnapshotHash:schedule.parameterSnapshotHash??null,
        pvEvent:rpvEvent?{reference:reference('PV',rpvEvent.eventId),eventType:rpvEvent.eventType,amount:rpvEvent.amount.toString(),occurredAt:rpvEvent.occurredAt.toISOString()}:null,
        awards:rpvAwards.map(row=>({reference:reference('RPV_AWARD',row.rpvAwardEventId),generation:row.binaryGeneration,activeAtRecognition:row.activeSnapshot,theoryAmount:row.theoryAmount.toString(),payableAmount:row.payableAmount.toString(),ruleVersionCode:row.ruleVersionCode,parameterSnapshotHash:row.parameterSnapshotHash??null})),
        replay:snapshot?{reference:reference('REPLAY_SNAPSHOT',snapshot.snapshotId),hash:snapshot.hash,ruleVersionCode:snapshot.ruleVersionCode,corrections:snapshot.postings.map(row=>({reference:reference('REPLAY_POSTING',row.postingId),originallyPosted:row.originallyPosted.toString(),recalculatedEntitlement:row.recalculatedEntitlement.toString(),delta:row.delta.toString(),stateHash:row.stateHash}))}:null,
      });
      rpvAwardIds.push(...rpvAwards.map(row=>row.rpvAwardEventId));
    }
  }
  const destinations=await tx.awardEconomicDestination.findMany({
    where:{OR:[{sourceBonusAwardId:{in:ids}},{sourceRpvAwardId:{in:rpvAwardIds}}]},
    include:{effects:{orderBy:[{recordedAt:'asc'},{effectId:'asc'}]}},
    orderBy:[{effectiveAt:'asc'},{destinationId:'asc'}],
  });
  return {
    scope:'ORDER_PV_AWARD_RETURN_SUBSCRIPTION_RPV_REPLAY_RESERVOIR_B_AND_PERIOD_INPUTS',
    periodContributions:await periodContributions(tx,orderId,pv),
    returnReplays:await returnReplayEvidence(tx,returnIds),
    pvEvents:pv.map(row=>({reference:reference('PV',row.eventId),pvType:row.pvType,eventType:row.eventType,amount:row.amount.toString(),occurredAt:row.occurredAt.toISOString()})),
    awards:[...awards.values()].sort((a,b)=>a.occurredAt.getTime()-b.occurredAt.getTime()||a.bonusAwardId.localeCompare(b.bonusAwardId)).map(row=>({reference:reference('AWARD',row.bonusAwardId),sourcePvReference:row.sourceEventId&&pv.some(p=>p.eventId===row.sourceEventId)?reference('PV',row.sourceEventId):null,sourceAwardReference:row.sourceAwardId&&awards.has(row.sourceAwardId)?reference('AWARD',row.sourceAwardId):null,awardType:row.awardType,theoryAmount:row.theoryAmount.toString(),payableAmount:row.payableAmount.toString(),occurredAt:row.occurredAt.toISOString(),ruleVersionCode:row.ruleVersionCode,parameterSnapshotHash:row.parameterSnapshotHash})),
    payables:payables.map(row=>({reference:reference('PAYABLE',row.payableEntryId),awardReference:reference('AWARD',row.sourceId),grossAmount:row.grossAmount.toString(),status:row.status,availableAt:row.availableAt.toISOString(),payout:row.payoutLine?{status:row.payoutLine.payoutBatch.status,periodStart:row.payoutLine.payoutBatch.periodStart.toISOString(),periodEnd:row.payoutLine.payoutBatch.periodEnd.toISOString()}:null})),
    recoveries:recoveries.map(row=>({reference:reference('RECOVERY',row.bonusRecoveryEventId),awardReference:reference('AWARD',row.bonusAwardId),awardIncluded:awards.has(row.bonusAwardId),linkedToOrderReturn:row.returnCaseId!==null&&returnIds.includes(row.returnCaseId),recoveryAmount:row.recoveryAmount.toString(),recoveredAmount:row.recoveredAmount.toString(),outstandingAmount:row.outstandingAmount.toString(),status:row.status,reasonCode:row.reasonCode,occurredAt:row.occurredAt.toISOString()})),
    subscriptionRecognitions:recognitions,
    reservoirBDestinations:destinations.map(row=>({
      reference:reference('ECONOMIC_DESTINATION',row.destinationId),
      sourceKind:row.sourceBonusAwardId?'BONUS_AWARD':'RPV_AWARD',
      sourceReference:row.sourceBonusAwardId?reference('AWARD',row.sourceBonusAwardId):reference('RPV_AWARD',row.sourceRpvAwardId!),
      destination:row.destination,awardType:row.awardType,companyPosition:row.companyPosition,
      periodStart:row.periodStart.toISOString(),periodEnd:row.periodEnd.toISOString(),finalAmount:row.finalAmount.toString(),
      ruleVersion:row.ruleVersion,parameterVersion:row.parameterVersion,snapshotHash:row.snapshotHash,effectiveAt:row.effectiveAt.toISOString(),
      effects:row.effects.map(effect=>({reference:reference('RESERVOIR_B_EFFECT',effect.effectId),effectType:effect.effectType,amountDelta:effect.amountDelta.toString(),effectiveAt:effect.effectiveAt.toISOString(),recordedAt:effect.recordedAt.toISOString()})),
    })),
  };
}
