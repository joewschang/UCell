import { Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';

// References join this projection without exposing internal UUIDs or identities.
const reference = (kind:string,id:string) => `${kind}:${createHash('sha256').update(`${kind}:${id}`).digest('hex')}`;

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
  return {
    scope:'ORDER_PV_BONUS_AWARD_AND_RETURN_RECOVERY',
    pvEvents:pv.map(row=>({reference:reference('PV',row.eventId),pvType:row.pvType,eventType:row.eventType,amount:row.amount.toString(),occurredAt:row.occurredAt.toISOString()})),
    awards:[...awards.values()].sort((a,b)=>a.occurredAt.getTime()-b.occurredAt.getTime()||a.bonusAwardId.localeCompare(b.bonusAwardId)).map(row=>({reference:reference('AWARD',row.bonusAwardId),sourcePvReference:row.sourceEventId&&pv.some(p=>p.eventId===row.sourceEventId)?reference('PV',row.sourceEventId):null,sourceAwardReference:row.sourceAwardId&&awards.has(row.sourceAwardId)?reference('AWARD',row.sourceAwardId):null,awardType:row.awardType,theoryAmount:row.theoryAmount.toString(),payableAmount:row.payableAmount.toString(),occurredAt:row.occurredAt.toISOString(),ruleVersionCode:row.ruleVersionCode,parameterSnapshotHash:row.parameterSnapshotHash})),
    payables:payables.map(row=>({reference:reference('PAYABLE',row.payableEntryId),awardReference:reference('AWARD',row.sourceId),grossAmount:row.grossAmount.toString(),status:row.status,availableAt:row.availableAt.toISOString(),payout:row.payoutLine?{status:row.payoutLine.payoutBatch.status,periodStart:row.payoutLine.payoutBatch.periodStart.toISOString(),periodEnd:row.payoutLine.payoutBatch.periodEnd.toISOString()}:null})),
    recoveries:recoveries.map(row=>({reference:reference('RECOVERY',row.bonusRecoveryEventId),awardReference:reference('AWARD',row.bonusAwardId),awardIncluded:awards.has(row.bonusAwardId),linkedToOrderReturn:row.returnCaseId!==null&&returnIds.includes(row.returnCaseId),recoveryAmount:row.recoveryAmount.toString(),recoveredAmount:row.recoveredAmount.toString(),outstandingAmount:row.outstandingAmount.toString(),status:row.status,reasonCode:row.reasonCode,occurredAt:row.occurredAt.toISOString()})),
  };
}
