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
 assert.equal(stage,true);const admin=await actor('ADMIN');
 const {chromium}=require(process.env.AI_PLAYWRIGHT_MODULE);const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.addInitScript(token=>sessionStorage.setItem('ucell_admin_token',token),admin.accessToken);const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('https://admin-stage.ucell.life/ai-assistant');await page.getByRole('button',{name:'目前會員數有多少？',exact:true}).waitFor();
 await page.getByRole('button',{name:'目前會員資格數有多少？',exact:true}).click();await page.getByText('目前會員與資格統計',{exact:true}).waitFor({timeout:40000});
 for(const width of [1440,390]){await page.setViewportSize({width,height:1000});eq(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:'C:/UCell/ai-stage-20261022/counts-'+width+'.png',fullPage:true});}
 eq(errors,[]);console.log(JSON.stringify({result:'PASS',desktop:true,mobile:true,noOverflow:true,noPageErrors:true}));
 }finally{await browser.close()}
 }finally{for(const a of actors){await db.authSession.updateMany({where:{personId:a.id},data:{status:'REVOKED',revokedAt:new Date()}});await db.adminAccessGrant.updateMany({where:{personId:a.id},data:{validTo:new Date()}});await db.$executeRaw`UPDATE ai.capability_grant SET valid_to=now() WHERE actor_id=${a.id}::uuid`; }await db.$disconnect()}})().catch(e=>{console.error(e.message);process.exitCode=1});

