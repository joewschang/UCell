const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const root=process.argv[2],html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const asset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1],bundle=fs.readFileSync(path.join(root,asset),'utf8');
 const code=bundle.replace('function Et(){','function Et(){return {user:{role:"SUPER_ADMIN",name:"測試承辦人"},ready:true,logout:()=>{}};');
 const id='12345678-1234-4123-8123-123456789012';
 const ball={qualificationId:id,qualificationNo:'238',ballNo:'TW0900001234-01',kind:'MEMBER_ORIGIN',planLevelCode:'STARTER',status:'EFFECTIVE',currentHolder:{legalName:'測試會員',memberNo:'TW0900001234'}};
 const testCode=code.replace('async function Tn(r,t={}){','async function Tn(r,t={}){if(r.startsWith(\u0022/admin/qualifications?\u0022))return {data:['+JSON.stringify(ball)+']};throw Error(\u0022測試環境未提供資料\u0022);');
 const browser=await chromium.launch({executablePath:process.env.CHROME});
 try{await Promise.all(['light','dark'].flatMap(colorScheme=>[390,1366].map(async width=>{
 const page=await browser.newPage({viewport:{width,height:820},colorScheme});page.setDefaultTimeout(6000);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url()),pathname=url.pathname;
  if(pathname.includes('/api/')){
    if(pathname.endsWith('/admin/health-game/topics'))return route.fulfill({json:{data:{tags:['測試'],edges:[],jobs:[],rows:[]}}});
    if(pathname.endsWith('/admin/qualifications'))return route.fulfill({json:{data:[ball],meta:{total:1}}});
    return route.fulfill({status:503,json:{message:'測試環境未提供此筆資料'}});
  }
  if(pathname===asset)return route.fulfill({contentType:'text/javascript',body:testCode.replace("children:e.jsx(JT,{})","children:location.pathname==='/test-source-filter'?e.jsx(CT,{selection:{}}):e.jsx(JT,{})")});
  const file=path.join(root,pathname.endsWith('/')?pathname+'index.html':pathname);
  if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
  if(/\.(?:css|js|png|webp|svg|ico)$/.test(pathname)){
   if(!/^[\w./-]+$/.test(pathname))return route.abort();
   try{const remote=await route.fetch({url:'https://admin.ucell.life'+pathname,timeout:6000});return route.fulfill({response:remote});}catch{return route.abort();}
  }
  return route.fulfill({contentType:'text/html',body:html});
 });
 await page.goto('https://admin.test/qualifications');
 await page.waitForSelector('.ux-nav-search');
 assert.equal(await page.locator('html').getAttribute('data-theme'),colorScheme);
 const links=await page.locator('nav[aria-label="後台主要功能"] a').evaluateAll(els=>els.map(el=>new URL(el.href).pathname));
 const search=page.getByLabel('搜尋後台功能');await search.fill('紙本');assert(await page.getByRole('link',{name:'會員紙本建檔'}).isVisible());await search.fill('不存在的功能');await page.getByText('沒有符合的功能').waitFor();await search.fill('');
 const row=page.locator('#qualification-ball-list .list-row').first();try{await row.click();}catch(err){console.log(page.url(),await page.locator("main").innerText({timeout:500}),errors);throw err;}
 const colors=await row.evaluate(el=>[getComputedStyle(el).backgroundColor,getComputedStyle(el.querySelector('strong')).color]);
 function luminance(rgb){return rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=0.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((t,v,i)=>t+v*[.2126,.7152,.0722][i],0);}
 const lum=colors.map(luminance).sort((a,b)=>b-a);assert((lum[0]+.05)/(lum[1]+.05)>=4.5,colors.join(' '));
 if(process.env.UX_SCREENSHOTS){await row.scrollIntoViewIfNeeded();await row.screenshot({path:path.join(process.env.UX_SCREENSHOTS,'row-'+width+'-'+colorScheme+'.png')});}
 const overflow=[];
 for(const link of links.filter(h=>h!='/topics/')){
   await page.evaluate(h=>{history.pushState({},'',h);dispatchEvent(new PopStateEvent('popstate'));},link);
   await page.waitForTimeout(75);
   const wide=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
   if(wide>4)overflow.push([link,wide]);
 }
 await page.goto('https://admin.test/topics/');
 await page.locator('#review-only').waitFor();
 assert.equal(await page.locator('html').getAttribute('data-theme'),colorScheme);
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+4),true);
 assert.deepEqual(overflow,[]);assert.deepEqual(errors,[]);
 console.log(JSON.stringify({colorScheme,width,links:links.length,overflow,errors:[...new Set(errors)]}));
 await page.goto('https://admin.test/organization/geo');const pick=page.getByRole('button',{name:'從球清單選取'}).first();
 if(!await pick.count()){const geo=links.find(x=>x.includes('/geo'));await page.goto('https://admin.test'+geo);}
 await pick.click();await page.getByRole('dialog').getByRole('searchbox').fill('測試');
 await page.locator('.ux-ball-option').first().click();assert.equal(await page.getByPlaceholder('輸入完整球號').inputValue(),ball.ballNo);
 await page.goto('https://admin.test/test-source-filter');
 await page.getByRole('button',{name:'從球清單選取'}).click();
 await page.locator('.ux-ball-option').first().click();
 assert.equal(await page.locator('input[inputmode=numeric]').inputValue(),ball.qualificationNo);
 await page.close();
 })));}finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
