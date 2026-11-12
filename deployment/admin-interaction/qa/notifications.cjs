const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright-core');
const [site,out,phase='candidate']=process.argv.slice(2),origin='https://member.ucell.life',cache=new Map();
if(!site||!out)throw Error('Usage: node notifications.cjs <member SPA> <evidence folder> [baseline]');
const ref='MESSAGE-'+'a'.repeat(40),stamp='2026-11-12T02:43:00Z';
const q={id:'00000000-0000-4000-8000-000000000011',code:'TW0900000000-01',qualificationNo:'12',rank:'STARTER',active:true,ballLabel:'啟航',monthReference:'2026-11',activeInterval:null};
const notice={reference:ref,qualificationNo:null,category:'ORDER',title:'訂單進度通知範例',content:'合成會員測試內容',createdAt:stamp,publishedAt:stamp,expiresAt:null,readAt:null,archivedAt:null,status:'PUBLISHED',sourceReference:'MEMBER-ORDER-QA',deepLink:'/orders'};
async function check(browser,engine,kind,theme){
  const ctx=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,colorScheme:theme,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await ctx.newPage(),requests=[],stats={kind,theme,errors:[]};page.on('pageerror',e=>stats.errors.push(e.message));page.setDefaultTimeout(6500);
  let list='ready',read=false,qualificationRecovered=false,releaseQualification;
  const waiting=new Promise(resolve=>{releaseQualification=resolve;});
  await page.addInitScript(({auth,theme,callback})=>{if(callback)sessionStorage.setItem('ucell_line_intended_destination','/notifications');if(auth) sessionStorage.setItem('ucell_member_token','synthetic-local-only');localStorage.setItem('ucell.ui-theme-preference.v1',theme.toUpperCase());},{auth:kind!=='guest'&&kind!=='callback',theme,callback:kind==='callback'});
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname;
    if(p.startsWith('/api/')){
      const hdr={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
      if(req.method()==='OPTIONS')return route.fulfill({status:204,headers:hdr});requests.push([req.method(),p,url.search]);
      let data,code=200;
      if(p.endsWith('/auth/member/line/exchange')){assert.equal(kind,'callback');assert.equal(req.postDataJSON().idToken,'synthetic');data={accessToken:'synthetic-line-session',expiresAt:new Date(Date.now()+300000).toISOString()};}
      else if(p.endsWith('/member/me'))data={name:'測試會員',alias:null,memberNo:'TW0900000000',phone:null,email:null,gender:null,birthDate:null,membershipState:kind==='qualified'?'FORMAL_MEMBER':'NETWORK_MEMBER',mobileVerifiedAt:null,emailVerifiedAt:null};
      else if(p.endsWith('/member/qualifications')){if(kind==='slow'&&!qualificationRecovered)await waiting;if(kind==='unavailable'&&!qualificationRecovered)code=503;data=kind==='qualified'||qualificationRecovered?[q]:[];}
      else if(p.endsWith('/member/messages')&&req.method()==='GET'){if(list==='error')code=503;data={items:list==='ready'?[{...notice,readAt:read?stamp:null}]:[],asOf:stamp,dataThrough:stamp,nextCursor:null};}
      else if(p.endsWith('/member/messages/'+ref+'/read')&&req.method()==='POST'){read=true;data={};}
      else if(p.endsWith('/application-journey'))data={title:'測試申請進度',memberTasks:[],companyTasks:[],missing:[],action:{label:'查看進度',href:'/me'}};
      else if(p.endsWith('/season-theme'))data={theme:'classic'};
      else if(p.endsWith('/topics'))data={rows:[],tags:[],edges:[]};
      else code=503;
      return route.fulfill({status:code,headers:hdr,json:code===200?{data,meta:{api_version:'v1',request_id:'fixture',timestamp:stamp}}:{code:'SERVICE_UNAVAILABLE'}});
    }
    if(kind==='callback'&&p.includes('/liff-2.'))return route.fulfill({contentType:'text/javascript',body:"export default {init:async()=>{},isLoggedIn:()=>true,isInClient:()=>true,getIDToken:()=>'synthetic',getOS:()=>'ios',ready:Promise.resolve(),getContext:()=>({type:'external'})}"});
    if(req.method()!=='GET'&&req.method()!=='HEAD')return route.abort();
    if(url.origin!==origin)return route.abort();
    let file=path.join(site,p);
    if(fs.statSync(file,{throwIfNoEntry:false})?.isFile())return route.fulfill({path:file});
    const base=process.env.MEMBER_STATIC_FALLBACK&&path.join(process.env.MEMBER_STATIC_FALLBACK,p);if(base&&fs.statSync(base,{throwIfNoEntry:false})?.isFile()&&req.resourceType()!=='document')return route.fulfill({path:base});
    const realDocument=site==='PUBLIC'&&req.resourceType()==='document';
    if(!realDocument&&req.resourceType()==='document')return route.fulfill({path:path.join(site,'index.html')});
    if(!realDocument&&!/\.(?:css|js|svg|webp|png|jpe?g|woff2?|ico|mp3)$/i.test(p))return route.fulfill({status:404,body:''});
    if(!cache.has(url.href))cache.set(url.href,(async()=>{const r=await fetch(url.href,{signal:AbortSignal.timeout(12000)});const headers=Object.fromEntries(r.headers);for(const key of ['content-length','content-encoding','transfer-encoding'])delete headers[key];return {body:Buffer.from(await r.arrayBuffer()),status:r.status,headers};})());
    return route.fulfill(await cache.get(url.href));
  });
  try{
    await page.goto(origin+(kind==='guest'?'/notifications':'/'));const bell=page.locator('header a[href="/notifications"]').first();
    if(kind==='guest'){
      await page.locator('main').first().waitFor();stats.guestView=await page.locator('main').first().innerText();stats.guestHasBell=!!await bell.count();assert(!requests.some(r=>r[1].endsWith('/member/messages')));return stats;
    }
    if(kind==='callback'){
      await page.locator('#member-main').getByRole('heading',{name:'通知中心',exact:true}).waitFor();await page.getByRole('heading',{name:notice.title}).waitFor();assert.equal(new URL(page.url()).pathname,'/notifications');
      assert(requests.some(r=>r[1].endsWith('/auth/member/line/exchange')));assert(requests.some(r=>r[1].endsWith('/member/messages')&&r[2].includes('view=ACTIVE')));assert.deepEqual(stats.errors,[]);return stats;
    }
    await bell.waitFor();
    await page.locator('#member-main').waitFor();
    // Wait for the shell qualification and supplements to finish mounting (not for network idle).
    if(kind!=='slow')await page.waitForFunction(()=>!document.querySelector('#member-main')?.innerText.includes('資格資料載入中'));
    stats.beforeUrl=page.url();stats.headerText=await bell.innerText();stats.hit=await bell.evaluate(el=>{const r=el.getBoundingClientRect(),target=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return {inside:!!el.contains(target),target:target?.outerHTML.slice(0,140),rect:[r.x,r.y,r.width,r.height]};});
    await bell.tap();await page.waitForTimeout(80);
    stats.url=page.url();stats.main=(await page.locator('#member-main').innerText()).slice(0,230);stats.messageQueries=requests.filter(r=>r[0]==='GET'&&r[1].endsWith('/member/messages'));
    stats.firstViewport=await page.locator('#member-main h1,#member-main h2').first().boundingBox().catch(()=>null);
    await page.screenshot({path:path.join(out,engine+'-'+kind+'-'+theme+'.png')});
    if(phase!=='baseline'){
      assert(stats.hit.inside,'header hit target');assert(stats.hit.rect[2]>=44&&stats.hit.rect[3]>=44);assert(new URL(stats.url).pathname==='/notifications');
      await page.getByRole('heading',{name:notice.title}).waitFor();const readBtn=page.getByRole('button',{name:/已讀/}).first();await readBtn.click();await page.waitForFunction(()=>document.querySelector('#member-main')?.innerText.includes('已讀'));
      assert(read);const reload=page.getByRole('button',{name:/重新讀取|重新整理/}).first();
      list='empty';await reload.click();await page.getByText(/目前範圍沒有訊息|目前沒有通知|目前沒有訊息/).first().waitFor();
      list='error';await reload.click();const retry=page.getByRole('button',{name:/^重試$|^重新載入$/}).first();await retry.waitFor();list='ready';await retry.click();await page.getByRole('heading',{name:notice.title}).waitFor();
      if(kind==='slow'||kind==='unavailable'){
        await page.getByText(kind==='slow'?'正在查詢球號，先顯示個人通知。':'暫時無法載入球號，先顯示個人通知。').waitFor();qualificationRecovered=true;
        if(kind==='slow')releaseQualification();else await page.getByRole('button',{name:'重新載入球號'}).click();
        await page.waitForFunction(()=>document.querySelector('#member-main')?.innerText.includes('TW0900000000-01'));
      }
      const listCalls=requests.filter(r=>r[0]==='GET'&&r[1].endsWith('/member/messages')&&r[2].includes('take=25'));assert(listCalls.some(r=>r[2].includes('qualificationId=')===(kind==='qualified')));
      if(kind==='qualified'||kind==='network'){
        await page.evaluate(()=>scrollTo(0,document.documentElement.scrollHeight));await bell.tap();await page.waitForFunction(()=>scrollY===0);assert.equal(await page.evaluate(()=>document.activeElement?.id),'member-main');
        await page.goto(origin+'/me');await page.getByRole('link',{name:/查看通知中心/}).tap();await page.getByRole('heading',{name:'通知中心',exact:true}).waitFor();
      }
      assert.equal(stats.errors.length,0);
    }
    return stats;
  }catch(e){stats.failure=e.message;stats.url=page.url();stats.body=(await page.locator('body').innerText()).slice(0,500);stats.requests=requests;return stats;}finally{releaseQualification();await page.unrouteAll({behavior:'ignoreErrors'});await ctx.close();}
}
(async()=>{fs.mkdirSync(out,{recursive:true});const engine=process.env.ENGINE||'chromium',browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge',headless:true});
try{const r=await Promise.all([check(browser,engine,'network','dark'),check(browser,engine,'qualified','light'),check(browser,engine,'guest','light'),check(browser,engine,'unavailable','dark'),...(phase==='baseline'?[]:[check(browser,engine,'slow','dark'),check(browser,engine,'callback','dark')])]);fs.writeFileSync(path.join(out,engine+'-member.json'),JSON.stringify(r,null,2));console.log(JSON.stringify(r));if(phase!=='baseline'&&r.some(x=>x.failure))process.exitCode=1;}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
