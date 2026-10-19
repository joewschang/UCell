import {Prisma} from '@prisma/client';
import {effectiveGpv,verifyReplayEnvelope,ReplayEnvelope} from './historical-replay';
import {packageMonthlyPlan,approvedRepurchaseTiming} from './package-monthly-plan';

/** Only already recognized monthly cash may satisfy the EPV threshold.
 * Package cash never contributes to excess volume itself. */
export async function packageEpvBaseCredit(tx:Prisma.TransactionClient,qid:string,at:Date,start:Date,end:Date,base:Prisma.Decimal){
 const purchases=await tx.packagePurchaseSnapshot.findMany({where:{targetQualificationId:qid,packageClass:'ACTIVE_DURATION'}});
 for(const purchase of purchases){
  const order=await tx.order.findUniqueOrThrow({where:{orderId:purchase.orderId}});
  if(!order.paidAt||order.paidAt>at||order.status==='RETURNED')continue;
  const plan=packageMonthlyPlan({packageCode:purchase.packageCode,priceAmount:purchase.priceAmount,boxCount:purchase.selectableProductQuantity,paidAt:order.paidAt,timing:approvedRepurchaseTiming});
  const due=plan.installments.find(row=>row.dueAt>=start&&row.dueAt<end&&row.dueAt<=at);
  if(!due)continue;
  const schedules=await tx.monthlyRecognitionSchedule.findMany({where:{subscription:{orderId:order.orderId},installmentNo:due.installmentNo}});
  if(schedules.length!==1||!['RECOGNIZED','REVERSED','CANCELLED'].includes(schedules[0].status))throw new Error('PACKAGE_MONTHLY_RECOGNITION_REQUIRED');
  if(await tx.outboxEvent.count({where:{eventType:'PACKAGE_MONTHLY_RETURN_REQUIRED',aggregateId:schedules[0].subscriptionId,processStatus:{not:'PROCESSED'}}}))throw new Error('PACKAGE_MONTHLY_RETURN_REPLAY_REQUIRED');
 }
 const events=await tx.pvLedger.findMany({where:{qualificationId:qid,sourceType:'PACKAGE_MONTHLY',pvType:'GPV',eventType:'GPV_CREATED',occurredAt:{gte:start,lt:end,lte:at}},orderBy:{eventId:'asc'}});
 const sources:ReplayEnvelope[]=[];
 for(const event of events)sources.push(verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'GPV',sourceId:event.eventId}}})));
 const effective=await effectiveGpv(tx,sources);
 return {credit:Prisma.Decimal.min(base,[...effective.values()].reduce((sum,value)=>sum.add(value.div('0.6')),new Prisma.Decimal(0))),sources};
}
