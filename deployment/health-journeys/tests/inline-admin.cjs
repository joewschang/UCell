const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const registry=require('../games.json');
const base=process.argv.includes('--live')?'https://admin.ucell.life':'http://127.0.0.1:39142';
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME});
 try{
 for(const [theme,width] of [['light',1360],['dark',390]]){
 const page=await browser.newPage({viewport:{width,height:900},colorScheme:theme});
 page.setDefaultTimeout(6000);
 await page.addInitScript(()=>sessionStorage.setItem('ucell_admin_token','navigation-test'));
 const errors=[],documents=[];let role='SUPER_ADMIN',writes=0;
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.resourceType()==='document')documents.push(r.url());});
 const games=registry.map(g=>({...g,enabled:true,membersOnly:false,starts:'',ends:'',campaign:'測試',pinned:[]}));
 await page.route('**/api/v1/**',route=>{
  const r=route.request(),path=new URL(r.url()).pathname;
  let data=[];
  if(path.endsWith('/auth/admin/me'))data={role,subject:'UI fixture'};
  if(path.endsWith('/health-game/journey')){
    if(r.method()==='POST')writes++;
    data={draft:games,live:games,history:[{version:1,created_at:new Date()}],revision:1,version:1,canPublish:true,registry,tags:[],edges:[],resources:[],changes:[],channels:[],metrics:[]};
  }
  if(path.endsWith('/health-game'))data={open:true,tags:[],resources:[],stats:{started:0,finished:0},diabetesStats:{started:0,finished:0}};
  if(path.endsWith('/topics'))data={rows:[],tags:[],edges:[],jobs:[],archived:[]};
  return route.fulfill({json:{data,meta:{api_version:'v1',request_id:'qa',timestamp:new Date().toISOString()}}});
 });
 await page.goto(base+'/content/greetings');
 const menu=page.locator('a[href="/health/journey/"]').filter({hasText:'健康中心'}).first();
 await menu.waitFor({state:'attached'});const count=documents.length;
 await page.evaluate(()=>{window.healthNavTest=document.querySelector('nav');});
 await menu.click();
 const heading=page.locator('.uc-health-panel h1');
 await heading.waitFor();assert.equal(await heading.textContent(),'健康中心');
 await page.getByLabel('列表介紹').fill('保留草稿測試');
 await page.getByRole('link',{name:'全站健康遊戲開關'}).click();await page.getByText('健康中心遊戲開放設定',{exact:true}).waitFor();
 await page.goBack();await page.getByLabel('列表介紹').waitFor();assert.equal(await page.getByLabel('列表介紹').inputValue(),'保留草稿測試');
 await page.getByRole('link',{name:/查看原文、產生或審核/}).click();await page.locator('.uc-health-panel h1').filter({hasText:'標籤管理'}).waitFor();
 await page.getByRole('link',{name:'‹ 返回健康中心',exact:true}).click();await page.getByLabel('列表介紹').waitFor();
 await page.getByRole('button',{name:'儲存草稿'}).click();await page.getByText('已儲存草稿。',{exact:true}).waitFor();assert.equal(writes,1);
 await page.locator('a[href="/content/greetings"]').first().click();await page.waitForURL('**/content/greetings');
 await page.goBack();await page.getByLabel('列表介紹').waitFor();
 assert.equal(documents.length,count);assert(await page.evaluate(()=>!!window.healthNavTest&&window.healthNavTest===document.querySelector('nav')));assert.equal(page.frames().length,1);
 await page.reload();await page.getByLabel('列表介紹').waitFor();
 await page.goto(base+'/health/');await page.getByText('健康中心遊戲開放設定',{exact:true}).waitFor();
 role='FINANCE';await page.goto(base+'/health/journey/');await page.waitForFunction(()=>document.body.textContent.includes('權限')&&!document.querySelector('.uc-health-panel'));
 assert.deepEqual(errors,[]);console.log('PASS '+theme+' '+width+'px: sidebar, same document, settings, tags, draft save, history, reload, legacy URL, role guard');
 await page.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
