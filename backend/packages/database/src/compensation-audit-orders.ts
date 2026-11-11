import {Prisma, SettlementBatch} from '@prisma/client';
import {qualificationPackageAllocation} from './package-recognition';
import {preplacementReturnedGpv} from './qualification-return-review';
import {packageMonthlyPlan,approvedRepurchaseTiming} from './package-monthly-plan';

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
  for(const purchase of packages) {
    const subscriptions=await tx.subscription.findMany({where:{orderId:purchase.orderId},include:{schedules:{select:{installmentNo:true}}}});
    const term=purchase.activeDurationValue;
    const sub=subscriptions[0];
    const numbers=new Set(sub?.schedules.map(row=>row.installmentNo));
    const complete=term!==null&&[3,6,12].includes(term)&&numbers.size===term&&Array.from({length:term},(_,i)=>i+1).every(n=>numbers.has(n));
    if(subscriptions.length!==1||!complete||sub.schedules.length!==term||sub.qualificationId!==purchase.targetQualificationId)
      issues.push({key:'subscription/'+purchase.orderId,reason:'INSTALLMENT',order:purchase.orderId,qid:purchase.targetQualificationId??undefined,
        evidence:{duration:term,subscriptions:subscriptions.length,installments:[...numbers].sort((a,b)=>a-b)}});
  }
  const scheduled=await tx.monthlyRecognitionSchedule.findMany({where:{dueAt:window,ruleVersionCode:batch.ruleVersionCode,subscription:{orderId:{not:null}}},include:{subscription:true}});
  for(const row of scheduled) {
    const id=row.subscription.orderId!;
    const purchase=await tx.packagePurchaseSnapshot.findUnique({where:{orderId:id}});
    if(purchase?.packageClass!=='ACTIVE_DURATION'||row.status==='CANCELLED'||row.status==='REVERSED')continue;
    const order=await tx.order.findUniqueOrThrow({where:{orderId:id}});
    if(!order.paidAt)throw Error('PACKAGE_PAYMENT_TIME_MISSING');
    const plan=packageMonthlyPlan({packageCode:purchase.packageCode,priceAmount:purchase.priceAmount,boxCount:purchase.selectableProductQuantity,paidAt:order.paidAt,timing:approvedRepurchaseTiming});
    const expected=plan.installments[row.installmentNo-1];
    const ratio=row.retainedEntitlementRatio??new Prisma.Decimal(1);
    const events=await tx.pvLedger.findMany({where:{sourceLineId:row.recognitionId,eventType:{in:['GPV_CREATED','RPV_CREATED']}}});
    if(!expected||+expected.dueAt!==+row.dueAt||!row.recognizedAmount.eq(expected.cash.mul(ratio))||!row.rpvAmount.eq(expected.rpv.mul(ratio))||row.subscription.status==='ACTIVE'&&(row.status!=='RECOGNIZED'||!['GPV','RPV'].every(type=>events.some(e=>e.pvType===type&&e.amount.eq(row.rpvAmount)&&e.qualificationId===row.subscription.qualificationId))))
      issues.push({key:'installment/'+row.recognitionId,reason:'INSTALLMENT',order:id,qid:row.subscription.qualificationId,evidence:{duration:plan.months,installment:row.installmentNo,due:row.dueAt,status:row.status}});
  }
  return {issues,orders:new Set([...setups.map(q=>q.qualifyingOrderId),...scheduled.map(r=>r.subscription.orderId)]).size};
}
