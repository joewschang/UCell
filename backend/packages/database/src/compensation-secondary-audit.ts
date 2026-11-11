import {Prisma,SettlementBatch} from '@prisma/client';
import {companyAlwaysActiveAt} from './reservoir-b';
import {effectiveGpv,historicalBinaryAncestors,historicalRecipientState,historicalSponsorAncestors,periodGlobal,verifyReplayEnvelope} from './historical-replay';
import {snapshotDecimal} from './parameter-snapshot';

type Row={qid:string;generation:number;value:Prisma.Decimal};
type Issue={key:string;reason:string;qid?:string;order?:string;expected?:Prisma.Decimal;actual?:Prisma.Decimal;evidence:object};
const zero=new Prisma.Decimal(0);
function compare(issues:Issue[],source:string,kind:string,order:string|undefined,expected:Row[],actual:Row[]){
  const saved=new Map<string,Prisma.Decimal>();
  for(const r of actual){
    const k=r.qid+'/'+r.generation;
    if(saved.has(k))issues.push({key:kind+'/duplicate/'+source+'/'+k,reason:'DUPLICATE',qid:r.qid,order,evidence:{source,awardType:kind}});
    saved.set(k,(saved.get(k)??zero).plus(r.value));
  }
  for(const r of expected){
    const k=r.qid+'/'+r.generation,a=saved.get(k);
    if(!a||!a.eq(r.value))issues.push({key:kind+'/'+source+'/'+k,reason:!a?'MISSING':a.gt(r.value)?'OVER':'UNDER',qid:r.qid,order,expected:r.value,actual:a??zero,evidence:{source,generation:r.generation,awardType:kind}});
    saved.delete(k);
  }
  for(const [k,v] of saved)issues.push({key:kind+'/'+source+'/'+k,reason:'UNEXPECTED',qid:k.split('/')[0],order,expected:zero,actual:v,evidence:{source,awardType:kind}});
}

export async function auditOtherAwards(tx:Prisma.TransactionClient,batch:SettlementBatch) {
  const issues:Issue[]=[];
  const window={gte:batch.periodStart,lt:batch.periodEnd};
  const events=await tx.pvLedger.findMany({where:{ruleVersionCode:batch.ruleVersionCode,occurredAt:window,eventType:{in:['RPV_CREATED','EPV_CREATED']}}});
  for(const event of events){
    const rpv=event.pvType==='RPV',kind=rpv?'RPV':'EPV';
    const id=rpv?event.sourceLineId!:event.eventId;
    const envelope=verifyReplayEnvelope(await tx.historicalReplaySnapshot.findFirstOrThrow({where:{kind,sourceId:id}}));
    const graph=envelope.evidence;
    if(rpv){
      const schedule=await tx.monthlyRecognitionSchedule.findUniqueOrThrow({where:{recognitionId:id},include:{subscription:true}});
      const path=historicalBinaryAncestors(graph,event.qualificationId,12);
      const expected=path.map(a=>{
        const s=historicalRecipientState(graph,a.qualification_id);
        const depth=s.directs===0?5:s.directs===1?8:12;
        const base=new Prisma.Decimal(100).mul(envelope.inputs.refundBasis?.retainedRatio??1);
        return {qid:a.qualification_id,generation:a.generation,value:s.active&&a.generation<=depth?base.toDecimalPlaces(2):zero};
      });
      const actual=await tx.rpvUplineAwardEvent.findMany({where:{recognitionId:id}});
      compare(issues,id,kind,schedule.subscription.orderId??undefined,expected,actual.map(a=>({qid:a.recipientQualificationId,generation:a.binaryGeneration,value:a.payableAmount})));
    }else{
      const path=[{qualification_id:event.qualificationId,generation:0},...historicalSponsorAncestors(graph,event.qualificationId,5)];
      const expected=path.map(a=>{
        const active=historicalRecipientState(graph,a.qualification_id).active;
        const rate=a.generation?snapshotDecimal(envelope.parameters,'epv.upline.rate',String(a.generation)):snapshotDecimal(envelope.parameters,'epv.self.rate');
        return {qid:a.qualification_id,generation:a.generation,value:active?event.amount.mul(rate).toDecimalPlaces(4):zero};
      });
      const actual=await tx.bonusAward.findMany({where:{sourceEventId:id,awardType:'EPV'}});
      compare(issues,id,kind,envelope.inputs.orderId,expected,actual.map(a=>({qid:a.recipientQualificationId,generation:a.generationNo??0,value:a.payableAmount})));
    }
  }
  const retail=await tx.retailReferralOrderLineSnapshot.findMany({where:{order:{ruleVersionCode:batch.ruleVersionCode,paidAt:window}},include:{order:true}});
  for(const l of retail){
    const qid=l.referrerQualificationId,at=l.order.paidAt!,expected:Row[]=[];
    if(qid&&l.retailReferralEnabled&&l.rate&&l.calculationType==='PERCENTAGE'&&l.baseType==='NET_PAID_ITEM_AMOUNT'){
      const active=await companyAlwaysActiveAt(tx,qid,at)||await tx.activePeriod.findFirst({where:{qualificationId:qid,activeFrom:{lte:at},OR:[{activeTo:null},{activeTo:{gt:at}}]}});
      expected.push({qid,generation:0,value:active?l.netPaidItemAmount.mul(l.rate).toDecimalPlaces(4):zero});
    }
    const actual=await tx.bonusAward.findMany({where:{sourceEventId:l.orderLineId,awardType:'RETAIL_REFERRAL'}});
    compare(issues,l.orderLineId,'RETAIL_REFERRAL',l.orderId,expected,actual.map(a=>({qid:a.recipientQualificationId,generation:0,value:a.payableAmount})));
  }
  const pools=await tx.globalPoolSettlement.findMany({where:{periodEnd:{gt:batch.periodStart,lte:batch.periodEnd},ruleVersionCode:batch.ruleVersionCode}});
  for(const pool of pools){
    const id=pool.globalPoolSettlementId;
    const snap=await tx.historicalReplaySnapshot.findFirstOrThrow({where:{kind:'GLOBAL',sourceId:id}});
    const e=verifyReplayEnvelope(snap),result=periodGlobal(e,await effectiveGpv(tx,e.evidence.sources));
    const actual=await tx.globalPoolAward.findMany({where:{globalPoolSettlementId:id}});
    const postings=await tx.entitlementReplayPosting.findMany({where:{snapshotId:snap.snapshotId}});
    const expected=e.recipients.map(r=>({qid:r.qualificationId,generation:0,value:result.payables.get(r.key)!}));
    compare(issues,id,'GLOBAL',undefined,expected,actual.map(a=>({qid:a.qualificationId,generation:0,value:postings.filter(p=>p.entitlementKey===a.globalPoolAwardId).reduce((v,p)=>v.plus(p.delta),a.payableAmount)})));
  }
  return issues;
}
