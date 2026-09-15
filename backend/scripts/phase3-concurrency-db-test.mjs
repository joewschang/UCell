import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {IdempotencyService}=require('./apps/api/dist/common/idempotency/idempotency.service.js');
const url=new URL(process.env.DATABASE_URL??'');
assert.ok(['localhost','127.0.0.1'].includes(url.hostname));
assert.match(process.env.GOLDEN_ISOLATION_DATABASE??'',/^ucell_dev_golden_[a-f0-9]{32}$/);
assert.equal(url.pathname,'/'+process.env.GOLDEN_ISOLATION_DATABASE);
const prisma=new PrismaClient(),service=new IdempotencyService(prisma);
try{
 const work=async tx=>{const person=await tx.person.create({data:{legalName:'GOLDEN CONCURRENT IDEMPOTENCY'}});return {personId:person.personId};};
 const attempts=await Promise.allSettled([service.execute('GOLDEN_CONCURRENT','same-key',{request:1},work),service.execute('GOLDEN_CONCURRENT','same-key',{request:1},work)]);
 assert.ok(attempts.some(x=>x.status==='fulfilled'),'at least one transaction commits');
 const deliveries=[];
 for(const attempt of attempts){
   if(attempt.status==='fulfilled')deliveries.push(attempt.value);
   else{
     assert.ok(['P2002','P2034'].includes(attempt.reason.code),'only uniqueness/serialization conflicts permit redelivery');
     // Simulate external redelivery; this does not claim an automatic retry in the service.
     deliveries.push(await service.execute('GOLDEN_CONCURRENT','same-key',{request:1},work));
   }
 }
 assert.equal(deliveries[0].value.personId,deliveries[1].value.personId);
 assert.equal(await prisma.person.count({where:{legalName:'GOLDEN CONCURRENT IDEMPOTENCY'}}),1);
 assert.equal(await prisma.idempotencyRecord.count({where:{actorScope:'GOLDEN_CONCURRENT',idempotencyKey:'same-key'}}),1);
 await assert.rejects(service.execute('GOLDEN_CONCURRENT','same-key',{request:2},work),error=>error.getResponse?.().code==='IDEMPOTENCY_CONFLICT');
 const retryWork=async(tx,fail)=>{
   const person=await tx.person.create({data:{legalName:'GOLDEN ROLLBACK RETRY'}});
   await tx.outboxEvent.create({data:{eventType:'GOLDEN_TEST_ONLY',aggregateType:'PERSON',aggregateId:person.personId,payload:{testOnly:true},correlationId:person.personId}});
   if(fail)throw new Error('GOLDEN_INJECTED_PARTIAL_FAILURE');
   return {personId:person.personId};
 };
 await assert.rejects(service.execute('GOLDEN_ROLLBACK','retry-key',{request:1},tx=>retryWork(tx,true)),/GOLDEN_INJECTED_PARTIAL_FAILURE/);
 assert.equal(await prisma.person.count({where:{legalName:'GOLDEN ROLLBACK RETRY'}}),0);
 assert.equal(await prisma.outboxEvent.count({where:{eventType:'GOLDEN_TEST_ONLY'}}),0);
 assert.equal(await prisma.idempotencyRecord.count({where:{actorScope:'GOLDEN_ROLLBACK'}}),0);
 const retry=await service.execute('GOLDEN_ROLLBACK','retry-key',{request:1},tx=>retryWork(tx,false));
 assert.equal(retry.replayed,false);
 const duplicate=await service.execute('GOLDEN_ROLLBACK','retry-key',{request:1},tx=>retryWork(tx,false));
 assert.equal(duplicate.replayed,true);assert.equal(duplicate.value.personId,retry.value.personId);
 assert.equal(await prisma.person.count({where:{legalName:'GOLDEN ROLLBACK RETRY'}}),1);
 assert.equal(await prisma.outboxEvent.count({where:{eventType:'GOLDEN_TEST_ONLY'}}),1);
 console.log('PHASE3_CONCURRENCY_DB_PASS: concurrent unique commit, external redelivery, rollback of entity/outbox/idempotency, retry and duplicate delivery');
}finally{await prisma.$disconnect();}
