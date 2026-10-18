import {GlobalPoolService} from '../src/modules/global-pool/global-pool.service';
import {GlobalPoolPersistence} from '../src/modules/global-pool/global-pool-persistence';
import {SubscriptionService} from '../src/modules/subscription/subscription.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {RpvService} from '../src/modules/rpv/rpv.service';
import {processRecognition,processRetailReferralPayment} from '../../worker/src/main';
import {EpvService} from '../src/modules/epv/epv.service';
import {EpvMonthService} from '../src/modules/epv/epv-month.service';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';
import {PrismaClient,Prisma} from '@prisma/client';
import {claimOutboxLease,captureParameters,recognizeConsumption,sealGpvEvent,processHistoricalReturn} from '@ucell/database';
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
describe('Calculated GPV across all weeks intersecting leap year 2024',()=>{
 const weeks:Date[]=[];
 for(let at=Date.parse('2023-12-31T00:00:00Z');at<Date.parse('2025-01-01T00:00:00Z');at+=7*86400000)weeks.push(new Date(at));
 const db=new PrismaClient({datasources:{db:{url}}}),rule='TEST_GPV_CONTINUOUS_'+randomUUID(),ids:string[]=[];
 const query=new BonusQueryService(db as any),rules=new RuntimeRuleService(db as any),calendar=new SettlementCalendarService(db as any);
 const referral=new ReferralBonusService(db as any,rules,query,calendar),binary=new BinaryBonusService(db as any,rules,query,calendar);
 const pay=new UnifiedPayableService(db as any,new RecoveryBalanceService(db as any));let product:any;
 beforeAll(async()=>{
  const from=new Date('2023-01-01Z'),rows=await db.runtimeRuleParameter.findMany({where:{ruleVersionCode:'R1.0B'},orderBy:{effectiveFrom:'asc'}});
  const params=new Map(rows.map(r=>[JSON.stringify([r.parameterCode,r.scopeKey]),{code:r.parameterCode,scope:r.scopeKey,value:r.valueJson!}]));
  for(const kind of ['REFERRAL_K0','BINARY_K1','MATCHING_K2']){
   for(const [code,value] of [['settlement.timezone','UTC'],['settlement.period',{unit:'WEEK',count:1,anchorLocal:'2023-12-31T00:00:00'}],['settlement.cut_off',{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'SYNTHETIC_SAMPLE_WEEKS'}]] as const)params.set(JSON.stringify([code,kind]),{code,scope:kind,value:value as any});
  }
  for(const [code,value] of [
   ['subscription.calendar.timezone','Asia/Taipei'],
   ['subscription.calendar.period',{unit:'MONTH',count:1,anchorLocal:'2024-01-01T00:00:00'}],
   ['subscription.calendar.cutoff',{localTime:'00:00:00',daysAfterPeriodStart:0,approvalReference:'SYNTHETIC_MONTH_OPENING'}]
  ] as Array<[string,Prisma.JsonObject|string]>)params.set(JSON.stringify([code,'*']),{code,scope:'*',value});
  for(const [code,value] of [['settlement.timezone','UTC'],['settlement.period',{unit:'MONTH',count:1,anchorLocal:'2024-01-01T00:00:00'}],['settlement.cut_off',{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'SYNTHETIC_GLOBAL_MONTH'}]] as Array<[string,Prisma.JsonObject|string]>)params.set(JSON.stringify([code,'GLOBAL']),{code,scope:'GLOBAL',value});
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
 it.each(weeks.map((start,index)=>({start,index})))('week $index: alternating sides preserve carry and exact calculated payout',async ({start,index})=>{
  const paired=index%2===0?50:150, binaryAmount=new Prisma.Decimal(paired).mul('0.12'),matchingAmount=binaryAmount.mul('0.15');
  const end=new Date(start.getTime()+7*86400000),at=new Date(start.getTime()+86400000),cutoff=new Date(end.getTime()+46*86400000);
  const snapshot=await captureParameters(db as any,at,rule);
  for(const [side,qid] of ids.slice(2).entries()){
   const amount=(index+side)%2===0?150:50;
   const order=await db.order.create({data:{qualificationId:qid,purpose:'RETAIL',status:'PAID',paidAt:at,grossAmount:amount,netAmount:amount,ruleVersionCode:rule,parameterSnapshotHash:snapshot.hash,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:amount,lineAmount:amount,gpvRateSnapshot:1,gpvAmountSnapshot:amount,ruleProfileSnapshot:{synthetic:true}}}},include:{lines:true}});
   const input={qualificationId:qid,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,amount,eligible:true,concreteVolumeType:'GPV' as const,productProfileVersion:'SYNTHETIC',ruleVersionCode:rule,parameterSnapshotHash:snapshot.hash,recognizedAt:at,activeThreshold:'2000'};
   await db.$transaction(async tx=>{const recognized=await recognizeConsumption(tx,input);expect(recognized.created).toBe(true);await sealGpvEvent(tx,recognized.volume!);},{timeout:30000});
   await db.$transaction(async tx=>{expect((await recognizeConsumption(tx,input)).created).toBe(false);});
  }
  const k0=await referral.settle(start,end,rule),k1=await binary.settleBinary(start,end,rule),k2=await binary.settleMatching(start,end,rule);
  const batchIds=[k0.settlementBatchId,k1.settlementBatchId,k2.settlementBatchId];
  for(const batch of [k0,k1,k2]){expect(batch.kFactor.toString()).toBe('1');expect(batch.totalGpv.toString()).toBe('200');}
  const awards=await db.bonusAward.findMany({where:{settlementBatchId:{in:batchIds}}});
  const expected={REFERRAL:['22.5','7.5'],EQUALIZATION:['2.25','0.75'],BINARY:['0',binaryAmount.toString()],MATCHING:[matchingAmount.toString()]};
  for(const [type,amounts] of Object.entries(expected))expect(awards.filter(a=>a.awardType===type).map(a=>a.payableAmount.toString()).sort()).toEqual(amounts.sort());
  expect(awards).toHaveLength(7);
  expect(awards.filter(a=>a.payableAmount.eq(0)).map(a=>[a.awardType,a.recipientQualificationId])).toEqual([['BINARY',ids[0]]]);
  expect(awards.filter(a=>a.payableAmount.gt(0)&&['REFERRAL','BINARY'].includes(a.awardType)).every(a=>a.recipientQualificationId===ids[1])).toBe(true);
  expect(awards.filter(a=>['EQUALIZATION','MATCHING'].includes(a.awardType)).every(a=>a.recipientQualificationId===ids[0])).toBe(true);
  const carry=await db.binaryCarry.findFirstOrThrow({where:{periodEnd:end,ruleVersionCode:rule,qualificationId:ids[1]}});expect(carry.leftCarryIn.toString()).toBe(index%2===0?'0':'100');expect(carry.rightCarryIn.toString()).toBe('0');expect(carry.pairedPv.toString()).toBe(String(paired));expect(carry.leftCarryOut.toString()).toBe(index%2===0?'100':'0');expect(carry.rightCarryOut.toString()).toBe('0');
  await referral.settle(start,end,rule);await binary.settleBinary(start,end,rule);await binary.settleMatching(start,end,rule);
  expect(await db.bonusAward.count({where:{settlementBatchId:{in:batchIds}}})).toBe(7);
  expect(await new BonusLifecycleService(db as any).matureDueAwards(new Date())).toEqual({matured:7});
  expect(await pay.materialize(cutoff,rule)).toEqual({created:6});expect(await pay.materialize(cutoff,rule)).toEqual({created:0});
  const payout=await pay.createPayoutBatch(start,cutoff,rule);expect(payout.totalGross.toString()).toBe(index%2===0?'39.9':'53.7');
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:payout.payoutBatchId}});expect(lines).toHaveLength(2);
  expect(lines.find(l=>l.recipientQualificationId===ids[1])!.netAmount.toString()).toBe(index%2===0?'36':'48');expect(lines.find(l=>l.recipientQualificationId===ids[0])!.netAmount.toString()).toBe(index%2===0?'3.9':'5.7');
 },30000);
 it('all 53 intersecting weeks reconcile with 100 unpaired GPV carried into next year',async()=>{
  expect(weeks).toHaveLength(53);expect(weeks[0].toISOString()).toBe('2023-12-31T00:00:00.000Z');expect(new Date(weeks[52].getTime()+7*86400000).toISOString()).toBe('2025-01-05T00:00:00.000Z');
  expect(await db.pvLedger.count({where:{ruleVersionCode:rule,pvType:'GPV'}})).toBe(106);
  expect(await db.settlementBatch.count({where:{ruleVersionCode:rule,status:'FINALIZED'}})).toBe(159);
  expect(await db.bonusAward.count({where:{ruleVersionCode:rule}})).toBe(371);
  const totals=await db.payableEntry.aggregate({where:{ruleVersionCode:rule},_count:true,_sum:{grossAmount:true}});expect(totals._count).toBe(318);expect(totals._sum.grossAmount!.toString()).toBe('2473.5');
 });
 it('consumes the carried 100 GPV next year once, then an empty week produces no new payable',async()=>{
  const start=new Date('2025-01-05Z'),end=new Date('2025-01-12Z'),at=new Date('2025-01-06Z'),cutoff=new Date('2025-03-01Z');
  const previousAwards=await db.bonusAward.findMany({where:{ruleVersionCode:rule},orderBy:{bonusAwardId:'asc'}});
  const previousCarry=await db.binaryCarry.findFirstOrThrow({where:{qualificationId:ids[1],periodEnd:start,ruleVersionCode:rule}});
  expect(previousCarry.leftCarryOut.toString()).toBe('100');
  const snapshot=await captureParameters(db as any,at,rule),qid=ids[3];
  const order=await db.order.create({data:{qualificationId:qid,purpose:'RETAIL',status:'PAID',paidAt:at,grossAmount:100,netAmount:100,ruleVersionCode:rule,parameterSnapshotHash:snapshot.hash,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:1,gpvAmountSnapshot:100,ruleProfileSnapshot:{synthetic:true}}}},include:{lines:true}});
  const input={qualificationId:qid,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,amount:100,eligible:true,concreteVolumeType:'GPV' as const,productProfileVersion:'SYNTHETIC',ruleVersionCode:rule,parameterSnapshotHash:snapshot.hash,recognizedAt:at,activeThreshold:'2000'};
  await db.$transaction(async tx=>{const r=await recognizeConsumption(tx,input);expect(r.created).toBe(true);await sealGpvEvent(tx,r.volume!);},{timeout:30000});
  const k0=await referral.settle(start,end,rule),k1=await binary.settleBinary(start,end,rule),k2=await binary.settleMatching(start,end,rule);
  const batchIds=[k0.settlementBatchId,k1.settlementBatchId,k2.settlementBatchId];
  const awards=await db.bonusAward.findMany({where:{settlementBatchId:{in:batchIds}}});
  for(const [type,expected] of Object.entries({REFERRAL:['15'],EQUALIZATION:['1.5'],BINARY:['0','12'],MATCHING:['1.8']}))expect(awards.filter(a=>a.awardType===type).map(a=>a.payableAmount.toString()).sort()).toEqual(expected.sort());
  expect(awards).toHaveLength(5);
  const carry=await db.binaryCarry.findFirstOrThrow({where:{qualificationId:ids[1],periodEnd:end,ruleVersionCode:rule}});
  expect([carry.leftCarryIn,carry.rightCarryIn,carry.leftPeriodGpv,carry.rightPeriodGpv,carry.pairedPv,carry.leftCarryOut,carry.rightCarryOut].map(v=>v.toString())).toEqual(['100','0','0','100','100','0','0']);
  await db.$transaction(async tx=>{expect((await recognizeConsumption(tx,input)).created).toBe(false);});
  await referral.settle(start,end,rule);await binary.settleBinary(start,end,rule);await binary.settleMatching(start,end,rule);
  expect(await db.bonusAward.count({where:{settlementBatchId:{in:batchIds}}})).toBe(5);
  expect(await new BonusLifecycleService(db as any).matureDueAwards(new Date())).toEqual({matured:5});
  expect(await pay.materialize(cutoff,rule)).toEqual({created:4});expect(await pay.materialize(cutoff,rule)).toEqual({created:0});
  const payout=await pay.createPayoutBatch(start,cutoff,rule);expect(payout.totalGross.toString()).toBe('30.3');
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:payout.payoutBatchId}});
  expect(lines.find(l=>l.recipientQualificationId===ids[1])!.netAmount.toString()).toBe('27');expect(lines.find(l=>l.recipientQualificationId===ids[0])!.netAmount.toString()).toBe('3.3');
  const emptyEnd=new Date('2025-01-19Z');
  await referral.settle(end,emptyEnd,rule);await binary.settleBinary(end,emptyEnd,rule);await binary.settleMatching(end,emptyEnd,rule);
  const emptyAwards=await db.bonusAward.findMany({where:{settlementBatch:{periodStart:end,periodEnd:emptyEnd,ruleVersionCode:rule}}});
  expect(emptyAwards.every(a=>a.payableAmount.eq(0))).toBe(true);
  const emptyCarry=await db.binaryCarry.findFirstOrThrow({where:{qualificationId:ids[1],periodEnd:emptyEnd,ruleVersionCode:rule}});
  expect([emptyCarry.leftCarryIn,emptyCarry.rightCarryIn,emptyCarry.pairedPv,emptyCarry.leftCarryOut,emptyCarry.rightCarryOut].map(v=>v.toString())).toEqual(['0','0','0','0','0']);
  await new BonusLifecycleService(db as any).matureDueAwards(new Date());expect(await pay.materialize(new Date('2025-03-10Z'),rule)).toEqual({created:0});
  expect((await pay.createPayoutBatch(end,new Date('2025-03-10Z'),rule)).totalGross.toString()).toBe('0');
  expect(await db.bonusAward.findMany({where:{bonusAwardId:{in:previousAwards.map(a=>a.bonusAwardId)}},orderBy:{bonusAwardId:'asc'}})).toEqual(previousAwards);
  expect(await db.binaryCarry.findUniqueOrThrow({where:{binaryCarryId:previousCarry.binaryCarryId}})).toEqual(previousCarry);
  const total=await db.payableEntry.aggregate({where:{ruleVersionCode:rule},_count:true,_sum:{grossAmount:true}});expect(total._count).toBe(322);expect(total._sum.grossAmount!.toString()).toBe('2503.8');
 },30000);
 it('late full return replays cross-year carry and records recovery exactly once without rewriting original awards',async()=>{
  const order=await db.order.findFirstOrThrow({where:{qualificationId:ids[2],ruleVersionCode:rule,paidAt:new Date('2024-12-30Z')},include:{lines:true}});
  expect(order.netAmount.toString()).toBe('150');
  const beforeAwards=await db.bonusAward.findMany({where:{ruleVersionCode:rule},orderBy:{bonusAwardId:'asc'}});
  const beforeCarry=await db.binaryCarry.findMany({where:{ruleVersionCode:rule},orderBy:{binaryCarryId:'asc'}});
  const beforePayables=await db.payableEntry.findMany({where:{ruleVersionCode:rule},orderBy:{payableEntryId:'asc'}});
  const ret=await db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',postedAt:new Date('2025-01-20Z'),occurredAt:new Date('2025-01-20Z'),reasonCode:'SYNTHETIC_CROSS_YEAR_FULL_RETURN',idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:order.lines[0].orderLineId,quantity:1,returnAmount:150,gpvReversalAmount:150}}}});
  await db.$transaction(tx=>processHistoricalReturn(tx,ret.returnCaseId),{timeout:60000});
  const postings=await db.entitlementReplayPosting.findMany({where:{snapshot:{ruleVersionCode:rule}},include:{snapshot:true}});
  expect(postings).toHaveLength(13);expect(postings.filter(p=>p.delta.lt(0))).toHaveLength(6);expect(postings.filter(p=>p.delta.eq(0))).toHaveLength(7);expect(postings.some(p=>p.delta.gt(0))).toBe(false);
  for(const [kind,expected] of Object.entries({REFERRAL_K0:'-24.75',BINARY_K1:'-18',MATCHING_K2:'-2.7'}))expect(postings.filter(p=>p.snapshot.kind===kind).reduce((sum,p)=>sum.add(p.delta),new Prisma.Decimal(0)).toString()).toBe(expected);
  expect(postings.filter(p=>p.delta.lt(0)).every(p=>p.recoveryId)).toBe(true);expect(postings.filter(p=>p.delta.eq(0)).every(p=>p.recoveryId===null&&p.correctionAwardId===null)).toBe(true);
  const recoveries=await db.bonusRecoveryEvent.findMany({where:{returnCaseId:ret.returnCaseId}});
  expect(recoveries).toHaveLength(6);expect(recoveries.reduce((sum,r)=>sum.add(r.outstandingAmount),new Prisma.Decimal(0)).toString()).toBe('45.45');
  const projection=await db.replayCarryProjection.findFirstOrThrow({where:{ruleVersionCode:rule,periodEnd:new Date('2025-01-19Z')},orderBy:{sequence:'desc'}});
  expect((projection.carry as any)[ids[1]]).toMatchObject({left:'0',right:'150'});
  expect(await db.bonusAward.findMany({where:{bonusAwardId:{in:beforeAwards.map(a=>a.bonusAwardId)}},orderBy:{bonusAwardId:'asc'}})).toEqual(beforeAwards);
  expect(await db.binaryCarry.findMany({where:{ruleVersionCode:rule},orderBy:{binaryCarryId:'asc'}})).toEqual(beforeCarry);
  expect(await db.payableEntry.findMany({where:{ruleVersionCode:rule},orderBy:{payableEntryId:'asc'}})).toEqual(beforePayables);
  const reversals=await db.pvLedger.findMany({where:{sourceType:'RETURN',sourceId:ret.returnCaseId,eventType:'GPV_REVERSAL'}});expect(reversals).toHaveLength(1);expect(reversals[0].amount.toString()).toBe('-150');
  const counts=async()=>({postings:await db.entitlementReplayPosting.count({where:{snapshot:{ruleVersionCode:rule}}}),recoveries:await db.bonusRecoveryEvent.count({where:{returnCaseId:ret.returnCaseId}}),projections:await db.replayCarryProjection.count({where:{ruleVersionCode:rule}}),reversals:await db.pvLedger.count({where:{sourceType:'RETURN',sourceId:ret.returnCaseId}})});
  const once=await counts();await db.$transaction(tx=>processHistoricalReturn(tx,ret.returnCaseId),{timeout:60000});expect(await counts()).toEqual(once);
  expect((await db.bonusRecoveryEvent.aggregate({where:{returnCaseId:ret.returnCaseId},_sum:{outstandingAmount:true}}))._sum.outstandingAmount!.toString()).toBe('45.45');
 },90000);

 it('next settlement consumes corrected carry, offsets all recoveries once and reconciles the net payout',async()=>{
  const start=new Date('2025-01-19Z'),end=new Date('2025-01-26Z'),at=new Date('2025-01-21Z'),cutoff=new Date('2025-03-15Z');
  const old=await db.binaryCarry.findFirstOrThrow({where:{qualificationId:ids[1],periodEnd:start,ruleVersionCode:rule}});expect(old.rightCarryOut.toString()).toBe('0');
  const snapshot=await captureParameters(db as any,at,rule),qid=ids[2];
  const order=await db.order.create({data:{qualificationId:qid,purpose:'RETAIL',status:'PAID',paidAt:at,grossAmount:300,netAmount:300,ruleVersionCode:rule,parameterSnapshotHash:snapshot.hash,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:300,lineAmount:300,gpvRateSnapshot:1,gpvAmountSnapshot:300,ruleProfileSnapshot:{synthetic:true}}}},include:{lines:true}});
  await db.$transaction(async tx=>{const r=await recognizeConsumption(tx,{qualificationId:qid,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,amount:300,eligible:true,concreteVolumeType:'GPV',productProfileVersion:'SYNTHETIC',ruleVersionCode:rule,parameterSnapshotHash:snapshot.hash,recognizedAt:at,activeThreshold:'2000'});expect(r.created).toBe(true);await sealGpvEvent(tx,r.volume!);},{timeout:30000});
  const k0=await referral.settle(start,end,rule),k1=await binary.settleBinary(start,end,rule),k2=await binary.settleMatching(start,end,rule);
  const batchIds=[k0.settlementBatchId,k1.settlementBatchId,k2.settlementBatchId];
  const awards=await db.bonusAward.findMany({where:{settlementBatchId:{in:batchIds}}});
  for(const [type,expected] of Object.entries({REFERRAL:['45'],EQUALIZATION:['4.5'],BINARY:['0','18'],MATCHING:['2.7']}))expect(awards.filter(a=>a.awardType===type).map(a=>a.payableAmount.toString()).sort()).toEqual(expected.sort());
  expect(awards).toHaveLength(5);
  const carry=await db.binaryCarry.findFirstOrThrow({where:{qualificationId:ids[1],periodEnd:end,ruleVersionCode:rule}});
  expect([carry.leftCarryIn,carry.rightCarryIn,carry.leftPeriodGpv,carry.rightPeriodGpv,carry.pairedPv,carry.leftCarryOut,carry.rightCarryOut].map(v=>v.toString())).toEqual(['0','150','300','0','150','150','0']);
  expect(await new BonusLifecycleService(db as any).matureDueAwards(new Date())).toEqual({matured:5});
  expect(await pay.materialize(cutoff,rule)).toEqual({created:4});
  const payout=await pay.createPayoutBatch(start,cutoff,rule);
  expect([payout.totalGross,payout.totalRecovery,payout.totalNet].map(v=>v.toString())).toEqual(['70.2','45.45','24.75']);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:payout.payoutBatchId}});expect(lines).toHaveLength(2);
  for(const [qid,expected] of [[ids[1],['63','40.5','22.5']],[ids[0],['7.2','4.95','2.25']]] as const){const line=lines.find(l=>l.recipientQualificationId===qid)!;expect([line.grossAmount,line.recoveryOffset,line.netAmount].map(v=>v.toString())).toEqual(expected);}
  const recoveryWhere={bonusAward:{ruleVersionCode:rule}};
  const recoveries=await db.bonusRecoveryEvent.findMany({where:recoveryWhere});expect(recoveries).toHaveLength(6);expect(recoveries.every(r=>r.status==='RECOVERED'&&r.outstandingAmount.eq(0)&&r.recoveredAmount.eq(r.recoveryAmount))).toBe(true);
  const applications=await db.recoveryApplication.findMany({where:{payoutLineId:{in:lines.map(l=>l.payoutLineId)}},orderBy:{bonusRecoveryEventId:'asc'}});expect(applications).toHaveLength(6);expect(new Set(applications.map(a=>a.bonusRecoveryEventId)).size).toBe(6);
  const recovery=new RecoveryBalanceService(db as any);
  for(const line of lines)expect((await db.$transaction(tx=>recovery.apply(tx,{qualificationId:line.recipientQualificationId,payoutLineId:line.payoutLineId,maxAmount:line.grossAmount}))).applied.toString()).toBe(line.recoveryOffset.toString());
  await referral.settle(start,end,rule);await binary.settleBinary(start,end,rule);await binary.settleMatching(start,end,rule);expect(await pay.materialize(cutoff,rule)).toEqual({created:0});
  const ret=await db.returnCase.findFirstOrThrow({where:{order:{ruleVersionCode:rule},reasonCode:'SYNTHETIC_CROSS_YEAR_FULL_RETURN'}});await db.$transaction(tx=>processHistoricalReturn(tx,ret.returnCaseId),{timeout:60000});
  expect(await db.bonusRecoveryEvent.findMany({where:recoveryWhere,orderBy:{bonusRecoveryEventId:'asc'}})).toEqual([...recoveries].sort((a,b)=>a.bonusRecoveryEventId.localeCompare(b.bonusRecoveryEventId)));
  expect(await db.recoveryApplication.findMany({where:{payoutLineId:{in:lines.map(l=>l.payoutLineId)}},orderBy:{bonusRecoveryEventId:'asc'}})).toEqual(applications);
  const ops=new AdminOperationsService(db as any,new AuditService()),finance=randomUUID(),compliance=randomUUID();
  await ops.approvePayout(payout.payoutBatchId,'FINANCE_REVIEW',finance,'FINANCE',undefined,randomUUID(),randomUUID());await ops.approvePayout(payout.payoutBatchId,'COMPLIANCE_REVIEW',compliance,'COMPLIANCE_AUDIT',undefined,randomUUID(),randomUUID());
  await ops.exportPayout(payout.payoutBatchId,'SYNTHETIC-CROSS-YEAR-OFFSET',finance,'FINANCE',randomUUID(),randomUUID());
  const body={results:lines.map(line=>({payoutLineId:line.payoutLineId,status:'PAID' as const,paidAmount:line.netAmount.toString(),paymentReference:'SYNTHETIC-OFFSET-'+line.payoutLineId}))};
  await ops.recordPayoutResults(payout.payoutBatchId,body,finance,'FINANCE',randomUUID(),randomUUID());expect((await ops.recordPayoutResults(payout.payoutBatchId,body,finance,'FINANCE',randomUUID(),randomUUID())).replayed).toBe(true);
  expect((await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:payout.payoutBatchId}})).status).toBe('PAID');expect(await db.payoutPaymentResult.count({where:{payoutBatchId:payout.payoutBatchId}})).toBe(2);
  expect((await pay.createPayoutBatch(start,cutoff,rule)).totalGross.toString()).toBe('0');
 },60000);

 const epvOrders:string[]=[];let gpvBeforeEpv:any;
 async function gpvState(){return {volumes:await db.pvLedger.findMany({where:{ruleVersionCode:rule,pvType:'GPV'},orderBy:{eventId:'asc'}}),awards:await db.bonusAward.findMany({where:{ruleVersionCode:rule,awardType:{not:'EPV'}},orderBy:{bonusAwardId:'asc'}}),carry:await db.binaryCarry.findMany({where:{ruleVersionCode:rule},orderBy:{binaryCarryId:'asc'}}),payables:await db.payableEntry.findMany({where:{ruleVersionCode:rule,awardType:{not:'EPV'}},orderBy:{payableEntryId:'asc'}}),recoveries:await db.bonusRecoveryEvent.findMany({where:{bonusAward:{ruleVersionCode:rule}},orderBy:{bonusRecoveryEventId:'asc'}})};}
 it.each(Array.from({length:12},(_,i)=>i))('same-organization EPV month %i preserves monthly threshold and ball isolation',async month=>{
  if(month===0)gpvBeforeEpv=await gpvState();
  const service=new EpvService(db as any,rules,query,new EpvMonthService());
  const opening=new Date(Date.UTC(2024,month,1)-8*3600000),cutoff=new Date(Date.UTC(2024,month+1,1)+46*86400000);
  const snap=await captureParameters(db as any,opening,rule),value=(code:string,scope='*')=>snap.parameters.find(p=>p.code===code&&p.scope===scope)!.value;
  expect(value('epv.calendar.timezone')).toBe('Asia/Taipei');
  for(const [code,scope,expected] of [['epv.base_amount','*','2000'],['epv.rate','*','0.6'],['epv.self.rate','*','0.5'],['epv.upline.rate','1','0.06']])expect(new Prisma.Decimal(value(code,scope) as string).eq(expected)).toBe(true);
  for(const [qid,day,expected,amounts] of [[ids[1],0,'0',['0','0']],[ids[0],1,'0',['0']],[ids[1],2,'600',['300','36']]] as const){
   const paidAt=new Date(opening.getTime()+day*86400000);
   const order=await db.order.create({data:{qualificationId:qid,purpose:'REPURCHASE',status:'PAID',paidAt,grossAmount:1500,netAmount:1500,ruleVersionCode:rule,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:1500,lineAmount:1500,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{synthetic:true}}}}});epvOrders.push(order.orderId);
   expect(await service.recognizeOrder(order.orderId,rule)).toMatchObject({epv:expected});
   const volume=await db.pvLedger.findFirstOrThrow({where:{sourceId:order.orderId,pvType:'EPV'}});expect(volume.amount.toString()).toBe(expected);
   const awards=await db.bonusAward.findMany({where:{sourceEventId:volume.eventId},orderBy:{generationNo:'asc'}});expect(awards.map(a=>a.payableAmount.toString())).toEqual(amounts);
   expect(awards.map(a=>a.recipientQualificationId)).toEqual(qid===ids[1]?[ids[1],ids[0]]:[ids[0]]);
   expect(await service.recognizeOrder(order.orderId,rule)).toMatchObject({skipped:'ALREADY_RECOGNIZED'});
  }
  expect(await new BonusLifecycleService(db as any).matureDueAwards(new Date())).toEqual({matured:5});
  expect(await pay.materialize(cutoff,rule)).toEqual({created:2});expect(await pay.materialize(cutoff,rule)).toEqual({created:0});
  const batch=await pay.createPayoutBatch(opening,cutoff,rule);expect([batch.totalGross,batch.totalRecovery,batch.totalNet].map(v=>v.toString())).toEqual(['336','0','336']);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:batch.payoutBatchId}});expect(lines).toHaveLength(2);expect(lines.find(l=>l.recipientQualificationId===ids[1])!.netAmount.toString()).toBe('300');expect(lines.find(l=>l.recipientQualificationId===ids[0])!.netAmount.toString()).toBe('36');
 },30000);
 it('same-organization EPV annual replay preserves 7200 EPV and 4032 payable without changing GPV history',async()=>{
  const service=new EpvService(db as any,rules,query,new EpvMonthService());for(const id of epvOrders)expect(await service.recognizeOrder(id,rule)).toMatchObject({skipped:'ALREADY_RECOGNIZED'});
  expect(epvOrders).toHaveLength(36);
  const volumes=await db.pvLedger.aggregate({where:{ruleVersionCode:rule,pvType:'EPV'},_count:true,_sum:{amount:true}});expect(volumes._count).toBe(36);expect(volumes._sum.amount!.toString()).toBe('7200');
  expect(await db.bonusAward.count({where:{ruleVersionCode:rule,awardType:'EPV'}})).toBe(60);
  const entries=await db.payableEntry.aggregate({where:{ruleVersionCode:rule,awardType:'EPV'},_count:true,_sum:{grossAmount:true}});expect(entries._count).toBe(24);expect(entries._sum.grossAmount!.toString()).toBe('4032');
  expect(await gpvState()).toEqual(gpvBeforeEpv);
 });

 const rpvIds:string[]=[];let rpvSchedules:any[],beforeRpv:any;
 async function protectedBeforeRpv(){return {
  volumes:await db.pvLedger.findMany({where:{ruleVersionCode:rule,pvType:{not:'RPV'}},orderBy:{eventId:'asc'}}),
  awards:await db.bonusAward.findMany({where:{ruleVersionCode:rule},orderBy:{bonusAwardId:'asc'}}),
  carry:await db.binaryCarry.findMany({where:{ruleVersionCode:rule},orderBy:{binaryCarryId:'asc'}}),
  payables:await db.payableEntry.findMany({where:{ruleVersionCode:rule,awardType:{not:'RPV'}},orderBy:{payableEntryId:'asc'}}),
  recoveries:await db.bonusRecoveryEvent.findMany({where:{bonusAward:{ruleVersionCode:rule}},orderBy:{bonusRecoveryEventId:'asc'}})
 };}
 it.each(Array.from({length:12},(_,i)=>i))('same-organization RPV month %i recognizes once across API and Worker',async month=>{
  if(month===0){
   beforeRpv=await protectedBeforeRpv();
   const plan=await db.subscriptionPlan.create({data:{planCode:'TEST_'+randomUUID(),displayName:'Synthetic same-organization annual prepaid',durationMonths:12,prepaidAmount:24000,productBoxQty:8,monthlyRecognizedAmount:2000,monthlyRpv:1200}});
   const service=new SubscriptionService(db as any,new IdempotencyService(db as any),new AuditService()),key=randomUUID();
   const dto={qualificationId:ids[2],planCode:plan.planCode as any,startMonth:'2024-01-01'};
   const {value:sub}=await service.create(dto,key,randomUUID(),undefined,rule);rpvSchedules=sub.schedules;
   expect(rpvSchedules).toHaveLength(12);expect(rpvSchedules.every(r=>r.status==='SCHEDULED'&&r.recognizedAmount.eq(2000)&&r.rpvAmount.eq(1200))).toBe(true);
   expect((await service.create(dto,key,randomUUID(),undefined,rule)).value.subscriptionId).toBe(sub.subscriptionId);
   expect(await db.monthlyRecognitionSchedule.count({where:{subscriptionId:sub.subscriptionId}})).toBe(12);
   expect(await db.pvLedger.count({where:{sourceId:sub.subscriptionId,pvType:'RPV'}})).toBe(0);
  }
  const row=rpvSchedules[month],opening=new Date(Date.UTC(2024,month,1)-8*3600000),cutoff=new Date(Date.UTC(2024,month+1,1)+46*86400000);
  expect(row.dueAt).toEqual(opening);
  const api=new RpvService(db as any,{} as any);
  if(month%2)await processRecognition(row.recognitionId,db as any);else await api.recognize(row.recognitionId);
  rpvIds.push(row.recognitionId);
  const awards=await db.rpvUplineAwardEvent.findMany({where:{recognitionId:row.recognitionId}});
  // Only ids[1] is a binary ancestor. Sponsor-only ids[0] must not receive RPV.
  expect(awards).toHaveLength(1);expect(awards[0]).toMatchObject({recipientQualificationId:ids[1],binaryGeneration:1,effectiveDirectCountSnapshot:2,unlockedDepthSnapshot:12,activeSnapshot:true});
  expect(awards[0].theoryAmount.toString()).toBe('100');expect(awards[0].payableAmount.toString()).toBe('100');
  await processRecognition(row.recognitionId,db as any);expect(await api.recognize(row.recognitionId)).toMatchObject({skipped:'ALREADY_RECOGNIZED'});
  expect(await db.pvLedger.count({where:{sourceLineId:row.recognitionId,pvType:'RPV'}})).toBe(1);
  expect(await db.memberNotification.count({where:{messageKey:'repurchase:recognized:'+row.recognitionId}})).toBe(1);
  const recognized=await db.monthlyRecognitionSchedule.findUniqueOrThrow({where:{recognitionId:row.recognitionId}});expect(recognized.status).toBe('RECOGNIZED');expect(recognized.workerBlocked).toBe(false);
  expect(await pay.materialize(cutoff,rule)).toEqual({created:1});expect(await pay.materialize(cutoff,rule)).toEqual({created:0});
  const batch=await pay.createPayoutBatch(opening,cutoff,rule);expect([batch.totalGross,batch.totalRecovery,batch.totalNet].map(v=>v.toString())).toEqual(['100','0','100']);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:batch.payoutBatchId}});expect(lines).toHaveLength(1);expect(lines[0].recipientQualificationId).toBe(ids[1]);
 },30000);
 it('same-organization RPV annual replay preserves 14400 volume and 1200 payable without changing GPV or EPV',async()=>{
  const api=new RpvService(db as any,{} as any);
  for(const id of rpvIds){await processRecognition(id,db as any);expect(await api.recognize(id)).toMatchObject({skipped:'ALREADY_RECOGNIZED'});}
  expect(rpvIds).toHaveLength(12);
  const volumes=await db.pvLedger.aggregate({where:{ruleVersionCode:rule,pvType:'RPV'},_count:true,_sum:{amount:true}});expect(volumes._count).toBe(12);expect(volumes._sum.amount!.toString()).toBe('14400');
  const awards=await db.rpvUplineAwardEvent.aggregate({where:{recognitionId:{in:rpvIds}},_count:true,_sum:{payableAmount:true}});expect(awards._count).toBe(12);expect(awards._sum.payableAmount!.toString()).toBe('1200');
  const entries=await db.payableEntry.aggregate({where:{ruleVersionCode:rule,awardType:'RPV'},_count:true,_sum:{grossAmount:true}});expect(entries._count).toBe(12);expect(entries._sum.grossAmount!.toString()).toBe('1200');
  expect(await db.memberNotification.count({where:{messageKey:{in:rpvIds.map(id=>'repurchase:recognized:'+id)}}})).toBe(12);
  expect(await protectedBeforeRpv()).toEqual(beforeRpv);
 });

 const retailOrders:string[]=[];let beforeRetail:any,retailPurchaser:string;
 async function protectedBeforeRetail(){return {
  volumes:await db.pvLedger.findMany({where:{ruleVersionCode:rule},orderBy:{eventId:'asc'}}),
  awards:await db.bonusAward.findMany({where:{ruleVersionCode:rule,awardType:{not:'RETAIL_REFERRAL'}},orderBy:{bonusAwardId:'asc'}}),
  rpv:await db.rpvUplineAwardEvent.findMany({where:{ruleVersionCode:rule},orderBy:{rpvAwardEventId:'asc'}}),
  carry:await db.binaryCarry.findMany({where:{ruleVersionCode:rule},orderBy:{binaryCarryId:'asc'}}),
  payables:await db.payableEntry.findMany({where:{ruleVersionCode:rule,awardType:{not:'RETAIL_REFERRAL'}},orderBy:{payableEntryId:'asc'}}),
  recoveries:await db.bonusRecoveryEvent.findMany({where:{bonusAward:{ruleVersionCode:rule}},orderBy:{bonusRecoveryEventId:'asc'}}),
  sponsor:await db.sponsorRelationship.findMany({where:{childQualificationId:{in:ids}},orderBy:{childQualificationId:'asc'}}),
  binary:await db.binaryPlacement.findMany({where:{childQualificationId:{in:ids}},orderBy:{childQualificationId:'asc'}})
 };}
 async function deliverRetail(orderId:string){
  const event=await db.outboxEvent.create({data:{eventType:'WEB_MEMBER_RETAIL_PAYMENT_CONFIRMED',aggregateType:'ORDER',aggregateId:orderId,payload:{orderId},correlationId:randomUUID()}});
  const lease=await claimOutboxLease(db,event);expect(lease).not.toBeNull();
  await processRetailReferralPayment(db as any,lease!);
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:event.outboxEventId}})).processStatus).toBe('PROCESSED');
  expect(await processRetailReferralPayment(db as any,lease!)).toEqual({lostLease:true});
 }
 it.each(Array.from({length:12},(_,i)=>i))('same-organization retail month %i preserves snapshot rate and eligibility',async month=>{
  if(month===0){beforeRetail=await protectedBeforeRetail();retailPurchaser=(await db.person.create({data:{legalName:'SYNTHETIC ANNUAL WEB RETAIL PURCHASER'}})).personId;}
  const paidAt=new Date(Date.UTC(2024,month,15,4)),cutoff=new Date(paidAt.getTime()+46*86400000),snapshot=await captureParameters(db as any,paidAt,rule);
  const sku=await db.productReference.create({data:{sku:randomUUID(),displayName:'Synthetic retail snapshot rate',currentPrice:1000}});
  const profile=await db.productRuleProfile.create({data:{productId:sku.productId,effectiveFrom:new Date('2023-01-01Z'),gpvRate:0,ruleVersionCode:rule,retailReferralEnabled:true,retailReferralCalculationType:'PERCENTAGE',retailReferralRate:'0.1',retailReferralBaseType:'NET_PAID_ITEM_AMOUNT'}});
  const cases=[{qid:ids[1],enabled:true,amount:'100',active:true},{qid:ids[2],enabled:true,amount:'0',active:false},{qid:ids[1],enabled:false,amount:null,active:true},{qid:null,enabled:true,amount:null,active:false}];
  const lines:string[]=[];
  for(const c of cases){
   const order=await db.order.create({data:{purchaserPersonId:retailPurchaser,purpose:'RETAIL',status:'PAID',grossAmount:1000,netAmount:1000,ruleVersionCode:rule,parameterSnapshotHash:snapshot.hash,paidAt,lines:{create:{productId:sku.productId,skuSnapshot:sku.sku,productNameSnapshot:sku.displayName,quantity:1,unitPrice:1000,lineAmount:1000,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{synthetic:true,profileId:profile.productRuleProfileId}}}},include:{lines:true}});
   retailOrders.push(order.orderId);lines.push(order.lines[0].orderLineId);
   await db.retailReferralOrderLineSnapshot.create({data:{orderLineId:order.lines[0].orderLineId,orderId:order.orderId,referrerQualificationId:c.qid,retailReferralEnabled:c.enabled,calculationType:c.enabled?'PERCENTAGE':null,rate:c.enabled?'0.1':null,baseType:c.enabled?'NET_PAID_ITEM_AMOUNT':null,netPaidItemAmount:1000,productRuleProfileId:profile.productRuleProfileId,productRuleVersion:rule,parameterSnapshotHash:snapshot.hash,attributionEvidence:{kind:'SYNTHETIC_ANNUAL'}}});
  }
  // Deliberate fixture mutation proves recognition reads the immutable order snapshot.
  await db.productRuleProfile.update({where:{productRuleProfileId:profile.productRuleProfileId},data:{retailReferralRate:'0.05'}});
  for(const [i,c] of cases.entries()){
   const orderId=retailOrders[retailOrders.length-4+i];await deliverRetail(orderId);await deliverRetail(orderId);
   const awards=await db.bonusAward.findMany({where:{awardType:'RETAIL_REFERRAL',sourceEventId:lines[i]},include:{lifecycleEvents:true}});
   if(c.amount===null){expect(awards).toHaveLength(0);continue;}
   expect(awards).toHaveLength(1);expect(awards[0]).toMatchObject({recipientQualificationId:c.qid,activeSnapshot:c.active,planLevelSnapshot:'STARTER'});
   expect(awards[0].theoryAmount.toString()).toBe('100');expect(awards[0].payableAmount.toString()).toBe(c.amount);
   expect(awards[0].pendingUntil).toEqual(new Date(paidAt.getTime()+45*86400000));
   expect(awards[0].lifecycleEvents.map(e=>e.status).sort()).toEqual(['CALCULATED','PENDING_45D']);
  }
  expect(await new BonusLifecycleService(db as any).matureDueAwards(new Date())).toEqual({matured:2});
  expect(await pay.materialize(cutoff,rule)).toEqual({created:1});expect(await pay.materialize(cutoff,rule)).toEqual({created:0});
  const batch=await pay.createPayoutBatch(paidAt,cutoff,rule);expect([batch.totalGross,batch.totalRecovery,batch.totalNet].map(v=>v.toString())).toEqual(['100','0','100']);
  const payoutLines=await db.payoutLine.findMany({where:{payoutBatchId:batch.payoutBatchId}});expect(payoutLines).toHaveLength(1);expect(payoutLines[0].recipientQualificationId).toBe(ids[1]);
 },30000);
 it('same-organization retail annual replay preserves 1200 payable and all prior six award types',async()=>{
  const awards=await db.bonusAward.findMany({where:{ruleVersionCode:rule,awardType:'RETAIL_REFERRAL'},orderBy:{bonusAwardId:'asc'}});
  expect(retailOrders).toHaveLength(48);expect(awards).toHaveLength(24);expect(awards.filter(a=>a.payableAmount.eq(0))).toHaveLength(12);
  for(const orderId of retailOrders)await deliverRetail(orderId);
  expect(await db.bonusAward.findMany({where:{ruleVersionCode:rule,awardType:'RETAIL_REFERRAL'},orderBy:{bonusAwardId:'asc'}})).toEqual(awards);
  const entries=await db.payableEntry.aggregate({where:{ruleVersionCode:rule,awardType:'RETAIL_REFERRAL'},_count:true,_sum:{grossAmount:true}});expect(entries._count).toBe(12);expect(entries._sum.grossAmount!.toString()).toBe('1200');
  expect(await db.pvLedger.count({where:{sourceId:{in:retailOrders}}})).toBe(0);
  expect(await db.qualification.count({where:{currentHolderPersonId:retailPurchaser}})).toBe(0);
  expect(await protectedBeforeRetail()).toEqual(beforeRetail);
 },30000);

 const globalService=new GlobalPoolService(db as any,rules,query,calendar,new GlobalPoolPersistence());let beforeGlobal:any;
 const globalPeriods:Array<{start:Date;end:Date;id:string}>=[];
 async function protectedBeforeGlobal(){return {
  volumes:await db.pvLedger.findMany({where:{ruleVersionCode:rule,occurredAt:{lt:new Date('2025-02-01Z')}},orderBy:{eventId:'asc'}}),
  awards:await db.bonusAward.findMany({where:{ruleVersionCode:rule},orderBy:{bonusAwardId:'asc'}}),
  rpv:await db.rpvUplineAwardEvent.findMany({where:{ruleVersionCode:rule},orderBy:{rpvAwardEventId:'asc'}}),
  carry:await db.binaryCarry.findMany({where:{ruleVersionCode:rule},orderBy:{binaryCarryId:'asc'}}),
  payables:await db.payableEntry.findMany({where:{ruleVersionCode:rule,awardType:{not:'GLOBAL'}},orderBy:{payableEntryId:'asc'}}),
  recoveries:await db.bonusRecoveryEvent.findMany({where:{bonusAward:{ruleVersionCode:rule}},orderBy:{bonusRecoveryEventId:'asc'}})
 };}
 async function verifyGlobal(start:Date,end:Date,total:string,distributed:string,reservoir:string){
  const settlement=await globalService.evaluateAndSettle(start,end,rule);globalPeriods.push({start,end,id:settlement.globalPoolSettlementId});
  expect([settlement.totalGpv,settlement.poolRate,settlement.distributedAmount,settlement.undistributedAmount].map(v=>v.toString())).toEqual([total,'0.05',distributed,reservoir]);
  expect(settlement.poolAvailable.eq(settlement.distributedAmount.add(settlement.undistributedAmount))).toBe(true);
  const effects=await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:settlement.globalPoolSettlementId}});expect(effects).toHaveLength(1);expect(effects[0].amount.toString()).toBe(reservoir);expect(effects[0].reservoirCode).toBe('A');
  expect((await globalService.evaluateAndSettle(start,end,rule)).globalPoolSettlementId).toBe(settlement.globalPoolSettlementId);
  expect(await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:settlement.globalPoolSettlementId}})).toEqual(effects);
  return settlement;
 }
 it.each(Array.from({length:12},(_,i)=>i))('same-organization GLOBAL month %i routes ineligible pool to Reservoir A',async month=>{
  if(month===0){beforeGlobal=await protectedBeforeGlobal();const snap=await captureParameters(db as any,new Date('2024-01-01Z'),rule);for(const [code,scope,value] of [['global.rank.weak_threshold','NEW_STAR','300000'],['global.rank.pool_rate','NEW_STAR','0.015'],['pool.global.rate','*','0.05']])expect(new Prisma.Decimal(snap.parameters.find(p=>p.code===code&&p.scope===scope)!.value as string).eq(value)).toBe(true);}
  const start=new Date(Date.UTC(2024,month,1)),end=new Date(Date.UTC(2024,month+1,1));
  // Each existing Monday contributes 200 GPV; December's late-returned 150 is excluded.
  const count=weeks.filter(w=>{const paid=new Date(w.getTime()+86400000);return paid>=start&&paid<end;}).length;
  const total=new Prisma.Decimal(count*200-(month===11?150:0));
  const settled=await verifyGlobal(start,end,total.toString(),'0',total.mul('0.05').toString());
  expect(await db.globalPoolAward.count({where:{globalPoolSettlementId:settled.globalPoolSettlementId}})).toBe(0);
  expect(await pay.materialize(new Date(end.getTime()+46*86400000),rule)).toEqual({created:0});
 },30000);
 async function globalSourceMonth(month:number,amount:number){
  const at=new Date(Date.UTC(2025,month,15)),snapshot=await captureParameters(db as any,at,rule);
  for(const qid of ids.slice(2)){
   const order=await db.order.create({data:{qualificationId:qid,purpose:'RETAIL',status:'PAID',paidAt:at,grossAmount:amount,netAmount:amount,ruleVersionCode:rule,parameterSnapshotHash:snapshot.hash,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:amount,lineAmount:amount,gpvRateSnapshot:1,gpvAmountSnapshot:amount,ruleProfileSnapshot:{synthetic:true}}}},include:{lines:true}});
   await db.$transaction(async tx=>{const recognized=await recognizeConsumption(tx,{qualificationId:qid,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,amount,eligible:true,concreteVolumeType:'GPV',productProfileVersion:'SYNTHETIC',ruleVersionCode:rule,parameterSnapshotHash:snapshot.hash,recognizedAt:at,activeThreshold:'2000'});expect(recognized.created).toBe(true);await sealGpvEvent(tx,recognized.volume!);},{timeout:30000});
  }
 }
 it('same-organization GLOBAL exact NEW_STAR threshold distributes 9000 and retains 21000',async()=>{
  await globalSourceMonth(1,300000);const start=new Date('2025-02-01Z'),end=new Date('2025-03-01Z');
  const settled=await verifyGlobal(start,end,'600000','9000','21000');
  const awards=await db.globalPoolAward.findMany({where:{globalPoolSettlementId:settled.globalPoolSettlementId}});expect(awards).toHaveLength(1);
  expect(awards[0]).toMatchObject({qualificationId:ids[1],rankLevel:'NEW_STAR',eligibleCount:1,activeSnapshot:true});expect(awards[0].weakSidePvSnapshot.toString()).toBe('300000');expect(awards[0].payableAmount.toString()).toBe('9000');
  expect(await pay.materialize(end,rule)).toEqual({created:1});expect(await pay.materialize(end,rule)).toEqual({created:0});
  const batch=await pay.createPayoutBatch(start,end,rule);expect([batch.totalGross,batch.totalRecovery,batch.totalNet].map(v=>v.toString())).toEqual(['9000','0','9000']);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:batch.payoutBatchId}});expect(lines).toHaveLength(1);expect(lines[0].recipientQualificationId).toBe(ids[1]);
 },30000);
 it('same-organization GLOBAL below threshold preserves rank but pays nothing next month',async()=>{
  const rank=await db.qualificationGlobalRankHistory.findUniqueOrThrow({where:{qualificationId_rankCode:{qualificationId:ids[1],rankCode:'NEW_STAR'}}});
  await globalSourceMonth(2,299999);const start=new Date('2025-03-01Z'),end=new Date('2025-04-01Z');
  const settled=await verifyGlobal(start,end,'599998','0','29999.9');expect(await db.globalPoolAward.count({where:{globalPoolSettlementId:settled.globalPoolSettlementId}})).toBe(0);
  expect(await db.qualificationGlobalRankHistory.findUniqueOrThrow({where:{qualificationId_rankCode:{qualificationId:ids[1],rankCode:'NEW_STAR'}}})).toEqual(rank);
  expect(await pay.materialize(end,rule)).toEqual({created:0});
 },30000);
 it('same-organization GLOBAL replay preserves fourteen settlements and all prior seven award types',async()=>{
  const original=await db.globalPoolSettlement.findMany({where:{ruleVersionCode:rule},orderBy:{globalPoolSettlementId:'asc'}});
  for(const period of globalPeriods)expect((await globalService.evaluateAndSettle(period.start,period.end,rule)).globalPoolSettlementId).toBe(period.id);
  expect(globalPeriods).toHaveLength(14);expect(await db.globalPoolSettlement.findMany({where:{ruleVersionCode:rule},orderBy:{globalPoolSettlementId:'asc'}})).toEqual(original);
  const annual=original.filter(r=>r.periodStart.getUTCFullYear()===2024);expect(annual).toHaveLength(12);expect(annual.reduce((a,r)=>a.add(r.totalGpv),new Prisma.Decimal(0)).toString()).toBe('10450');expect(annual.reduce((a,r)=>a.add(r.undistributedAmount),new Prisma.Decimal(0)).toString()).toBe('522.5');
  expect(await db.reservoirLedgerEffect.count({where:{sourceGlobalSettlementId:{in:globalPeriods.map(p=>p.id)}}})).toBe(14);
  const entries=await db.payableEntry.aggregate({where:{ruleVersionCode:rule,awardType:'GLOBAL'},_count:true,_sum:{grossAmount:true}});expect(entries._count).toBe(1);expect(entries._sum.grossAmount!.toString()).toBe('9000');
  expect(await protectedBeforeGlobal()).toEqual(beforeGlobal);
 },30000);

 let multiGlobalId:string,multiGlobalBatch:string;
 it('same-organization GLOBAL three recipients share all five ranks and retain rounding residue',async()=>{
  const from=new Date('2025-04-01Z'),at=new Date('2025-04-15Z'),end=new Date('2025-05-01Z'),snap=await captureParameters(db as any,at,rule);
  const ranks=[['NEW_STAR','300000','0.015','80000.005'],['EXCELLENCE','600000','0.010','53333.3366'],['GLORY','1000000','0.005','26666.6683'],['DIAMOND','2000000','0.005','26666.6683'],['CROWN','4000000','0.015','80000.005']] as const;
  for(const [rank,threshold,rate] of ranks){for(const [code,value] of [['global.rank.weak_threshold',threshold],['global.rank.pool_rate',rate]])expect(new Prisma.Decimal(snap.parameters.find(p=>p.code===code&&p.scope===rank)!.value as string).eq(value)).toBe(true);}
  for(const qid of ids.slice(1))if(!await db.activePeriod.findFirst({where:{qualificationId:qid,activeFrom:{lte:end},OR:[{activeTo:null},{activeTo:{gt:end}}]}}))await db.activePeriod.create({data:{qualificationId:qid,activeFrom:from,sourceType:'SYNTHETIC_GLOBAL_MULTI',ruleVersionCode:rule}});
  for(let i=0;i<4;i++){
   const person=await db.person.create({data:{legalName:'SYNTHETIC GLOBAL MULTI LEAF '+i}});
   const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:from}});
   await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:from,sourceType:'TEST'}});
   await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:from,sourceType:'TEST'}});
   await db.binaryPlacement.create({data:{parentQualificationId:ids[i<2?2:3],childQualificationId:q.qualificationId,side:i%2?'RIGHT':'LEFT',effectiveFrom:from}});
   const amount=i===0?4000001:4000000;
   const order=await db.order.create({data:{qualificationId:q.qualificationId,purpose:'RETAIL',status:'PAID',paidAt:at,grossAmount:amount,netAmount:amount,ruleVersionCode:rule,parameterSnapshotHash:snap.hash,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:amount,lineAmount:amount,gpvRateSnapshot:1,gpvAmountSnapshot:amount,ruleProfileSnapshot:{synthetic:true}}}},include:{lines:true}});
   await db.$transaction(async tx=>{const recognized=await recognizeConsumption(tx,{qualificationId:q.qualificationId,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,amount,eligible:true,concreteVolumeType:'GPV',productProfileVersion:'SYNTHETIC',ruleVersionCode:rule,parameterSnapshotHash:snap.hash,recognizedAt:at,activeThreshold:'2000'});expect(recognized.created).toBe(true);await sealGpvEvent(tx,recognized.volume!);},{timeout:30000});
  }
  const settled=await verifyGlobal(from,end,'16000001','800000.0496','0.0004');multiGlobalId=settled.globalPoolSettlementId;
  expect(settled.poolAvailable.toString()).toBe('800000.05');
  const awards=await db.globalPoolAward.findMany({where:{globalPoolSettlementId:multiGlobalId}});expect(awards).toHaveLength(15);
  for(const [rank,,rate,amount] of ranks){const rows=awards.filter(a=>a.rankLevel===rank);expect(rows).toHaveLength(3);expect(rows.map(a=>a.qualificationId).sort()).toEqual(ids.slice(1).sort());
   for(const a of rows){expect(a.eligibleCount).toBe(3);expect(a.activeSnapshot).toBe(true);expect(a.rankPoolRate.eq(rate)).toBe(true);expect(a.payableAmount.toString()).toBe(amount);expect(a.weakSidePvSnapshot.toString()).toBe(a.qualificationId===ids[1]?'8000000':'4000000');}
  }
  expect(await db.qualificationGlobalRankHistory.count({where:{qualificationId:{in:ids.slice(1)}}})).toBe(15);
  expect(await pay.materialize(end,rule)).toEqual({created:15});expect(await pay.materialize(end,rule)).toEqual({created:0});
  const batch=await pay.createPayoutBatch(from,end,rule);multiGlobalBatch=batch.payoutBatchId;
  expect([batch.totalGross,batch.totalRecovery,batch.totalNet].map(v=>v.toString())).toEqual(['800000.0496','0','800000.0496']);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:multiGlobalBatch}});expect(lines).toHaveLength(3);expect(lines.map(l=>l.recipientQualificationId).sort()).toEqual(ids.slice(1).sort());expect(lines.every(l=>l.netAmount.toString()==='266666.6832')).toBe(true);
  expect(await protectedBeforeGlobal()).toEqual(beforeGlobal);
 },60000);
 it('same-organization GLOBAL multi-rank replay preserves awards, residue and allocated payables',async()=>{
  const read=async()=>({awards:await db.globalPoolAward.findMany({where:{globalPoolSettlementId:multiGlobalId},orderBy:{globalPoolAwardId:'asc'}}),effects:await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:multiGlobalId}}),entries:await db.payableEntry.findMany({where:{payoutLine:{payoutBatchId:multiGlobalBatch}},orderBy:{payableEntryId:'asc'}}),lines:await db.payoutLine.findMany({where:{payoutBatchId:multiGlobalBatch},orderBy:{payoutLineId:'asc'}})});
  const before=await read();expect(before.entries).toHaveLength(15);
  expect((await globalService.evaluateAndSettle(new Date('2025-04-01Z'),new Date('2025-05-01Z'),rule)).globalPoolSettlementId).toBe(multiGlobalId);
  expect(await pay.materialize(new Date('2025-05-01Z'),rule)).toEqual({created:0});expect(await read()).toEqual(before);
  expect((await pay.createPayoutBatch(new Date('2025-04-01Z'),new Date('2025-05-01Z'),rule)).totalGross.toString()).toBe('0');
 },30000);

 let globalReturnId:string,globalReturnOriginal:any;
 async function globalReturnState(){return {awards:await db.globalPoolAward.findMany({where:{globalPoolSettlementId:multiGlobalId},orderBy:{globalPoolAwardId:'asc'}}),settlement:await db.globalPoolSettlement.findUniqueOrThrow({where:{globalPoolSettlementId:multiGlobalId}}),entries:await db.payableEntry.findMany({where:{payoutLine:{payoutBatchId:multiGlobalBatch}},orderBy:{payableEntryId:'asc'}}),lines:await db.payoutLine.findMany({where:{payoutBatchId:multiGlobalBatch},orderBy:{payoutLineId:'asc'}})};}
 it('GLOBAL post-settlement return reconciles three-recipient rounding with 0.0501 recovery and 0.0001 reservoir delta',async()=>{
  globalReturnOriginal=await globalReturnState();
  const order=await db.order.findFirstOrThrow({where:{ruleVersionCode:rule,paidAt:new Date('2025-04-15Z'),netAmount:4000001},include:{lines:true}});
  const ret=await db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',occurredAt:new Date('2025-05-10Z'),postedAt:new Date('2025-05-10Z'),reasonCode:'SYNTHETIC_GLOBAL_MONETARY_PARTIAL_RETURN',idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:order.lines[0].orderLineId,quantity:1,returnAmount:1,gpvReversalAmount:1}}}});globalReturnId=ret.returnCaseId;
  await db.$transaction(tx=>processHistoricalReturn(tx,globalReturnId),{timeout:60000});
  const postings=await db.entitlementReplayPosting.findMany({where:{snapshot:{kind:'GLOBAL',sourceId:multiGlobalId}}});expect(postings).toHaveLength(15);expect(postings.every(p=>p.delta.lt(0)&&p.recoveryId!==null&&p.correctionAwardId===null)).toBe(true);
  for(const a of globalReturnOriginal.awards){const p=postings.find(p=>p.entitlementKey===a.globalPoolAwardId)!;const amounts={NEW_STAR:['80000','-0.005'],EXCELLENCE:['53333.3333','-0.0033'],GLORY:['26666.6666','-0.0017'],DIAMOND:['26666.6666','-0.0017'],CROWN:['80000','-0.005']} as Record<string,string[]>;expect([p.recalculatedEntitlement.toString(),p.delta.toString()]).toEqual(amounts[a.rankLevel]);}
  const recoveries=await db.bonusRecoveryEvent.findMany({where:{returnCaseId:globalReturnId}});expect(recoveries).toHaveLength(15);expect(recoveries.every(r=>r.status==='OPEN'&&r.recoveryAmount.eq(r.outstandingAmount))).toBe(true);
  const recovery=recoveries.reduce((n,r)=>n.add(r.recoveryAmount),new Prisma.Decimal(0));expect(recovery.toString()).toBe('0.0501');
  const effects=await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:multiGlobalId}});expect(effects).toHaveLength(2);expect(effects.map(e=>e.amount.toString()).sort()).toEqual(['0.0001','0.0004']);expect(recovery.sub('0.0001').toString()).toBe('0.05');
  expect(await globalReturnState()).toEqual(globalReturnOriginal);
  expect(await pay.materialize(new Date('2025-06-01Z'),rule)).toEqual({created:0});
 },60000);
 it('GLOBAL return replay preserves original allocation and does not duplicate recoveries or reservoir effects',async()=>{
  const read=async()=>({postings:await db.entitlementReplayPosting.findMany({where:{snapshot:{kind:'GLOBAL',sourceId:multiGlobalId}},orderBy:{postingId:'asc'}}),recoveries:await db.bonusRecoveryEvent.findMany({where:{returnCaseId:globalReturnId},orderBy:{bonusRecoveryEventId:'asc'}}),effects:await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:multiGlobalId},orderBy:{reservoirLedgerEffectId:'asc'}})});
  const before=await read();await db.$transaction(tx=>processHistoricalReturn(tx,globalReturnId),{timeout:60000});expect(await read()).toEqual(before);expect(await globalReturnState()).toEqual(globalReturnOriginal);
  const reversal=await db.pvLedger.findMany({where:{sourceId:globalReturnId,eventType:'GPV_REVERSAL'}});expect(reversal).toHaveLength(1);expect(reversal[0].amount.toString()).toBe('-1');
 },60000);

 let globalOffsetBatch:string;
 it('GLOBAL next-period distribution recovers all fifteen balances with exact four-decimal net amounts',async()=>{
  const start=new Date('2025-05-01Z'),at=new Date('2025-05-15Z'),end=new Date('2025-06-01Z'),snap=await captureParameters(db as any,at,rule);
  const sources=await db.order.findMany({where:{ruleVersionCode:rule,paidAt:new Date('2025-04-15Z')},select:{qualificationId:true}});expect(sources).toHaveLength(4);
  for(const source of sources){const qid=source.qualificationId!;
   const order=await db.order.create({data:{qualificationId:qid,purpose:'RETAIL',status:'PAID',paidAt:at,grossAmount:4000000,netAmount:4000000,ruleVersionCode:rule,parameterSnapshotHash:snap.hash,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:4000000,lineAmount:4000000,gpvRateSnapshot:1,gpvAmountSnapshot:4000000,ruleProfileSnapshot:{synthetic:true}}}},include:{lines:true}});
   await db.$transaction(async tx=>{const recognized=await recognizeConsumption(tx,{qualificationId:qid,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,amount:4000000,eligible:true,concreteVolumeType:'GPV',productProfileVersion:'SYNTHETIC',ruleVersionCode:rule,parameterSnapshotHash:snap.hash,recognizedAt:at,activeThreshold:'2000'});expect(recognized.created).toBe(true);await sealGpvEvent(tx,recognized.volume!);},{timeout:30000});
  }
  const settlement=await verifyGlobal(start,end,'16000000','799999.9995','0.0005');expect(await db.globalPoolAward.count({where:{globalPoolSettlementId:settlement.globalPoolSettlementId}})).toBe(15);
  expect(await pay.materialize(end,rule)).toEqual({created:15});expect(await pay.materialize(end,rule)).toEqual({created:0});
  const batch=await pay.createPayoutBatch(start,end,rule);globalOffsetBatch=batch.payoutBatchId;
  expect([batch.totalGross,batch.totalRecovery,batch.totalNet].map(v=>v.toString())).toEqual(['799999.9995','0.0501','799999.9494']);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:globalOffsetBatch}});expect(lines).toHaveLength(3);expect(lines.map(l=>l.recipientQualificationId).sort()).toEqual(ids.slice(1).sort());
  for(const line of lines)expect([line.grossAmount,line.recoveryOffset,line.netAmount].map(v=>v.toString())).toEqual(['266666.6665','0.0167','266666.6498']);
  const recoveries=await db.bonusRecoveryEvent.findMany({where:{returnCaseId:globalReturnId}});expect(recoveries).toHaveLength(15);expect(recoveries.every(r=>r.status==='RECOVERED'&&r.outstandingAmount.eq(0)&&r.recoveredAmount.eq(r.recoveryAmount))).toBe(true);
  const applications=await db.recoveryApplication.findMany({where:{payoutLineId:{in:lines.map(l=>l.payoutLineId)}}});expect(applications).toHaveLength(15);expect(new Set(applications.map(a=>a.bonusRecoveryEventId))).toEqual(new Set(recoveries.map(r=>r.bonusRecoveryEventId)));
  expect(applications.reduce((sum,a)=>sum.add(a.amount),new Prisma.Decimal(0)).toString()).toBe('0.0501');
  expect(await globalReturnState()).toEqual(globalReturnOriginal);
 },60000);
 it('GLOBAL recovered balances stay closed after offset retry and old return replay',async()=>{
  const read=async()=>({recoveries:await db.bonusRecoveryEvent.findMany({where:{returnCaseId:globalReturnId},orderBy:{bonusRecoveryEventId:'asc'}}),applications:await db.recoveryApplication.findMany({where:{payoutLine:{payoutBatchId:globalOffsetBatch}},orderBy:{bonusRecoveryEventId:'asc'}}),effects:await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:multiGlobalId},orderBy:{reservoirLedgerEffectId:'asc'}}),postings:await db.entitlementReplayPosting.findMany({where:{snapshot:{kind:'GLOBAL',sourceId:multiGlobalId}},orderBy:{postingId:'asc'}})});
  const before=await read(),lines=await db.payoutLine.findMany({where:{payoutBatchId:globalOffsetBatch},orderBy:{payoutLineId:'asc'}}),recovery=new RecoveryBalanceService(db as any);
  for(const line of lines)expect((await db.$transaction(tx=>recovery.apply(tx,{qualificationId:line.recipientQualificationId,payoutLineId:line.payoutLineId,maxAmount:line.grossAmount}))).applied.toString()).toBe('0.0167');
  await db.$transaction(tx=>processHistoricalReturn(tx,globalReturnId),{timeout:60000});
  await globalService.evaluateAndSettle(new Date('2025-05-01Z'),new Date('2025-06-01Z'),rule);expect(await pay.materialize(new Date('2025-06-01Z'),rule)).toEqual({created:0});
  expect(await read()).toEqual(before);expect(await db.payoutLine.findMany({where:{payoutBatchId:globalOffsetBatch},orderBy:{payoutLineId:'asc'}})).toEqual(lines);expect(await globalReturnState()).toEqual(globalReturnOriginal);
  expect((await pay.createPayoutBatch(new Date('2025-05-01Z'),new Date('2025-06-01Z'),rule)).totalGross.toString()).toBe('0');
 },60000);

 let rankLossReturn:string,rankLossSettlement:string,rankLossOriginal:any;
 async function rankLossOriginalState(){return {settlement:await db.globalPoolSettlement.findUniqueOrThrow({where:{globalPoolSettlementId:rankLossSettlement}}),awards:await db.globalPoolAward.findMany({where:{globalPoolSettlementId:rankLossSettlement},orderBy:{globalPoolAwardId:'asc'}}),entries:await db.payableEntry.findMany({where:{payoutLine:{payoutBatchId:globalOffsetBatch}},orderBy:{payableEntryId:'asc'}}),lines:await db.payoutLine.findMany({where:{payoutBatchId:globalOffsetBatch},orderBy:{payoutLineId:'asc'}})};}
 it('GLOBAL return below CROWN threshold redistributes the slice to two recipients with positive and negative corrections',async()=>{
  const settlement=await db.globalPoolSettlement.findFirstOrThrow({where:{ruleVersionCode:rule,periodStart:new Date('2025-05-01Z'),periodEnd:new Date('2025-06-01Z')}});rankLossSettlement=settlement.globalPoolSettlementId;rankLossOriginal=await rankLossOriginalState();
  const rankBefore=await db.qualificationGlobalRankHistory.findMany({where:{qualificationId:{in:ids.slice(1)}},orderBy:{qualificationGlobalRankHistoryId:'asc'}});
  const placement=await db.binaryPlacement.findFirstOrThrow({where:{parentQualificationId:ids[2],side:'LEFT'}});
  const order=await db.order.findFirstOrThrow({where:{ruleVersionCode:rule,qualificationId:placement.childQualificationId,paidAt:new Date('2025-05-15Z')},include:{lines:true}});
  const ret=await db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',occurredAt:new Date('2025-06-10Z'),postedAt:new Date('2025-06-10Z'),reasonCode:'SYNTHETIC_GLOBAL_CROWN_THRESHOLD_RETURN',idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:order.lines[0].orderLineId,quantity:1,returnAmount:1,gpvReversalAmount:1}}}});rankLossReturn=ret.returnCaseId;
  await db.$transaction(tx=>processHistoricalReturn(tx,rankLossReturn),{timeout:60000});
  const postings=await db.entitlementReplayPosting.findMany({where:{snapshot:{kind:'GLOBAL',sourceId:rankLossSettlement}}});expect(postings).toHaveLength(15);expect(postings.filter(p=>p.delta.gt(0))).toHaveLength(2);expect(postings.filter(p=>p.delta.lt(0))).toHaveLength(13);
  for(const a of rankLossOriginal.awards){const p=postings.find(p=>p.entitlementKey===a.globalPoolAwardId)!;let expected:string[];
   if(a.rankLevel==='CROWN')expected=a.qualificationId===ids[2]?['0','-80000']:['119999.9925','39999.9925'];
   else expected=({NEW_STAR:['79999.995','-0.005'],EXCELLENCE:['53333.33','-0.0033'],GLORY:['26666.665','-0.0016'],DIAMOND:['26666.665','-0.0016']} as Record<string,string[]>)[a.rankLevel];
   expect([p.recalculatedEntitlement.toString(),p.delta.toString()]).toEqual(expected);
  }
  const corrections=await db.bonusAward.findMany({where:{bonusAwardId:{in:postings.filter(p=>p.delta.gt(0)).map(p=>p.correctionAwardId!)}}});expect(corrections).toHaveLength(2);expect(corrections.map(a=>a.recipientQualificationId).sort()).toEqual([ids[1],ids[3]].sort());expect(corrections.every(a=>a.awardType==='GLOBAL'&&a.payableAmount.toString()==='39999.9925')).toBe(true);
  const recoveries=await db.bonusRecoveryEvent.findMany({where:{returnCaseId:rankLossReturn}});expect(recoveries).toHaveLength(13);expect(recoveries.every(r=>r.status==='OPEN'&&r.outstandingAmount.eq(r.recoveryAmount))).toBe(true);expect(recoveries.reduce((n,r)=>n.add(r.recoveryAmount),new Prisma.Decimal(0)).toString()).toBe('80000.0345');
  expect(postings.reduce((n,p)=>n.add(p.delta),new Prisma.Decimal(0)).toString()).toBe('-0.0495');
  const effects=await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:rankLossSettlement}});expect(effects).toHaveLength(2);expect(effects.map(e=>e.amount.toString()).sort()).toEqual(['-0.0005','0.0005']);
  expect(new Prisma.Decimal('-0.0495').sub('0.0005').toString()).toBe('-0.05');
  expect(await rankLossOriginalState()).toEqual(rankLossOriginal);expect(await db.qualificationGlobalRankHistory.findMany({where:{qualificationId:{in:ids.slice(1)}},orderBy:{qualificationGlobalRankHistoryId:'asc'}})).toEqual(rankBefore);
 },60000);
 it('GLOBAL rank-loss replay materializes only the two positive corrections and never duplicates new debt',async()=>{
  const read=async()=>({postings:await db.entitlementReplayPosting.findMany({where:{snapshot:{kind:'GLOBAL',sourceId:rankLossSettlement}},orderBy:{postingId:'asc'}}),recoveries:await db.bonusRecoveryEvent.findMany({where:{returnCaseId:rankLossReturn},orderBy:{bonusRecoveryEventId:'asc'}}),effects:await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:rankLossSettlement},orderBy:{reservoirLedgerEffectId:'asc'}})});
  const before=await read();await db.$transaction(tx=>processHistoricalReturn(tx,rankLossReturn),{timeout:60000});expect(await read()).toEqual(before);
  expect(await pay.materialize(new Date(),rule)).toEqual({created:2});expect(await pay.materialize(new Date(),rule)).toEqual({created:0});
  const correctionIds=before.postings.filter(p=>p.delta.gt(0)).map(p=>p.correctionAwardId!);
  const entries=await db.payableEntry.findMany({where:{sourceId:{in:correctionIds}}});expect(entries).toHaveLength(2);expect(entries.every(e=>e.sourceType==='BONUS_AWARD'&&e.awardType==='GLOBAL'&&e.grossAmount.toString()==='39999.9925')).toBe(true);
  expect(await rankLossOriginalState()).toEqual(rankLossOriginal);expect(await db.pvLedger.count({where:{sourceId:rankLossReturn,eventType:'GPV_REVERSAL'}})).toBe(1);
 },60000);

 let rankLossOffsetBatch:string;
 it('GLOBAL correction payout offsets only matching qualifications and leaves the ineligible qualification debt open',async()=>{
  const holders=await db.qualification.findMany({where:{qualificationId:{in:ids.slice(1)}},select:{currentHolderPersonId:true}});expect(new Set(holders.map(q=>q.currentHolderPersonId)).size).toBe(1);
  const batch=await pay.createPayoutBatch(new Date('2025-06-01Z'),new Date(),rule);rankLossOffsetBatch=batch.payoutBatchId;
  expect([batch.totalGross,batch.totalRecovery,batch.totalNet].map(v=>v.toString())).toEqual(['79999.985','0.023','79999.962']);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:rankLossOffsetBatch}});expect(lines).toHaveLength(2);expect(lines.map(l=>l.recipientQualificationId).sort()).toEqual([ids[1],ids[3]].sort());
  for(const line of lines)expect([line.grossAmount,line.recoveryOffset,line.netAmount].map(v=>v.toString())).toEqual(['39999.9925','0.0115','39999.981']);
  const rows=await db.bonusRecoveryEvent.findMany({where:{returnCaseId:rankLossReturn},include:{bonusAward:true}});expect(rows).toHaveLength(13);
  const unpaid=rows.filter(r=>r.bonusAward.recipientQualificationId===ids[2]),closed=rows.filter(r=>r.bonusAward.recipientQualificationId!==ids[2]);expect(unpaid).toHaveLength(5);expect(closed).toHaveLength(8);
  expect(unpaid.every(r=>r.status==='OPEN'&&r.recoveredAmount.eq(0)&&r.outstandingAmount.eq(r.recoveryAmount))).toBe(true);expect(unpaid.reduce((sum,r)=>sum.add(r.outstandingAmount),new Prisma.Decimal(0)).toString()).toBe('80000.0115');
  expect(closed.every(r=>r.status==='RECOVERED'&&r.outstandingAmount.eq(0)&&r.recoveredAmount.eq(r.recoveryAmount))).toBe(true);
  const applications=await db.recoveryApplication.findMany({where:{payoutLine:{payoutBatchId:rankLossOffsetBatch}}});expect(applications).toHaveLength(8);expect(new Set(applications.map(a=>a.bonusRecoveryEventId))).toEqual(new Set(closed.map(r=>r.bonusRecoveryEventId)));
  for(const a of applications)expect(rows.find(r=>r.bonusRecoveryEventId===a.bonusRecoveryEventId)!.bonusAward.recipientQualificationId).toBe(lines.find(l=>l.payoutLineId===a.payoutLineId)!.recipientQualificationId);
  expect(await rankLossOriginalState()).toEqual(rankLossOriginal);
 },30000);
 it('GLOBAL correction offset replay preserves both closed and outstanding debt and rejects a different qualification',async()=>{
  const read=async()=>({recoveries:await db.bonusRecoveryEvent.findMany({where:{returnCaseId:rankLossReturn},orderBy:{bonusRecoveryEventId:'asc'}}),applications:await db.recoveryApplication.findMany({where:{payoutLine:{payoutBatchId:rankLossOffsetBatch}},orderBy:{bonusRecoveryEventId:'asc'}}),lines:await db.payoutLine.findMany({where:{payoutBatchId:rankLossOffsetBatch},orderBy:{payoutLineId:'asc'}}),postings:await db.entitlementReplayPosting.findMany({where:{snapshot:{kind:'GLOBAL',sourceId:rankLossSettlement}},orderBy:{postingId:'asc'}})});
  const before=await read(),recovery=new RecoveryBalanceService(db as any),line=before.lines[0];
  await expect(db.$transaction(tx=>recovery.apply(tx,{qualificationId:ids[2],payoutLineId:line.payoutLineId,maxAmount:line.grossAmount}))).rejects.toThrow('Offset must use the original payout line recipient and gross amount');
  for(const line of before.lines)expect((await db.$transaction(tx=>recovery.apply(tx,{qualificationId:line.recipientQualificationId,payoutLineId:line.payoutLineId,maxAmount:line.grossAmount}))).applied.toString()).toBe('0.0115');
  await db.$transaction(tx=>processHistoricalReturn(tx,rankLossReturn),{timeout:60000});expect(await pay.materialize(new Date(),rule)).toEqual({created:0});expect(await read()).toEqual(before);
  expect((await pay.createPayoutBatch(new Date('2025-06-01Z'),new Date(),rule)).totalGross.toString()).toBe('0');expect(await read()).toEqual(before);expect(await rankLossOriginalState()).toEqual(rankLossOriginal);
 },60000);

 const installmentBatches:string[]=[];
 async function installmentSources(month:number,amount:number){
  const at=new Date(Date.UTC(2025,month,15)),snap=await captureParameters(db as any,at,rule);
  const sources=await db.order.findMany({where:{ruleVersionCode:rule,paidAt:new Date('2025-04-15Z')},select:{qualificationId:true}});expect(sources).toHaveLength(4);
  for(const source of sources){const qid=source.qualificationId!;const order=await db.order.create({data:{qualificationId:qid,purpose:'RETAIL',status:'PAID',paidAt:at,grossAmount:amount,netAmount:amount,ruleVersionCode:rule,parameterSnapshotHash:snap.hash,lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:amount,lineAmount:amount,gpvRateSnapshot:1,gpvAmountSnapshot:amount,ruleProfileSnapshot:{synthetic:true}}}},include:{lines:true}});
   await db.$transaction(async tx=>{const recognized=await recognizeConsumption(tx,{qualificationId:qid,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,amount,eligible:true,concreteVolumeType:'GPV',productProfileVersion:'SYNTHETIC',ruleVersionCode:rule,parameterSnapshotHash:snap.hash,recognizedAt:at,activeThreshold:'2000'});expect(recognized.created).toBe(true);await sealGpvEvent(tx,recognized.volume!);},{timeout:30000});
  }
 }
 it('GLOBAL insufficient next-period income offsets 39999.9999 and preserves 40000.0116 outstanding',async()=>{
  await installmentSources(5,1000000);const start=new Date('2025-06-01Z'),end=new Date('2025-07-01Z');
  await verifyGlobal(start,end,'4000000','139999.9997','60000.0003');expect(await pay.materialize(end,rule)).toEqual({created:10});
  const batch=await pay.createPayoutBatch(start,end,rule);installmentBatches.push(batch.payoutBatchId);expect([batch.totalGross,batch.totalRecovery,batch.totalNet].map(v=>v.toString())).toEqual(['139999.9997','39999.9999','99999.9998']);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:batch.payoutBatchId}});expect(lines).toHaveLength(3);
  for(const [qid,values] of [[ids[1],['59999.9999','0','59999.9999']],[ids[2],['39999.9999','39999.9999','0']],[ids[3],['39999.9999','0','39999.9999']]] as const){const l=lines.find(l=>l.recipientQualificationId===qid)!;expect([l.grossAmount,l.recoveryOffset,l.netAmount].map(v=>v.toString())).toEqual(values);}
  const debt=await db.bonusRecoveryEvent.findMany({where:{returnCaseId:rankLossReturn,bonusAward:{recipientQualificationId:ids[2]}}});expect(debt).toHaveLength(5);expect(debt.reduce((n,r)=>n.add(r.recoveredAmount),new Prisma.Decimal(0)).toString()).toBe('39999.9999');expect(debt.reduce((n,r)=>n.add(r.outstandingAmount),new Prisma.Decimal(0)).toString()).toBe('40000.0116');expect(debt.some(r=>r.status==='OFFSETTING')).toBe(true);
  expect(await rankLossOriginalState()).toEqual(rankLossOriginal);
 },60000);
 it('GLOBAL following-period income clears the remaining installment debt without over-deduction',async()=>{
  await installmentSources(6,4000000);const start=new Date('2025-07-01Z'),end=new Date('2025-08-01Z');
  await verifyGlobal(start,end,'16000000','799999.9995','0.0005');expect(await pay.materialize(end,rule)).toEqual({created:15});
  const batch=await pay.createPayoutBatch(start,end,rule);installmentBatches.push(batch.payoutBatchId);expect([batch.totalGross,batch.totalRecovery,batch.totalNet].map(v=>v.toString())).toEqual(['799999.9995','40000.0116','759999.9879']);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:batch.payoutBatchId}});expect(lines).toHaveLength(3);for(const l of lines)expect([l.grossAmount,l.recoveryOffset,l.netAmount].map(v=>v.toString())).toEqual(l.recipientQualificationId===ids[2]?['266666.6665','40000.0116','226666.6549']:['266666.6665','0','266666.6665']);
  const debt=await db.bonusRecoveryEvent.findMany({where:{returnCaseId:rankLossReturn}});expect(debt).toHaveLength(13);expect(debt.every(r=>r.status==='RECOVERED'&&r.outstandingAmount.eq(0)&&r.recoveredAmount.eq(r.recoveryAmount))).toBe(true);
  const applications=await db.recoveryApplication.findMany({where:{payoutLine:{payoutBatchId:{in:installmentBatches}}}});expect(applications).toHaveLength(6);expect(applications.reduce((n,a)=>n.add(a.amount),new Prisma.Decimal(0)).toString()).toBe('80000.0115');
 },60000);
 it('GLOBAL installment offset and return retries leave the fully recovered debt closed',async()=>{
  const read=async()=>({debt:await db.bonusRecoveryEvent.findMany({where:{returnCaseId:rankLossReturn},orderBy:{bonusRecoveryEventId:'asc'}}),applications:await db.recoveryApplication.findMany({where:{payoutLine:{payoutBatchId:{in:installmentBatches}}},orderBy:{recoveryApplicationId:'asc'}}),lines:await db.payoutLine.findMany({where:{payoutBatchId:{in:installmentBatches}},orderBy:{payoutLineId:'asc'}})});
  const before=await read(),recovery=new RecoveryBalanceService(db as any);for(const l of before.lines)expect((await db.$transaction(tx=>recovery.apply(tx,{qualificationId:l.recipientQualificationId,payoutLineId:l.payoutLineId,maxAmount:l.grossAmount}))).applied.toString()).toBe(l.recoveryOffset.toString());
  await db.$transaction(tx=>processHistoricalReturn(tx,rankLossReturn),{timeout:60000});expect(await pay.materialize(new Date(),rule)).toEqual({created:0});expect(await read()).toEqual(before);expect(await rankLossOriginalState()).toEqual(rankLossOriginal);
  expect((await pay.createPayoutBatch(new Date('2025-08-01Z'),new Date(),rule)).totalGross.toString()).toBe('0');expect(await read()).toEqual(before);
 },60000);

 let inactiveGlobalId:string,inactiveGlobalOriginal:any,activeRankHistory:any;
 async function inactiveGlobalState(){return {settlement:await db.globalPoolSettlement.findUniqueOrThrow({where:{globalPoolSettlementId:inactiveGlobalId}}),awards:await db.globalPoolAward.findMany({where:{globalPoolSettlementId:inactiveGlobalId},orderBy:{globalPoolAwardId:'asc'}}),effects:await db.reservoirLedgerEffect.findMany({where:{sourceGlobalSettlementId:inactiveGlobalId}})};}
 it('GLOBAL Active expiry at exact period end excludes one otherwise fully qualified recipient',async()=>{
  const start=new Date('2025-08-01Z'),end=new Date('2025-09-01Z');
  activeRankHistory=await db.qualificationGlobalRankHistory.findMany({where:{qualificationId:ids[2]},orderBy:{qualificationGlobalRankHistoryId:'asc'}});expect(activeRankHistory).toHaveLength(5);
  const changed=await db.activePeriod.updateMany({where:{qualificationId:ids[2],activeFrom:{lt:end},OR:[{activeTo:null},{activeTo:{gt:end}}]},data:{activeTo:end}});expect(changed.count).toBeGreaterThan(0);
  expect(await query.isActiveAt(db as any,ids[2],new Date(end.getTime()-1))).toBe(true);expect(await query.isActiveAt(db as any,ids[2],end)).toBe(false);
  await installmentSources(7,4000000);const settled=await verifyGlobal(start,end,'16000000','800000','0');inactiveGlobalId=settled.globalPoolSettlementId;
  const awards=await db.globalPoolAward.findMany({where:{globalPoolSettlementId:inactiveGlobalId}});expect(awards).toHaveLength(10);expect(awards.every(a=>a.qualificationId!==ids[2]&&a.eligibleCount===2)).toBe(true);
  expect(await pay.materialize(end,rule)).toEqual({created:10});const batch=await pay.createPayoutBatch(start,end,rule);expect([batch.totalGross,batch.totalRecovery,batch.totalNet].map(v=>v.toString())).toEqual(['800000','0','800000']);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:batch.payoutBatchId}});expect(lines.map(l=>l.recipientQualificationId).sort()).toEqual([ids[1],ids[3]].sort());expect(lines.every(l=>l.netAmount.toString()==='400000')).toBe(true);
  expect(await db.qualificationGlobalRankHistory.findMany({where:{qualificationId:ids[2]},orderBy:{qualificationGlobalRankHistoryId:'asc'}})).toEqual(activeRankHistory);inactiveGlobalOriginal=await inactiveGlobalState();
 },60000);
 it('GLOBAL Active restoration starts inclusively and resumes only next-period distribution',async()=>{
  const from=new Date('2025-09-02Z');await db.activePeriod.create({data:{qualificationId:ids[2],activeFrom:from,sourceType:'SYNTHETIC_GLOBAL_ACTIVE_RESTORED',ruleVersionCode:rule}});
  expect(await query.isActiveAt(db as any,ids[2],new Date(from.getTime()-1))).toBe(false);expect(await query.isActiveAt(db as any,ids[2],from)).toBe(true);
  await installmentSources(8,4000000);const start=new Date('2025-09-01Z'),end=new Date('2025-10-01Z');const settled=await verifyGlobal(start,end,'16000000','799999.9995','0.0005');
  const awards=await db.globalPoolAward.findMany({where:{globalPoolSettlementId:settled.globalPoolSettlementId}});expect(awards).toHaveLength(15);expect(awards.filter(a=>a.qualificationId===ids[2])).toHaveLength(5);expect(awards.every(a=>a.eligibleCount===3&&a.activeSnapshot)).toBe(true);
  expect(await pay.materialize(end,rule)).toEqual({created:15});const batch=await pay.createPayoutBatch(start,end,rule);expect([batch.totalGross,batch.totalRecovery,batch.totalNet].map(v=>v.toString())).toEqual(['799999.9995','0','799999.9995']);
  const lines=await db.payoutLine.findMany({where:{payoutBatchId:batch.payoutBatchId}});expect(lines).toHaveLength(3);expect(lines.every(l=>l.netAmount.toString()==='266666.6665')).toBe(true);
 },60000);
 it('GLOBAL later Active restoration never retroactively changes the excluded period',async()=>{
  expect((await globalService.evaluateAndSettle(new Date('2025-08-01Z'),new Date('2025-09-01Z'),rule)).globalPoolSettlementId).toBe(inactiveGlobalId);expect(await inactiveGlobalState()).toEqual(inactiveGlobalOriginal);
  expect(await query.isActiveAt(db as any,ids[2],new Date('2025-09-01Z'))).toBe(false);expect(await pay.materialize(new Date(),rule)).toEqual({created:0});
  expect(await db.qualificationGlobalRankHistory.findMany({where:{qualificationId:ids[2]},orderBy:{qualificationGlobalRankHistoryId:'asc'}})).toEqual(activeRankHistory);
  const debt=await db.bonusRecoveryEvent.findMany({where:{returnCaseId:rankLossReturn}});expect(debt).toHaveLength(13);expect(debt.every(r=>r.status==='RECOVERED'&&r.outstandingAmount.eq(0))).toBe(true);
 },30000);

 it('annual organization rejects company GLOBAL routing without historical tree membership and rolls back all monetary writes',async()=>{
  const start=new Date('2025-10-01Z'),end=new Date('2025-11-01Z');await installmentSources(9,4000000);
  const read=async()=>({settlements:await db.globalPoolSettlement.count({where:{ruleVersionCode:rule}}),awards:await db.globalPoolAward.count(),destinations:await db.awardEconomicDestination.count(),effects:await db.reservoirBEffect.count(),reservoirA:await db.reservoirLedgerEffect.count(),payables:await db.payableEntry.count({where:{ruleVersionCode:rule}})});
  const before=await read(),stop=new Error('ROLLBACK_COMPANY_EVIDENCE_FIXTURE');
  await expect(db.$transaction(async tx=>{
   const company=await tx.companyPrincipal.create({data:{code:'SYNTHETIC_'+randomUUID(),displayName:'Synthetic annual company succession'}});
   await tx.qualificationOwnerInterval.create({data:{qualificationId:ids[2],ownerType:'COMPANY',companyPrincipalId:company.companyPrincipalId,effectiveFrom:start,sourceType:'SYNTHETIC_COMPANY_SUCCESSION',sourceId:randomUUID(),evidenceHash:'c'.repeat(64)}});
   await tx.activePeriod.updateMany({where:{qualificationId:ids[2],activeFrom:{lt:start},OR:[{activeTo:null},{activeTo:{gt:start}}]},data:{activeTo:start}});
   expect(await tx.activePeriod.count({where:{qualificationId:ids[2],activeFrom:{lte:end},OR:[{activeTo:null},{activeTo:{gt:end}}]}})).toBe(0);
   expect(await query.isActiveAt(tx,ids[2],end)).toBe(true);expect(await tx.binaryTreeMembership.findUnique({where:{qualificationId:ids[2]}})).toBeNull();
   // Keep real SQL and guards, but route nested service transactions through this rollback fixture.
   const proxy=new Proxy(tx,{get(target,key){return key==='$transaction'?(work:any)=>work(proxy):Reflect.get(target,key);}}) as any;
   const service=new GlobalPoolService(proxy,rules,query,calendar,new GlobalPoolPersistence());
   await expect(service.evaluateAndSettle(start,end,rule)).rejects.toThrow('Company final requires historical tree membership');
   throw stop;
  },{timeout:60000})).rejects.toBe(stop);
  expect(await read()).toEqual(before);expect(await db.qualificationOwnerInterval.count({where:{qualificationId:ids[2],sourceType:'SYNTHETIC_COMPANY_SUCCESSION'}})).toBe(0);
  expect(await rankLossOriginalState()).toEqual(rankLossOriginal);
 },60000);

 let committedCompanyOwnerId:string;
 async function companyAtomicState(){
  return {
   settlements:await db.globalPoolSettlement.findMany({orderBy:{globalPoolSettlementId:'asc'}}),
   awards:await db.globalPoolAward.findMany({orderBy:{globalPoolAwardId:'asc'}}),
   destinations:await db.awardEconomicDestination.findMany({orderBy:{destinationId:'asc'}}),
   effects:await db.reservoirBEffect.findMany({orderBy:{effectId:'asc'}}),
   reservoirA:await db.reservoirLedgerEffect.findMany(),
   ranks:await db.qualificationGlobalRankHistory.findMany({orderBy:{qualificationGlobalRankHistoryId:'asc'}}),
   payables:await db.payableEntry.findMany(),
   snapshots:await db.historicalReplaySnapshot.findMany(),
  };
 }
 it('company evidence failure and retry roll back the real GLOBAL transaction without an outer test transaction',async()=>{
  const company=await db.companyPrincipal.create({data:{code:'ATOMIC_'+randomUUID(),displayName:'Synthetic committed company evidence failure'}});
  const owner=await db.qualificationOwnerInterval.create({data:{qualificationId:ids[2],ownerType:'COMPANY',companyPrincipalId:company.companyPrincipalId,effectiveFrom:new Date('2025-10-01Z'),sourceType:'SYNTHETIC_ATOMIC_GUARD',sourceId:randomUUID(),evidenceHash:'d'.repeat(64)}});
  committedCompanyOwnerId=owner.ownerIntervalId;
  const before=await companyAtomicState();
  for(let attempt=0;attempt<2;attempt++){
   await expect(globalService.evaluateAndSettle(new Date('2025-10-01Z'),new Date('2025-11-01Z'),rule)).rejects.toThrow('Company final requires historical tree membership');
   expect(await companyAtomicState()).toEqual(before);
   expect(await db.qualificationOwnerInterval.findUnique({where:{ownerIntervalId:committedCompanyOwnerId}})).toEqual(owner);
  }
 },60000);
 it('ending company ownership at the settlement boundary permits one member settlement after failed retries',async()=>{
  const start=new Date('2025-10-01Z'),end=new Date('2025-11-01Z');
  await db.qualificationOwnerInterval.update({where:{ownerIntervalId:committedCompanyOwnerId},data:{effectiveTo:end,closedRecordedAt:new Date()}});
  expect(await query.isActiveAt(db as any,ids[2],end)).toBe(true);
  const settled=await verifyGlobal(start,end,'16000000','799999.9995','0.0005');
  expect(await db.globalPoolAward.count({where:{globalPoolSettlementId:settled.globalPoolSettlementId}})).toBe(15);
  expect(await db.awardEconomicDestination.count({where:{sourceSettlementId:settled.globalPoolSettlementId}})).toBe(0);
  const before=await companyAtomicState();
  expect((await globalService.evaluateAndSettle(start,end,rule)).globalPoolSettlementId).toBe(settled.globalPoolSettlementId);
  expect(await companyAtomicState()).toEqual(before);
  expect(await rankLossOriginalState()).toEqual(rankLossOriginal);
 },60000);
});
