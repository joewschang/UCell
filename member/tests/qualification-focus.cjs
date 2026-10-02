const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const balls=['q1','q2'].map((id,index)=>({id,code:'A'+String(index+1).padStart(6,'0'),rank:'ELITE',active:true,ballLabel:id}));
  let pending;
  const envelope=data=>({data,meta:{request_id:'local-test',timestamp:new Date().toISOString(),api_version:'v1'}});
  await page.route('**/*',route=>{
   const url=new URL(route.request().url());
   if(url.origin!=='http://127.0.0.1:5186')return route.abort();
   if(url.pathname.endsWith('/context/qualification')){pending=route;return;}
   if(url.pathname.startsWith('/api/'))return route.fulfill({json:envelope(url.pathname.endsWith('/qualifications')?balls:[])});
   return route.continue();
  });
  await page.goto('http://127.0.0.1:5186/tests/qualification-focus.html');
  const selector=page.getByLabel('目前資格');
  await selector.waitFor();
  await selector.focus();await selector.selectOption('q2');
  await page.getByText('正在確認球編號 A000002，請稍候…',{exact:true}).waitFor();
  assert.equal(await page.locator(':focus').getAttribute('id'),'member-main');
  await pending.fulfill({json:envelope({qualificationId:'q2',qualification:balls[1]})});
  await selector.waitFor();
  assert.equal(await page.locator(':focus').getAttribute('id'),'qualification');
  assert.equal(await selector.inputValue(),'q2');
  await selector.selectOption('q1');
  await page.getByText('正在確認球編號 A000001，請稍候…',{exact:true}).waitFor();
  await page.getByRole('navigation',{name:'主要功能',exact:true}).getByText('收益',{exact:true}).focus();
  await pending.fulfill({json:envelope({qualificationId:'q1',qualification:balls[0]})});
  await selector.waitFor();
  assert.equal(await page.locator(':focus').innerText(),'收益');
  await selector.selectOption('q2');
  await page.getByText('正在確認球編號 A000002，請稍候…',{exact:true}).waitFor();
  await pending.fulfill({status:403,json:{message:'denied'}});
  await page.getByRole('alert').waitFor();
  assert.equal(await page.locator(':focus').getAttribute('id'),'member-main');
  await page.getByRole('button',{name:'重新載入',exact:true}).click();
  await selector.waitFor();
  assert.equal(await page.locator(':focus').getAttribute('id'),'qualification');
  console.log('PASS: waiting focus, success restoration, navigation focus preserved, denied focus and retry restoration');
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
