import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient,Prisma}=require('@prisma/client');
const replay=require('./packages/database/dist/historical-replay.js');
const {EpvService}=require('../backend/apps/api/dist/modules/epv/epv.service.js');
const {EpvMonthService}=require('../backend/apps/api/dist/modules/epv/epv-month.service.js');
const {BonusQueryService}=require('../backend/apps/api/dist/modules/bonus/bonus-query.service.js');
const {RuntimeRuleService}=require('../backend/apps/api/dist/modules/rules/runtime-rule.service.js');
const url=new URL(process.env.DATABASE_URL??'');assert.equal(url.pathname,'/ucell_admin_test');assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
const prisma=new PrismaClient(),results=[],version='PHASE2_TEST_'+randomUUID(),rollback=new Error('ROLLBACK_PHASE2_FIXTURES');
function check(label,actual,expected){assert.deepEqual(actual,expected,label);results.push({label,result:'PASS',actual});}
let failure;
try{await prisma.$transaction(async tx=>{
 const person=await tx.person.findFirstOrThrow(),product=await tx.productReference.findFirstOrThrow();
 const parameters=await tx.runtimeRuleParameter.findMany({where:{ruleVersionCode:'R1.0B'}});
 for(const row of new Map(parameters.map(r=>[JSON.stringify([r.parameterCode,r.scopeKey]),r])).values()) await tx.runtimeRuleParameter.create({data:{ruleVersionCode:version,parameterCode:row.parameterCode,scopeKey:row.scopeKey,valueJson:row.valueJson,effectiveFrom:new Date('2019-01-01')}});
 await tx.runtimeRuleParameter.create({data:{ruleVersionCode:version,parameterCode:'epv.calendar.timezone',valueJson:'UTC',effectiveFrom:new Date('2019-01-01')}});
 async function qualification(active=true){const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'LEADER',status:'EFFECTIVE',effectiveAt:new Date('2020-01-01')}});await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'LEADER',effectiveFrom:new Date('2020-01-01'),sourceType:'PHASE2_TEST'}});await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:new Date('2020-01-01'),sourceType:'PHASE2_TEST'}});if(active)await tx.activePeriod.create({data:{qualificationId:q.qualificationId,activeFrom:new Date('2020-01-01'),sourceType:'PHASE2_TEST',ruleVersionCode:version}});return q;}
 const self=await qualification(),oldSponsor=await qualification(),inactive=await qualification(false),newSponsor=await qualification();
 const relationship=await tx.sponsorRelationship.create({data:{childQualificationId:self.qualificationId,sponsorQualificationId:oldSponsor.qualificationId,sponsorSequenceNo:1,effectiveFrom:new Date('2020-01-01')}});
 await tx.sponsorRelationship.create({data:{childQualificationId:oldSponsor.qualificationId,sponsorQualificationId:inactive.qualificationId,sponsorSequenceNo:1,effectiveFrom:new Date('2020-01-01')}});
 const order=await tx.order.create({data:{qualificationId:self.qualificationId,purpose:'REPURCHASE',status:'PAID',grossAmount:4800,netAmount:4800,ruleVersionCode:version,paidAt:new Date('2020-01-05'),lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:'PHASE2 TEST',quantity:3,unitPrice:1600,lineAmount:4800,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{testOnly:true}}}},include:{lines:true}});
 const gpv=await tx.pvLedger.create({data:{qualificationId:self.qualificationId,pvType:'GPV',amount:0,eventType:'GPV_CREATED',sourceType:'ORDER',sourceId:order.orderId,sourceLineId:order.lines[0].orderLineId,ruleVersionCode:version,occurredAt:order.paidAt,correlationId:randomUUID()}});await replay.sealGpvEvent(tx,gpv);
 const facade={$transaction:fn=>fn(tx)};
 const service=new EpvService(facade,new RuntimeRuleService(facade),new BonusQueryService(facade),new EpvMonthService());
 check('original EPV 4800 => 1680',(await service.recognizeOrder(order.orderId,version)).epv,'1680');
 const originalAwards=await tx.bonusAward.findMany({where:{sourceQualificationId:self.qualificationId,awardType:'EPV'}}),originalJson=JSON.stringify(originalAwards);
 const selfAward=originalAwards.find(a=>a.recipientQualificationId===self.qualificationId);
 await tx.bonusAwardLifecycleEvent.create({data:{bonusAwardId:selfAward.bonusAwardId,status:'PAID',occurredAt:new Date('2020-01-09'),reasonCode:'PHASE2_TEST_PAID'}});
 const paid=JSON.stringify(await tx.bonusAwardLifecycleEvent.findMany({where:{bonusAwardId:selfAward.bonusAwardId}}));
 await tx.sponsorRelationship.update({where:{sponsorRelationshipId:relationship.sponsorRelationshipId},data:{effectiveTo:new Date('2020-01-06')}});
 await tx.activePeriod.updateMany({where:{qualificationId:oldSponsor.qualificationId},data:{activeTo:new Date('2020-01-06')}});
 await tx.activePeriod.create({data:{qualificationId:inactive.qualificationId,activeFrom:new Date('2020-01-06'),sourceType:'CHANGED_AFTER_CAPTURE_TEST',ruleVersionCode:version}});
 async function ret(amount=1600){return tx.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'PHASE2_TEST',occurredAt:new Date('2020-01-10'),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:order.lines[0].orderLineId,quantity:1,returnAmount:amount,gpvReversalAmount:0}}}});}
 const first=await ret();await replay.processHistoricalReturn(tx,first.returnCaseId);
 const firstPost=await tx.entitlementReplayPosting.findFirstOrThrow({where:{actionKey:'RETURN:'+first.returnCaseId,recipientQualificationId:self.qualificationId}});
 check('partial return historical self delta',firstPost.delta.toString(),'-480');
 check('first effective historical self entitlement',firstPost.recalculatedEntitlement.toString(),'360');
 check('historical sponsor receives adjustment despite current inactive',await tx.entitlementReplayPosting.count({where:{actionKey:'RETURN:'+first.returnCaseId,recipientQualificationId:oldSponsor.qualificationId,delta:{lt:0}}}),1);
 check('current sponsor never receives historical money',await tx.entitlementReplayPosting.count({where:{recipientQualificationId:newSponsor.qualificationId}}),0);
 check('historically inactive recipient stays zero',(await tx.entitlementReplayPosting.findFirstOrThrow({where:{recipientQualificationId:inactive.qualificationId}})).delta.toString(),'0');
 const firstRecoveryCount=await tx.bonusRecoveryEvent.count({where:{returnCaseId:first.returnCaseId}});
 await replay.processHistoricalReturn(tx,first.returnCaseId);check('duplicate return no duplicate recovery',await tx.bonusRecoveryEvent.count({where:{returnCaseId:first.returnCaseId}}),firstRecoveryCount);
 const second=await ret();await replay.processHistoricalReturn(tx,second.returnCaseId);
 const secondPost=await tx.entitlementReplayPosting.findFirstOrThrow({where:{actionKey:'RETURN:'+second.returnCaseId,recipientQualificationId:self.qualificationId}});
 check('multi-return incremental self delta',secondPost.delta.toString(),'-360');
 check('cross-threshold effective entitlement',secondPost.recalculatedEntitlement.toString(),'0');
 check('clawback never exceeds original entitlement',(await tx.bonusRecoveryEvent.aggregate({where:{bonusAwardId:selfAward.bonusAwardId},_sum:{recoveryAmount:true}}))._sum.recoveryAmount.toString(),'840');
 check('original awards are immutable',JSON.stringify(await tx.bonusAward.findMany({where:{sourceQualificationId:self.qualificationId,awardType:'EPV'}})),originalJson);
 check('original PAID history is immutable',JSON.stringify(await tx.bonusAwardLifecycleEvent.findMany({where:{bonusAwardId:selfAward.bonusAwardId}})),paid);
 check('original EPV ledger unchanged',(await tx.pvLedger.findFirstOrThrow({where:{sourceId:order.orderId,pvType:'EPV'}})).amount.toString(),'1680');
 check('effective EPV ledger after two returns',(await tx.pvLedger.aggregate({where:{qualificationId:self.qualificationId,pvType:'EPV'},_sum:{amount:true}}))._sum.amount.toString(),'0');
 check('outstanding recovery tracks PAID clawback',(await tx.bonusRecoveryEvent.aggregate({where:{bonusAwardId:selfAward.bonusAwardId},_sum:{outstandingAmount:true}}))._sum.outstandingAmount.toString(),'840');
 async function rejected(label,operation,code){await tx.$executeRawUnsafe('SAVEPOINT phase2_expected_failure');let caught;try{await operation();}catch(error){caught=error;}await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT phase2_expected_failure');assert.ok(caught,label);check(label,String(caught.message).includes(code)||String(caught.getResponse?.().code).includes(code),true);}
 const snapshot=await tx.historicalReplaySnapshot.findFirstOrThrow({where:{kind:'EPV',sourceId:{in:originalAwards.map(a=>a.sourceEventId)}}});
 await rejected('snapshot UPDATE rejected by DB',()=>tx.historicalReplaySnapshot.update({where:{snapshotId:snapshot.snapshotId},data:{hash:'invalid'}}),'APPEND_ONLY_REPLAY_EVIDENCE');
 await rejected('posting DELETE rejected by DB',()=>tx.entitlementReplayPosting.delete({where:{postingId:firstPost.postingId}}),'APPEND_ONLY_REPLAY_EVIDENCE');
 await rejected('posting cannot repeat previously clawed back delta',()=>tx.entitlementReplayPosting.create({data:{actionKey:'RETURN:INVALID',snapshotId:snapshot.snapshotId,entitlementKey:firstPost.entitlementKey,recipientQualificationId:self.qualificationId,originallyPosted:840,recalculatedEntitlement:0,delta:-840,stateHash:'invalid'}}),'REPLAY_DELTA_BASELINE_MISMATCH');
 const beforeMissing=await tx.pvLedger.count();
 const absent=await tx.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'MISSING',occurredAt:new Date('2020-01-11'),idempotencyKey:randomUUID(),correlationId:randomUUID()}});
 await rejected('missing snapshot fails closed',()=>replay.verifyReplayEnvelope(null),'HISTORICAL_SNAPSHOT_MISSING');
 check('missing snapshot does not append money',await tx.pvLedger.count(),beforeMissing);
 // Original fixture capture precedes replay. TEST_ONLY parameters do not establish an operational calendar.
 const {captureParameters}=require('./packages/database/dist/parameter-snapshot.js');
 const historical=await captureParameters(tx,new Date('2020-01-03'),version);
 const leftQ=await qualification(),rightQ=await qualification();
 await tx.binaryPlacement.create({data:{parentQualificationId:self.qualificationId,childQualificationId:leftQ.qualificationId,side:'LEFT',effectiveFrom:new Date('2020-01-01')}});
 await tx.binaryPlacement.create({data:{parentQualificationId:self.qualificationId,childQualificationId:rightQ.qualificationId,side:'RIGHT',effectiveFrom:new Date('2020-01-01')}});
 const economic=[];
 for(const q of [leftQ,rightQ]){const o=await tx.order.create({data:{qualificationId:q.qualificationId,purpose:'RETAIL',status:'PAID',grossAmount:1000,netAmount:1000,ruleVersionCode:version,paidAt:new Date('2020-01-03'),lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:'GPV TEST',quantity:2,unitPrice:500,lineAmount:1000,gpvRateSnapshot:1,gpvAmountSnapshot:1000,ruleProfileSnapshot:{testOnly:true}}}},include:{lines:true}});const event=await tx.pvLedger.create({data:{qualificationId:q.qualificationId,pvType:'GPV',amount:1000,eventType:'GPV_CREATED',sourceType:'ORDER',sourceId:o.orderId,sourceLineId:o.lines[0].orderLineId,ruleVersionCode:version,occurredAt:o.paidAt,correlationId:randomUUID()}});const row=await replay.sealGpvEvent(tx,event);economic.push({order:o,event,envelope:replay.verifyReplayEnvelope(row)});}
 const batch=await tx.settlementBatch.create({data:{settlementType:'REFERRAL_K0',periodStart:new Date('2020-01-01'),periodEnd:new Date('2020-01-08'),ruleVersionCode:version,status:'FINALIZED',parameterSnapshot:historical,totalGpv:2000,kFactor:'.42'}});
 const originals=[];
 for(const source of economic){originals.push(await tx.bonusAward.create({data:{settlementBatchId:batch.settlementBatchId,awardType:'REFERRAL',recipientQualificationId:self.qualificationId,sourceQualificationId:source.order.qualificationId,sourceEventId:source.event.eventId,theoryAmount:1000,payableAmount:420,kFactor:'.42',activeSnapshot:true,planLevelSnapshot:'LEADER',ruleVersionCode:version,occurredAt:source.event.occurredAt,pendingUntil:new Date('2020-02-17'),calculationDetail:{testOnly:true}}}));}
 await replay.sealSettlement(tx,batch);
 const saved=JSON.stringify(originals);
 const refund=await tx.returnCase.create({data:{orderId:economic[0].order.orderId,status:'POSTED',reasonCode:'PERIOD_TEST',occurredAt:new Date('2020-01-10'),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:economic[0].order.lines[0].orderLineId,quantity:1,returnAmount:500,gpvReversalAmount:500}}}});
 await replay.processHistoricalReturn(tx,refund.returnCaseId);
 const postings=await tx.entitlementReplayPosting.findMany({where:{actionKey:'RETURN:'+refund.returnCaseId},orderBy:{entitlementKey:'asc'}});
 check('K0 complete period posts every original entitlement',postings.length,2);
 check('K0 cumulative effective source replay',postings.map(p=>p.recalculatedEntitlement.toNumber()).sort((a,b)=>a-b),[210,420]);
 check('K0 original award baseline preserved',JSON.stringify(await tx.bonusAward.findMany({where:{bonusAwardId:{in:originals.map(a=>a.bonusAwardId)}}})),saved);
 const envelope={format:'UCELL_HISTORICAL_REPLAY_V1',kind:'BINARY_K1',sourceId:randomUUID(),ruleVersionCode:version,at:'2020-01-08T00:00:00.000Z',parameters:historical,recipients:[],evidence:{sources:economic.map(e=>e.envelope),carryRecipients:[{qualificationId:self.qualificationId,leftCarryIn:'200',rightCarryIn:'0',leftCarryOut:'0',rightCarryOut:'0',weeklyCapSnapshot:'200',active:true,qualification:{plan:{planCode:'LEADER'},status:{status:'EFFECTIVE'}}}]},inputs:{}};
 const effective=await replay.effectiveGpv(tx,envelope.evidence.sources);
 envelope.recipients=[{key:'binary-original',awardId:'binary-original',awardType:'BINARY',qualificationId:self.qualificationId,generation:0,active:true,eligible:true,theory:'100',posted:'100',pendingUntil:'2020-03-01T00:00:00.000Z',detail:{},qualification:{plan:{planCode:'LEADER'},status:{status:'EFFECTIVE'},activeIntervals:[]}}];
 const projected=replay.periodBinary(envelope,effective,new Map());
 check('DB effective subtree honors partial return',effective.get(economic[0].event.eventId).toString(),'500');
 check('historical cap preserves nonzero left carry',projected.carryOut.get(self.qualificationId).left.toString(),'500');
 check('historical cap preserves nonzero right carry',projected.carryOut.get(self.qualificationId).right.toString(),'800');
 const next={...envelope,evidence:{...envelope.evidence,sources:[]}};
 const continuation=replay.periodBinary(next,new Map(),projected.carryOut);
 check('carry continuation derives next historical left carry',continuation.carryOut.get(self.qualificationId).left.toString(),'300');
 check('carry continuation derives next historical right carry',continuation.carryOut.get(self.qualificationId).right.toString(),'600');
 throw rollback;
},{timeout:120000,isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(error){if(error!==rollback)failure=error;}finally{await prisma.$disconnect();}
const out=new URL('../../governance/phase2-return-replay/final/',import.meta.url);fs.mkdirSync(out,{recursive:true});fs.writeFileSync(new URL('db-regression.json',out),JSON.stringify({result:failure?'FAIL':'PASS',fixturesRolledBack:true,results,...(failure?{error:failure.stack}:{})},null,2)+'\n');
if(failure){console.error(failure);process.exitCode=1;}else console.log(`PASS ${results.length} real DB assertions; fixtures rolled back`);
