// Run against two assembled SPA directories, or PUBLIC to verify the released websites.
// All browser data requests use synthetic fixtures. The asset crawler only reads static resources.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { mount } = require('../admin-interaction/qa/fixtures.cjs');
const { chromium, webkit } = require('playwright-core');

const [admin, member, output, phase = 'candidate'] = process.argv.slice(2);
if (!admin || !member || !output) throw Error('Usage: node qa.cjs <admin build|PUBLIC> <member build|PUBLIC> <report directory> [baseline]');
const baseline = phase === 'baseline';
const hosts = { admin: 'https://admin.ucell.life', member: 'https://member.ucell.life' };
const stamp = '2026-11-12T05:00:00Z';
const menu = '重銷訂閱一覽';
const oldTerm = '重購';
const httpCache = new Map();

async function publicResource(url) {
  if (!httpCache.has(url)) httpCache.set(url, (async () => {
    const res = await fetch(url, {headers:{'Cache-Control':'no-cache'},signal:AbortSignal.timeout(15000)});
    return {status:res.status, type:res.headers.get('content-type') || '', bytes:Buffer.from(await res.arrayBuffer())};
  })());
  return httpCache.get(url);
}

async function asset(site, url) {
  const address = new URL(url);
  const filename = path.join(site, address.pathname.endsWith('/') ? address.pathname+'index.html' : address.pathname);
  if (site !== 'PUBLIC' && fs.statSync(filename,{throwIfNoEntry:false})?.isFile()) {
    return {status:200, type:filename.endsWith('.js')?'text/javascript':filename.endsWith('.css')?'text/css':'text/html',bytes:fs.readFileSync(filename)};
  }
  return publicResource(url);
}

async function scan(brand, site) {
  const origin = hosts[brand];
  const entries=brand==='member'?['/','/topics/','/health/']:['/','/topics/'];
  const queue = entries.map(route=>origin+route);
  const known = new Set(queue);
  const resources = [], missing = [], routes = new Set();
  for (let n = 0; n < queue.length; n++) {
    const url = queue[n], response = await asset(site,url), source = response.bytes.toString();
    if (response.status !== 200 || !entries.includes(new URL(url).pathname) && response.type.includes('text/html')) { missing.push(new URL(url).pathname); continue; }
    const items = [...source.matchAll(/重購/g)].map(m => source.slice(Math.max(0,m.index-16),m.index+22));
    resources.push({file:new URL(url).pathname, size:response.bytes.length, sha256:createHash('sha256').update(response.bytes).digest('hex'), oldTermCount:items.length, samples:items.slice(0,5)});
    for (const m of source.matchAll(/path:"(\/[^"]*)",element:/g)) routes.add(m[1]);
    for (const m of source.matchAll(/["'`]((?:\.{0,2}\/|assets\/|[a-zA-Z][^:/"'`\s]*)[^"'`\s$<>]*?\.(?:m?js|css)(?:\?[A-Za-z0-9_=&.-]+)?)["'`]/g)) {
      const spec = m[1];
      if (spec.includes('://')) continue;
      const ref = new URL(spec.startsWith('assets/') ? '/'+spec : spec, url);
      if (ref.origin!==origin || ref.pathname.includes('/api/')) continue;
      if (!known.has(ref.href)) { known.add(ref.href); queue.push(ref.href); }
    }
  }
  // pdf.js supplies a default worker while this build sets its hash-named worker explicitly. LIFF only probes an optional script tag.
  const optionalReferences=brand==='admin'?['/assets/pdf.worker.mjs']:['/assets/luivendor.js'];
  assert.deepEqual(missing.filter(ref=>!optionalReferences.includes(ref)),[],brand+' missing a referenced release asset');
  assert(resources.length>7,brand+' expected app chunks and supplemental bundles');
  return {brand,resources,missing,routes:[...routes],oldTermCount:resources.reduce((v,r)=>v+r.oldTermCount,0)};
}

function api(route, data, status=200) {
  return route.fulfill({status, headers:{'access-control-allow-origin':'*', 'access-control-allow-headers':'*'},json:status===200?{data, meta:{api_version:'v1',request_id:'local-qa',timestamp:stamp}}:{code:'SERVICE_UNAVAILABLE'}});
}
const qid='00000000-0000-4000-8000-000000000001';
const q={id:qid,code:'TW0900000000-01',qualificationNo:'12',rank:'STARTER',active:true,ballLabel:'啟航',monthReference:'2026-11',activeInterval:null};
const shippingName='測試收件人乙', operator='代操作人丙', memberName='下單會員甲';
const corporateName='示範股份有限公司';
const orders=[memberName,null,corporateName].map((name,i)=>({
  orderId:qid.slice(0,-1)+(i+2),orderNo:String(2102+i),displayOrderNo:'SL0000000210'+(i+2),
  createdAt:stamp,tab:'SHIPPING',paymentStatus:'PAID',total:'250.00',items:[{name:'示範商品',quantity:1}],fulfillments:[],reviews:[],
  memberName:name,recipientName:shippingName,actorName:operator,ballNo:q.code,
}));
function ensureCurrent(text,label) { if (!baseline) assert(!text.includes(oldTerm),label+' contains obsolete wording'); }
async function adminBrowser(browser, width, theme) {
  const page=await browser.newPage({viewport:{width,height:870},isMobile:width<600,hasTouch:width<600,colorScheme:theme,serviceWorkers:'block'});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(7000);
  await mount(page,admin,theme.toUpperCase());
  await page.route('**/api/v1/**',r=>{
    const req=r.request(),p=new URL(req.url()).pathname.slice(7);
    if(req.method()==='OPTIONS')return r.fulfill({status:204});
    assert.equal(req.method(),'GET','unexpected admin write');
    if(p==='/admin/order-tracking')return api(r,{orders,counts:{ALL:orders.length,SHIPPING:orders.length},total:orders.length,page:1,pages:1,asOf:stamp});
    if(p==='/admin/order-tracking/imports'||p.startsWith('/admin/subscriptions'))return api(r,[]);
    if(p.includes('order-tracking/')&&p.endsWith('/timeline'))return api(r,[]);
    if(p.endsWith('/manual-delivery'))return api(r,{displayOrderNo:orders[0].displayOrderNo,state:'READY',reasons:[],allowed:false,options:[]});
    return r.fallback();
  });
  try {
    await page.goto(hosts.admin+'/subscriptions');
    const heading=page.getByRole('heading',{level:1}).first();await heading.waitFor();
    const nav=page.locator('a[href="/subscriptions"]').first();await nav.waitFor({state:'attached'});
    const navText=(await nav.textContent()).trim(), headingText=(await heading.innerText()).trim();
    if(!baseline) {assert.equal(navText,menu);assert.equal(headingText,menu);assert.equal(await nav.getAttribute('aria-current'),'page');}
    ensureCurrent(await page.locator('body').innerText(),'/subscriptions');
    await page.goto(hosts.admin+'/order-tracking');
    const cards=page.locator('.tracking-order');await cards.first().waitFor();
    assert.equal(await cards.count(),orders.length);
    if(!baseline) {
      assert.match(await cards.nth(0).locator('.tracking-member-name').innerText(),new RegExp(memberName));
      assert.match(await cards.nth(1).locator('.tracking-member-name').innerText(),/未提供/);
      assert.match(await cards.nth(2).locator('.tracking-member-name').innerText(),new RegExp(corporateName));
      for(const other of [shippingName,operator])assert(!(await cards.allInnerTexts()).join('').includes(other));
    }
    const expand=cards.first().getByRole('button',{name:/查看歷程/});await expand.click();
    await cards.first().getByRole('button',{name:/收合歷程/}).waitFor();
    if(!baseline) {assert((await cards.first().innerText()).includes(memberName));assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);}
    await cards.first().screenshot({path:path.join(output,'tracking-'+theme+'-'+width+'.png')});
    assert.deepEqual(errors,[]);
    return {width,theme,navText,headingText,expandedMember:(await cards.first().innerText()).includes(memberName)};
  } finally {await page.unrouteAll({behavior:'ignoreErrors'});await page.close();}
}

async function mountMember(page,seen) {
  await page.addInitScript(()=>sessionStorage.setItem('ucell_member_token','synthetic-only'));
  await page.route('**/*',async r=>{
    const req=r.request(),url=new URL(req.url()),p=url.pathname;
    if(p.startsWith('/api/')){
      if(req.method()==='OPTIONS')return r.fulfill({status:204});assert.equal(req.method(),'GET','unexpected member write');seen.push(p);
      if(p.endsWith('/member/me'))return api(r,{name:memberName,alias:null,memberNo:'TW0900000000',phone:null,email:null,gender:null,birthDate:null,membershipState:'FORMAL_MEMBER',mobileVerifiedAt:null,emailVerifiedAt:null});
      if(p.endsWith('/member/qualifications'))return api(r,[q]);
      if(p.endsWith('/member/dashboard'))return api(r,{memberName,memberNo:'TW0900000000',qualification:q,monthlyRepurchaseStatus:'ACTIVE',pv:null,rpv:1000,epv:null,bonusAmount:null,bonusStatus:'PENDING',monthReference:'2026-11',activeInterval:null});
      if(p.endsWith('/member/repurchase/status'))return api(r,{qualificationId:qid,period:url.searchParams.get('period'),status:'ACTIVE',recognitions:[]});
      if(p.endsWith('/member/messages'))return api(r,{items:[],asOf:stamp,dataThrough:stamp,nextCursor:null});
      if(p.endsWith('/member/order-payments/coverage/repurchase'))return api(r,{items:[{qualificationId:qid,ballNo:q.code,state:'ACTIVE',planNames:['重銷（三個月）'],endDate:'2027-01-31',subscriptionCount:1,totalMonths:3}]});
      if(p.endsWith('/member/orders'))return api(r,[]);
      if(p.endsWith('/health-game/topics'))return api(r,{rows:[],tags:[],edges:[]});
      return api(r,null,503);
    }
    if(req.method()!=='GET'||url.origin!==hosts.member)return r.abort();
    if(req.resourceType()==='document'&&member!=='PUBLIC'&&!['/topics/','/health/'].includes(p))return r.fulfill({path:path.join(member,'index.html')});
    if(req.resourceType()!=='document'&&!/\.(js|css|png|webp|svg|jpe?g|ico|mp3|woff2?)$/i.test(p))return r.fulfill({status:404,body:''});
    const file=await asset(member,url.href);return r.fulfill({status:file.status,contentType:file.type,body:file.bytes});
  });
}
async function memberBrowser(browser, width, theme) {
  const page=await browser.newPage({viewport:{width,height:870},isMobile:width<600,hasTouch:width<600,colorScheme:theme,serviceWorkers:'block'});
  const seen=[],errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(7000);
  await mountMember(page,seen);
  try {
    await page.goto(hosts.member+'/');
    const today=page.getByText(baseline?'本月重購已完成':'本月重銷已完成',{exact:true}).first();await today.waitFor();
    const details=page.locator('details#repurchase-details summary');await details.click();await page.locator('details#repurchase-details h3').first().waitFor();
    ensureCurrent(await page.locator('main').innerText(),'member dashboard and expanded recognition details');
    const purchase=page.getByRole('link',{name:/前往商城購買/});await purchase.waitFor();if(!baseline)assert.equal(await purchase.getAttribute('href'),'/shop?category=repurchase');
    await page.goto(hosts.member+'/business');
    const link=page.locator('main a[href="/repurchase"]');await link.waitFor();
    const label=await link.innerText();ensureCurrent(label,'business hub');
    if(!baseline)assert(label.includes('重銷'));
    await link.click();assert.equal(new URL(page.url()).pathname,'/repurchase');ensureCurrent(await page.locator('main').innerText(),'/repurchase');

    const categories=[];
    for(const term of baseline?['重購方案套組']:['repurchase','重銷方案套組','重購方案套組']){
      await page.goto(hosts.member+'/shop?category='+encodeURIComponent(term));
      const button=page.getByRole('button',{name:baseline?'重購方案套組':'重銷方案套組',exact:true});await button.waitFor();
      assert.equal(await button.getAttribute('aria-pressed'),'true','category link '+term);
      ensureCurrent(await page.locator('main').innerText(),'selected shop category');categories.push(term);
    }
    await page.goto(hosts.member+'/orders');await page.locator('#member-main h1,#member-main h2').first().waitFor();
    ensureCurrent(await page.locator('main').innerText(),'/orders');
    const ordersPath=new URL(page.url()).pathname;
    await page.goto(hosts.member+'/topics/');assert.match(await page.title(),/主題探索/);ensureCurrent(await page.locator('body').innerText(),'shared topics');
    assert.deepEqual(errors,[]);
    return {width,theme,label,categories,ordersPath,sharedTopics:await page.title(),requests: [...new Set(seen)]};
  } catch(error) {error.message+='; route '+page.url()+'; '+(await page.locator('main').innerText()).slice(-900)+'; requests '+seen.join(',');throw error;} finally {await page.unrouteAll({behavior:'ignoreErrors'});await page.close();}
}
async function crawlRoutes(browser, brand, theme, routeNames) {
  const results=[];
  const run=async paths=>{
    const page=await browser.newPage({viewport:{width:1280,height:860},colorScheme:theme,serviceWorkers:'block'});
    if(brand==='admin')await mount(page,admin,theme.toUpperCase());else await mountMember(page,[]);
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try {
      for(const name of paths){
        const route=name.replace('/:id?','').replace(':id',qid).replace(':sku','TIP-001').replace(':orderNo','2102');
        const item={route,heading:'',obsolete:[],scriptErrors:[]},start=errors.length;results.push(item);
        try {
          await page.goto(hosts[brand]+route,{waitUntil:'domcontentloaded'});
          await page.locator('main h1,main h2,main [role=alert],main h3,.auth-error').first().waitFor({timeout:2200}).catch(()=>{});
          const ui=await page.evaluate(()=>{
            const main=document.querySelector('main');const heading=main?.querySelector('h1,h2,h3')?.textContent?.trim()||document.title;
            const texts=[document.body.innerText,...Array.from(document.querySelectorAll('main [aria-label],main [title],main [placeholder]')).flatMap(x=>['aria-label','title','placeholder'].map(key=>x.getAttribute(key)||''))].flatMap(s=>s.split('\n'));
            return {heading,texts};
          });
          item.heading=ui.heading;item.obsolete=ui.texts.filter(s=>s.includes(oldTerm));
        } catch(error) { item.failure=error.message; }
        item.scriptErrors=errors.slice(start);
      }
    } finally { await page.unrouteAll({behavior:'ignoreErrors'});await page.close(); }
  };
  await Promise.all([0,1].map(i=>run(routeNames.filter((_,n)=>n%2===i))));
  return {brand,theme,results};
}

(async()=>{
  fs.mkdirSync(output,{recursive:true});
  const assetReports=await Promise.all([scan('admin',admin),scan('member',member)]);
  fs.writeFileSync(path.join(output,'assets.json'),JSON.stringify(assetReports,null,2));
  if(process.env.EXPECTED_ASSETS){
    const expected=JSON.parse(fs.readFileSync(process.env.EXPECTED_ASSETS,'utf8'));
    for(const live of assetReports){
      const expectedFiles=expected.find(a=>a.brand===live.brand).resources;
      const inventory=files=>Object.fromEntries(files.map(({file,sha256})=>[file,sha256]));
      assert.deepEqual(inventory(live.resources),inventory(expectedFiles),live.brand+' different from the tested candidate');
    }
  }
  for(const a of assetReports)console.log(a.brand,a.resources.length+' static assets',a.routes.length+' SPA routes',a.oldTermCount+' obsolete occurrences',a.missing);
  if(!baseline)for(const a of assetReports)if(a.oldTermCount){console.error(a.brand+' still references obsolete wording');process.exitCode=1;}
  const engine=process.env.ENGINE||'chromium',browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge'});
  try {
    if(process.env.FULL_ROUTES==='1'){
      const pages=await Promise.all(assetReports.map(a=>crawlRoutes(browser,a.brand,'dark',a.routes)));
      fs.writeFileSync(path.join(output,'routes.json'),JSON.stringify(pages,null,2));
      for(const a of pages){const failures=a.results.filter(r=>r.failure||r.scriptErrors.length);console.log(a.brand,a.results.length+' visited routes',a.results.filter(r=>r.obsolete.length).length+' old-text routes',failures.length+' fixture/render errors');if(!baseline){assert.equal(failures.length,0,'route rendered an error');assert.equal(a.results.filter(r=>r.obsolete.length).length,0);}}
    }
    const jobs=engine==='webkit'?[[390,'dark']]:[[1366,'light'],[390,'dark']];
    const results=await Promise.allSettled(jobs.flatMap(([w,t])=>[adminBrowser(browser,w,t),memberBrowser(browser,w,t)]));
    fs.writeFileSync(path.join(output,engine+'-browser.json'),JSON.stringify(results.map(r=>r.status==='fulfilled'?r.value:{error:r.reason.message}),null,2));
    for(const r of results)if(r.status==='rejected')throw r.reason;
    console.log(engine+' navigation, order tracking cards and member shop links passed');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
