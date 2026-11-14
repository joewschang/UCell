const {chromium}=require('../../member/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/assets/member-password-*.js',async route=>{
   const response=await route.fetch(),src=await response.text();
   const fn='async function P1(){';assert(src.includes(fn));
   if(new URL(page.url()).searchParams.has('profile')){
    const mount='xE(document.getElementById("root")).render(';
    const start=src.lastIndexOf(mount);assert(start>0);
    await route.fulfill({response,body:src.slice(0,start)+mount+'r.jsx(PasswordCard,{}));'});
   } else await route.fulfill({response,body:src.replace(fn,fn+'const Ze={init:async()=>{},isLoggedIn:()=>true,getIDToken:()=>"test"};')});
  });
  await page.route('**/auth/member/line/exchange',r=>r.fulfill({status:401,json:{code:'LINE_ACCOUNT_UNBOUND'}}));
  await page.goto('https://member.ucell.life/',{waitUntil:'domcontentloaded'});
  await page.locator('form.uc-auth-form input[autocomplete=name]').waitFor();
  assert.equal(await page.locator('input[autocomplete=new-password]').count(),0);
  let saved=false,posts=0;
  const envelope=data=>({data,meta:{api_version:'v1',request_id:'test',timestamp:new Date().toISOString()}});
  await page.addInitScript(()=>sessionStorage.setItem('ucell_member_token','test'));
  await page.route('**/member/identity',r=>r.fulfill({json:envelope({line:true,hasPassword:saved})}));
  await page.route('**/member/identity/password/initial',r=>{assert.deepEqual(r.request().postDataJSON(),{password:'Sample123'});saved=true;posts++;return r.fulfill({json:envelope({hasPassword:true})})});
  await page.goto('https://member.ucell.life/?profile=1',{waitUntil:'domcontentloaded'});
  await page.getByText('設定登入密碼',{exact:true}).click();
  await page.getByLabel('新密碼',{exact:true}).fill('Sample123');
  await page.getByLabel('確認新密碼',{exact:true}).fill('Wrong123');
  await page.getByText('儲存密碼',{exact:true}).click();
  await page.getByText('兩次密碼不同，請重新確認。').waitFor();assert.equal(posts,0);
  await page.getByLabel('確認新密碼',{exact:true}).fill('Sample123');
  await page.getByText('儲存密碼',{exact:true}).click();
  await page.getByText('已設定登入密碼。').waitFor();assert.equal(posts,1);
  await page.reload({waitUntil:'domcontentloaded'});await page.getByText('已設定登入密碼。').waitFor();
  console.log('PASS LINE registration fields, first password, mismatch, saved status after reload');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
