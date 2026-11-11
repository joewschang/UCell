const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const game = require('../games.json').find(g => g.id === 'cognition');
const live = process.argv.includes('--live');
const endpoint = '/api/v1/public/health-game/journey';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME});
 try {
  for(const [mode,changed,unknown] of [['light',2,1],['dark',0,8],['light',1,0]]) {
   const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:mode});
   const events=[],errors=[];page.on('pageerror',err=>errors.push(err.message));
   await page.route(new RegExp(endpoint+"(?:[/?]|$)"), async route=>{
     const req=route.request();
     if(req.method()==='POST'){
       events.push(req.postDataJSON());return route.fulfill({json:{data:{ok:true}}});
     }
     if(!live && new URL(req.url()).pathname===endpoint) return route.fulfill({json:{data:{games:[game],passport:[]}}});
     return route.continue();
   });
   if(!live)await page.route('**/health/cognition/**',route=>{
     const file=new URL(route.request().url()).pathname.split('/cognition/')[1]||'index.html';
     return route.fulfill({path:path.join(__dirname,'site',file)});
   });
   await page.goto('https://member.ucell.life/health/');
   const tile=page.locator('article').filter({has:page.getByRole('heading',{name:game.name,exact:true})});
   await tile.getByRole('link').click();
   await page.getByRole('button',{name:unknown===8?'我為自己填寫':'我為家人或親友填寫'}).click();
   await page.getByRole('button',{name:'大字模式'}).click();
   assert(await page.getByRole('button',{name:'下一題'}).isDisabled());
   for(let i=0;i<8;i++){
     await page.getByText('第 '+(i+1)+' 題 ／ 共 8 題',{exact:true}).waitFor();
     assert(await page.locator('.art img').evaluate(async img=>{await img.decode();return img.naturalWidth===1280}));
     if(i===0){await page.getByRole('button',{name:/放大圖卡/}).click();await page.getByRole('button',{name:'關閉圖卡'}).click();}
     if(i===1){await page.getByRole('button',{name:'上一題'}).click();assert(await page.locator('input:checked').count());await page.getByRole('button',{name:'下一題'}).click();}
     await page.getByRole('radio').nth(i<changed?0:i<changed+unknown?2:1).check();
     await page.getByRole('button',{name:i===7?'查看觀察摘要':'下一題'}).click();
   }
   await page.getByRole('heading',{name:'我的觀察摘要'}).waitFor();
   await page.getByText('AD8® '+changed+' 分 ／ 8 分',{exact:true}).waitFor();
   await page.getByRole('heading',{name:changed>=2?'建議安排專業評估':unknown?'還有情境需要進一步觀察':'繼續留意日常變化'}).waitFor();
   await page.getByText('登入後可領取本週印章。').waitFor();
   await page.getByText('回看八題答案').click();assert.equal(await page.locator('details li').count(),8);
   const download=page.waitForEvent('download');await page.getByRole('button',{name:'下載個人摘要'}).click();
   const item=await download;assert(fs.readFileSync(await item.path(),'utf8').includes('不知道／不適用 '+unknown+' 項'));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   assert.deepEqual(events.map(e=>e.action),['start','finish']);
   assert(events.every(e=>Object.keys(e).every(k=>['attempt','visitor','action','game'].includes(k))));
   await page.getByRole('button',{name:'重新開始'}).click();await page.getByRole('button',{name:'我為自己填寫'}).click();
   assert.equal(await page.locator('input:checked').count(),0);assert.deepEqual(errors,[]);
   console.log('PASS',mode,{changed,unknown},'hub, eight images, edit, summary, download, restart');await page.close();
  }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
