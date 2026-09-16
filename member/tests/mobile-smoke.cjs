// Run only against the isolated local mock server. No LINE or production API access.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 let page;
 try {
  page=await browser.newPage({viewport:{width:390,height:844}});
  page.setDefaultTimeout(10000);
  const writes=[];
  await page.route('**/*',route=>{
   const req=route.request(); const url=new URL(req.url());
   if(!['GET','HEAD'].includes(req.method())) {writes.push(req.method()+' '+url.pathname);return route.abort();}
   if(url.origin!=='http://127.0.0.1:5174') return route.abort();
   return route.continue();
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:5174/');
  await page.getByRole('heading',{name:'您好，示範會員'}).waitFor();
  await page.getByText('目前為示範資料，不代表真實業績、獎金或訂單。',{exact:true}).waitFor();
  await page.getByLabel('目前資格').selectOption('q2');
  await page.getByText('未完成',{exact:true}).waitFor();
  for(const route of ['organization','performance','bonuses','shop','orders','me','notifications']) {
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
  await page.goto('http://127.0.0.1:5174/notifications');
  await page.getByLabel('目前資格').selectOption('q1');
  await page.getByText('2 則未讀示範通知',{exact:true}).waitFor();
  await page.getByRole('button',{name:'查看通知',exact:true}).first().click();
  await page.getByText('這是介面操作示範，不是公司正式公告。',{exact:false}).waitFor();
  await page.getByRole('button',{name:'標為已讀（示範）',exact:true}).first().click();
  await page.getByText('1 則未讀示範通知',{exact:true}).waitFor();
  await page.getByLabel('目前資格').selectOption('q2');
  await page.getByText('1 則未讀示範通知',{exact:true}).waitFor();
  assert.equal(await page.getByText('訂單狀態查看提醒（示範）',{exact:true}).count(),0);
  await page.getByLabel('通知分類').selectOption('ORDER');
  await page.getByText('目前篩選條件下沒有通知',{exact:true}).waitFor();
  await page.getByLabel('通知分類').selectOption('ALL');
  await page.getByRole('button',{name:'只看未讀',exact:true}).click();
  await page.getByRole('button',{name:'目前範圍全部標為已讀（示範）',exact:true}).click();
  await page.getByText('0 則未讀示範通知',{exact:true}).waitFor();
  for(const width of [320,390,768]) {
   await page.setViewportSize({width,height:844});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+' notifications overflow');
  }
  await page.reload();
  await page.getByText('2 則未讀示範通知',{exact:true}).waitFor();
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:5174/');
  await page.getByRole('heading',{name:'您好，示範會員'}).waitFor();
  for(const width of [320,390,768,1440]) {
   await page.setViewportSize({width,height:960});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+' home overflow');
   assert.equal(await page.getByRole('navigation',{name:'主要功能'}).getByRole('link').count(),5);
  }
  await page.getByLabel('目前資格').selectOption('q1');
  await page.getByText('已完成',{exact:true}).waitFor();
  if(process.env.SMOKE_SCREENSHOT) await page.screenshot({path:process.env.SMOKE_SCREENSHOT.replace(/\.png$/,'.desktop.png'),fullPage:true,animations:'disabled'});
  await page.setViewportSize({width:390,height:844});
  await page.screenshot({path:process.env.SMOKE_SCREENSHOT||'/tmp/ucell-member-mobile.png',fullPage:true,animations:'disabled'});
  if(process.env.SMOKE_SCREENSHOT) await page.screenshot({path:process.env.SMOKE_SCREENSHOT.replace(/\.png$/,'.viewport.png'),animations:'disabled'});
  await page.getByRole('link',{name:'我的',exact:true}).click();
  await page.getByRole('button',{name:'結束本頁工作階段',exact:true}).click();
  await page.getByRole('button',{name:'取消，繼續使用',exact:true}).click();
  await page.getByLabel('目前資格').waitFor();
  await page.getByRole('button',{name:'結束本頁工作階段',exact:true}).click();
  await page.getByRole('button',{name:'確認結束本頁工作階段',exact:true}).click();
  await page.getByRole('heading',{name:'已結束本頁工作階段'}).waitFor();
  assert.equal(await page.getByLabel('目前資格').count(),0);
  assert.equal(await page.getByRole('navigation').count(),0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('ucell_qualification_id')),null);
  await page.getByRole('button',{name:'重新連線',exact:true}).click();
  await page.getByLabel('目前資格').waitFor();
  console.log('PASS: local session end confirmation/cancel, unmount, storage clearing and demo restart');
  assert.deepEqual(errors,[]);
  assert.deepEqual(writes,[],'Demo must never create network writes');
  console.log('PASS: seven routes, persisted ball selection, separate trees, order expansion, month filter, cart, shipping, confirmation, qualification isolation, notification filters/read/reset, null awards, 320/390/768px overflow, no page errors');
 } catch(error) {
  if(page && process.env.SMOKE_SCREENSHOT) await page.screenshot({path:process.env.SMOKE_SCREENSHOT.replace(/\.png$/,'.failure.png'),fullPage:true}).catch(()=>{});
  throw error;
 } finally {await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
