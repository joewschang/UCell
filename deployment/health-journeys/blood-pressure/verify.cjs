const assert = require('node:assert/strict');
const path = require('node:path');
const {chromium} = require('playwright-core');
const game = require('../games.json').at(-1);
const live=process.argv.includes('--live');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME});
 try {
 for(const mode of ['light','dark']){
  const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:mode});
  const errors=[],events=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/\/api\/v1\/[^/]+\/health-game\/journey(?:[/?]|$)/,async r=>{
    const body=r.request().postDataJSON();
    if(body){events.push(body);return r.fulfill({json:{data:{ok:true}}})}
    if(live)return r.continue();
    return r.fulfill({json:{data:{games:[game],passport:[]}}});
  });
  if(!live){
   await page.route('**/health/blood-pressure/**',r=>{
    const name=new URL(r.request().url()).pathname.split('/blood-pressure/')[1]||'index.html';
    return r.fulfill({path:path.join(__dirname,'site',name)});
   });
  }
  await page.goto('https://member.ucell.life/health/');
  const tile=page.locator('article').filter({has:page.getByRole('heading',{name:'血壓監測',exact:true})});
  await tile.getByRole('link').click();
  await page.getByRole('button',{name:'用範例練習'}).click();
  const next=()=>page.getByRole('button',{name:'下一步',exact:true}).click();
  await page.getByRole('button',{name:/放大圖卡/}).click();await page.getByRole('button',{name:'關閉圖卡'}).click();
  await next();await page.locator('#reading').fill('130');await next();await page.getByText('低壓應小於高壓',{exact:false}).waitFor();
  await page.locator('#reading').fill('78');await next();
  await page.getByRole('button',{name:'52',exact:true}).click();await page.getByText('再試一次，用高壓減去低壓。').waitFor();
  await page.getByRole('button',{name:'42',exact:true}).click();await next();
  await page.getByRole('button',{name:'偶爾量，還沒有固定時間'}).click();await next();
  await page.getByRole('button',{name:/現在胸痛/}).click();await next();await page.getByRole('link',{name:'撥打 119'}).waitFor();
  await page.getByRole('button',{name:'目前沒有明顯不適'}).click();await next();
  await page.getByRole('button',{name:/常吃偏鹹/}).click();await page.getByRole('button',{name:'家人有高血壓或中風病史'}).click();
  await page.getByRole('button',{name:'查看結果'}).click();await page.getByText('本次脈壓差　42 mmHg').waitFor();
  await page.getByText('登入後可領取本週印章。').waitFor();
  const download=page.waitForEvent('download');await page.getByRole('button',{name:'下載完成卡'}).click();
  assert.match((await download).suggestedFilename(),/png$/);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(events.map(e=>e.action),['start','finish']);
  assert(events.every(e=>Object.keys(e).every(k=>['visitor','game','action','attempt'].includes(k))));
  await page.getByRole('button',{name:'重新練習'}).click();await page.getByRole('button',{name:'使用我的讀值'}).click();
  await page.locator('#reading').fill('181');await next();await page.getByRole('alert').waitFor();
  assert.deepEqual(errors,[]);console.log('PASS '+mode+' home → six stations → result, urgent paths, private events and certificate');await page.close();
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
