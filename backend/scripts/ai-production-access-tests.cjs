const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('../packages/database/node_modules/@prisma/client');
const {ConfigService}=require('../apps/api/node_modules/@nestjs/config');
const {AiService}=require('../apps/api/dist/modules/ai/ai.service');
const {AiData}=require('../apps/api/dist/modules/ai/ai-data');
const {IdentityTokenService}=require('../apps/api/dist/modules/auth/identity-token.service');
assert.equal(new URL(process.env.DATABASE_URL).hostname,'127.0.0.1');assert.equal(new URL(process.env.DATABASE_URL).port,'55432');
const db=new PrismaClient(),config=new ConfigService({UCELL_ENVIRONMENT:'PRODUCTION',NODE_ENV:'production',AI_ENABLED:'true',AI_ACCESS_MODE:'PRODUCTION_ROLES'});
const service=new AiService(db,config,{configured:()=>true},new AiData(db,config));let checks=0;
const eq=(a,b)=>{assert.deepEqual(a,b);checks++},deny=async f=>{await assert.rejects(f);checks++};
async function actor(role){const p=await db.person.create({data:{legalName:'LOCAL PRODUCTION POLICY TEST',status:'EFFECTIVE',membershipState:role?null:'NETWORK_MEMBER'}}),provider=role?'ADMIN_LOCAL':'MEMBER_LOCAL',subject=randomUUID();const s=await new IdentityTokenService(db).issue({provider,subject,personId:p.personId,roleCode:role});if(role)await db.adminAccessGrant.create({data:{personId:p.personId,provider,providerSubject:subject,roleCode:role}});return{id:p.personId,audience:role?'ADMIN':'MEMBER',sessionId:s.sessionId,provider,subject,role};}
(async()=>{try{
 const admin=await actor('SUPER_ADMIN'),finance=await actor('FINANCE'),member=await actor();
 for(const cap of ['AI_EXEC_READ','AI_REPORT_EXPORT','AI_KB_EDIT','AI_KB_APPROVE','AI_AUDIT_READ']){await service.assertActor(admin,cap);checks++;}
 await service.assertActor(member);checks++;
 await deny(()=>service.assertActor(finance));await deny(()=>service.assertActor({...finance,role:'SUPER_ADMIN'}));
 await deny(()=>service.assertActor(member,'AI_EXEC_READ'));await deny(()=>service.assertActor({...admin,sessionId:'DEV_BYPASS'}));
 await deny(()=>service.assertActor({...member,id:'51000000-0000-4000-8000-000000000001',sessionId:'STAGE_UAT_MEMBER'}));
 eq((await service.capabilities(admin)).stageOnly,false);eq((await service.capabilities(member)).capabilities,['AI_MEMBER_SELF']);
 const counts=await new AiData(db,config).execute(admin,{intent:'MEMBERSHIP_COUNTS'},null);assert.ok(counts.notice.startsWith('正式環境'));checks++;
 await db.person.update({where:{personId:member.id},data:{securityStatus:'SECURITY_LOCKED'}});await deny(()=>service.assertActor(member));
 await db.adminAccessGrant.updateMany({where:{personId:admin.id},data:{validTo:new Date()}});await deny(()=>service.assertActor(admin));
 config.set('AI_ENABLED','false');await deny(()=>service.assertActor(finance));config.set('AI_ENABLED','true');config.set('NODE_ENV','staging');await deny(()=>service.assertActor(finance));
 console.log(JSON.stringify({result:'PASS',checks,environment:'LOCAL_PRODUCTION_POLICY'}));
}finally{await db.$disconnect()}})().catch(e=>{console.error(e.message);process.exitCode=1});
