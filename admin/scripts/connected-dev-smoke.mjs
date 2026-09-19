// Real local Admin UI/API reads, never Entra or Production validation.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const require=createRequire(new URL('../../member/package.json',import.meta.url));
const {chromium}=require('playwright');
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL??'msedge'});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(10000);
 const errors=[],requests=[];page.on('pageerror',error=>errors.push(error.message));
 await page.route('**/*',route=>{
  const request=route.request(),url=new URL(request.url());
  if(!['http://127.0.0.1:4173','http://localhost:4173','http://127.0.0.1:3001'].includes(url.origin))return route.abort();
  if(!['GET','HEAD'].includes(request.method()))return route.abort();
  return route.continue();
 });
 page.on('response',response=>{if(response.url().includes('/api/v1/'))requests.push({url:response.url(),status:response.status()});});
 await page.goto('http://127.0.0.1:4173/login');await page.getByRole('button',{name:'DEV：Super Admin',exact:true}).click();
 await page.getByRole('heading',{name:'營運總覽',exact:true}).waitFor();
 for(const [path,title] of [['subscriptions','重購訂閱與認列排程'],['orders','訂單與收款'],['products','商品參照'],['returns','退貨／反向／Replay'],['reports','報表／完整性']]){
  await page.goto('http://127.0.0.1:4173/'+path);await page.getByRole('heading',{name:title,exact:true}).waitFor();
  await assert.doesNotReject(()=>page.waitForFunction(()=>!Array.from(document.querySelectorAll('[role="status"]')).some(el=>el.textContent.includes('載入中'))));
 }
 await page.goto('http://127.0.0.1:4173/subscriptions');
 await page.getByText('此頁暫不啟用寫入',{exact:false}).waitFor();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'1440px subscription page has no horizontal overflow');
 const input=page.getByLabel('Ball Number',{exact:true});
 const validFilter=page.waitForResponse(response=>response.url().includes('/api/v1/admin/subscriptions?')&&new URL(response.url()).searchParams.get('ballNo')==='TREE-A000001');
 await input.fill('TREE-A000001');assert.equal((await validFilter).status(),200,'canonical Ball Number filter is accepted');
 const invalidFilter=page.waitForResponse(response=>response.url().includes('/api/v1/admin/subscriptions?')&&new URL(response.url()).searchParams.get('ballNo')==='FORGED');
 await input.fill('FORGED');assert.equal((await invalidFilter).status(),422,'malformed Ball Number fails closed');await page.getByRole('alert').filter({hasText:'資料驗證或必要設定未完成'}).waitFor();
 await input.fill('');await page.getByRole('alert').filter({hasText:'資料驗證或必要設定未完成'}).waitFor({state:'hidden'});
 await page.goto('http://127.0.0.1:4173/not-a-page');await page.getByRole('heading',{name:'找不到後台頁面'}).waitFor();
 assert.deepEqual(errors,[],'no uncaught render or async errors');
 assert.ok(requests.some(row=>row.url.includes('/admin/subscriptions?')&&row.status===200));
 assert.ok(requests.some(row=>new URL(row.url).searchParams.get('ballNo')==='TREE-A000001'&&row.status===200));
 assert.ok(requests.some(row=>new URL(row.url).searchParams.get('ballNo')==='FORGED'&&row.status===422));
 console.log(`ADMIN_UI_CONNECTED_DEV_PASS: ${requests.length} real HTTP responses; DEV demo, five screens, invalid context error/recovery, 404; no network mutations, formal Entra NOT VERIFIED`);
}finally{await browser.close();}
