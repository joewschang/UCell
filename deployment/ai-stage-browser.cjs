const {chromium}=require(process.env.AI_PLAYWRIGHT_MODULE||'../member/node_modules/playwright');
const {PrismaClient}=require('../backend/packages/database/node_modules/@prisma/client');
const {IdentityTokenService}=require('../backend/apps/api/dist/modules/auth/identity-token.service');
const {randomUUID}=require('node:crypto'),assert=require('node:assert/strict'),fs=require('node:fs');
assert.equal(new URL(process.env.DATABASE_URL).hostname,'ucellstage-pg-5mafbbsq33mgu.postgres.database.azure.com');
const db=new PrismaClient(),actors=[];let browser;const results=[];
(async()=>{try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 for(const audience of ['admin','member']){
  const p=await db.person.create({data:{legalName:'SYNTHETIC AI SCREEN TEST',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}}),provider=audience==='admin'?'ADMIN_LOCAL':'MEMBER_LOCAL',subject=audience==='admin'?randomUUID():p.memberNo;
  const session=await new IdentityTokenService(db).issue({provider,subject,personId:p.personId,roleCode:audience==='admin'?'SUPER_ADMIN':undefined,ttlSeconds:900});actors.push(p.personId);
  if(audience==='admin')await db.adminAccessGrant.create({data:{personId:p.personId,provider,providerSubject:subject,roleCode:'SUPER_ADMIN',validTo:new Date(Date.now()+900000)}});
  for(const cap of audience==='admin'?['AI_EXEC_READ','AI_REPORT_EXPORT','AI_KB_EDIT','AI_KB_APPROVE','AI_AUDIT_READ']:['AI_MEMBER_SELF'])await db.$executeRaw`INSERT INTO ai.capability_grant(id,actor_id,capability,valid_to,granted_by,reason) VALUES(${randomUUID()}::uuid,${p.personId}::uuid,${cap},now()+interval '15 minutes','RELEASE_TEST','Synthetic browser verification')`;
  const ctx=await browser.newContext({viewport:{width:1440,height:1000}});await ctx.addInitScript(({audience,token})=>sessionStorage.setItem('ucell_'+audience+'_token',token),{audience,token:session.accessToken});
  const page=await ctx.newPage(),errors=[];page.on('response',r=>{if(r.url().includes('/ai/')&&r.status()>=400)console.log(JSON.stringify({path:new URL(r.url()).pathname,status:r.status()}))});page.on('pageerror',e=>errors.push(e.message));
  const origin=audience==='admin'?'https://admin-stage.ucell.life':'https://stage.ucell.life';await page.goto(origin+'/ai-assistant');
  await page.getByRole('heading',{name:audience==='admin'?'AI 營運助理':'我的 AI 助理',exact:true}).waitFor({timeout:45000});
  const question=audience==='admin'?'本月付款入帳總額多少？':'我有哪些會員資格？';await page.getByRole('button',{name:question,exact:true}).click();
  try{await page.locator('.uc-ai article').waitFor({timeout:40000})}catch(e){await page.screenshot({path:'C:/UCell/ai-stage-20261022/browser-failure.png',fullPage:true});console.log((await page.locator('.uc-ai').innerText()).slice(0,1600));throw e;}assert.ok(!await page.locator('.uc-ai [role=alert]').count());
  await page.screenshot({path:'C:/UCell/ai-stage-20261022/'+audience+'-desktop.png',fullPage:true});
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'C:/UCell/ai-stage-20261022/'+audience+'-mobile.png',fullPage:true});
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Horizontal page overflow: '+audience);
  if(audience==='admin'){
   await page.goto(origin+'/ai-knowledge');await page.getByRole('heading',{name:'AI 知識庫',exact:true}).waitFor();await page.screenshot({path:'C:/UCell/ai-stage-20261022/knowledge-mobile.png',fullPage:true});
   await page.goto(origin+'/ai-governance');await page.getByRole('heading',{name:'AI 治理與稽核',exact:true}).waitFor();
  }
  assert.deepEqual(errors,[]);results.push({audience,desktop:true,mobile:true,noOverflow:true,noPageErrors:true});await ctx.close();
 }
 fs.writeFileSync('C:/UCell/ai-stage-20261022/browser-results.json',JSON.stringify(results,null,2));console.log(JSON.stringify({result:'PASS',results}));
 }finally{if(browser)await browser.close();for(const id of actors){await db.authSession.updateMany({where:{personId:id},data:{status:'REVOKED',revokedAt:new Date()}});await db.adminAccessGrant.updateMany({where:{personId:id},data:{validTo:new Date()}});await db.$executeRaw`UPDATE ai.capability_grant SET valid_to=now() WHERE actor_id=${id}::uuid`;}await db.$disconnect()}})().catch(e=>{console.error(e.message);process.exitCode=1});
