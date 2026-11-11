/* Run against the admin site. The browser receives synthetic API replies on every route. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium, webkit} = require('playwright-core');

const origin = 'https://admin.ucell.life';
const site = process.env.SITE_DIR;
const mobileOnly = process.env.ENGINE === 'webkit';
const fixtures = new Map();

const cache = new Map();
const metrics = [];
const products = Array.from({length:25}, (_, i) => ({
  productId:'qa-'+i, sku:'QA-'+String(i+1).padStart(2,'0'),
  displayName:(i<3?'量測用品':'日用商品')+(i+1), currentPrice:'30', ruleProfiles:[]
}));
const meta = {api_version:'v1',request_id:'audit-fixture',timestamp:'2026-11-12T00:00:00Z'};
function fileFor(url) {
  if(!site) return;
  const name=path.join(path.resolve(site),decodeURIComponent(url.pathname).replace(/^\/+/,''));
  if(fs.existsSync(name) && fs.statSync(name).isFile()) return name;
}
async function staticResponse(route) {
  const url=new URL(route.request().url());
  if(url.pathname.startsWith('/api/') || url.hostname!==new URL(origin).hostname) {
    const response = url.pathname.endsWith('/auth/admin/me') ? {role:'SUPER_ADMIN',subject:'QA'}
      : url.pathname.endsWith('/admin/products') ? products
      : fixtures.get(url.pathname);
    const ok = response!==undefined && ['GET','HEAD'].includes(route.request().method());
    return route.fulfill({status:ok?200:503, json:ok?{data:response,meta}:{error:{code:'SERVICE_UNAVAILABLE',message:'測試服務暫時無法提供資料'},meta}});
  }
  const doc=route.request().resourceType()==='document';
  const file = fileFor(url) || (doc && site && !url.pathname.startsWith('/topics/') && path.join(site,'index.html'));
  if(file) return route.fulfill({path:file});
  if(!['GET','HEAD'].includes(route.request().method())) return route.abort();
  const key=url.href;
  if(!cache.has(key)) cache.set(key,(async()=>{
    const res=await route.fetch({timeout:15000});
    const headers={...res.headers()};
    for(const key of ['content-encoding','content-length','transfer-encoding']) delete headers[key];
    const reply={status:res.status(),headers,body:await res.body()};
    await res.dispose();
    return reply;
  })());
  return route.fulfill(await cache.get(key));
}
async function snapshot(page) {
  return page.evaluate(()=>{
    const main=document.querySelector('#admin-main,main')??document.body;
    const headings=[...main.querySelectorAll('h1,h2,h3')].filter(x=>x.getClientRects().length);
    const excess=document.documentElement.scrollWidth-innerWidth;
    const offenders=excess>2?[...main.querySelectorAll('*')].filter(el=>el.getBoundingClientRect().right>innerWidth+2).slice(0,7).map(el=>el.tagName+'.'+el.className):[];
    return {title:headings[0]?.innerText||'',excess,offenders};
  });
}
async function run(browser,width,theme,paths) {
  const page=await browser.newPage({viewport:{width,height:880},colorScheme:theme,serviceWorkers:'block'});
  const errors=[];page.on('pageerror', e=>errors.push(e.message));
  page.setDefaultTimeout(5500);
  await page.route('**/*',staticResponse);
  await page.addInitScript(()=>{if(location.pathname==='/login'){sessionStorage.removeItem('ucell_admin_token');sessionStorage.removeItem('ucell_admin_user');return;}sessionStorage.setItem('ucell_admin_token','test-only');sessionStorage.setItem('ucell_admin_user',JSON.stringify({role:'SUPER_ADMIN',provider:'ENTRA'}));});
  try {
    await page.goto(origin+'/');
    await page.locator('nav[aria-label="後台主要功能"]').waitFor({state:'attached'});
    const links=await page.locator('nav[aria-label="後台主要功能"] a').evaluateAll(els=>els.map(a=>new URL(a.href).pathname));
    const all=[...new Set([...paths,...links])];
    for(const route of all) {
      const start=errors.length;
      const documentResponse=await page.goto(origin+route,{waitUntil:'domcontentloaded'});
      const selector=route==='/topics/'||route==='/login'?'h1':'#admin-main h1,#admin-main h2';
      try{await page.locator(selector).first().waitFor({state:'visible',timeout:7500});}catch{}
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
      const result=await snapshot(page);
      metrics.push({width,theme,route,httpStatus:documentResponse?.status(),...result,errors:errors.slice(start)});
    }
    if(!process.env.BASELINE) {
      await page.goto(origin+'/products');
      const grid=page.locator('section.ops-data-grid').filter({has:page.getByRole('searchbox')}).first();
      await grid.getByText('QA-01',{exact:true}).waitFor();const search=grid.getByRole('searchbox');
      await search.fill('  量測用品  ');assert.equal(await grid.locator('tbody tr').count(),3);
      await search.fill('無此商品');await grid.getByText('找不到符合搜尋的資料').waitFor();
      await grid.getByRole('button',{name:'清除搜尋'}).click();
      const sort=grid.getByRole('button',{name:'名稱',exact:true});await sort.click();assert.equal(await sort.locator('..').getAttribute('aria-sort'),'ascending');
      await grid.getByRole('button',{name:'下一頁'}).click();assert.equal(await grid.locator('tbody tr').count(),5);
      assert.equal(await grid.locator('[role=region]').getAttribute('tabindex'),'0');
      if(theme==='light' && width===390) {
        let role='COMPLIANCE_AUDIT';
        await page.route('**/api/v1/auth/admin/me',r=>r.fulfill({json:{data:{role,subject:'QA'},meta}}));
        await page.goto(origin+'/applications');
        await page.getByRole('heading',{name:'會員申請待審'}).waitFor();
        assert.equal(await page.locator('a[href="/applications/formal-paper"]').count(),0);
        await page.goto(origin+'/applications/formal-paper');
        await page.getByRole('heading',{name:'無權存取此後台頁面'}).waitFor();
        role='MEMBERSHIP_OPS';
        await page.goto(origin+'/applications');
        await page.locator('a[href="/applications/formal-paper"]').click();
        await page.locator('#admin-main h1').filter({hasText:'紙本'}).waitFor();
      }
    }
  }finally{await page.close();}
}
(async()=>{
  const request=require('playwright-core').request;const api=await request.newContext();
  const html=site?fs.readFileSync(path.join(site,'index.html'),'utf8'):await(await api.get(origin)).text();
  const main=html.match(/<script type="module"[^>]+src="([^"]+)"/)[1];
  const js=site?fs.readFileSync(path.join(site,main),'utf8'):await(await api.get(origin+main)).text();
  await api.dispose();
  const routes=[...new Set([...js.slice(js.lastIndexOf('path:"/login"')).matchAll(/path:"(\/[^"]*)",element:/g)].map(row=>row[1].replace('/:id?','')))];
  assert(routes.length>=50,'router inventory incomplete');
  const browser=mobileOnly?await webkit.launch():await chromium.launch({executablePath:process.env.CHROME});
  try {
    const configs=mobileOnly?[[390,'light'],[390,'dark']]:[[390,'light'],[390,'dark'],[1366,'light'],[1366,'dark']];
    const results=await Promise.allSettled(configs.map(([w,t])=>run(browser,w,t,routes)));
    const failures=metrics.filter(m=>m.httpStatus!==200 || /^(4|5)\d\d\b/.test(m.title) || m.excess>2 || !m.title || m.title.includes('找不到後台頁面') || m.title.includes('無權存取') || m.errors.length);
    if(process.env.REPORT)fs.writeFileSync(process.env.REPORT,JSON.stringify({metrics,failures},null,2));
    console.log(JSON.stringify({screens:metrics.length,routes:new Set(metrics.map(m=>m.route)).size,failures,errors:results.filter(r=>r.status==='rejected').map(r=>String(r.reason))},null,2));
    for(const r of results)if(r.status==='rejected')throw r.reason;
    if(!process.env.BASELINE) assert.equal(failures.length,0,'route audit failed');
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
