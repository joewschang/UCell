import {PrismaClient} from '@prisma/client';
import {MemberGrowthService} from '../src/modules/member/member-growth.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('Growth repurchase historical recognition',()=>{
 let db:PrismaClient;beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));afterAll(()=>db.$disconnect());
 it('keeps cancelled scheme history, exact status counts beyond preview, decimal precision and owner scope without writes',async()=>{
  const owner=await db.person.create({data:{legalName:'Growth recognition owner'}}),foreign=await db.person.create({data:{legalName:'PRIVATE foreign recognition'}});
  const q=await db.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER'}}),other=await db.qualification.create({data:{currentHolderPersonId:foreign.personId,planLevelCode:'STARTER'}});
  const plan=await db.subscriptionPlan.create({data:{planCode:'GROWTH-RECOGNITION',displayName:'Test',durationMonths:3,prepaidAmount:'3000',productBoxQty:2,monthlyRecognizedAmount:'1000',monthlyRpv:'20'}});
  const start=new Date('2026-01-01Z'),end=new Date('2026-03-01Z'),past=new Date('2026-02-01Z');
  const scheme=await db.subscription.create({data:{qualificationId:q.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,status:'CANCELLED',startMonth:start,endMonth:end,cancelledAt:past,ruleVersionCode:'R1.0B'}}),otherScheme=await db.subscription.create({data:{qualificationId:other.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:start,endMonth:end,ruleVersionCode:'R1.0B'}});
  await db.monthlyRecognitionSchedule.createMany({data:Array.from({length:105},(_,i)=>({subscriptionId:scheme.subscriptionId,installmentNo:i+1,recognitionMonth:start,dueAt:past,status:i<101?'SCHEDULED' as const:i===101||i===102?'RECOGNIZED' as const:i===103?'REVERSED' as const:'CANCELLED' as const,recognizedAt:i===101||i===103?past:null,recognizedAmount:'123.45',rpvAmount:'12.3456',ruleVersionCode:'R1.0B'}))});
  await db.monthlyRecognitionSchedule.create({data:{subscriptionId:otherScheme.subscriptionId,installmentNo:1,recognitionMonth:start,dueAt:past,status:'DUE',recognizedAmount:'999999',rpvAmount:'999999',ruleVersionCode:'R1.0B'}});
  const before=await db.monthlyRecognitionSchedule.findMany({orderBy:{recognitionId:'asc'}});
  const view=await new MemberGrowthService(db as any).read(owner.personId),r=view.dimensions.repurchase.recognition;
  expect(r.counts).toEqual({SCHEDULED:101,DUE:0,RECOGNIZED:2,CANCELLED:1,REVERSED:1});expect(r.items).toHaveLength(100);expect(r.itemLimit).toBe(100);
  expect(r.items.every(x=>x.qualificationNo===q.qualificationNo.toString()&&x.schemeStatus==='CANCELLED'&&x.scheduledAmount==='123.45'&&x.scheduledRpv==='12.3456')).toBe(true);
  expect(await db.monthlyRecognitionSchedule.findMany({orderBy:{recognitionId:'asc'}})).toEqual(before);
  // Put timestamp edge cases in the most recent month so they cannot be lost in the bounded preview.
  await db.monthlyRecognitionSchedule.updateMany({where:{subscriptionId:scheme.subscriptionId,status:'RECOGNIZED'},data:{recognitionMonth:end}});
  const recent=(await new MemberGrowthService(db as any).read(owner.personId)).dimensions.repurchase.recognition.items.filter(x=>x.status==='RECOGNIZED');
  expect(recent).toHaveLength(2);expect(recent.find(x=>x.recognizedAt===null)?.recordConsistency).toBe('UNAVAILABLE');expect(recent.find(x=>x.recognizedAt===past.toISOString())?.recordConsistency).toBe('RECORDED');
  const json=JSON.stringify(view);for(const secret of [owner.personId,foreign.personId,q.qualificationId,other.qualificationId,scheme.subscriptionId,otherScheme.subscriptionId,'PRIVATE foreign recognition','999999'])expect(json).not.toContain(secret);
  await db.monthlyRecognitionSchedule.updateMany({where:{subscriptionId:scheme.subscriptionId,status:'RECOGNIZED',recognizedAt:past},data:{recognizedAt:new Date('2099-01-01Z')}});
  const future=(await new MemberGrowthService(db as any).read(owner.personId)).dimensions.repurchase.recognition.items.find(x=>x.recognizedAt==='2099-01-01T00:00:00.000Z');expect(future?.recordConsistency).toBe('UNAVAILABLE');
  expect((await new MemberGrowthService(db as any).read(foreign.personId)).dimensions.repurchase.recognition.counts.DUE).toBe(1);
 });
});
