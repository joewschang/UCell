const {chromium}=require('../../member/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844}});
  await page.route('**/assets/line-registration-actions-*.js',async route=>{
   const response=await route.fetch(),js=await response.text();
   const start='async function P1(){';assert.equal(js.split(start).length,2);
   await route.fulfill({response,body:js.replace(start,start+'const Ze={init:async()=>{},isLoggedIn:()=>true,getIDToken:()=>"mock"};')});
  });
  await page.route('**/auth/member/line/exchange',route=>route.fulfill({status:401,json:{code:'LINE_ACCOUNT_UNBOUND'}}));
  await page.goto('https://member.ucell.life/',{waitUntil:'domcontentloaded'});
  const form=page.locator('form.uc-auth-form');
  const back=form.getByRole('button',{name:'上一步',exact:true});
  await back.waitFor({timeout:10000});
  assert.equal((await form.getByRole('button').last().innerText()).trim(),'上一步');
  await back.click();
  console.log('PASS LINE registration back action last and operable');
 }finally{await browser.close();}
})().catch(err=>{console.error(err);process.exitCode=1;});
