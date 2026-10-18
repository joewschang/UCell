import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {BonusLifecycleService} from '../src/modules/bonus/bonus-lifecycle.service';
import {UnifiedPayableService} from '../src/modules/payout/unified-payable.service';
import {RecoveryBalanceService} from '../src/modules/payout/recovery-balance.service';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw Error('ISOLATED_DATABASE_REQUIRED');

// Native source fixtures intentionally bypass award calculation. This suite
// verifies eight-source convergence into real downstream payout services only.
describe('Twelve monthly eight-source payout cycles (synthetic source fixtures)',()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),rule='TEST_EIGHT_PAYOUT_'+randomUUID();
 const pay=new UnifiedPayableService(db as any,new RecoveryBalanceService(db as any));
 const ops=new AdminOperationsService(db as any,new AuditService());
 const types=['REFERRAL','RETAIL_REFERRAL','EQUALIZATION','BINARY','MATCHING','EPV'] as const;
 let qid:string,subscriptionId:string;const batches:string[]=[];
 beforeAll(async()=>{
  const person=await db.person.create({data:{legalName:'SYNTHETIC EIGHT SOURCE ANNUAL'}});
  const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date('2023-01-01Z')}});qid=q.qualificationId;
  const plan=await db.subscriptionPlan.create({data:{planCode:rule,displayName:'Synthetic downstream fixture',durationMonths:12,prepaidAmount:24000,productBoxQty:8,monthlyRecognizedAmount:2000,monthlyRpv:1200}});
  const sub=await db.subscription.create({data:{qualificationId:qid,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:new Date('2024-01-01Z'),endMonth:new Date('2024-12-01Z'),ruleVersionCode:rule}});subscriptionId=sub.subscriptionId;
 });
 afterAll(()=>db.$disconnect());
 it.each(Array.from({length:12},(_,i)=>i))('month index %i: all eight sources reconcile through failed, partial and full payment',async month=>{
  const start=new Date(Date.UTC(2024,month,1)),end=new Date(Date.UTC(2024,month+1,1));
  const cutoff=new Date(end.getTime()+46*86400000),finance=randomUUID(),compliance=randomUUID();
  const sourceIds:string[]=[];
  for(let i=0;i<types.length;i++){
   const a=await db.bonusAward.create({data:{awardType:types[i],recipientQualificationId:qid,sourceEventId:randomUUID(),theoryAmount:(i+1)*10,payableAmount:(i+1)*10,kFactor:1,activeSnapshot:true,planLevelSnapshot:'STARTER',ruleVersionCode:rule,occurredAt:start,pendingUntil:new Date(end.getTime()+45*86400000),calculationDetail:{synthetic:'DOWNSTREAM_ONLY'}}});
   sourceIds.push(a.bonusAwardId);await db.bonusAwardLifecycleEvent.create({data:{bonusAwardId:a.bonusAwardId,status:'PENDING_45D',occurredAt:start}});
  }
  const schedule=await db.monthlyRecognitionSchedule.create({data:{subscriptionId,installmentNo:month+1,recognitionMonth:start,dueAt:start,status:'RECOGNIZED',recognizedAt:start,recognizedAmount:2000,rpvAmount:1200,ruleVersionCode:rule}});
  const rpv=await db.rpvUplineAwardEvent.create({data:{recognitionId:schedule.recognitionId,sourceQualificationId:qid,recipientQualificationId:qid,binaryGeneration:1,effectiveDirectCountSnapshot:0,unlockedDepthSnapshot:5,activeSnapshot:true,theoryAmount:70,payableAmount:70,ruleVersionCode:rule,occurredAt:start}});sourceIds.push(rpv.rpvAwardEventId);
  const global=await db.globalPoolSettlement.create({data:{periodStart:start,periodEnd:end,totalGpv:1000,poolRate:'0.08',poolAvailable:80,distributedAmount:80,undistributedAmount:0,ruleVersionCode:rule}});
  const ga=await db.globalPoolAward.create({data:{globalPoolSettlementId:global.globalPoolSettlementId,qualificationId:qid,rankLevel:'NEW_STAR',rankPoolRate:'0.08',rankPoolAmount:80,eligibleCount:1,payableAmount:80,weakSidePvSnapshot:1000,activeSnapshot:true}});sourceIds.push(ga.globalPoolAwardId);
  expect(await new BonusLifecycleService(db as any).matureDueAwards(cutoff)).toEqual({matured:6});
  expect(await pay.materialize(cutoff,rule)).toEqual({created:8});expect(await pay.materialize(cutoff,rule)).toEqual({created:0});
  const entries=await db.payableEntry.findMany({where:{sourceId:{in:sourceIds}}});
  expect(entries).toHaveLength(8);
  for(const [i,type] of [...types,'RPV','GLOBAL'].entries()){
   const row=entries.find(e=>e.awardType===type)!;expect(row.grossAmount.toString()).toBe(String((i+1)*10));
   expect(row.sourceType).toBe(type==='RPV'?'RPV_UPLINE_AWARD':type==='GLOBAL'?'GLOBAL_POOL_AWARD':'BONUS_AWARD');
  }
  const batch=await pay.createPayoutBatch(start,cutoff,rule);batches.push(batch.payoutBatchId);
  expect(batch.totalGross.toString()).toBe('360');expect(batch.totalNet.toString()).toBe('360');expect(batch.totalRecovery.toString()).toBe('0');
  const line=await db.payoutLine.findFirstOrThrow({where:{payoutBatchId:batch.payoutBatchId}});
  expect(new Set((line.detailJson as any).payableEntryIds)).toEqual(new Set(entries.map(e=>e.payableEntryId)));
  await ops.approvePayout(batch.payoutBatchId,'FINANCE_REVIEW',finance,'FINANCE',undefined,randomUUID(),randomUUID());
  await ops.approvePayout(batch.payoutBatchId,'COMPLIANCE_REVIEW',compliance,'COMPLIANCE_AUDIT',undefined,randomUUID(),randomUUID());
  await ops.exportPayout(batch.payoutBatchId,'SYNTHETIC-EXPORT-'+month,finance,'FINANCE',randomUUID(),randomUUID());
  for(const [status,amount,expected] of [['FAILED','0','FAILED'],['PAID','180','PARTIALLY_PAID'],['PAID','360','PAID']] as const){
   const body={results:[{payoutLineId:line.payoutLineId,status,paidAmount:amount,paymentReference:`SYNTHETIC-${month}-${amount}`} ]};
   await ops.recordPayoutResults(batch.payoutBatchId,body,finance,'FINANCE',randomUUID(),randomUUID());
   const replay=await ops.recordPayoutResults(batch.payoutBatchId,body,finance,'FINANCE',randomUUID(),randomUUID());expect(replay.replayed).toBe(true);
   expect((await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:batch.payoutBatchId}})).status).toBe(expected);
  }
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:batch.payoutBatchId}})).toBe(3);
  expect(await pay.materialize(cutoff,rule)).toEqual({created:0});
  expect(await db.payableEntry.count({where:{sourceId:{in:sourceIds}}})).toBe(8);
 },30000);
 it('year-end has 96 unique source entries and twelve paid batches totaling 4320',async()=>{
  expect(batches).toHaveLength(12);expect(await db.payableEntry.count({where:{qualificationId:qid}})).toBe(96);
  const paid=await db.payoutBatch.findMany({where:{payoutBatchId:{in:batches}}});expect(paid.every(b=>b.status==='PAID')).toBe(true);
  expect((await db.payoutBatch.aggregate({where:{payoutBatchId:{in:batches}},_sum:{totalNet:true}}))._sum.totalNet!.toString()).toBe('4320');
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:{in:batches}}})).toBe(36);
  const extra=await pay.createPayoutBatch(new Date('2024-01-01Z'),new Date('2025-04-01Z'),rule);expect(extra.totalNet.toString()).toBe('0');
 });
});
