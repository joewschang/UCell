const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('/app/packages/database/node_modules/@prisma/client'),db=new PrismaClient();
const dir='/app/apps/api/dist/modules/member/',r=require(dir+'review.cjs'),{FormalMemberApplicationService}=require(dir+'formal-member-application.service.js'),{PiiCryptoService}=require('/app/packages/database/dist');
const undo=new Error('rollback');
(async()=>{try{await db.$transaction(async tx=>{
 const [c]=await tx.$queryRawUnsafe("SELECT c.person_id pid,c.legal_entity_id eid,e.registered_name name,e.registration_no number FROM identity.member_type_current c JOIN identity.legal_entity e USING(legal_entity_id) WHERE c.member_no=$1 AND c.active_type='LEGAL_ENTITY'",process.env.TEST_MEMBER_NO);
 assert(c);const app=await tx.formalMemberApplication.findFirstOrThrow({where:{personId:c.pid,status:'DRAFT'}});
 const old=await tx.formalMemberApplicationSnapshot.count({where:{formalMemberApplicationId:app.formalMemberApplicationId}});
 await r.migrate(tx);
 const updated=await tx.formalMemberApplication.findUniqueOrThrow({where:{formalMemberApplicationId:app.formalMemberApplicationId}});
 assert.equal(updated.applicantType,'LEGAL_ENTITY');assert.equal(updated.legalEntityId,c.eid);assert.equal(updated.legalEntityRegistrationNo,c.number);assert.equal(updated.sourceChannel,app.sourceChannel);assert.equal(updated.status,app.status);
 const svc=Object.create(FormalMemberApplicationService.prototype);svc.db=new Proxy(tx,{get:(t,k)=>k==='$transaction'?fn=>fn(tx):t[k]});svc.audit={write:async()=>{}};svc.pii=new PiiCryptoService();
 const list=await svc.adminList({take:100});const row=list.find(x=>x.id===app.formalMemberApplicationId);assert.equal(row.personName,c.name);assert.equal(row.applicantType,'LEGAL_ENTITY');assert(row.representativeName&&row.representativeName!==c.name);
  const details=await svc.adminDetail(row.id,c.pid,randomUUID());assert.equal(details.legalEntity.registeredName,c.name);assert.equal(details.person.legalName,row.representativeName);
 const gate=await svc.evidenceGate(row.id,tx);assert(!gate.codes.includes('LEGAL_ENTITY_PAPER_APPLICATION_REQUIRED'));
 const [latest]=await tx.formalMemberApplicationSnapshot.findMany({where:{formalMemberApplicationId:row.id},orderBy:{version:'desc'},take:1});
 assert.equal(svc.pii.decrypt(latest.payloadCiphertext,latest.keyVersion).legalEntityRegistrationNo,c.number);
 await r.sync(tx,c.pid,c.eid,'LEGAL_ENTITY');assert.equal(await tx.formalMemberApplicationSnapshot.count({where:{formalMemberApplicationId:row.id}}),old+(app.applicantType==='INDIVIDUAL'?1:0));
 await r.sync(tx,c.pid,c.eid,'INDIVIDUAL');assert.equal((await tx.formalMemberApplication.findUnique({where:{formalMemberApplicationId:row.id}})).legalEntityId,null);
 console.log('REVIEW_TEST list/company/representative/source/status/snapshot/reverse passed');throw undo;
 },{timeout:60000});}catch(e){if(e!==undo)throw e}})().catch(e=>{console.log('REVIEW_TEST error '+e.message.slice(-900).replace(/\s+/g,' '));process.exitCode=1}).finally(()=>db.$disconnect());



