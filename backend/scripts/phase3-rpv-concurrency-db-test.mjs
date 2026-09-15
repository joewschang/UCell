import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {RpvService}=require('./apps/api/dist/modules/rpv/rpv.service.js');
const {replayRpvCancellation}=require('./packages/database/dist/historical-replay.js');
const url=new URL(process.env.DATABASE_URL??'');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.match(process.env.GOLDEN_ISOLATION_DATABASE??'',/^ucell_dev_golden_[a-f0-9]{32}$/);
assert.equal(url.pathname,'/'+process.env.GOLDEN_ISOLATION_DATABASE);
const db=new PrismaClient();let assertions=0;
function equal(actual,expected,label){assert.deepEqual(actual,expected,label);assertions++;}
try{
 const at=new Date('2026-09-15T16:00:00Z');
 const owner=await db.person.create({data:{legalName:'RPV CONCURRENCY TEST ONLY'}});
 const q=await db.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
 await db.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:at,sourceType:'TEST_ONLY'}});
 await db.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:at,sourceType:'TEST_ONLY'}});
 const ancestors=[];
 for(let generation=1;generation<=2;generation++){
  const ancestor=await db.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
  await db.qualificationPlanHistory.create({data:{qualificationId:ancestor.qualificationId,planCode:'STARTER',effectiveFrom:at,sourceType:'TEST_ONLY'}});
  await db.qualificationStatusHistory.create({data:{qualificationId:ancestor.qualificationId,status:'EFFECTIVE',effectiveFrom:at,sourceType:'TEST_ONLY'}});
  if(generation===2)await db.activePeriod.create({data:{qualificationId:ancestor.qualificationId,activeFrom:at,sourceType:'TEST_ONLY',ruleVersionCode:'R1.0B'}});
  await db.binaryPlacement.create({data:{childQualificationId:generation===1?q.qualificationId:ancestors[0].qualificationId,parentQualificationId:ancestor.qualificationId,side:'LEFT',effectiveFrom:at}});
  ancestors.push(ancestor);
 }
 const plan=await db.subscriptionPlan.create({data:{planCode:'TEST_ONLY_'+randomUUID(),displayName:'TEST ONLY',durationMonths:1,prepaidAmount:2000,productBoxQty:1,monthlyRecognizedAmount:2000,monthlyRpv:1200}});
 const sub=await db.subscription.create({data:{qualificationId:q.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:new Date('2026-09-01'),endMonth:new Date('2026-09-01'),ruleVersionCode:'R1.0B'}});
 const schedule=await db.monthlyRecognitionSchedule.create({data:{subscriptionId:sub.subscriptionId,installmentNo:1,recognitionMonth:new Date('2026-09-01'),recognizedAmount:2000,rpvAmount:1200,dueAt:at,ruleVersionCode:'R1.0B'}});
 let arrived=0,release;const barrier=new Promise(resolve=>{release=resolve;});
 const concurrent={ $transaction:(work,options)=>db.$transaction(tx=>work({...tx,monthlyRecognitionSchedule:{...tx.monthlyRecognitionSchedule,findUnique:async args=>{
  const row=await tx.monthlyRecognitionSchedule.findUnique(args);
  if(++arrived===2)release();await barrier;return row;
 }}}),options)};
 const attempts=await Promise.allSettled([new RpvService(concurrent,{}).recognize(schedule.recognitionId),new RpvService(concurrent,{}).recognize(schedule.recognitionId)]);
 equal(attempts.filter(item=>item.status==='fulfilled').length,1,'one concurrent recognition commits');
 const failed=attempts.find(item=>item.status==='rejected');
 equal(['P2034','P2002'].includes(failed?.reason.code),true,'losing Serializable delivery requires redelivery');
 const service=new RpvService(db,{});
 equal(await service.recognize(schedule.recognitionId),{skipped:'ALREADY_RECOGNIZED'},'external redelivery returns already recognized');
 equal(await db.pvLedger.count({where:{sourceLineId:schedule.recognitionId,pvType:'RPV'}}),1,'one durable original RPV ledger event');
 const event=await db.pvLedger.findFirstOrThrow({where:{sourceLineId:schedule.recognitionId,pvType:'RPV'}});
 equal(event.amount.toString(),'1200','one exact recognition amount');
 const original=await db.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'RPV',sourceId:schedule.recognitionId}}});
 equal(original.content.inputs.eventId,event.eventId,'sealed evidence references committed event');
 equal((await db.monthlyRecognitionSchedule.findUniqueOrThrow({where:{recognitionId:schedule.recognitionId}})).pvLedgerEventId,event.eventId,'schedule references committed event');
 await service.recognize(schedule.recognitionId);
 equal(await db.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'RPV',sourceId:schedule.recognitionId}}}),original,'duplicate preserves complete historical snapshot');
 const awards=await db.rpvUplineAwardEvent.findMany({where:{recognitionId:schedule.recognitionId},orderBy:{binaryGeneration:'asc'}});
 equal(awards.map(row=>[row.binaryGeneration,row.activeSnapshot,row.payableAmount.toString()]),[[1,false,'0'],[2,true,'100']],'concurrent recognition preserves inactive generation and higher Active recipient');
 const replacement=await db.qualification.create({data:{currentHolderPersonId:owner.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:at}});
 await db.binaryPlacement.update({where:{childQualificationId:q.qualificationId},data:{parentQualificationId:replacement.qualificationId}});
 await db.activePeriod.create({data:{qualificationId:ancestors[0].qualificationId,activeFrom:new Date(at.getTime()+1),sourceType:'TEST_ONLY',ruleVersionCode:'R1.0B'}});
 await db.activePeriod.updateMany({where:{qualificationId:ancestors[1].qualificationId},data:{activeTo:new Date(at.getTime()+1)}});
 const cancellation=await db.subscriptionCancellation.create({data:{subscriptionId:sub.subscriptionId,requestedAt:at,effectiveAt:at,reasonCode:'TEST_ONLY',correlationId:randomUUID()}});
 const actionKey='RPV:'+schedule.recognitionId+':'+cancellation.subscriptionCancellationId;
 let readers=0,unlock;const replayBarrier=new Promise(resolve=>{unlock=resolve;});
 const run=controlled=>db.$transaction(tx=>replayRpvCancellation(controlled?{...tx,replayAction:{...tx.replayAction,findUnique:async args=>{
  const row=await tx.replayAction.findUnique(args);if(++readers===2)unlock();await replayBarrier;return row;
 }}}:tx,schedule.recognitionId,cancellation.subscriptionCancellationId,actionKey,randomUUID()),{isolationLevel:'Serializable',timeout:15000});
 const replayAttempts=await Promise.allSettled([run(true),run(true)]);
 equal(replayAttempts.filter(item=>item.status==='fulfilled').length,1,'one concurrent historical recipient replay commits');
 equal(['P2034','P2002'].includes(replayAttempts.find(item=>item.status==='rejected')?.reason.code),true,'losing historical replay requires external redelivery');
 equal((await run(false)).status,'REPLAYED','historical replay external retry succeeds');
 const posts=await db.entitlementReplayPosting.findMany({where:{actionKey}});
 equal(posts.length,2,'one posting per original historical recipient including inactive');
 equal(posts.find(row=>row.recipientQualificationId===ancestors[0].qualificationId).delta.toString(),'0','original inactive recipient remains zero despite current Active');
 const activePost=posts.find(row=>row.recipientQualificationId===ancestors[1].qualificationId);
 equal(activePost.delta.toString(),'-100','original Active recipient receives historical recovery despite current inactivity');
 equal(await db.entitlementReplayPosting.count({where:{actionKey,recipientQualificationId:replacement.qualificationId}}),0,'current replacement receives no historical recovery');
 equal(await db.bonusRecoveryEvent.count({where:{bonusRecoveryEventId:activePost.recoveryId,recoveryAmount:100,outstandingAmount:100}}),1,'one exact historical recipient recovery');
 equal(await db.pvLedger.count({where:{reversalOfEventId:event.eventId,amount:-1200}}),1,'one original RPV reversal across concurrent replay and retry');
 equal(await db.rpvUplineAwardEvent.findMany({where:{recognitionId:schedule.recognitionId},orderBy:{binaryGeneration:'asc'}}),awards,'all original recipient awards remain unchanged');
 equal(await db.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'RPV',sourceId:schedule.recognitionId}}}),original,'concurrent historical replay preserves entire snapshot');
 console.log(`PHASE3_RPV_CONCURRENCY_DB_PASS: ${assertions} assertions; controlled parallel reads, Serializable conflict, external redelivery, original identity and immutable evidence`);
}finally{await db.$disconnect();}
