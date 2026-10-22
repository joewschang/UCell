// Ephemeral synthetic sessions; never impersonates a human account.
const assert=require('node:assert/strict'),{randomUUID}=require('node:crypto');
const {PrismaClient}=require('../packages/database/node_modules/@prisma/client');
const {IdentityTokenService}=require('../apps/api/dist/modules/auth/identity-token.service');
const db=new PrismaClient(),stage=process.env.UCELL_ENVIRONMENT==='STAGE'&&new URL(process.env.DATABASE_URL).hostname==='ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com';
const base=stage?'https://api-stage.ucell.life/api/v1':'http://127.0.0.1:55300/api/v1';
assert.ok(stage||['localhost','127.0.0.1'].includes(new URL(process.env.DATABASE_URL).hostname));
const actors=[];let checks=0;const eq=(a,b)=>{assert.deepEqual(a,b);checks++};
async function actor(audience){const p=await db.person.create({data:{legalName:'SYNTHETIC AI RELEASE TEST',status:'EFFECTIVE'}}),provider=audience==='ADMIN'?'ADMIN_LOCAL':'MEMBER_LOCAL',subject=audience==='ADMIN'?'AI-SYNTHETIC-'+randomUUID():p.memberNo;
 const s=await new IdentityTokenService(db).issue({provider,subject,personId:p.personId,roleCode:audience==='ADMIN'?'SUPER_ADMIN':undefined,ttlSeconds:900});
 if(audience==='ADMIN')await db.adminAccessGrant.create({data:{personId:p.personId,provider,providerSubject:subject,roleCode:'SUPER_ADMIN',validTo:new Date(Date.now()+900000)}});
 for(const cap of audience==='ADMIN'?['AI_EXEC_READ','AI_REPORT_EXPORT','AI_AUDIT_READ']:['AI_MEMBER_SELF'])await db.$executeRaw`INSERT INTO ai.capability_grant(id,actor_id,capability,valid_to,granted_by,reason) VALUES(${randomUUID()}::uuid,${p.personId}::uuid,${cap},now()+interval '15 minutes','RELEASE_TEST','Ephemeral synthetic HTTP verification')`;
 const a={...s,id:p.personId,prefix:audience==='ADMIN'?'/admin/ai':'/member/ai'};actors.push(a);return a;}
async function call(a,path,method='GET',body){const r=await fetch(base+(a?.prefix||'/admin/ai')+path,{method,headers:{...(a?{Authorization:'Bearer '+a.accessToken}:{}),'Content-Type':'application/json','Idempotency-Key':randomUUID()},body:body?JSON.stringify(body):undefined});const text=await r.text();let json;try{json=JSON.parse(text)}catch{}return{status:r.status,data:json?.data??json,text,headers:r.headers};}
async function ask(a,message){const c=await call(a,'/conversations','POST',{});eq(c.status,201);const t=await call(a,'/conversations/'+c.data.id+'/turns','POST',{message,contextVersion:1});eq(t.status,202);for(let i=0;i<40;i++){const r=await call(a,'/turns/'+t.data.turnId);if(!['QUEUED','RUNNING'].includes(r.data.status))return r.data;await new Promise(r=>setTimeout(r,800))}throw Error('QUERY_TIMEOUT')}
(async()=>{try{
 assert.equal(stage,true,'Stage only');
 const admin=await actor('ADMIN'),member=await actor('MEMBER');
 for(const question of ['目前會員數有多少？','目前會員資格數有多少？','現在共有幾位會員，以及多少個會員資格？']){
  const result=await ask(admin,question);eq(result.status,'COMPLETED');eq(result.answer.status,'AVAILABLE');eq(result.answer.definitionVersion,'membership-counts-v1');eq(result.answer.period,undefined);
  const people=await db.person.count({where:{membershipState:{not:null}}});eq(result.answer.facts[0].value,String(people));
  const effective=await db.person.count({where:{membershipState:{not:null},status:'EFFECTIVE'}});eq(result.answer.facts[1].value,String(effective));
  const [qualifications]=await db.$queryRaw`SELECT count(*)::text AS total FROM membership.qualification q WHERE q.kind='MEMBER_ORIGIN' AND q.current_company_principal_id IS NULL AND NOT EXISTS(SELECT 1 FROM rules.system_assignment_pool_entry p WHERE p.qualification_id=q.qualification_id AND p.enabled_from<=now() AND (p.enabled_to IS NULL OR p.enabled_to>now()))`;
  eq(result.answer.facts[5].value,qualifications.total);
  eq(result.answer.rows.reduce((n,r)=>n+Number(r[1]),0),Number(qualifications.total));
  const report=await call(admin,'/report-jobs','POST',{snapshotId:result.snapshotId});eq(report.status,201);
  const csv=await call(admin,'/report-jobs/'+report.data.id+'/download');eq(csv.status,200);assert.ok(csv.text.includes('會員來源資格'));checks++;
  eq((await call({...member,prefix:'/admin/ai'},'/turns/'+result.turnId)).status,401);
 }
 const old=await ask(admin,'去年年底會員數有多少？');eq(old.status,'NEEDS_CLARIFICATION');
 const c=require('../apps/api/dist/modules/ai/ai-contract');eq(c.validatePlan({intent:'MEMBERSHIP_COUNTS'},'MEMBER'),{intent:'DENIED'});
 console.log(JSON.stringify({result:'PASS',checks,countsReconciled:true,export:true,memberDenied:true}));
 }finally{for(const a of actors){await db.authSession.updateMany({where:{personId:a.id},data:{status:'REVOKED',revokedAt:new Date()}});await db.adminAccessGrant.updateMany({where:{personId:a.id},data:{validTo:new Date()}});await db.$executeRaw`UPDATE ai.capability_grant SET valid_to=now() WHERE actor_id=${a.id}::uuid`; }await db.$disconnect()}})().catch(e=>{console.error(e.message);process.exitCode=1});

