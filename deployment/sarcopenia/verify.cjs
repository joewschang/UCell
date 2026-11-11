const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
(async()=>{
 const root=path.join(__dirname,'health'),base=process.argv[2],browser=await chromium.launch({executablePath:process.env.CHROME});
 try{
 for(const [mode,choices,expected] of [['guest',[0,0,0,0,0,0],'100／100'],['member',[2,2,2,2,2,2],'0／100'],['guest',[3,1,2,3,1,1],'已回答 4／6 題']]){
 const page=await browser.newPage({viewport:{width:360,height:780},hasTouch:true});
 const writes=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(member=>{if(member)sessionStorage.setItem('ucell_member_token','test')},mode==='member');
 await page.route('http://test.invalid/**',route=>{
 const u=new URL(route.request().url()),url=u.pathname;
 if(url.startsWith('/api/')){
 if(route.request().method()==='POST'){writes.push(url.split('/').pop());assert.equal(route.request().postData(),null)}
 return route.fulfill({json:{data:{open:true,weeks:[],tags:[],resources:[]}}});
 }
 if(url.startsWith('/topics/'))return route.fulfill({contentType:'text/javascript',body:''});
 const name=url.slice('/health/'.length)||'index.html';const file=[path.join(root,name),path.join(base,name)].find(f=>fs.existsSync(f));
 if(!file)return route.abort();
 return route.fulfill({path:file});
 });
 await page.goto('http://test.invalid/health/');await page.getByRole('button',{name:'開始六題檢測'}).click();
 for(let i=0;i<6;i++){
 await page.waitForFunction(()=>document.querySelector('.station-photo img')?.naturalWidth>0);
 if(i===0){await page.locator('.station-photo').click();await page.getByText('關閉圖解').click()}
 if(i===1){await page.getByRole('button',{name:'開始計時'}).click();await page.getByRole('button',{name:'停止計時'}).click()}
 assert(await page.locator('.station-nav .primary').isDisabled());
 await page.locator('.choices button').nth(choices[i]).click();
 if(i===2){await page.getByRole('button',{name:'上一題'}).click();assert.equal(await page.locator('.choices button').nth(choices[1]).getAttribute('aria-pressed'),'true');await page.locator('.station-nav .primary').click()}
 await page.locator('.station-nav .primary').click();
 }
 await page.getByText(expected,{exact:true}).waitFor();
 assert.equal(await page.locator('.result-lines').last().locator('li').count(),6);
 const download=page.waitForEvent('download');await page.getByRole('button',{name:'下載完成卡'}).click();assert.match((await download).suggestedFilename(),/肌少症/);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
 assert.deepEqual(writes,mode==='member'?['start','finish']:[]);assert.deepEqual(errors,[]);await page.close();
 }
 console.log('Six image stations, zoom, timer, previous answers, score, skip, completion card and membership callbacks passed');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
