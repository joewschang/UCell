import {Prisma, SettlementBatch} from '@prisma/client';
import {qualificationPackageAllocation} from './package-recognition';
import {preplacementReturnedGpv} from './qualification-return-review';
import {packageMonthlyPlan,approvedRepurchaseTiming,PackageMonthlyTiming} from './package-monthly-plan';

export async function auditOrderVolume(tx:Prisma.TransactionClient,batch:SettlementBatch) {
  const issues:Array<{key:string;reason:string;qid?:string;order:string;evidence:object}>=[];
  const window={gte:batch.periodStart,lt:batch.periodEnd};
  const setups=await tx.qualificationSetup.findMany({where:{placedAt:window,setupStatus:'PLACED'}});
  for(const setup of setups) {
    const order=await tx.order.findUniqueOrThrow({where:{orderId:setup.qualifyingOrderId},include:{lines:true}});
    if(order.ruleVersionCode!==batch.ruleVersionCode||!setup.packagePurchaseSnapshotId)continue;
    const purchase=await tx.packagePurchaseSnapshot.findUniqueOrThrow({where:{packagePurchaseSnapshotId:setup.packagePurchaseSnapshotId}});
    if(purchase.packageClass!=='QUALIFICATION')continue;
    const allocation=qualificationPackageAllocation(purchase,order.lines,order.netAmount);
    const excluded=await preplacementReturnedGpv(tx,order.orderId);
    const volume=await tx.pvLedger.findMany({where:{sourceId:order.orderId,sourceType:'ORDER',eventType:'GPV_CREATED',pvType:'GPV'}});
    for(const line of order.lines) {
      const expected=allocation.gpvPerBox.times(line.quantity).minus(excluded.get(line.orderLineId)??0);
      const events=volume.filter(e=>e.sourceLineId===line.orderLineId);
      if(events.length!==Number(!expected.isZero())||events.some(e=>!e.amount.eq(expected)||e.qualificationId!==setup.qualificationId||+e.occurredAt!==+setup.placedAt!))
        issues.push({key:'order/'+line.orderLineId,reason:'ORDER_VOLUME',order:order.orderId,qid:setup.qualificationId,evidence:{expectedGpv:expected.toString(),observedGpv:events.map(e=>e.amount.toString())}});
    }
  }
  // Start from payment so an absent subscription or an entirely missing installment is visible.
  const payments=await tx.order.findMany({where:{paidAt:window,ruleVersionCode:batch.ruleVersionCode},select:{orderId:true,qualificationId:true}});
  const packages=await tx.packagePurchaseSnapshot.findMany({where:{orderId:{in:payments.map(o=>o.orderId)},packageClass:'ACTIVE_DURATION'}});
  const replaced=await tx.subscriptionCancellation.findMany({where:{reasonCode:'TIMING_RESEQUENCE',status:'POSTED'},select:{subscriptionId:true}});
  const replacedIds=replaced.map(row=>row.subscriptionId);
  for(const purchase of packages) {
    const subscriptions=await tx.subscription.findMany({where:{orderId:purchase.orderId,subscriptionId:{notIn:replacedIds}},include:{schedules:{select:{installmentNo:true}}}});
    const term=purchase.activeDurationValue;
    const sub=subscriptions[0];
    const numbers=new Set(sub?.schedules.map(row=>row.installmentNo));
    const complete=term!==null&&[3,6,12].includes(term)&&numbers.size===term&&Array.from({length:term},(_,i)=>i+1).every(n=>numbers.has(n));
    if(subscriptions.length!==1||!complete||sub.schedules.length!==term||sub.qualificationId!==purchase.targetQualificationId)
      issues.push({key:'subscription/'+purchase.orderId,reason:'INSTALLMENT',order:purchase.orderId,qid:purchase.targetQualificationId??undefined,
        evidence:{duration:term,subscriptions:subscriptions.length,installments:[...numbers].sort((a,b)=>a-b)}});
  }
  const scheduled=await tx.monthlyRecognitionSchedule.findMany({where:{subscriptionId:{notIn:replacedIds},dueAt:window,ruleVersionCode:batch.ruleVersionCode,subscription:{orderId:{not:null}}},include:{subscription:true}});
  for(const row of scheduled) {
    const id=row.subscription.orderId!;
    const purchase=await tx.packagePurchaseSnapshot.findUnique({where:{orderId:id}});
    if(purchase?.packageClass!=='ACTIVE_DURATION'||row.status==='CANCELLED'||row.status==='REVERSED')continue;
    const order=await tx.order.findUniqueOrThrow({where:{orderId:id}});
    if(!order.paidAt)throw Error('PACKAGE_PAYMENT_TIME_MISSING');
    const sealed=await tx.auditEvent.findFirst({where:{entityType:'SUBSCRIPTION',entityId:row.subscriptionId,action:'PACKAGE_MONTHLY_SCHEDULE_PREPARED'},orderBy:{occurredAt:'asc'}});
    const facts=sealed?.afterData as {timing?:PackageMonthlyTiming;startMonth?:string;gpvPerMonth?:string}|null;
    const plan=packageMonthlyPlan({packageCode:purchase.packageCode,priceAmount:purchase.priceAmount,boxCount:purchase.selectableProductQuantity,paidAt:order.paidAt,timing:facts?.timing??approvedRepurchaseTiming});
    const expected=plan.installments[row.installmentNo-1];
    let dueAt=expected?.dueAt;
    if(facts?.startMonth) {
      const start=new Date(facts.startMonth);
      const monthStart=new Date(Date.UTC(start.getUTCFullYear(),start.getUTCMonth()+row.installmentNo-1,1)-8*3600000);
      dueAt=row.installmentNo===1&&facts.timing==='PAYMENT_THEN_MONTH_START'&&monthStart<=order.paidAt?order.paidAt:monthStart;
    }
    const ratio=row.retainedEntitlementRatio??new Prisma.Decimal(1);
    const events=await tx.pvLedger.findMany({where:{sourceLineId:row.recognitionId,eventType:{in:['GPV_CREATED','RPV_CREATED']}}});
    const expectedGpv=facts?.gpvPerMonth!=null?new Prisma.Decimal(facts.gpvPerMonth).mul(ratio):expected?.gpv.mul(ratio);
    const volumesMatch=([['GPV',expectedGpv],['RPV',expected?.rpv.mul(ratio)]] as const).every(([type,value])=>{
      const matches=events.filter(e=>e.pvType===type);
      return value?.isZero()?matches.length===0:!!value&&matches.length===1&&matches[0].amount.eq(value)&&matches[0].qualificationId===row.subscription.qualificationId;
    });
    if(!expected||!dueAt||+dueAt!==+row.dueAt||!row.recognizedAmount.eq(expected.cash.mul(ratio))||!row.rpvAmount.eq(expected.rpv.mul(ratio))||row.dueAt<=new Date()&&(row.status!=='RECOGNIZED'||!volumesMatch))
      issues.push({key:'installment/'+row.recognitionId,reason:'INSTALLMENT',order:id,qid:row.subscription.qualificationId,evidence:{duration:plan.months,installment:row.installmentNo,due:row.dueAt,status:row.status}});
  }
  return {issues,orders:new Set([...setups.map(q=>q.qualifyingOrderId),...scheduled.map(r=>r.subscription.orderId)]).size};
}
