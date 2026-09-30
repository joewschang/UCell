import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {mkdtempSync,readFileSync,existsSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve,extname,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const backend=join(root,'backend'),apiRequire=createRequire(join(backend,'apps/api/package.json'));
const dbRequire=createRequire(join(backend,'packages/database/package.json')),memberRequire=createRequire(join(root,'member/package.json'));
const {PrismaClient}=dbRequire('@prisma/client');
const database='ucell_browser_'+randomUUID().replaceAll('-','');
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['127.0.0.1','localhost'].includes(base.hostname));assert.match(database,/^ucell_browser_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';const target=new URL(base);target.pathname='/'+database;
const adminDb=new PrismaClient({datasources:{db:{url:control.href}}});
const temp=mkdtempSync(join(tmpdir(),'ucell-browser-')),screens=resolve(process.env.UCELL_BROWSER_OUTPUT??join(root,'../logs/member-engagement-browser'));
mkdirSync(screens,{recursive:true});
let created=false,app,db,browser;const servers=[];
function run(args,cwd,env){const result=spawnSync(process.execPath,args,{cwd,env,encoding:'utf8'});assert.equal(result.status,0,'Local build/migration failed: '+result.stderr);}
async function site(directory,apiOrigin){
 const server=createServer(async(req,res)=>{try{
  if(req.url.startsWith('/api/v1/')){
   const body=[];for await(const chunk of req)body.push(chunk);
   const response=await fetch(apiOrigin+req.url,{method:req.method,headers:{...(req.headers.authorization?{authorization:req.headers.authorization}:{}),...(req.headers['content-type']?{'content-type':req.headers['content-type']}:{}),...(req.headers['idempotency-key']?{'idempotency-key':req.headers['idempotency-key']}:{} )},...(!['GET','HEAD'].includes(req.method)?{body:Buffer.concat(body)}:{})});
   res.writeHead(response.status,{'content-type':response.headers.get('content-type')??'application/json'});res.end(Buffer.from(await response.arrayBuffer()));return;
  }
  const path=resolve(directory,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
  if(path!==directory&&!path.startsWith(directory+'/')&&!path.startsWith(directory+'\\')){res.writeHead(403);res.end();return;}
  const file=existsSync(path)&&extname(path)?path:join(directory,'index.html');
  res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'})[extname(file)]??'application/octet-stream');res.end(readFileSync(file));
 }catch{res.writeHead(500);res.end('Local test server error');}});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));servers.push(server);return 'http://127.0.0.1:'+server.address().port;
}
try{
 await adminDb.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;
 process.env.DATABASE_URL=target.href;process.env.NODE_ENV='test';
 run([dbRequire.resolve('prisma/build/index.js'),'migrate','deploy','--schema','packages/database/prisma/schema.prisma'],backend,process.env);
 db=new PrismaClient({datasources:{db:{url:target.href}}});
 apiRequire('reflect-metadata');
 const {IdentityTokenService}=apiRequire('./dist/modules/auth/identity-token.service');
 const tokens=new IdentityTokenService(db);
 async function actor(roleCode){const person=await db.person.create({data:{legalName:roleCode?'本機測試管理員':'本機測試會員',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}}),subject=randomUUID(),provider=roleCode?'ENTRA':'LINE';await db.identityLink.create({data:{provider,providerSubject:subject,personId:person.personId}});if(roleCode)await db.adminAccessGrant.create({data:{personId:person.personId,provider,providerSubject:subject,roleCode,validFrom:new Date(Date.now()-1000)}});return {person,token:(await tokens.issue({provider,subject,personId:person.personId,...(roleCode?{roleCode}:{})})).accessToken};}
 const member=await actor(),operator=await actor('MEMBERSHIP_OPS');
 const {NestFactory}=apiRequire('@nestjs/core'),{FastifyAdapter}=apiRequire('@nestjs/platform-fastify'),{ValidationPipe}=apiRequire('@nestjs/common');
 app=await NestFactory.create(apiRequire('./dist/app.module').AppModule,new FastifyAdapter(),{logger:false,abortOnError:false});
 app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
 app.useGlobalFilters(new (apiRequire('./dist/common/filters/api-exception.filter').ApiExceptionFilter)());
 app.useGlobalInterceptors(new (apiRequire('./dist/common/interceptors/request-context.interceptor').RequestContextInterceptor)(),new (apiRequire('./dist/common/interceptors/envelope.interceptor').EnvelopeInterceptor)());
 await app.listen(0,'127.0.0.1');const apiOrigin=await app.getUrl();
 // Existing explicit UAT bootstrap uses an ephemeral local session. Never modifies a deployable dist or .env.
 run([join(dirname(memberRequire.resolve('vite/package.json')),'bin/vite.js'),'build','--outDir',join(temp,'member')],join(root,'member'),{...process.env,NODE_ENV:'production',VITE_ENABLE_MOCK:'false',VITE_STAGE_UAT_MEMBER_ENABLED:'true',VITE_STAGE_UAT_MEMBER_TOKEN:member.token});
 const memberOrigin=await site(join(temp,'member'),apiOrigin),adminOrigin=await site(join(root,'admin/dist'),apiOrigin);
 const {chromium}=memberRequire('playwright');browser=await chromium.launch({headless:true,channel:'msedge'});
 const errors=[];
 async function pageFor(origin,token){const context=await browser.newContext({viewport:{width:1280,height:900}});await context.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());if(token)await context.addInitScript(token=>sessionStorage.setItem('ucell_admin_token',token),token);const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));return page;}
 const adminPage=await pageFor(adminOrigin,operator.token);
 await adminPage.goto(adminOrigin+'/learning');await adminPage.getByRole('heading',{name:'教育訓練管理',exact:true}).waitFor();
 await adminPage.getByLabel('課程代碼',{exact:true}).fill('BROWSER-COURSE');await adminPage.getByLabel('課程名稱',{exact:true}).fill('瀏覽器驗收課程');await adminPage.getByLabel('單元名稱',{exact:true}).fill('安全操作');await adminPage.getByLabel('文章內容',{exact:true}).fill('閱讀本機測試教材，完成後保存學習紀錄。');await adminPage.getByRole('button',{name:'保存草稿',exact:true}).click();
 await adminPage.getByLabel('發布核准依據',{exact:true}).fill('LOCAL-BROWSER-APPROVAL');await adminPage.getByRole('button',{name:'核准發布',exact:true}).click();await adminPage.getByText('BROWSER-COURSE · 已發布 · 0 筆報名',{exact:true}).waitFor();
 await adminPage.evaluate(()=>window.scrollTo(0,0));await adminPage.screenshot({path:join(screens,'admin-learning.png'),fullPage:true});
 const page=await pageFor(memberOrigin);
 await page.goto(memberOrigin+'/learning?uat=A&course=BROWSER-COURSE');await page.getByRole('button',{name:'加入課程',exact:true}).click();await page.getByRole('button',{name:'標記「安全操作」已完成',exact:true}).click();await page.getByRole('button',{name:'完成課程',exact:true}).click();await page.getByText('課程 BROWSER-COURSE · 第 1 版 · 已完成',{exact:true}).waitFor();await page.screenshot({path:join(screens,'member-learning.png'),fullPage:true});
 await page.goto(memberOrigin+'/growth?uat=A');await page.getByRole('heading',{name:'我的成長',exact:true}).waitFor();await page.getByText('本人全部紀錄：1 門已加入，1 門已完成。',{exact:true}).waitFor();await page.screenshot({path:join(screens,'member-growth-desktop.png'),fullPage:true});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:join(screens,'member-growth-mobile.png'),fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),'Mobile horizontal overflow');
 assert.equal(await db.learningEnrollment.count({where:{personId:member.person.personId,status:'COMPLETED'}}),1);assert.equal(await db.memberNotification.count({where:{personId:member.person.personId,category:'LEARNING'}}),2);
 await adminPage.goto(adminOrigin+'/events');await adminPage.getByRole('heading',{name:'活動管理',exact:true}).waitFor();
 const localInput=milliseconds=>new Date(milliseconds+8*3600000).toISOString().slice(0,16);
 await adminPage.getByLabel('活動代碼',{exact:true}).fill('BROWSER-EVENT');await adminPage.getByLabel('活動名稱',{exact:true}).fill('瀏覽器驗收活動');await adminPage.getByLabel('活動形式').selectOption('OFFLINE');await adminPage.getByLabel('開始時間（臺北）',{exact:true}).fill(localInput(Date.now()+3600000));await adminPage.getByLabel('結束時間（臺北）',{exact:true}).fill(localInput(Date.now()+7200000));await adminPage.getByLabel('實體地點',{exact:true}).fill('本機驗收會場');await adminPage.getByRole('button',{name:'保存活動草稿',exact:true}).click();
 await adminPage.getByLabel('發布核准依據',{exact:true}).fill('LOCAL-BROWSER-APPROVAL');await adminPage.getByRole('button',{name:'核准發布活動',exact:true}).click();await adminPage.getByText('BROWSER-EVENT · 已發布 · 0 筆會員報名資料',{exact:true}).waitFor();
 await page.goto(memberOrigin+'/events?uat=A&event=BROWSER-EVENT');await page.getByRole('button',{name:'報名活動',exact:true}).click();await page.getByRole('button',{name:'更新報到憑證',exact:true}).waitFor();const first=await page.getByLabel('報到憑證',{exact:true}).textContent();assert.match(first,/^[A-Za-z0-9_-]{43}$/);await page.getByRole('button',{name:'更新報到憑證',exact:true}).click();await page.getByText('已更新報到憑證，舊憑證已失效。',{exact:true}).waitFor();assert.notEqual(await page.getByLabel('報到憑證',{exact:true}).textContent(),first);
 await page.getByRole('button',{name:'取消報名',exact:true}).click();await page.getByText('已取消報名。',{exact:true}).waitFor();assert.equal(await page.getByLabel('報到憑證',{exact:true}).count(),0);await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:join(screens,'member-event-cancelled.png'),fullPage:true});
 await page.goto(memberOrigin+'/notifications?uat=A');await page.getByRole('heading',{name:'訊息中心',exact:true}).waitFor();await page.getByLabel('訊息分類').selectOption('EVENT');await page.getByRole('button',{name:'標為已讀',exact:true}).first().click();await page.locator('article').filter({hasText:/· 已讀 ·/}).first().waitFor();await page.getByRole('button',{name:'封存訊息',exact:true}).first().click();await page.getByLabel('訊息範圍').selectOption('ARCHIVED');await page.locator('article').filter({hasText:'已封存'}).waitFor();await page.evaluate(()=>window.scrollTo(0,0));await page.screenshot({path:join(screens,'member-message-history.png'),fullPage:true});
 assert.equal(await db.memberEventParticipationEvidence.count({where:{registration:{personId:member.person.personId}}}),2);assert.equal(await db.notificationDelivery.count(),0);
 assert.equal(await db.memberNotificationRead.count({where:{personId:member.person.personId}}),1);assert.equal(await db.memberNotificationArchive.count({where:{personId:member.person.personId}}),1);
 await adminPage.getByLabel('顯示模式',{exact:true}).selectOption('DARK');await adminPage.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await adminPage.evaluate(()=>window.scrollTo(0,0));await adminPage.screenshot({path:join(screens,'admin-events-dark.png'),fullPage:true});
 await adminPage.getByLabel('顯示模式',{exact:true}).selectOption('SYSTEM');await adminPage.emulateMedia({colorScheme:'dark'});await adminPage.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await adminPage.getByLabel('顯示模式',{exact:true}).selectOption('LIGHT');await adminPage.waitForFunction(()=>document.documentElement.dataset.theme==='light');
 await page.emulateMedia({colorScheme:'dark'});await page.goto(memberOrigin+'/growth?uat=A');await page.getByRole('heading',{name:'我的成長',exact:true}).waitFor();await page.waitForFunction(()=>document.documentElement.dataset.theme==='dark');await page.screenshot({path:join(screens,'member-growth-dark.png'),fullPage:true});
 // Transport fault injection exercises recovery UI; the successful retry still uses the actual API.
 const growthRoute='**/api/v1/member/my-growth';await page.route(growthRoute,route=>route.abort('failed'));await page.reload();await page.getByRole('alert').waitFor();await page.unroute(growthRoute);await page.getByRole('button',{name:'重新載入',exact:true}).click();await page.getByRole('heading',{name:'我的成長',exact:true}).waitFor();
 assert.deepEqual(errors,[]);console.log('MEMBER_ENGAGEMENT_BROWSER_PASS: real Admin course/event publish, Member lesson/course completion, Growth desktop/mobile, event registration/credential rotation/cancellation, message read/archive; no qualification; real PostgreSQL and API');
}finally{
 await browser?.close();for(const server of servers)await new Promise(ok=>server.close(ok));await app?.close();await db?.$disconnect();
 if(created)await adminDb.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');await adminDb.$disconnect();
 assert.ok(resolve(temp).startsWith(resolve(tmpdir())+'\\ucell-browser-')||resolve(temp).startsWith(resolve(tmpdir())+'/ucell-browser-'));rmSync(temp,{recursive:true,force:true});console.log('MEMBER_ENGAGEMENT_BROWSER_CLEANUP_PASS');
}
