import {Prisma} from '@prisma/client';
import {captureParameters} from './parameter-snapshot';
import {taipeiMonth} from './recognition-active';
import {approvedRepurchaseTiming,approvedRepurchaseCalendarReference,approvedRepurchaseVolumeReference,packageMonthlyPlan} from './package-monthly-plan';

/** Caller owns a SERIALIZABLE transaction; this prepares facts, never posts volume. */
export async function preparePackageMonthlySchedule(tx:Prisma.TransactionClient,orderId:string,correlationId:string){
 await tx.$queryRaw`SELECT order_id FROM commerce."order" WHERE order_id=${orderId}::uuid FOR UPDATE`;
 const order=await tx.order.findUniqueOrThrow({where:{orderId}});
 const purchase=await tx.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId}});
 if(!order.paidAt||!order.qualificationId||!['PAID','FULFILLED','PARTIAL_RETURN'].includes(order.status)||purchase.packageClass!=='ACTIVE_DURATION'||purchase.recognitionConfigRef!=='PO_20261019_REPURCHASE_60'||purchase.currency!=='TWD'||!order.netAmount.eq(purchase.priceAmount))throw new Error('REPURCHASE_PAID_PACKAGE_REQUIRED');
 const specification=packageMonthlyPlan({packageCode:purchase.packageCode,priceAmount:purchase.priceAmount,boxCount:purchase.selectableProductQuantity,paidAt:order.paidAt,timing:approvedRepurchaseTiming});
 if(purchase.activeDurationUnit!=='MONTH'||purchase.activeDurationValue!==specification.months||purchase.targetQualificationId!==order.qualificationId)throw new Error('REPURCHASE_DURATION_OR_TARGET_CONFLICT');
 const existing=await tx.subscription.findMany({where:{orderId},include:{schedules:true}});
 if(existing.length>1)throw new Error('PACKAGE_SUBSCRIPTION_DUPLICATE');
 if(existing.length){
  const sub=existing[0];
  if(sub.qualificationId!==order.qualificationId||sub.schedules.length!==specification.months||sub.schedules.some(row=>row.dueAt.getTime()!==specification.installments[row.installmentNo-1]?.dueAt.getTime()))throw new Error('PACKAGE_SUBSCRIPTION_EVIDENCE_CONFLICT');
  return {subscription:sub,created:false};
 }
 const planCode='PO_20261019_'+purchase.packageCode;
 let plan=await tx.subscriptionPlan.findUnique({where:{planCode}});
 if(!plan)plan=await tx.subscriptionPlan.create({data:{planCode,displayName:purchase.packageName,durationMonths:specification.months,prepaidAmount:purchase.priceAmount,productBoxQty:purchase.selectableProductQuantity,monthlyRecognizedAmount:2000,monthlyRpv:1200,isActive:true}});
 if(plan.durationMonths!==specification.months||!plan.prepaidAmount.eq(purchase.priceAmount)||!plan.monthlyRecognizedAmount.eq(2000)||!plan.monthlyRpv.eq(1200)||plan.productBoxQty!==purchase.selectableProductQuantity)throw new Error('PACKAGE_SUBSCRIPTION_PLAN_CONFLICT');
 const parameters=await captureParameters(tx,order.paidAt,order.ruleVersionCode);
 const subscription=await tx.subscription.create({data:{qualificationId:order.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,orderId,status:'PENDING',startMonth:taipeiMonth(specification.installments[0].dueAt).calendarMonth,endMonth:taipeiMonth(specification.installments.at(-1)!.dueAt).calendarMonth,ruleVersionCode:order.ruleVersionCode,parameterSnapshotHash:parameters.hash}});
 // Blocked until the GPV/RPV poster, Active evidence and reversal consumer are enabled together.
 for(const row of specification.installments)await tx.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:row.installmentNo,recognitionMonth:taipeiMonth(row.dueAt).calendarMonth,recognizedAmount:row.cash,rpvAmount:row.rpv,status:'SCHEDULED',dueAt:row.dueAt,ruleVersionCode:order.ruleVersionCode,parameterSnapshotHash:parameters.hash,retainedEntitlementRatio:1}});
 await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'PACKAGE_MONTHLY_SCHEDULE_PREPARED',entityType:'SUBSCRIPTION',entityId:subscription.subscriptionId,requestId:orderId,correlationId,afterData:{orderId,packagePurchaseSnapshotId:purchase.packagePurchaseSnapshotId,calendarReference:approvedRepurchaseCalendarReference,timing:approvedRepurchaseTiming,months:specification.months,cashPerMonth:'2000',gpvPerMonth:'1200',rpvPerMonth:'1200',epvPerMonth:'0',volumePolicyReference:approvedRepurchaseVolumeReference,activationStatus:'POSTER_AND_REVERSAL_PENDING'}}});
 return {subscription:await tx.subscription.findUniqueOrThrow({where:{subscriptionId:subscription.subscriptionId},include:{schedules:true}}),created:true};
}
