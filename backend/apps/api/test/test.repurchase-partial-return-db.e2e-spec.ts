import { Prisma, PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { SubscriptionCancellationService } from '../src/modules/subscription/subscription-cancellation.service';

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
    async function refund(amount:string){
      const ret=await db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'PARTIAL_RETURN',occurredAt:new Date('2026-09-28'),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:line.orderLineId,quantity:1,returnAmount:amount,gpvReversalAmount:0}}}});
      const input={sourceReturnCaseId:ret.returnCaseId,idempotencyKey:randomUUID()};
      return ()=>service.cancel(sub.subscriptionId,new Date('2026-09-28'),'PARTIAL_RETURN',amount,input);
    }
    const rows=()=>db.monthlyRecognitionSchedule.findMany({where:{subscriptionId:sub.subscriptionId},orderBy:{installmentNo:'asc'}});
    return {sub,refund,rows};
  }
  const total=(rows:any[],key:string)=>rows.reduce((sum,row)=>sum.add(row[key]),new Prisma.Decimal(0)).toString();
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
});
