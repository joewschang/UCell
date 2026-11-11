const {chromium}=require(require('node:path').resolve(__dirname,'../../../member/node_modules/playwright'));
const assert=require('node:assert/strict'),fs=require('node:fs');
const origin='http://127.0.0.1:5812',evidence=require('node:path').resolve(__dirname,'../evidence');
(async()=>{const browser=await chromium.launch({channel:'chrome'});let writes=0;try{
 for(const role of [null,'SUPER_ADMIN','COMPLIANCE_AUDIT']){
  const context=await browser.newContext({viewport:{width:390,height:844}});let rows=[];
  if(role)await context.addInitScript(()=>sessionStorage.setItem('ucell_admin_token','ISOLATED-BROWSER-TEST'));
  await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());if(u.origin===origin)return route.continue();
   if(u.origin!=='https://api.ucell.life')return route.abort();
   const headers={'access-control-allow-origin':origin,'access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   let data;
   if(u.pathname.endsWith('/auth/admin/me'))data={role,subject:'isolated-test'};
   else if(u.pathname.endsWith('/preview'))return route.fulfill({headers,contentType:'image/png',body:fs.readFileSync(evidence+'/runtime-poster.png')});
   else if(req.method()==='POST'){
    assert.equal(role,'SUPER_ADMIN');assert(req.headers()['idempotency-key']);writes++;
    if(u.pathname.endsWith('/publish')){assert.equal(req.postDataJSON().approvalReference,'ISOLATED UAT approval');rows[0].status='PUBLISHED';data={id:rows[0].id,status:'PUBLISHED'}}
    else{assert(req.postDataJSON().contentBase64);rows=[{id:'11111111-1111-4111-8111-111111111111',greeting_date:'2026-11-11',title:'隔離測試問候',status:'DRAFT',publish_at:'2026-11-10T23:00:00Z',image_hash:'test'}];data=rows[0]}
   }else data=rows;
   return route.fulfill({headers,contentType:'application/json',body:JSON.stringify({data,meta:{api_version:'v1',request_id:'isolated',timestamp:new Date().toISOString()}})});
  });
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/greetings/');
  if(!role){await page.getByText('請先回到後台登入，再開啟本頁。').waitFor();assert.equal(await page.getByRole('button',{name:'上傳草稿'}).count(),0)}
  else if(role==='COMPLIANCE_AUDIT'){await page.getByRole('heading',{name:'每日問候圖上稿'}).last().waitFor();assert.equal(await page.getByRole('button',{name:'上傳草稿'}).count(),0)}
  else{
   await page.locator('input[maxlength="160"]').fill('隔離測試問候');await page.locator('textarea').fill('隔離測試，不會正式發布');await page.locator('input[type=file]').setInputFiles(require('node:path').resolve(__dirname,'../../../member/tests/fixtures/daily-greeting-2026-11-11.png'));await page.getByRole('button',{name:'上傳草稿'}).click();
   const publish=page.getByRole('button',{name:'核准發布此版本'});await publish.waitFor();assert(await publish.isDisabled());await page.getByRole('button',{name:'預覽',exact:true}).click();await page.locator('input[maxlength="200"]').fill('ISOLATED UAT approval');await publish.click();await page.getByRole('button',{name:'下架',exact:true}).waitFor();await page.screenshot({path:evidence+'/admin-390.png',fullPage:true});
  }
  assert.deepEqual(errors,[]);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await context.close();
 }
 assert.equal(writes,2);console.log('PASS candidate admin image: unauthenticated gate, audited-role UI, upload, preview-before-approval, idempotency headers, mobile layout; all writes mocked');
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
