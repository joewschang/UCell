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
  await page.getByRole('button',{name:'加入示範購物車'}).first().click();
  await page.getByText('共 1 件商品',{exact:true}).waitFor();
  await page.getByLabel('收件人姓名').fill('示範收件人');
  await page.getByLabel('聯絡電話').fill('0900000000');
  await page.getByLabel('收件地址').fill('示範市示範路一號');
  await page.getByRole('button',{name:'檢查示範訂單'}).click();
  await page.getByRole('region',{name:'訂單確認'}).waitFor();
  await page.getByLabel('目前資格').selectOption('q2');
  await page.getByText('購物車尚無商品',{exact:true}).waitFor();
  assert.equal(await page.getByText('示範市示範路一號',{exact:true}).count(),0);
  await page.getByLabel('目前資格').selectOption('q1');
  await page.getByText('共 1 件商品',{exact:true}).waitFor();
  assert.equal(await page.getByLabel('收件人姓名').inputValue(),'');
  await page.getByLabel('收件人姓名').fill('示範收件人');
  await page.getByLabel('聯絡電話').fill('0900000000');
  await page.getByLabel('收件地址').fill('示範市示範路一號');
  await page.getByRole('button',{name:'檢查示範訂單'}).click();
  await page.getByRole('button',{name:'確認建立示範訂單'}).click();
  await page.getByRole('heading',{name:'示範訂單已建立'}).waitFor();
  await page.getByRole('link',{name:'查看我的訂單 →'}).click();
  await page.getByText('訂單：示範訂單',{exact:true}).waitFor();
  await page.getByLabel('目前資格').selectOption('q2');
  await page.getByText('此資格目前沒有訂單',{exact:true}).waitFor();
  for(const width of [320,390,768]) {
   await page.setViewportSize({width,height:844});
   await page.goto('http://127.0.0.1:5174/shop');
   await page.getByRole('button',{name:'加入示範購物車'}).first().click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+' cart overflow');
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:5174/');
  await page.getByRole('heading',{name:'您好，示範會員'}).waitFor();
  await page.screenshot({path:process.env.SMOKE_SCREENSHOT||'/tmp/ucell-member-mobile.png',fullPage:true});
  assert.deepEqual(errors,[]);
  console.log('PASS: six routes, persisted ball selection, separate trees, order expansion, month filter, cart, shipping, confirmation, qualification isolation, null awards, 320/390/768px overflow, no page errors');
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
