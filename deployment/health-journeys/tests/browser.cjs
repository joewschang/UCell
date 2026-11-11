const assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const games=require('../games.json'),live=process.argv.includes('--live');
const memberUrl=live?'https://member.ucell.life':'http://127.0.0.1:39141';
const adminUrl=live?'https://admin.ucell.life':'http://127.0.0.1:39142';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME});
 try{
 for(const mode of ['light','dark']){
  const page=await browser.newPage({viewport:{width:390,height:844},colorScheme:mode});
  const errors=[],bodies=[],draft=games.map(g=>({...g,enabled:true,membersOnly:false,starts:'',ends:'',campaign:'測試',pinned:[]}));
  page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(8000);
  await page.route('**/api/v1/**',async route=>{
   const u=new URL(route.request().url()),path=u.pathname,body=route.request().postDataJSON();let data={};
   if(body)bodies.push(body);
   if(path.includes('/admin/health-game/journey'))data=path.endsWith('preview')?[]:{live:draft,draft,version:1,revision:1,registry:games,history:[{version:1,created_at:new Date()}],changes:[],tags:[],edges:[],resources:[{id:'guide',kind:'指南',title:'觀察準備'}],metrics:[],channels:[],canPublish:true};
   else if(path.endsWith('/journey'))data={games,passport:[]};
   else if(path.endsWith('/journey/invite'))data=body?{id:'ec426301-f760-4ba9-8414-a52980b82af5'}:{game:'egfr'};
   else if(path.endsWith('/journey/related'))data=[{kind:'指南',title:'讀懂報告',id:'guide',href:'/health/?read=guide'}];
   else if(path.endsWith('/topics'))data={rows:[],tags:[],edges:[]};
   else if(path.endsWith('/season-theme'))data={theme:'classic'};
   else if(path.endsWith('/health-game')||path.endsWith('/diabetes'))data={open:true,resources:[],weeks:[],tags:[]};
   return route.fulfill({json:{data,meta:{api_version:'v1',request_id:'test',timestamp:new Date().toISOString()}}});
  });
  await page.goto(memberUrl+'/health/');await page.locator('.j-tile h2').nth(2).waitFor();assert.deepEqual(await page.locator('.j-tile h2').allTextContents(),games.map(g=>g.name));
  await page.waitForFunction(()=>[...document.querySelectorAll('.j-tile img')].every(i=>i.complete&&i.naturalWidth>0));if(process.env.JOURNEY_QA)await page.screenshot({path:process.env.JOURNEY_QA+'/hub-'+mode+'.png'});
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  for(const id of ['game','diabetes']){
   await page.goto(memberUrl+games.find(g=>g.id===id).href);
   await page.getByRole('button',{name:/開始六題/}).click();
   for(let i=0;i<6;i++){await page.locator('.choices button').first().click();await page.getByRole('button',{name:/下一題|查看.*結果|完成觀察/}).last().click();}
   await page.locator('.j-share select').waitFor();await page.getByRole('button',{name:/我想/}).click();await page.getByRole('link',{name:'讀懂報告'}).waitFor();
  }
  await page.goto(memberUrl+'/health/egfr/');await page.locator('#demo').click();assert.equal(await page.locator('#score').innerText(),'83.5');
  await page.locator('#learn').click();await page.locator('#quiz button').nth(1).click();await page.locator('#claim').click();
  await page.getByRole('button',{name:'顯示 QR Code'}).click();await page.locator('.j-share-output img').waitFor();assert(await page.locator('.j-share-output img').evaluate(i=>i.naturalWidth>0));
  assert.match(await page.locator('.j-share-output input').inputValue(),/invite\/egfr\//);
  await page.locator('.j-share select').selectOption('all');await page.getByRole('button',{name:'LINE 邀請'}).click();const line=await page.getByRole('link',{name:'開啟 LINE 選擇分享對象'}).getAttribute('href');assert(!decodeURIComponent(line).includes('egfr'));
  await page.goto(memberUrl+'/health/journey/invite/egfr/?id=ec426301-f760-4ba9-8414-a52980b82af5');await page.getByRole('link',{name:'進入遊戲'}).click();await page.locator('#entry').waitFor();
  const events=bodies.filter(b=>b.action);assert(events.some(e=>e.action==='calculate'));assert(events.filter(e=>e.action==='finish').length>=3);
  assert(events.every(e=>Object.keys(e).every(k=>['visitor','attempt','action','resource','game','invite'].includes(k))));
  await page.goto(adminUrl+'/health/journey/');await page.getByLabel('選擇遊戲').selectOption('egfr');await page.getByLabel('列表介紹').fill('測試介紹');await page.getByRole('button',{name:'加入精選'}).click();
  await page.getByRole('button',{name:'預覽訪客'}).click();await page.locator('.j-preview').waitFor();assert((await page.locator('.j-preview').innerText()).includes('測試介紹'));
  await page.getByRole('button',{name:'儲存草稿'}).click();await page.getByText('已儲存草稿。',{exact:true}).waitFor();assert(bodies.some(b=>b.action==='draft'&&b.games.find(g=>g.id==='egfr').pinned.includes('guide')));
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));assert.deepEqual(errors,[]);
  console.log('PASS '+mode+' mobile: game catalogue, all three completions, invitation, QR, generic LINE privacy, resource choice, admin draft and preview');await page.close();
 }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
