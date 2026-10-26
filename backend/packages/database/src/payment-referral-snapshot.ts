import {Prisma} from '@prisma/client';
import {captureParameters,pending} from './parameter-snapshot';
import {bonusTimingEnabled} from './bonus-timing-policy';
import {captureHistoricalGraph,storeReplaySnapshot,verifyReplayEnvelope} from './historical-replay';

/** Called in the payment transaction, after the authoritative Sponsor link exists. */
export async function capturePaymentReferral(tx:Prisma.TransactionClient,orderId:string,qid:string,paidAt:Date,rule:string){
 const parameters=await captureParameters(tx,paidAt,rule);
 if(!bonusTimingEnabled(parameters))return;
 const qualification=await tx.qualification.findUniqueOrThrow({where:{qualificationId:qid},select:{kind:true}});
 if(qualification.kind==='MEMBER_ORIGIN'){
  const purchase=await tx.packagePurchaseSnapshot.findUniqueOrThrow({where:{orderId}});
  if(purchase.packageClass!=='QUALIFICATION'||!['STARTER','ELITE','LEADER'].includes(purchase.packageCode))pending('PAYMENT_PLAN_EVIDENCE_REQUIRED','Original qualification package plan is required');
  const plan=await tx.qualificationPlanHistory.findFirst({where:{qualificationId:qid,effectiveFrom:{lte:paidAt},OR:[{effectiveTo:null},{effectiveTo:{gt:paidAt}}]}});
  if(!plan){
   if(await tx.qualificationPlanHistory.count({where:{qualificationId:qid}}))pending('PAYMENT_PLAN_HISTORY_CONFLICT','Cannot replace an existing historical plan');
   await tx.qualificationPlanHistory.create({data:{qualificationId:qid,planCode:purchase.packageCode,effectiveFrom:paidAt,sourceType:'QUALIFICATION_PAYMENT',sourceId:orderId}});
  }else if(plan.planCode!==purchase.packageCode)pending('PAYMENT_PLAN_HISTORY_CONFLICT','Purchased plan differs from effective historical plan');
 }
 const evidence=await captureHistoricalGraph(tx,qid,paidAt,parameters);
 if(!evidence||!(evidence as any).sponsor.some((r:any)=>r.childQualificationId===qid))pending('PAYMENT_SPONSOR_REQUIRED','Confirm the referral ball before confirming qualification package payment');
 await storeReplaySnapshot(tx,{format:'UCELL_HISTORICAL_REPLAY_V1',kind:'PAYMENT_REFERRAL',sourceId:orderId,ruleVersionCode:rule,at:paidAt.toISOString(),parameters,recipients:[],evidence,inputs:{orderId,qualificationId:qid}});
}
export async function paymentReferralForGpv(tx:Prisma.TransactionClient,event:any){
 if(event.sourceType!=='ORDER')return null;
 if(!bonusTimingEnabled(await captureParameters(tx,event.occurredAt,event.ruleVersionCode)))return null;
 const purchase=await tx.packagePurchaseSnapshot.findUnique({where:{orderId:event.sourceId}});
 if(purchase?.packageClass!=='QUALIFICATION')return null;
 const order=await tx.order.findUniqueOrThrow({where:{orderId:event.sourceId}});
 if(!order.paidAt)pending('ORDER_NOT_PAID','Qualification source payment is required');
 const parameters=await captureParameters(tx,order.paidAt,event.ruleVersionCode);
 if(!bonusTimingEnabled(parameters))return null;
 const snapshot=verifyReplayEnvelope(await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:'PAYMENT_REFERRAL',sourceId:event.sourceId}}}));
 if(snapshot.at!==order.paidAt.toISOString()||snapshot.inputs.qualificationId!==event.qualificationId)pending('PAYMENT_REFERRAL_MISMATCH','Payment qualification snapshot does not match GPV source');
 return snapshot;
}
