// Exact principals verified against Stage data and Entra directory on 2026-10-22.
// The user explicitly requested these two accounts and the existing Super Admin test identity.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('../backend/packages/database/node_modules/@prisma/client');
assert.equal(new URL(process.env.DATABASE_URL).hostname,'ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com');
assert.equal(new URL(process.env.DATABASE_URL).pathname,'/ucell_stage');
const targets=[
 {label:'joewschang@gmail.com',id:'aac33b07-d24a-4887-972b-6fdf9eaf9e7a',subject:'25ecd876-6756-46fe-83c8-2a7437e96acc',createAdminGrant:true},
 {label:'service@ucell.life',id:'48008ed6-3f92-4c7a-b50b-bdf6c314ae2f',subject:'75da5a19-f8a4-41a5-a1f4-62e7ec648fde'},
 {label:'Existing Stage Super Admin test identity',id:'2933a0c8-f8b1-45ef-8e71-c41959f76334',subject:'UAT_STAGE_ADMIN_SUPER_ADMIN'},
];
const capabilities=['AI_EXEC_READ','AI_REPORT_EXPORT','AI_KB_EDIT','AI_KB_APPROVE','AI_AUDIT_READ'],until=new Date('2026-11-22T00:00:00Z'),db=new PrismaClient();
(async()=>{try{const author=await db.person.findFirstOrThrow({where:{legalName:'AI Stage release content author (automation)'},select:{personId:true}});
 await db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('ai-stage-authorize'))::text`;
  for(const target of targets){
   const p=await tx.person.findUniqueOrThrow({where:{personId:target.id},select:{email:true,status:true,securityStatus:true}});assert.equal(p.status,'EFFECTIVE');assert.equal(p.securityStatus,'NORMAL');
   if(target.createAdminGrant)assert.equal(p.email?.toLowerCase(),target.label);
   const link=await tx.identityLink.findUnique({where:{provider_providerSubject:{provider:'ENTRA',providerSubject:target.subject}}});if(link)assert.equal(link.personId,target.id,'Identity conflict');
   const grants=await tx.adminAccessGrant.findMany({where:{provider:'ENTRA',providerSubject:target.subject,status:'ACTIVE',validFrom:{lte:new Date()},OR:[{validTo:null},{validTo:{gt:new Date()}}]}});
   for(const grant of grants){assert.equal(grant.personId,target.id);assert.equal(grant.roleCode,'SUPER_ADMIN');}
   if(!grants.length){assert.equal(target.createAdminGrant,true,'Missing existing admin grant');await tx.adminAccessGrant.create({data:{personId:target.id,provider:'ENTRA',providerSubject:target.subject,roleCode:'SUPER_ADMIN',validTo:until,createdBy:author.personId}});}
   for(const cap of capabilities)await tx.$executeRaw`INSERT INTO ai.capability_grant(id,actor_id,capability,valid_to,granted_by,reason) VALUES(${randomUUID()}::uuid,${target.id}::uuid,${cap},${until},'EXPLICIT_USER_REQUEST_20261022','User named this Stage tester; verified directory subject and existing person') ON CONFLICT(actor_id,capability) DO UPDATE SET valid_to=EXCLUDED.valid_to,revision=ai.capability_grant.revision+1`;
   await tx.$executeRaw`INSERT INTO ai.audit_event(id,actor_id,audience,action,entity_id,outcome,details) VALUES(${randomUUID()}::uuid,${author.personId}::uuid,'ADMIN','CAPABILITIES_GRANTED',${target.id}::uuid,'GRANTED',${JSON.stringify({authorization:'explicit-user-request',capabilities,validTo:until.toISOString()})}::jsonb)`;
  }
 },{timeout:30000});
 for(const target of targets){for(const capability of capabilities){const rows=await db.$queryRaw`SELECT id FROM ai.capability_grant WHERE actor_id=${target.id}::uuid AND capability=${capability} AND valid_from<=now() AND valid_to>now()`;assert.equal(rows.length,1);}console.log(JSON.stringify({account:target.label,role:'SUPER_ADMIN',capabilities,expiresAt:until.toISOString(),verified:true}));}
 // No human login is fabricated. Actual Microsoft sign-in/MFA remains the user's step.
 }finally{await db.$disconnect()}})().catch(e=>{console.error(e.message);process.exitCode=1});
