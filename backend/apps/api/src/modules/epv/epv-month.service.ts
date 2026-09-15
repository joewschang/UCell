import { Injectable } from '@nestjs/common';
import { Prisma } from '@ucell/database';
import { ParameterSnapshot, snapshotValue, snapshotDecimal, pending } from '../rules/parameter-snapshot';
import { monthlyEpv, monthlyReturnDelta } from './monthly-epv';

@Injectable()
export class EpvMonthService {
  async bounds(tx:Prisma.TransactionClient,at:Date,snapshot:ParameterSnapshot) {
    const timezone=snapshotValue(snapshot,'epv.calendar.timezone');
    if(typeof timezone!=='string') pending('CONFIGURATION_PENDING','EPV calendar timezone must be explicitly configured');
    try {new Intl.DateTimeFormat('en',{timeZone:timezone});} catch {pending('INVALID_TIMEZONE','EPV calendar timezone is invalid');}
    const [row]=await tx.$queryRaw<Array<{start:Date;end:Date}>>`
      SELECT (date_trunc('month',${at}::timestamptz AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone}) AS start,
      ((date_trunc('month',${at}::timestamptz AT TIME ZONE ${timezone})+interval '1 month') AT TIME ZONE ${timezone}) AS end`;
    return {...row,timezone};
  }

  async recognition(tx:Prisma.TransactionClient,order:{orderId:string;qualificationId:string;paidAt:Date|null;netAmount:Prisma.Decimal},snapshot:ParameterSnapshot) {
    if(!order.paidAt) pending('EPV_PAYMENT_TIME_MISSING','Paid order requires its original payment timestamp');
    const month=await this.bounds(tx,order.paidAt,snapshot);
    const orders=await tx.order.findMany({where:{qualificationId:order.qualificationId,purpose:'REPURCHASE',paidAt:{gte:month.start,lt:month.end,lte:order.paidAt}},orderBy:[{paidAt:'asc'},{orderId:'asc'}]});
    const prefix=orders.slice(0,orders.findIndex(o=>o.orderId===order.orderId)+1);
    if(!prefix.length) pending('EPV_ORDER_MISSING','Order is absent from its economic calendar month');
    let before=new Prisma.Decimal(0);
    for(const earlier of prefix.slice(0,-1)) {
      const marker=await tx.pvLedger.findFirst({where:{sourceType:'ORDER',sourceId:earlier.orderId,pvType:'EPV',eventType:'EPV_CREATED'}});
      if(!marker) pending('EPV_PREVIOUS_ORDER_PENDING','Recognize earlier same-month orders first; do not assign their EPV to a later Active/Sponsor snapshot');
      const evidence=await tx.auditEvent.findFirst({where:{action:'EPV_MONTH_RECOGNIZED',entityId:earlier.orderId}});
      const detail=evidence?.afterData as any;
      if(!detail || detail.timezone!==month.timezone || detail.base!==snapshotDecimal(snapshot,'epv.base_amount').toString() || detail.rate!==snapshotDecimal(snapshot,'epv.rate').toString() || earlier.ruleVersionCode!==snapshot.ruleVersionCode)
        pending('EPV_MONTH_PARAMETER_DECISION_PENDING','Same-month parameter changes or legacy recognition require an explicit migration decision');
      before=before.add(earlier.netAmount);
    }
    const returns=await tx.returnLine.aggregate({where:{returnCase:{status:'POSTED',orderId:{in:prefix.map(o=>o.orderId)},occurredAt:{lte:order.paidAt}}},_sum:{returnAmount:true}});
    if((returns._sum.returnAmount??new Prisma.Decimal(0)).gt(0)) pending('EPV_RETURN_ALLOCATION_PENDING','A returned month must be reconciled before recognizing subsequent awards');
    const base=snapshotDecimal(snapshot,'epv.base_amount'),rate=snapshotDecimal(snapshot,'epv.rate');
    const cumulative=before.add(order.netAmount);
    return {...month,base,rate,before,cumulative,epv:monthlyEpv(cumulative,base,rate).sub(monthlyEpv(before,base,rate))};
  }

  async returnProjection(tx:Prisma.TransactionClient,returnCaseId:string,snapshot:ParameterSnapshot) {
    const ret=await tx.returnCase.findUniqueOrThrow({where:{returnCaseId},include:{order:true,lines:true}});
    if(!ret.order.paidAt) pending('EPV_PAYMENT_TIME_MISSING','Return source payment timestamp is missing');
    const month=await this.bounds(tx,ret.order.paidAt,snapshot);
    const orders=await tx.order.findMany({where:{qualificationId:ret.order.qualificationId,purpose:'REPURCHASE',paidAt:{gte:month.start,lt:month.end,lte:ret.occurredAt}}});
    if(orders.some(o=>o.ruleVersionCode!==snapshot.ruleVersionCode)) pending('EPV_MONTH_PARAMETER_DECISION_PENDING','Mixed monthly rule versions require a decision');
    for(const order of orders) {
      const evidence=await tx.auditEvent.findFirst({where:{action:'EPV_MONTH_RECOGNIZED',entityId:order.orderId}});
      const detail=evidence?.afterData as any;
      if(detail && (detail.timezone!==month.timezone || detail.base!==snapshotDecimal(snapshot,'epv.base_amount').toString() || detail.rate!==snapshotDecimal(snapshot,'epv.rate').toString()))
        pending('EPV_MONTH_PARAMETER_DECISION_PENDING','Monthly return spans incompatible historical threshold/rate/timezone snapshots');
    }
    const previousReturns=await tx.returnLine.aggregate({where:{returnCase:{status:'POSTED',orderId:{in:orders.map(o=>o.orderId)},OR:[{occurredAt:{lt:ret.occurredAt}},{occurredAt:ret.occurredAt,returnCaseId:{lt:returnCaseId}}]}},_sum:{returnAmount:true}});
    const total=orders.reduce((a,o)=>a.add(o.netAmount),new Prisma.Decimal(0));
    const returned=ret.lines.reduce((a,l)=>a.add(l.returnAmount),new Prisma.Decimal(0));
    const result=monthlyReturnDelta(total.sub(previousReturns._sum.returnAmount??new Prisma.Decimal(0)),returned,snapshotDecimal(snapshot,'epv.base_amount'),snapshotDecimal(snapshot,'epv.rate'));
    return {...month,...result,qualificationId:ret.order.qualificationId,sourceOrderIds:orders.map(o=>o.orderId)};
  }
}
