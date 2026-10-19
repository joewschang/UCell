import {Prisma} from '@prisma/client';
import {recognizeConsumption,taipeiMonth} from './recognition-active';
import {captureParameters} from './parameter-snapshot';
import {applyGpvImmediateEffects} from './gpv-immediate-effects';
import {approvedRepurchaseTiming,approvedRepurchaseVolumeReference,packageMonthlyPlan} from './package-monthly-plan';

/** Runs under the monthly worker's subscription lock and SERIALIZABLE transaction.
 * RPV and its historical awards are posted by the existing worker in the same
 * transaction. This adds GPV and one consumption/Active fact, never EPV.
 */
export async function recognizePackageMonthlyGpv(tx:Prisma.TransactionClient,recognitionId:string,correlationId:string){
 const row=await tx.monthlyRecognitionSchedule.findUniqueOrThrow({where:{recognitionId},include:{subscription:true}});
 if(await tx.outboxEvent.count({where:{eventType:'PACKAGE_MONTHLY_RETURN_REQUIRED',aggregateId:row.subscriptionId,processStatus:{not:'PROCESSED'}}}))throw new Error('PACKAGE_MONTHLY_RETURN_REPLAY_REQUIRED');
 const order=await tx.order.findUniqueOrThrow({where:{orderId:row.subscription.orderId!}});
 const purchase=await tx.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId:order.orderId}});
 if(!order.paidAt||purchase.packageClass!=='ACTIVE_DURATION'||purchase.recognitionConfigRef!=='PO_20261019_REPURCHASE_60'||purchase.currency!=='TWD'||!order.netAmount.eq(purchase.priceAmount)||row.subscription.qualificationId!==order.qualificationId||row.ruleVersionCode!==order.ruleVersionCode)throw new Error('PACKAGE_MONTHLY_SOURCE_CONFLICT');
 const original=packageMonthlyPlan({packageCode:purchase.packageCode,priceAmount:purchase.priceAmount,boxCount:purchase.selectableProductQuantity,paidAt:order.paidAt,timing:approvedRepurchaseTiming});
 const installment=original.installments[row.installmentNo-1];
 const ratio=row.retainedEntitlementRatio;
 if(!installment||installment.dueAt.getTime()!==row.dueAt.getTime()||!ratio||ratio.lte(0)||ratio.gt(1)||!row.recognizedAmount.eq(installment.cash.mul(ratio))||!row.rpvAmount.eq(installment.rpv.mul(ratio)))throw new Error('PACKAGE_MONTHLY_ALLOCATION_CONFLICT');
 const refunds=await tx.returnLine.aggregate({where:{returnCase:{orderId:order.orderId,status:'POSTED'}},_sum:{returnAmount:true}});
 if(!purchase.priceAmount.sub(refunds._sum.returnAmount??0).div(purchase.priceAmount).eq(ratio))throw new Error('PACKAGE_MONTHLY_RETURN_PREPARATION_REQUIRED');
 const parameters=await captureParameters(tx,row.dueAt,order.ruleVersionCode);
 const result=await recognizeConsumption(tx,{qualificationId:row.subscription.qualificationId,sourceType:'PACKAGE_MONTHLY',sourceId:order.orderId,sourceLineId:recognitionId,amount:row.rpvAmount,eligible:true,concreteVolumeType:'GPV',productProfileVersion:approvedRepurchaseVolumeReference,ruleVersionCode:order.ruleVersionCode,parameterSnapshotHash:parameters.hash,recognizedAt:row.dueAt,activeThreshold:1200,correlationId});
 if(result.created&&result.volume)await applyGpvImmediateEffects(tx,result.volume,{orderId:order.orderId,prepaidAmount:purchase.priceAmount.toString(),retainedRatio:ratio.toString()});
 // A delayed historical recognition must not set today's cached Active flag.
 const now=new Date(),active=await tx.activePeriod.count({where:{qualificationId:row.subscription.qualificationId,activeFrom:{lte:now},OR:[{activeTo:null},{activeTo:{gt:now}}]}});
 await tx.qualification.update({where:{qualificationId:row.subscription.qualificationId},data:{activeFlag:active>0}});
 return {created:result.created,eventId:result.volume?.eventId,month:taipeiMonth(row.dueAt).key};
}
