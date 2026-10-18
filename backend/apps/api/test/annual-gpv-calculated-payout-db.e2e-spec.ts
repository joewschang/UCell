import {PrismaClient,Prisma} from '@prisma/client';
import {captureParameters,recognizeConsumption,sealGpvEvent} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {ReferralBonusService} from '../src/modules/bonus/referral-bonus.service';
import {BinaryBonusService} from '../src/modules/bonus/binary-bonus.service';
import {BonusQueryService} from '../src/modules/bonus/bonus-query.service';
import {RuntimeRuleService} from '../src/modules/rules/runtime-rule.service';
import {SettlementCalendarService} from '../src/modules/settlement/settlement-calendar.service';
import {BonusLifecycleService} from '../src/modules/bonus/bonus-lifecycle.service';
import {UnifiedPayableService} from '../src/modules/payout/unified-payable.service';
import {RecoveryBalanceService} from '../src/modules/payout/recovery-balance.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw Error('ISOLATED_DATABASE_REQUIRED');
describe('Calculated GPV to payable across twelve monthly sample weeks',()=>{
 const db=new PrismaClient({datasources:{db:{url}}}),rule='TEST_GPV_YEAR_'+randomUUID(),ids:string[]=[];
 const query=new BonusQueryService(db as any),rules=new RuntimeRuleService(db as any),calendar=new SettlementCalendarService(db as any);
 const referral=new ReferralBonusService(db as any,rules,query,calendar),binary=new BinaryBonusService(db as any,rules,query,calendar);
 const pay=new UnifiedPayableService(db as any,new RecoveryBalanceService(db as any));let product:any;
 beforeAll(async()=>{
  const from=new Date('2023-01-01Z'),rows=await db.runtimeRuleParameter.findMany({where:{ruleVersionCode:'R1.0B'},orderBy:{effectiveFrom:'asc'}});
  const params=new Map(rows.map(r=>[JSON.stringify([r.parameterCode,r.scopeKey]),{code:r.parameterCode,scope:r.scopeKey,value:r.valueJson!}]));
  for(const kind of ['REFERRAL_K0','BINARY_K1','MATCHING_K2']){
   for(const [code,value] of [['settlement.timezone','UTC'],['settlement.period',{unit:'WEEK',count:1,anchorLocal:'2024-01-07T00:00:00'}],['settlement.cut_off',{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'SYNTHETIC_SAMPLE_WEEKS'}]] as const)params.set(JSON.stringify([code,kind]),{code,scope:kind,value:value as any});
  }
  for(const p of params.values())await db.runtimeRuleParameter.create({data:{ruleVersionCode:rule,parameterCode:p.code,scopeKey:p.scope,valueJson:p.value,effectiveFrom:from}});
  for(const [code,scope,value] of [['referral.g1.rate','STARTER','0.15'],['equalization.rate','STARTER:G2','0.10'],['binary.pair.rate','*','0.12'],['matching.rate','1','0.15']])expect(new Prisma.Decimal(params.get(JSON.stringify([code,scope]))!.value as string).eq(value)).toBe(true);
  const person=await db.person.create({data:{legalName:'SYNTHETIC CALCULATED GPV YEAR'}});
  // 0 = sponsor above 1; 2/3 are the left/right buyers under 1.
  for(let i=0;i<4;i++){
   const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:from}});ids.push(q.qualificationId);
   await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:from,sourceType:'TEST'}});
   await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:from,sourceType:'TEST'}});
   if(i<2)await db.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:from,sourceType:'TEST',ruleVersionCode:rule}});
   if(i>0)await db.sponsorRelationship.create({data:{sponsorQualificationId:ids[i===1?0:1],childQualificationId:q.qualificationId,sponsorSequenceNo:i===1?1:i-1,effectiveFrom:from}});
   if(i>1)await db.binaryPlacement.create({data:{parentQualificationId:ids[1],childQualificationId:q.qualificationId,side:i===2?'LEFT':'RIGHT',effectiveFrom:from}});
  }
  product=await db.productReference.create({data:{sku:randomUUID(),displayName:'Synthetic GPV source',currentPrice:1000}});
 });
 afterAll(()=>db.$disconnect());
 it.each(Array.from({length:12},(_,i)=>i))('month index %i: paid order snapshots produce independently checked referral/equalization/binary/matching payables',async month=>{
  const start=new Date(Date.UTC(2024,month,1));start.setUTCDate(start.getUTCDate()+(7-start.getUTCDay())%7);
  const end=new Date(start.getTime()+7*86400000),at=new Date(start.getTime()+86400000),cutoff=new Date(end.getTime()+46*86400000);
  const snapshot=await captureParameters(db as any,at,rule);
  for(const qid of ids.slice(2)){
   const order=await db.order.create({data:{qualificationId:qid,purpose:'RETAIL',status:'PAID',paidAt:at,grossAmount:1000,netAmount:1000,ruleVersionCode:rule,parameterSnapshotHash:snapshot.hash,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:1000,lineAmount:1000,gpvRateSnapshot:1,gpvAmountSnapshot:1000,ruleProfileSnapshot:{synthetic:true}}}},include:{lines:true}});
   const input={qualificationId:qid,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,amount:1000,eligible:true,concreteVolumeType:'GPV' as const,productProfileVersion:'SYNTHETIC',ruleVersionCode:rule,parameterSnapshotHash:snapshot.hash,recognizedAt:at,activeThreshold:'2000'};
   await db.$transaction(async tx=>{const recognized=await recognizeConsumption(tx,input);expect(recognized.created).toBe(true);await sealGpvEvent(tx,recognized.volume!);},{timeout:30000});
   await db.$transaction(async tx=>{expect((await recognizeConsumption(tx,input)).created).toBe(false);});
  }
  const k0=await referral.settle(start,end,rule),k1=await binary.settleBinary(start,end,rule),k2=await binary.settleMatching(start,end,rule);
  const batchIds=[k0.settlementBatchId,k1.settlementBatchId,k2.settlementBatchId];
  for(const batch of [k0,k1,k2]){expect(batch.kFactor.toString()).toBe('1');expect(batch.totalGpv.toString()).toBe('2000');}
  const awards=await db.bonusAward.findMany({where:{settlementBatchId:{in:batchIds}}});
  const expected={REFERRAL:['150','150'],EQUALIZATION:['15','15'],BINARY:['0','120'],MATCHING:['18']};
  for(const [type,amounts] of Object.entries(expected))expect(awards.filter(a=>a.awardType===type).map(a=>a.payableAmount.toString()).sort()).toEqual(amounts.sort());
  expect(awards).toHaveLength(7);
  expect(awards.filter(a=>a.payableAmount.eq(0)).map(a=>[a.awardType,a.recipientQualificationId])).toEqual([['BINARY',ids[0]]]);
  expect(awards.filter(a=>a.payableAmount.gt(0)&&['REFERRAL','BINARY'].includes(a.awardType)).every(a=>a.recipientQualificationId===ids[1])).toBe(true);
  expect(awards.filter(a=>['EQUALIZATION','MATCHING'].includes(a.awardType)).every(a=>a.recipientQualificationId===ids[0])).toBe(true);
  const carry=await db.binaryCarry.findFirstOrThrow({where:{periodEnd:end,ruleVersionCode:rule,qualificationId:ids[1]}});expect(carry.leftCarryOut.toString()).toBe('0');expect(carry.rightCarryOut.toString()).toBe('0');
  await referral.settle(start,end,rule);await binary.settleBinary(start,end,rule);await binary.settleMatching(start,end,rule);
  expect(await db.bonusAward.count({where:{settlementBatchId:{in:batchIds}}})).toBe(7);
  expect(await new BonusLifecycleService(db as any).matureDueAwards(new Date())).toEqual({matured:7});
  expect(await pay.materialize(cutoff,rule)).toEqual({created:6});expect(await pay.materialize(cutoff,rule)).toEqual({created:0});
  const payout=await pay.createPayoutBatch(start,cutoff,rule);expect(payout.totalGross.toString()).toBe('468');
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:payout.payoutBatchId}});expect(lines).toHaveLength(2);
  expect(lines.find(l=>l.recipientQualificationId===ids[1])!.netAmount.toString()).toBe('420');expect(lines.find(l=>l.recipientQualificationId===ids[0])!.netAmount.toString()).toBe('48');
 },30000);
 it('year sample totals preserve 24 GPV sources, 36 settlements, 84 calculated awards (12 zero) and 5616 payable',async()=>{
  expect(await db.pvLedger.count({where:{ruleVersionCode:rule,pvType:'GPV'}})).toBe(24);
  expect(await db.settlementBatch.count({where:{ruleVersionCode:rule,status:'FINALIZED'}})).toBe(36);
  expect(await db.bonusAward.count({where:{ruleVersionCode:rule}})).toBe(84);
  const totals=await db.payableEntry.aggregate({where:{ruleVersionCode:rule},_count:true,_sum:{grossAmount:true}});expect(totals._count).toBe(72);expect(totals._sum.grossAmount!.toString()).toBe('5616');
 });
});
