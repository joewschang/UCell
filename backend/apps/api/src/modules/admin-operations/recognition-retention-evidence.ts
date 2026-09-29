import {Prisma,PvLedger,EntitlementReplayPosting} from '@prisma/client';
import {pending} from '@ucell/database';
import {createHash} from 'node:crypto';
const ref=(kind:string,id:string)=>`${kind}:${createHash('sha256').update(`${kind}:${id}`).digest('hex')}`;

/** Report persisted deltas only: pending returns do not imply a completed replay. */
export async function recognitionRetentionEvidence(tx:Prisma.TransactionClient,event:PvLedger,postings:EntitlementReplayPosting[]){
  const adjustments=await tx.pvLedger.findMany({where:{reversalOfEventId:event.eventId},orderBy:[{occurredAt:'asc'},{eventId:'asc'}]});
  if(adjustments.some(row=>row.pvType!==event.pvType||row.qualificationId!==event.qualificationId||row.ruleVersionCode!==event.ruleVersionCode||row.eventType!==(event.pvType==='EPV'?'EPV_REPLAY_ADJUSTMENT':'RPV_REVERSAL')))
    pending('HISTORICAL_SNAPSHOT_CORRUPT','Recognition adjustment conflicts with its original PV');
  const delta=adjustments.reduce((sum,row)=>sum.add(row.amount),new Prisma.Decimal(0)),retained=event.amount.add(delta);
  if(retained.lt(0))pending('HISTORICAL_SNAPSHOT_CORRUPT','Recorded recognition balance is negative');
  const grouped=new Map<string,{original:Prisma.Decimal;delta:Prisma.Decimal;recipient:string;snapshot:string}>();
  for(const posting of postings){
    const key=`${posting.snapshotId}:${posting.entitlementKey}`;
    const value=grouped.get(key)??{original:posting.originallyPosted,delta:new Prisma.Decimal(0),recipient:posting.recipientQualificationId,snapshot:posting.snapshotId};
    if(!value.original.eq(posting.originallyPosted)||value.recipient!==posting.recipientQualificationId||!value.original.add(value.delta).add(posting.delta).eq(posting.recalculatedEntitlement))
      pending('HISTORICAL_SNAPSHOT_CORRUPT','Recognition entitlement delta chain is inconsistent');
    value.delta=value.delta.add(posting.delta);grouped.set(key,value);
  }
  return {basis:'RECORDED_PV_AND_ENTITLEMENT_STATE',sourcePvReference:ref('PV',event.eventId),originalVolume:event.amount.toString(),recordedDelta:delta.toString(),recordedRetainedVolume:retained.toString(),
    adjustments:adjustments.map(row=>({reference:ref('PV',row.eventId),amount:row.amount.toString(),occurredAt:row.occurredAt.toISOString()})),
    replayedEntitlements:[...grouped].sort(([a],[b])=>a.localeCompare(b)).map(([key,row])=>({reference:ref('PERIOD_ENTITLEMENT',key),snapshotReference:ref('REPLAY_SNAPSHOT',row.snapshot),originallyPosted:row.original.toString(),recordedDelta:row.delta.toString(),recordedEntitlement:row.original.add(row.delta).toString()}))};
}
