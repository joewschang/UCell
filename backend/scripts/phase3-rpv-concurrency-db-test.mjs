import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {RpvService}=require('./apps/api/dist/modules/rpv/rpv.service.js');
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
 console.log(`PHASE3_RPV_CONCURRENCY_DB_PASS: ${assertions} assertions; controlled parallel reads, Serializable conflict, external redelivery, original identity and immutable evidence`);
}finally{await db.$disconnect();}
