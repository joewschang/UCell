// Run with NODE_PATH pointing to a Playwright installation, with mock dev server running.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try {
  const page=await browser.newPage({viewport:{width:390,height:844}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5174/');
  await page.getByRole('heading',{name:'您好，示範會員'}).waitFor();
  await page.getByLabel('目前資格').selectOption('q2');
  await page.getByText('未完成',{exact:true}).waitFor();
  for(const route of ['organization','performance','bonuses','shop','orders','me']) {
   await page.goto(`http://127.0.0.1:5174/${route}`);
   await page.getByLabel('目前資格').waitFor();
   assert.equal(await page.getByLabel('目前資格').inputValue(),'q2');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,route+' overflow');
  }
  await page.goto('http://127.0.0.1:5174/organization');
  await page.getByRole('button',{name:'二元組織'}).click();
  await page.getByText('左區人數').waitFor();
  await page.goto('http://127.0.0.1:5174/orders');
  await page.getByText('此資格目前沒有訂單').waitFor();
  await page.getByLabel('目前資格').selectOption('q1');
  await page.getByRole('button',{name:'付款與配送狀態'}).click();
  await page.getByText('配送：未出貨').waitFor();
  await page.goto('http://127.0.0.1:5174/bonuses');
  await page.getByLabel('查詢月份').fill('2026-08');
  await page.getByText('推薦獎金',{exact:true}).waitFor();
  assert.equal(await page.getByText('NT$ 0',{exact:true}).count(),0);
  await page.goto('http://127.0.0.1:5174/shop');
  await page.getByRole('button',{name:'購買功能準備中'}).first().waitFor();
  assert.equal(await page.getByRole('button',{name:'購買功能準備中'}).first().isDisabled(),true);
  await page.goto('http://127.0.0.1:5174/');
  await page.getByRole('heading',{name:'您好，示範會員'}).waitFor();
  await page.screenshot({path:process.env.SMOKE_SCREENSHOT||'/tmp/ucell-member-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: six routes, persisted ball selection, separate trees, order expansion, month filter, disabled purchase, null awards, 390px overflow, no page errors');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
