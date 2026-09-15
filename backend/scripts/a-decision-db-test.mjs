import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient,Prisma}=require('@prisma/client');
const url=new URL(process.env.DATABASE_URL??'');
assert.equal(url.pathname,'/ucell_admin_test');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
const {EpvService}=require('../backend/apps/api/dist/modules/epv/epv.service.js');
const {EpvMonthService}=require('../backend/apps/api/dist/modules/epv/epv-month.service.js');
const {BonusQueryService}=require('../backend/apps/api/dist/modules/bonus/bonus-query.service.js');
const {RuntimeRuleService}=require('../backend/apps/api/dist/modules/rules/runtime-rule.service.js');
const {captureParameters}=require('../backend/apps/api/dist/modules/rules/parameter-snapshot.js');
const {snapshotDecimal}=require('../backend/apps/api/dist/modules/rules/parameter-snapshot.js');
const {SettlementCalendarService}=require('../backend/apps/api/dist/modules/settlement/settlement-calendar.service.js');
const {SettlementReplayService}=require('../backend/apps/api/dist/modules/adjustment/settlement-replay.service.js');
const {ReversalService}=require('../backend/apps/api/dist/modules/return/reversal.service.js');
const prisma=new PrismaClient();
const results=[];const version='SA_TEST_'+randomUUID();const rollback=new Error('ROLLBACK_TEST_FIXTURES');
function check(label,actual,expected){assert.deepEqual(actual,expected,label);results.push({label,result:'PASS',actual});}
let failure;
try{
 await prisma.$transaction(async tx=>{
  const person=await tx.person.findFirstOrThrow();const product=await tx.productReference.findFirstOrThrow();
  const existing=await tx.runtimeRuleParameter.findMany({where:{ruleVersionCode:'R1.0B'}});
  const unique=new Map(existing.map(r=>[JSON.stringify([r.parameterCode,r.scopeKey]),r]));
  for(const r of unique.values()) await tx.runtimeRuleParameter.create({data:{ruleVersionCode:version,parameterCode:r.parameterCode,scopeKey:r.scopeKey,valueJson:r.valueJson,effectiveFrom:new Date('2019-01-01')}});
  await tx.runtimeRuleParameter.create({data:{ruleVersionCode:version,parameterCode:'epv.calendar.timezone',valueJson:'Asia/Taipei',effectiveFrom:new Date('2019-01-01')}});
  const qualification=()=>tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'LEADER',status:'EFFECTIVE',effectiveAt:new Date('2020-01-01')}});
  const q=await qualification(),q2=await qualification();
  await assert.rejects(new BonusQueryService({}).qualificationPlanAt(tx,q.qualificationId,new Date('2020-01-03')),error=>error.getResponse()?.code==='HISTORICAL_SNAPSHOT_MISSING');
  check('actual DB missing history rejects current LEADER plan',q.planLevelCode,'LEADER');
  const facade={$transaction:fn=>fn(tx)};
  const months=new EpvMonthService();const calendar=new SettlementCalendarService(facade);
  const service=new EpvService(facade,new RuntimeRuleService(facade),new BonusQueryService(facade),months);
  async function order(qualificationId,day,amount=1600){return tx.order.create({data:{qualificationId,purpose:'REPURCHASE',status:'PAID',grossAmount:amount,netAmount:amount,ruleVersionCode:version,paidAt:new Date(day),lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:'SA TEST',quantity:1,unitPrice:amount,lineAmount:amount,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{testOnly:true}}}},include:{lines:true}});}
  const orders=[];
  for(const date of ['2020-01-03','2020-01-04','2020-01-05']) orders.push(await order(q.qualificationId,date));
  const increments=[];
  for(const o of orders) increments.push((await service.recognizeOrder(o.orderId,version)).epv);
  check('three split orders => 0/720/960',[...increments],['0','720','960']);
  check('repeat recognition is idempotent',(await service.recognizeOrder(orders[2].orderId,version)).skipped,'ALREADY_RECOGNIZED');
  check('one ledger marker per paid order',await tx.pvLedger.count({where:{sourceType:'ORDER',sourceId:{in:orders.map(o=>o.orderId)},pvType:'EPV'}}),3);
  const separate=await order(q2.qualificationId,'2020-01-06');check('independent qualification threshold',(await service.recognizeOrder(separate.orderId,version)).epv,'0');
  const nextMonth=await order(q.qualificationId,'2020-02-02');check('independent calendar month threshold',(await service.recognizeOrder(nextMonth.orderId,version)).epv,'0');
  const snapshot=await captureParameters(tx,new Date('2020-01-05'),version);
  const bounds=await months.bounds(tx,new Date('2020-01-31T16:00:00Z'),snapshot);
  check('Taipei month boundary',bounds.start.toISOString(),'2020-01-31T16:00:00.000Z');
  const ret=await tx.returnCase.create({data:{orderId:orders[2].orderId,status:'POSTED',reasonCode:'SA_TEST',occurredAt:new Date('2020-01-10'),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:orders[2].lines[0].orderLineId,quantity:1,returnAmount:1600,gpvReversalAmount:0}}}});
  const projection=await months.returnProjection(tx,ret.returnCaseId,snapshot);check('first monthly return threshold',[projection.original.toString(),projection.recomputed.toString(),projection.delta.toString()],['1680','720','-960']);
  const ret2=await tx.returnCase.create({data:{orderId:orders[1].orderId,status:'POSTED',reasonCode:'SA_TEST',occurredAt:new Date('2020-01-11'),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:orders[1].lines[0].orderLineId,quantity:1,returnAmount:1600,gpvReversalAmount:0}}}});
  const projection2=await months.returnProjection(tx,ret2.returnCaseId,snapshot);check('second return crossing threshold',[projection2.original.toString(),projection2.recomputed.toString(),projection2.delta.toString()],['720','0','-720']);
  const reversal=new ReversalService(facade,calendar,months);await reversal.processReturn(ret.returnCaseId);check('repeat reversal is idempotent',(await reversal.processReturn(ret.returnCaseId)).replayed,true);
  check('transactional monthly replay outbox once',await tx.outboxEvent.count({where:{aggregateId:ret.returnCaseId,eventType:'EPV_MONTH_RECALCULATION_REQUIRED'}}),1);
  check('original monetary ledger is unchanged',(await tx.pvLedger.aggregate({where:{sourceType:'ORDER',sourceId:{in:orders.map(o=>o.orderId)},pvType:'EPV'},_sum:{amount:true}}))._sum.amount.toString(),'1680');
  check('pending allocation never creates an EPV return monetary event',await tx.pvLedger.count({where:{sourceType:'RETURN',sourceId:ret.returnCaseId,pvType:'EPV'}}),0);
  for(const [parameterCode,valueJson] of [['settlement.timezone','Asia/Taipei'],['settlement.period',{unit:'WEEK',count:2,anchorLocal:'2020-01-01T00:00:00'}],['settlement.cut_off',{localTime:'13:15:00',daysAfterPeriodEnd:1,approvalReference:'TEST_ONLY_NOT_OPERATIONAL_APPROVAL'}]]) await tx.runtimeRuleParameter.create({data:{ruleVersionCode:version,parameterCode,scopeKey:'BINARY_K1',valueJson,effectiveFrom:new Date('2019-01-01')}});
  const configured=await captureParameters(tx,new Date('2020-01-05'),version);
  const period=await calendar.periodFor(tx,new Date('2020-01-05'),configured,'BINARY_K1');
  check('configured biweekly period uses explicit Wednesday anchor',[period.start.toISOString(),period.end.toISOString()],['2019-12-31T16:00:00.000Z','2020-01-14T16:00:00.000Z']);
  await tx.runtimeRuleParameter.updateMany({where:{ruleVersionCode:version,parameterCode:'binary.pair.rate',scopeKey:'*'},data:{effectiveTo:new Date('2020-01-16T05:15:00Z')}});
  await tx.runtimeRuleParameter.create({data:{ruleVersionCode:version,parameterCode:'binary.pair.rate',scopeKey:'*',valueJson:'.2',effectiveFrom:new Date('2020-01-16T05:15:00Z')}});
  const historical=await calendar.captureForPeriod(tx,period.start,period.end,'BINARY_K1',version);check('configuration snapshot is persisted representation',historical.format,'UCELL_PARAMETER_SNAPSHOT_V1');
  check('monetary snapshot is locked at approved configured cut-off',historical.effectiveAt,'2020-01-16T05:15:00.000Z');
  check('parameter version effective exactly at cut-off is selected',snapshotDecimal(historical,'binary.pair.rate').toString(),'0.2');
  // A placement beginning mid-month must not include pre-placement sales.
  await tx.binaryPlacement.create({data:{parentQualificationId:q.qualificationId,childQualificationId:q2.qualificationId,side:'LEFT',effectiveFrom:new Date('2020-01-05')}});
  await tx.pvLedger.create({data:{qualificationId:q2.qualificationId,pvType:'GPV',amount:1000,sourceType:'ORDER',sourceId:randomUUID(),eventType:'GPV_CREATED',ruleVersionCode:version,occurredAt:new Date('2020-01-03'),correlationId:randomUUID()}});
  const original=await tx.pvLedger.create({data:{qualificationId:q2.qualificationId,pvType:'GPV',amount:2000,sourceType:'ORDER',sourceId:randomUUID(),eventType:'GPV_CREATED',ruleVersionCode:version,occurredAt:new Date('2020-01-06'),correlationId:randomUUID()}});
  await tx.pvLedger.create({data:{qualificationId:q2.qualificationId,pvType:'GPV',amount:-400,sourceType:'RETURN',sourceId:randomUUID(),eventType:'GPV_REVERSAL',ruleVersionCode:version,occurredAt:new Date('2020-02-10'),reversalOfEventId:original.eventId,correlationId:randomUUID()}});
  const replay=new SettlementReplayService(facade);
  check('event-time subtree excludes pre-placement sale and includes later linked reversal',(await replay.subtreeEconomicGpv(tx,q.qualificationId,'LEFT',new Date('2020-01-01'),new Date('2020-02-01'))).toString(),'1600');
  check('other side excludes sales outside its tree',(await replay.subtreeEconomicGpv(tx,q.qualificationId,'RIGHT',new Date('2020-01-01'),new Date('2020-02-01'))).toString(),'0');
  throw rollback;
 },{timeout:60000,isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}catch(error){if(error!==rollback) failure=error;}
finally{await prisma.$disconnect();}
const out=fileURLToPath(new URL('../../governance/a-decision-return-replay/final/',import.meta.url));
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(out+'db-regression.json',JSON.stringify({result:failure?'FAIL':'PASS',fixturesRolledBack:true,results,...(failure?{error:failure.stack}:{})},null,2)+'\n');
if(failure){console.error(failure);process.exitCode=1;}else console.log(`PASS ${results.length} real DB assertions; all fixtures rolled back`);

