// Verifies public login initiation only; never impersonates a human or enters credentials.
const {chromium}=require(process.env.AI_PLAYWRIGHT_MODULE||'../member/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
 try{
  for(const width of [1440,390]){
   const ctx=await browser.newContext({viewport:{width,height:844}});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.goto('https://admin.ucell.life/login');
   await page.getByText('安全登入管理後台',{exact:true}).waitFor();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   let request;
   await page.route('https://login.microsoftonline.com/**/oauth2/v2.0/authorize*',async route=>{
    request=new URL(route.request().url());await route.fulfill({status:200,contentType:'text/html',body:'<p>Authorization request verified</p>'});
   });
   await page.getByRole('button',{name:'使用 Microsoft 帳號登入'}).click();
   await page.getByText('Authorization request verified').waitFor();
   assert.equal(ctx.pages().length,1);assert.equal(request.searchParams.get('client_id'),'0dd08c48-b6e9-4b19-b67a-d3de401f9092');
   assert.equal(request.searchParams.get('redirect_uri'),'https://admin.ucell.life/login');
   assert.equal(request.searchParams.get('code_challenge_method'),'S256');assert.ok(request.searchParams.get('state'));assert.ok(request.searchParams.get('nonce'));
   assert.deepEqual(errors,[]);console.log(JSON.stringify({width,sameTab:true,pkce:true,callbackCorrect:true,noPageErrors:true}));await ctx.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
