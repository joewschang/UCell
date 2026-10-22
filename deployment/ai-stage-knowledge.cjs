// Creates reviewable drafts only. No fabricated human approval and no auto-publication.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('../backend/packages/database/node_modules/@prisma/client');
const {ConfigService}=require('../backend/apps/api/node_modules/@nestjs/config');
const {AiService}=require('../backend/apps/api/dist/modules/ai/ai.service');
const {IdentityTokenService}=require('../backend/apps/api/dist/modules/auth/identity-token.service');
assert.equal(new URL(process.env.DATABASE_URL).hostname,'ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com');
const db=new PrismaClient();let actor;
(async()=>{try{
 const p=await db.person.create({data:{legalName:'AI Stage release content author (automation)',status:'EFFECTIVE'}}),subject='ai-release-'+randomUUID();actor=p.personId;
 const s=await new IdentityTokenService(db).issue({provider:'ADMIN_LOCAL',subject,personId:actor,roleCode:'SUPER_ADMIN',ttlSeconds:900});
 await db.adminAccessGrant.create({data:{personId:actor,provider:'ADMIN_LOCAL',providerSubject:subject,roleCode:'SUPER_ADMIN',validTo:new Date(Date.now()+900000)}});
 await db.$executeRaw`INSERT INTO ai.capability_grant(id,actor_id,capability,valid_to,granted_by,reason) VALUES(${randomUUID()}::uuid,${actor}::uuid,'AI_KB_EDIT',now()+interval '15 minutes','RELEASE_AUTHORING','Prepare reviewable policy drafts only')`;
 const service=new AiService(db,new ConfigService(),{},{}),a={id:actor,sessionId:s.sessionId,audience:'ADMIN',provider:'ADMIN_LOCAL',subject,role:'SUPER_ADMIN'};let created=0;
 for(const item of require('./ai-stage-knowledge.json')){
  const existing=await db.$queryRaw`SELECT id FROM ai.knowledge_version WHERE topic=${item.topic} AND source_ref=${item.sourceRef}`;if(existing.length)continue;
  const k=await service.createKnowledge(a,{...item,audience:'ALL',effectiveFrom:'2026-10-22T00:00:00+08:00',effectiveTo:item.topic==='coupon'?'2027-02-01T00:00:00+08:00':'2027-10-22T00:00:00+08:00'});
  await service.knowledgeAction(a,k.id,'submit',{revision:1});created++;
 }
 console.log(JSON.stringify({created,status:'IN_REVIEW',published:0}));
 }finally{if(actor){await db.authSession.updateMany({where:{personId:actor},data:{status:'REVOKED',revokedAt:new Date()}});await db.adminAccessGrant.updateMany({where:{personId:actor},data:{validTo:new Date()}});await db.$executeRaw`UPDATE ai.capability_grant SET valid_to=now() WHERE actor_id=${actor}::uuid`;}await db.$disconnect()}})().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
