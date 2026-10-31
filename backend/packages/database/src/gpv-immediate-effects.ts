import {Prisma} from '@prisma/client';
import {OpportunityCandidate, equalizationRequirement, opportunityReasons, recordBonusOpportunities} from './bonus-opportunity';
import {captureParameters, pending, snapshotDecimal} from './parameter-snapshot';
import {
  captureHistoricalGraph,
  historicalRecipientState,
  historicalSponsorAncestors,
  replayHash,
  storeReplaySnapshot,
} from './historical-replay';

function referralMatchingUnlockDepth(plan:string,directs:number){
  if(plan==='STARTER') return directs>=2?4:(directs>=1?3:0);
  if(plan==='ELITE') return directs>=4?6:(directs===3?5:(directs===2?4:(directs===1?3:0)));
  if(plan==='LEADER') return directs>=4?7:(directs===3?5:(directs===2?4:(directs===1?3:0)));
  return 0;
}

/**
 * Materializes the non-final effects of an authoritative GPV fact. The caller
 * owns the SERIALIZABLE transaction, so the fact, snapshot, theories and
 * Binary propagation either all commit or all roll back.
 */
export async function applyGpvImmediateEffects(tx:Prisma.TransactionClient,event:any,monthlyBasis?:{orderId:string;prepaidAmount:string;retainedRatio:string},preplacementReturnedGpv?:string){
  if(event.pvType!=='GPV'||event.eventType!=='GPV_CREATED') throw new Error('GPV_CREATED_REQUIRED');
  const parameters=await captureParameters(tx,event.occurredAt,event.ruleVersionCode);
  const evidence:any=await captureHistoricalGraph(tx,event.qualificationId,event.occurredAt);
  const snapshot=await storeReplaySnapshot(tx,{
    format:'UCELL_HISTORICAL_REPLAY_V1',kind:'GPV',sourceId:event.eventId,
    ruleVersionCode:event.ruleVersionCode,at:event.occurredAt.toISOString(),parameters,recipients:[],evidence,
    inputs:{eventId:event.eventId,qualificationId:event.qualificationId,
      orderId:monthlyBasis?.orderId??(event.sourceType==='ORDER'?event.sourceId:null),lineId:event.sourceLineId,volume:event.amount.toString(),...(monthlyBasis?{monthlyRefundBasis:monthlyBasis}:{}),...(preplacementReturnedGpv?{preplacementReturnedGpv}:{})}
  });

  const sponsorPath=historicalSponsorAncestors(evidence,event.qualificationId,7);
  const sponsorPathHash=replayHash(sponsorPath);
  const g1=sponsorPath.find(a=>a.generation===1);
  let g1Theory=new Prisma.Decimal(0);
  if(g1){
    const state=historicalRecipientState(evidence,g1.qualification_id);
    const rate=snapshotDecimal(parameters,'referral.g1.rate',state.plan);
    g1Theory=state.active?event.amount.mul(rate):new Prisma.Decimal(0);
    await tx.theoryCalculationEvidence.upsert({
      where:{theoryKind_sourceVolumeEventId_recipientQualificationId_fixedGenerationNo:{
        theoryKind:'REFERRAL',sourceVolumeEventId:event.eventId,
        recipientQualificationId:g1.qualification_id,fixedGenerationNo:1}},update:{},create:{
        theoryKind:'REFERRAL',sourceVolumeEventId:event.eventId,sourceQualificationId:event.qualificationId,
        recipientQualificationId:g1.qualification_id,fixedGenerationNo:1,baseAmount:event.amount,
        rateSnapshot:rate,theoryAmount:g1Theory,activeSnapshot:state.active,unlockEligibleSnapshot:true,
        reasonCode:state.active?'ELIGIBLE':'HISTORICAL_INACTIVE',historicalSponsorPathHash:sponsorPathHash,
        ruleVersionCode:event.ruleVersionCode,parameterSnapshotHash:parameters.hash,occurredAt:event.occurredAt,
        idempotencyKey:`gpv:${event.eventId}:referral:g1`
      }});
  }

  // Fixed Sponsor generations are recorded even when Active or unlock fails.
  // A zero row is evidence that the generation was evaluated without compression.
  for(const ancestor of sponsorPath.filter(a=>a.generation>=2)){
    const state=historicalRecipientState(evidence,ancestor.qualification_id);
    const unlockDepth=referralMatchingUnlockDepth(state.plan,state.directs);
    const unlocked=ancestor.generation<=unlockDepth;
    const maximum=({STARTER:4,ELITE:6,LEADER:7} as Record<string,number>)[state.plan]??0;
    const rate=ancestor.generation>maximum?new Prisma.Decimal(0):snapshotDecimal(parameters,'equalization.rate',`${state.plan}:G${ancestor.generation}`);
    const theory=state.active&&unlocked?g1Theory.mul(rate):new Prisma.Decimal(0);
    await tx.theoryCalculationEvidence.upsert({
      where:{theoryKind_sourceVolumeEventId_recipientQualificationId_fixedGenerationNo:{
        theoryKind:'REFERRAL_MATCHING',sourceVolumeEventId:event.eventId,
        recipientQualificationId:ancestor.qualification_id,fixedGenerationNo:ancestor.generation}},update:{},create:{
        theoryKind:'REFERRAL_MATCHING',sourceVolumeEventId:event.eventId,sourceQualificationId:event.qualificationId,
        recipientQualificationId:ancestor.qualification_id,fixedGenerationNo:ancestor.generation,baseAmount:g1Theory,
        rateSnapshot:rate,theoryAmount:theory,activeSnapshot:state.active,unlockEligibleSnapshot:unlocked,
        reasonCode:!state.active?'HISTORICAL_INACTIVE':(!unlocked?'FIXED_GENERATION_LOCKED':(g1Theory.eq(0)?'G1_REFERRAL_THEORY_ZERO':'ELIGIBLE')),
        historicalSponsorPathHash:sponsorPathHash,ruleVersionCode:event.ruleVersionCode,
        parameterSnapshotHash:parameters.hash,occurredAt:event.occurredAt,
        idempotencyKey:`gpv:${event.eventId}:referral-matching:g${ancestor.generation}`
      }});
  }

  const binaryPath:Array<{childQualificationId:string;parentQualificationId:string;side:string}>=[];
  let child=event.qualificationId;
  const seen=new Set([child]);
  for(let generation=1;generation<=evidence.binary.length;generation++){
    const edges=evidence.binary.filter((edge:any)=>edge.childQualificationId===child);
    if(edges.length>1) pending('HISTORICAL_SNAPSHOT_CORRUPT','Overlapping original Binary parents');
    if(!edges.length) break;
    const edge=edges[0],ancestor=edge.parentQualificationId;
    if(!ancestor||seen.has(ancestor)) pending('HISTORICAL_SNAPSHOT_CORRUPT','Original Binary path is invalid or cyclic');
    // Requiring recipient evidence prevents propagation through a partial snapshot.
    historicalRecipientState(evidence,ancestor);
    binaryPath.push({childQualificationId:child,parentQualificationId:ancestor,side:edge.side});
    await tx.binaryVolumeLedger.upsert({
      where:{sourceVolumeEventId_ancestorQualificationId_binaryGenerationNo:{
        sourceVolumeEventId:event.eventId,ancestorQualificationId:ancestor,binaryGenerationNo:generation}},update:{},create:{
        sourceVolumeEventId:event.eventId,sourceQualificationId:event.qualificationId,
        ancestorQualificationId:ancestor,binaryGenerationNo:generation,side:edge.side,amount:event.amount,
        occurredAt:event.occurredAt,qualificationScopeHash:replayHash({source:event.qualificationId,ancestor}),
        historicalBinaryPathHash:replayHash(binaryPath),ruleVersionCode:event.ruleVersionCode,
        idempotencyKey:`gpv:${event.eventId}:binary:${ancestor}:g${generation}`
      }});
    seen.add(ancestor);child=ancestor;
  }
  // Opportunity evidence uses the source's immutable graph and does not alter
  // existing theory rows. G1 entitlement does not suppress other generations.
  const opportunities:OpportunityCandidate[]=[];
  if(g1){
    const first=historicalRecipientState(evidence,g1.qualification_id);
    const base=event.amount.mul(snapshotDecimal(parameters,'referral.g1.rate',first.plan));
    if(!first.active)opportunities.push({recipientQualificationId:g1.qualification_id,sourceKey:event.eventId,awardType:'REFERRAL',generation:1,theoreticalAmount:base,occurredAt:event.occurredAt,reasons:opportunityReasons(false,first.plan,first.plan,0,0),parameterSnapshotHash:parameters.hash,detail:{sourceGpv:event.amount.toString()}});
    for(const ancestor of sponsorPath.filter(a=>a.generation>=2)){
      const state=historicalRecipientState(evidence,ancestor.qualification_id);
      const required=equalizationRequirement(state.plan,ancestor.generation);
      const reasons=opportunityReasons(state.active,state.plan,required.requiredPlan,state.directs,required.requiredDirects);
      if(!reasons.length)continue;
      const rate=snapshotDecimal(parameters,'equalization.rate',`${required.requiredPlan}:G${ancestor.generation}`);
      opportunities.push({recipientQualificationId:ancestor.qualification_id,sourceKey:event.eventId,awardType:'EQUALIZATION',generation:ancestor.generation,theoreticalAmount:base.mul(rate),occurredAt:event.occurredAt,reasons,parameterSnapshotHash:parameters.hash,detail:{baseG1ReferralTheory:base.toString(),rate:rate.toString()}});
    }
  }
  await recordBonusOpportunities(tx,{settlementBatchId:null,sourceEventId:event.eventId,ruleVersionCode:event.ruleVersionCode},opportunities,new Prisma.Decimal(0),new Prisma.Decimal(0),[]);
  return snapshot;
}
