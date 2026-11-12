'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright-core');

// Point SITE_DIR at a copy of the public member frontend. All API calls use local synthetic data.
const site = process.env.SITE_DIR;
assert(site && fs.existsSync(path.join(site, 'index.html')), 'SITE_DIR must contain the member index.html');
const overlay = process.env.OVERLAY_DIR;
const baseline = process.argv.includes('--baseline');
const engine = process.argv.includes('--webkit') ? 'webkit' : 'chromium';
const origin = 'https://member.ucell.life';
const stamp = '2026-11-12T08:00:00Z';
const ball = {id:'00000001-1111-4111-8111-111111111111',code:'TW0900000000-01',rank:'STARTER',active:true,ballLabel:'測試資格'};
const me = {name:'測試會員',alias:null,memberNo:'TW0900000000',email:null,phone:'0900000000',gender:null,birthDate:null,membershipState:'FORMAL_MEMBER',mobileVerifiedAt:stamp,emailVerifiedAt:null};
const products = [363,364,365].map((sku,i) => ({id:'00000001-1111-4111-8111-11111111111'+(i+2),sku:'TIP-'+sku,name:'測試商品 '+sku,available:true,price:4800,pv:0}));
const offers = products.map(p => ({offeringCode:p.sku,offeringType:'CORE_PRODUCT',recognitionProfile:{displayName:p.name,coverImage:'/products/tip-363.png',packaging:'封面包裝標示：10 瓶'},composition:[{sku:p.sku,quantity:1}]}));
const headers = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
const files = new Map();
async function routeRequest(route, inset) {
  const req = route.request(), u = new URL(req.url());
  if (u.pathname.startsWith('/api/')) {
    if (req.method() === 'OPTIONS') return route.fulfill({status:204,headers});
    const endpoint = u.pathname.slice('/api/v1'.length);
    assert(req.method()==='GET' || endpoint==='/member/context/qualification','unexpected write in mall scenario');
    const data = ({
      '/member/me':me,'/member/qualifications':[ball],'/member/context/qualification':{qualificationId:ball.id,qualification:ball},
      '/member/products':products,'/member/commercial-offerings':offers,
      '/member/product-content/products/TIP-363':{name:products[0].name,price:4800,coverImage:'/products/tip-363.png',document:{blocks:[]},media:[]},
      '/member/messages':{items:[],asOf:stamp,dataThrough:stamp,nextCursor:null},
      '/member/delivery-profile':{complete:true,recipientName:'測試',phone:'0900000000',postalCode:'100',region:'臺北市',city:'中正區',address:'測試',updatedAt:stamp},
    })[endpoint];
    if (endpoint.startsWith('/public/product-reviews/products/')) {
      return route.fulfill({headers,json:{data:{reviews:[],distribution:[],total:0,page:1,pageSize:10,average:null}}});
    }
    if (data === undefined) return route.fulfill({status:404,headers,json:{error:{code:'NOT_FOUND'}}});
    return route.fulfill({headers,json:{data,meta:{api_version:'v1',timestamp:stamp,request_id:'fixture'}}});
  }
  if (u.origin !== origin || req.method() !== 'GET') return route.abort();
  const relative = req.resourceType() === 'document' ? 'index.html' : u.pathname.slice(1);
  let file;
  for (const dir of [overlay,site].filter(Boolean)) {
    const candidate=path.join(dir,relative);
    if (fs.statSync(candidate,{throwIfNoEntry:false})?.isFile()) { file=candidate; break; }
  }
  if (file && file.endsWith('.css') && inset) {
    const css=fs.readFileSync(file,'utf8').replace(/env\(\s*safe-area-inset-bottom(?:\s*,\s*[^)]*)?\)/g,inset+'px');
    return route.fulfill({contentType:'text/css',body:css});
  }
  if (file) return route.fulfill({path:file});
  if (!/\.(css|js|png|ico|svg|mp3|woff2?)$/i.test(relative)) return route.fulfill({status:404,body:''});
  if (!files.has(u.href)) files.set(u.href,(async()=>{
    const res=await fetch(u.href);
    return {status:res.status,contentType:res.headers.get('content-type') || undefined,body:Buffer.from(await res.arrayBuffer())};
  })());
  return route.fulfill(await files.get(u.href));
}

async function measure(page, selector='.cart-checkout-bar') {
  return page.evaluate(selector=>{
    const cart=document.querySelector(selector);
    const nav=document.querySelector('nav[aria-label="主要功能"]');
    const rect=el=>{const {top,bottom,left,right,height,width}=el.getBoundingClientRect();return {top,bottom,left,right,height,width}};
    const a=rect(cart), b=rect(nav);
    const bg=getComputedStyle(cart).backgroundColor, color=getComputedStyle(cart.querySelector('strong')).color;
    function luminance(rgb){
      const comps=rgb.match(/[\d.]+/g)?.slice(0,3).map(x=>Number(x)/255).map(v=>v<0.04045?v/12.92:((v+0.055)/1.055)**2.4);
      return comps[0]*0.2126+comps[1]*0.7152+comps[2]*0.0722;
    }
    const l1=luminance(bg),l2=luminance(color);
    const reachable=[...nav.querySelectorAll('a')].every(link=>{
      const r=rect(link);
      return [r.top+4,r.top+r.height/2,r.bottom-4].every(y=>link.contains(document.elementFromPoint(r.left+r.width/2,y)));
    });
    return {nav:b,dock:a,gap:b.top-a.bottom,hGap:a.left-b.right,contrast:(Math.max(l1,l2)+0.05)/(Math.min(l1,l2)+0.05),items:nav.children.length,position:getComputedStyle(cart).position,reachable,viewportWidth:innerWidth};
  },selector);
}
function checkClearance(m) {
  assert(m.reachable,'every navigation item receives pointer input across its height');
  assert(m.dock.left>=0 && m.dock.right <= m.viewportWidth+1,'dock fits viewport width');
  if (m.position !== 'static') assert(m.gap>=4 || m.hGap>=0,'floating checkout must clear the bottom navigation or desktop sidebar');
}
async function scrollToY(page, y) {
  await page.evaluate(y=>window.scrollTo({top:y,behavior:'instant'}),y);
}
async function run(browser, width,height,theme,inset,mobile,largeText=false) {
  const page=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile,colorScheme:theme.toLowerCase(),serviceWorkers:'block'});
  page.setDefaultTimeout(6000);
  await page.addInitScript(theme=>{sessionStorage.setItem('ucell_member_token','synthetic-only');localStorage.setItem('ucell.ui-theme-preference.v1',theme)},theme);
  await page.route('**/*',r=>routeRequest(r,inset));
  try {
    await page.goto(origin+'/shop');
    const bar=page.locator('.cart-checkout-bar'),nav=page.locator('nav[aria-label="主要功能"]');
    await bar.waitFor();
    if (largeText) await page.addStyleTag({content:'html{font-size:135%!important}'});
    await scrollToY(page,250);
    const m=await measure(page);
    console.log(engine,width+'x'+height,theme,'inset='+inset,JSON.stringify(m));
    if (baseline) return;
    assert(m.items===5, 'five destinations for formal member');
    checkClearance(m);
    assert(m.contrast>=4.5,'readable cart total');
    for(const y of [0,50,110,500]) {
      await scrollToY(page,y);
      checkClearance(await measure(page));
    }
    for(const link of await nav.locator('a').all()) await link.click({trial:true});
    await bar.getByRole('button',{name:'請先選擇商品'}).click();
    await bar.getByRole('alert').waitFor();
    checkClearance(await measure(page));
    const last=page.locator('.cart-product').last();
    if (m.position==='fixed') {
      await page.waitForFunction(()=>{
        const dock=document.querySelector('.cart-checkout-bar');
        const reserved=parseFloat(getComputedStyle(dock.parentElement).paddingBottom);
        return reserved >= dock.getBoundingClientRect().height + 15;
      });
    }
    await scrollToY(page,1e6);
    if (m.position==='fixed') {
      const reachesEnd=await page.evaluate(()=>{
        const bottom=document.querySelector('.cart-product:last-child').getBoundingClientRect().bottom;
        const dockTop=document.querySelector('.cart-checkout-bar').getBoundingClientRect().top;
        return {bottom,dockTop,scrollY,max:document.documentElement.scrollHeight-innerHeight};
      });
      assert(reachesEnd.bottom<=reachesEnd.dockTop+1,'last product footer clears the fixed bar: '+JSON.stringify(reachesEnd));
    }
    const add=last.getByRole('button',{name:'增加 測試商品 365'});
    // In a short viewport the card can be taller than the reading area. Scroll its
    // quantity control between the sticky header and checkout, as a member would.
    if (m.position==='fixed') await add.evaluate(el=>{
      const rect=el.getBoundingClientRect();
      const start=document.querySelector('.app>header').getBoundingClientRect().bottom;
      const end=document.querySelector('.cart-checkout-bar').getBoundingClientRect().top;
      window.scrollBy({top:rect.top+rect.height/2-(start+end)/2,behavior:'instant'});
    });
    await add.click();
    assert((await bar.innerText()).includes('4,800'));
    assert((await bar.innerText()).includes('已選 1 件'));
    await bar.getByRole('button',{name:'前往結帳'}).click();
    await page.getByRole('heading',{name:'確認訂單'}).waitFor();
    assert.equal(await bar.count(),0);
    if (width<=700) {
      await page.goto(origin+'/shop/products/TIP-363');
      const buy=page.locator('.product-mobile-buy');
      await buy.getByRole('button',{name:'加入購物車',exact:true}).waitFor();
      await scrollToY(page,1e6);
      const detail=await measure(page,'.product-mobile-buy');checkClearance(detail);
      await buy.getByRole('button',{name:'加入購物車',exact:true}).click();
      await bar.waitFor();
      assert((await bar.innerText()).includes('已選 2 件'));
    }
    await nav.getByRole('link',{name:'探索'}).click();
    assert.equal(new URL(page.url()).pathname,'/explore');
  } catch(e) {
    console.error((await page.locator('body').innerText().catch(()=>'' )).slice(0,1800));
    throw e;
  } finally {await page.close();}
}
(async()=>{
  const browser=await (engine==='webkit'?webkit.launch():chromium.launch({channel:'msedge'}));
  try {
    const cases=[[393,762,'DARK',0,true],[390,844,'DARK',34,true],[375,667,'LIGHT',0,true],[920,480,'DARK',21,true],[667,375,'LIGHT',0,true],[1280,900,'LIGHT',0,false],[320,640,'DARK',34,true,true]];
    for (const c of cases) await run(browser,...c);
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
