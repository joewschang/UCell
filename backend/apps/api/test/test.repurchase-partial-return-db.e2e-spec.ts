import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { SubscriptionCancellationService } from '../src/modules/subscription/subscription-cancellation.service';
import { RpvService } from '../src/modules/rpv/rpv.service';
import { replayRpvCancellation } from '@ucell/database';
import { processRecognition } from '../../worker/src/main';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('repurchase cumulative partial returns',()=>{
  let db:PrismaClient;
  let service:SubscriptionCancellationService;
  beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});service=new SubscriptionCancellationService(db as any);});
  afterAll(()=>db.$disconnect());
  async function fixture(){
    const person=await db.person.create({data:{legalName:'Partial return '+randomUUID()}});
    const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
    const order=await db.order.create({data:{qualificationId:qualification.qualificationId,purpose:'RETAIL',status:'PAID',grossAmount:100,netAmount:100,ruleVersionCode:'R1.0B'}});
    const product=await db.productReference.create({data:{sku:randomUUID(),displayName:'Return fixture',currentPrice:100}});
    const line=await db.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:100,unitPrice:1,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{}}});
    const plan=await db.subscriptionPlan.create({data:{planCode:randomUUID(),displayName:'Partial return test',durationMonths:3,prepaidAmount:100,productBoxQty:3,monthlyRecognizedAmount:33.33,monthlyRpv:1}});
    const sub=await db.subscription.create({data:{qualificationId:qualification.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,orderId:order.orderId,status:'ACTIVE',startMonth:new Date('2026-10-01'),endMonth:new Date('2026-12-01'),ruleVersionCode:'R1.0B'}});
    for(let i=0;i<3;i++) await db.monthlyRecognitionSchedule.create({data:{subscriptionId:sub.subscriptionId,installmentNo:i+1,recognitionMonth:new Date(Date.UTC(2026,9+i,1)),dueAt:new Date(Date.UTC(2026,9+i,1)),recognizedAmount:i===2?33.34:33.33,rpvAmount:1,ruleVersionCode:'R1.0B'}});
    async function refund(amount:string,effectiveAt=new Date('2026-09-28')){
      const ret=await db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'PARTIAL_RETURN',occurredAt:new Date('2026-09-28'),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:line.orderLineId,quantity:1,returnAmount:amount,gpvReversalAmount:0}}}});
      const input={sourceReturnCaseId:ret.returnCaseId,idempotencyKey:randomUUID()};
      return ()=>service.cancel(sub.subscriptionId,effectiveAt,'PARTIAL_RETURN',amount,input);
    }
    const rows=()=>db.monthlyRecognitionSchedule.findMany({where:{subscriptionId:sub.subscriptionId},orderBy:{installmentNo:'asc'}});
    return {sub,refund,rows,qualification};
  }
  const total=(rows:any[],key:string)=>rows.reduce((sum,row)=>sum.add(row[key]),new Prisma.Decimal(0)).toString();
  it('deduplicates concurrent legacy cancellation commands without a new required header',async()=>{
    const f=await fixture(),at=new Date('2026-09-28');
    const results=await Promise.all([service.cancel(f.sub.subscriptionId,at,'FULL_RETURN'),service.cancel(f.sub.subscriptionId,at,'FULL_RETURN')]);
    expect(results.map(r=>r.replayed).sort()).toEqual([false,true]);
    expect(await db.subscriptionCancellation.count({where:{subscriptionId:f.sub.subscriptionId}})).toBe(1);
  });
  it('rejects reuse of a cancellation key for another subscription or command',async()=>{
    const a=await fixture(),b=await fixture(),key=randomUUID(),at=new Date('2026-09-28');
    await service.cancel(a.sub.subscriptionId,at,'FULL_RETURN','0',{idempotencyKey:key});
    await expect(service.cancel(a.sub.subscriptionId,at,'FULL_RETURN')).resolves.toMatchObject({replayed:true});
    await expect(service.cancel(a.sub.subscriptionId,at,'FULL_RETURN','0',{idempotencyKey:randomUUID()})).rejects.toMatchObject({response:{code:'SUBSCRIPTION_ALREADY_CANCELLED'}});
    await expect(service.cancel(b.sub.subscriptionId,at,'FULL_RETURN','0',{idempotencyKey:key})).rejects.toMatchObject({response:{code:'SUBSCRIPTION_CANCELLATION_IDEMPOTENCY_CONFLICT'}});
    await expect(service.cancel(a.sub.subscriptionId,new Date('2026-09-29'),'FULL_RETURN','0',{idempotencyKey:key})).rejects.toMatchObject({response:{code:'SUBSCRIPTION_CANCELLATION_IDEMPOTENCY_CONFLICT'}});
    expect((await db.subscription.findUniqueOrThrow({where:{subscriptionId:b.sub.subscriptionId}})).status).toBe('ACTIVE');
  });
  it('deducts each refund once, preserves rounding residuals and replays without another reduction',async()=>{
    const f=await fixture();
    const first=await f.refund('20');
    await first();
    let rows=await f.rows();
    expect(total(rows,'recognizedAmount')).toBe('80');
    expect(total(rows,'rpvAmount')).toBe('2.4');
    const before=JSON.stringify(rows);
    await expect(first()).resolves.toMatchObject({replayed:true});
    expect(JSON.stringify(await f.rows())).toBe(before);
    await (await f.refund('30'))();
    rows=await f.rows();
    expect(total(rows,'recognizedAmount')).toBe('50');
    expect(total(rows,'rpvAmount')).toBe('1.5');
    await expect((await f.refund('51'))()).rejects.toMatchObject({response:{code:'SUBSCRIPTION_RETURN_AMOUNT_EXCEEDED'}});
    expect(total(await f.rows(),'recognizedAmount')).toBe('50');
    expect(await db.subscriptionCancellation.count({where:{subscriptionId:f.sub.subscriptionId}})).toBe(2);
    await (await f.refund('50'))();
    expect(total(await f.rows(),'recognizedAmount')).toBe('0');
    expect(total(await f.rows(),'rpvAmount')).toBe('0');
  });
  it('assigns currency and RPV rounding residuals to the final installment',async()=>{
    const f=await fixture();
    await (await f.refund('33.33'))();
    const rows=await f.rows();
    expect(total(rows,'recognizedAmount')).toBe('66.67');
    expect(total(rows,'rpvAmount')).toBe('2.0001');
  });
  it('serializes competing refunds so their total cannot exceed prepaid entitlement',async()=>{
    const f=await fixture();
    const a=await f.refund('60'),b=await f.refund('60');
    const results=await Promise.allSettled([a(),b()]);
    expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
    expect(results.filter(r=>r.status==='rejected')).toHaveLength(1);
    expect(total(await f.rows(),'recognizedAmount')).toBe('40');
    expect(await db.subscriptionCancellation.count({where:{subscriptionId:f.sub.subscriptionId}})).toBe(1);
  });

  async function recognitionFixture(){
    const f=await fixture(),at=new Date('2026-09-01');
    const parent=await db.qualification.create({data:{currentHolderPersonId:f.qualification.currentHolderPersonId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
    await db.qualification.update({where:{qualificationId:f.qualification.qualificationId},data:{status:'EFFECTIVE',effectiveAt:at}});
    for(const q of [f.qualification,parent]){
      await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:at,sourceType:'TEST'}});
      await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:at,sourceType:'TEST'}});
      await db.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:at,sourceType:'TEST',ruleVersionCode:'R1.0B'}});
    }
    await db.binaryPlacement.create({data:{parentQualificationId:parent.qualificationId,childQualificationId:f.qualification.qualificationId,side:'LEFT',effectiveFrom:at}});
    const first=(await f.rows())[0];
    await db.monthlyRecognitionSchedule.update({where:{recognitionId:first.recognitionId},data:{recognitionMonth:at,dueAt:new Date('2026-09-16')}});
    const recognize=()=>new RpvService(db as any,{} as any).recognize(first.recognitionId);
    const replay=(fact:any)=>db.$transaction(tx=>replayRpvCancellation(tx,first.recognitionId,fact.subscriptionCancellationId,'RPV:'+first.recognitionId+':'+fact.subscriptionCancellationId,randomUUID()),{timeout:15000});
    return {...f,first,recognize,replay};
  }
  it.each(['API','Worker'])('%s seals the reduced basis between returns and recovers only the new reduction',async path=>{
    const f=await recognitionFixture();
    await (await f.refund('20',new Date('2026-09-15')))();
    if(path==='Worker') await processRecognition(f.first.recognitionId,db as any);else await f.recognize();
    const awards=await db.rpvUplineAwardEvent.findMany({where:{recognitionId:f.first.recognitionId}});
    expect(awards.map(a=>a.payableAmount.toString())).toEqual(['80']);
    const snapshot=await db.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'RPV',sourceId:f.first.recognitionId}}});
    expect((snapshot.content as any).inputs.refundBasis).toEqual({prepaidAmount:'100',retainedRatio:'0.8'});
    const second=await (await f.refund('30',new Date('2026-09-20')))();
    await db.subscriptionPlan.update({where:{subscriptionPlanId:f.sub.subscriptionPlanId},data:{prepaidAmount:200}});
    await f.replay(second.cancellation);
    const reversal=await db.pvLedger.findMany({where:{sourceLineId:f.first.recognitionId,eventType:'RPV_REVERSAL'}});
    expect(reversal.map(r=>r.amount.toString())).toEqual(['-0.3']);
    const posting=await db.entitlementReplayPosting.findFirstOrThrow({where:{actionKey:'RPV:'+f.first.recognitionId+':'+second.cancellation.subscriptionCancellationId}});
    expect(posting.delta.toString()).toBe('-30');
    expect(await db.rpvUplineAwardEvent.findMany({where:{recognitionId:f.first.recognitionId}})).toEqual(awards);
    expect(await db.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'RPV',sourceId:f.first.recognitionId}}})).toEqual(snapshot);
  });
  it('concurrent recovery deliveries apply the cumulative reduction once',async()=>{
    const f=await recognitionFixture();await f.recognize();
    const a=await (await f.refund('20'))(),b=await (await f.refund('30'))();
    await Promise.all([f.replay(a.cancellation),f.replay(b.cancellation)]);
    await Promise.all([f.replay(a.cancellation),f.replay(b.cancellation)]);
    const reversals=await db.pvLedger.findMany({where:{sourceLineId:f.first.recognitionId,eventType:'RPV_REVERSAL'}});
    expect(total(reversals,'amount')).toBe('-0.5');
    expect(reversals).toHaveLength(1);
  });
  it('a delayed partial delivery after full recovery never restores or recovers entitlement twice',async()=>{
    const f=await recognitionFixture();await f.recognize();
    const partial=await (await f.refund('20'))();
    const full=await service.cancel(f.sub.subscriptionId,new Date('2026-09-28'),'FULL_RETURN','0',{idempotencyKey:randomUUID()});
    await f.replay(full.cancellation);await f.replay(partial.cancellation);
    const reversals=await db.pvLedger.findMany({where:{sourceLineId:f.first.recognitionId,eventType:'RPV_REVERSAL'}});
    expect(total(reversals,'amount')).toBe('-1');
    expect(reversals).toHaveLength(1);
  });
  it('does not guess the basis of legacy schedules already affected by partial refunds',async()=>{
    const f=await recognitionFixture();
    await (await f.refund('20',new Date('2026-09-15')))();
    await db.monthlyRecognitionSchedule.update({where:{recognitionId:f.first.recognitionId},data:{retainedEntitlementRatio:null}});
    await expect(f.recognize()).rejects.toMatchObject({response:{code:'SUBSCRIPTION_REFUND_BASIS_MISSING'}});
    expect(await db.pvLedger.count({where:{sourceLineId:f.first.recognitionId}})).toBe(0);
  });
});
