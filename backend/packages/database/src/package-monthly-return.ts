import {Prisma} from '@prisma/client';
import {approvedRepurchaseTiming,packageMonthlyPlan} from './package-monthly-plan';

/** Prepares refund facts in the caller's SERIALIZABLE transaction.
 * This deliberately does not acknowledge RETURN_CONFIRMED or post awards.
 * GPV/RPV and award replay must finish before the return is settled.
 */
export async function preparePackageMonthlyReturn(tx:Prisma.TransactionClient,returnCaseId:string){
 const ret=await tx.returnCase.findUniqueOrThrow({where:{returnCaseId},include:{lines:true}});
 await tx.$queryRaw`SELECT order_id FROM commerce."order" WHERE order_id=${ret.orderId}::uuid FOR UPDATE`;
 const order=await tx.order.findUniqueOrThrow({where:{orderId:ret.orderId},include:{lines:true}});
 const purchase=await tx.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId:ret.orderId}});
 if(ret.status!=='POSTED'||!order.paidAt||ret.occurredAt<order.paidAt||purchase.packageClass!=='ACTIVE_DURATION'||purchase.recognitionConfigRef!=='PO_20261019_REPURCHASE_60'||purchase.currency!=='TWD'||!order.netAmount.eq(purchase.priceAmount))throw new Error('PACKAGE_MONTHLY_RETURN_SOURCE_INVALID');
 const subscriptions=await tx.subscription.findMany({where:{orderId:order.orderId}});
 if(subscriptions.length!==1)throw new Error('PACKAGE_SUBSCRIPTION_REQUIRED');
 const subscriptionId=subscriptions[0].subscriptionId;
 await tx.$queryRaw`SELECT subscription_id FROM subscription.subscription WHERE subscription_id=${subscriptionId}::uuid FOR UPDATE`;
 const sub=await tx.subscription.findUniqueOrThrow({where:{subscriptionId},include:{schedules:true}});
 if(sub.qualificationId!==order.qualificationId)throw new Error('PACKAGE_SUBSCRIPTION_EVIDENCE_CONFLICT');
 const facts=await tx.returnCase.findMany({where:{orderId:order.orderId,status:'POSTED'},include:{lines:true},orderBy:[{postedAt:'asc'},{returnCaseId:'asc'}]});
 const quantities=new Map<string,Prisma.Decimal>();
 let returnedBoxes=0;
 for(const fact of facts)for(const line of fact.lines){
  const original=order.lines.find(row=>row.orderLineId===line.orderLineId);
  if(!original||!line.quantity.isInteger()||line.quantity.lte(0)||!line.returnAmount.eq(line.quantity.mul(3000)))throw new Error('PACKAGE_RETURN_ALLOCATION_CONFLICT');
  const total=(quantities.get(line.orderLineId)??new Prisma.Decimal(0)).add(line.quantity);
  if(total.gt(original.quantity))throw new Error('PACKAGE_RETURN_QUANTITY_INVALID');
  quantities.set(line.orderLineId,total);returnedBoxes+=line.quantity.toNumber();
 }
 const plan=packageMonthlyPlan({packageCode:purchase.packageCode,priceAmount:purchase.priceAmount,boxCount:purchase.selectableProductQuantity,paidAt:order.paidAt,timing:approvedRepurchaseTiming,returnedBoxes});
 if(sub.schedules.length!==plan.months||sub.schedules.some(row=>row.dueAt.getTime()!==plan.installments[row.installmentNo-1]?.dueAt.getTime()))throw new Error('PACKAGE_SUBSCRIPTION_EVIDENCE_CONFLICT');
 const ratio=new Prisma.Decimal(purchase.selectableProductQuantity-returnedBoxes).div(purchase.selectableProductQuantity);
 const prepared=await tx.subscriptionCancellation.findUnique({where:{sourceReturnCaseId:returnCaseId}});
 if(prepared){
  if(prepared.subscriptionId!==subscriptionId)throw new Error('PACKAGE_RETURN_SOURCE_CONFLICT');
  return {cancellation:prepared,created:false,returnedBoxes};
 }
 const refund=ret.lines.reduce((total,line)=>total.add(line.returnAmount),new Prisma.Decimal(0));
 if(refund.lte(0))throw new Error('PACKAGE_RETURN_ALLOCATION_CONFLICT');
 // Each fact carries only its own cash amount. A later full return must not
 // silently reverse the earlier partial return a second time.
 const cancellation=await tx.subscriptionCancellation.create({data:{subscriptionId,requestedAt:new Date(),effectiveAt:ret.occurredAt,reasonCode:'PACKAGE_BOX_RETURN',refundAmount:refund,sourceReturnCaseId:returnCaseId,idempotencyKey:'package-return:'+returnCaseId,correlationId:ret.correlationId,status:'POSTED'}});
 for(const row of sub.schedules){
  // Include overdue but unprocessed installments: dueAt is not evidence that
  // an installment has actually posted. Original recognized rows stay intact.
  if(!['SCHEDULED','DUE'].includes(row.status))continue;
  const target=plan.installments[row.installmentNo-1];
  await tx.monthlyRecognitionSchedule.update({where:{recognitionId:row.recognitionId},data:{recognizedAmount:target.cash,rpvAmount:target.rpv,retainedEntitlementRatio:ratio,...(ratio.eq(0)?{status:'CANCELLED' as const}:{})}});
 }
 if(ratio.eq(0))await tx.subscription.update({where:{subscriptionId},data:{status:'CANCELLED',cancelledAt:ret.occurredAt}});
 await tx.outboxEvent.create({data:{eventType:'PACKAGE_MONTHLY_RETURN_REQUIRED',aggregateType:'SUBSCRIPTION',aggregateId:subscriptionId,correlationId:ret.correlationId,payload:{returnCaseId,subscriptionCancellationId:cancellation.subscriptionCancellationId,subscriptionId,returnedBoxes,retainedRatio:ratio.toString()}}});
 return {cancellation,created:true,returnedBoxes};
}
