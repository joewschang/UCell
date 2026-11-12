const fs = require('node:fs');
const path = require('node:path');
const origin = 'https://admin.ucell.life';
const balls = Array.from({length:124}, (_,i) => {
  const serial = String(i+1).padStart(2,'0');
  return {qualificationId:'00000000-0000-4000-8000-'+String(i+1).padStart(12,'0'),ballNo:'TW09000000'+serial+'-01',planLevelCode:i%3?'STARTER':'LEADER',kind:'MEMBER_ORIGIN',activeFlag:i%2===0,status:'EFFECTIVE',effectiveAt:'2026-10-01T00:00:00Z',currentHolder:{legalName:'測試會員'+serial,memberNo:'QA'+serial,phone:'09000000'+serial}};
});
const dailyGroups = [
  {code:'APPLICATION',title:'待審核申請',count:2,overdue:0,owner:'會員承辦',hours:24},
  {code:'DOCUMENT',title:'待補件／補簽名',count:1,overdue:1,owner:'會員承辦',hours:48},
  {code:'PAPER',title:'紙本申請待建單',count:64,overdue:47,owner:'會員承辦',hours:48},
  {code:'PAYMENT',title:'已回報付款待確認',count:0,overdue:0,owner:'財務',hours:24}
];
const publicCache=new Map();
function mock(url,totalBalls) {
  const p=url.pathname.replace(/^.*?\/api\/v1/,'');
  if(p==='/auth/admin/me')return {role:'SUPER_ADMIN',provider:'ENTRA',subject:'測試管理員'};
  if(p==='/admin/daily-operations')return {asOf:'2026-11-12T02:51:27Z',groups:dailyGroups};
  if(p.endsWith('/daily-operations/items'))return {rows:[],total:0,path:'/applications'};
  if(p.endsWith('/daily-operations/health'))return undefined;
  if(p==='/admin/qualifications') {
    const q=(url.searchParams.get('q')??'').toLowerCase();
    const status=url.searchParams.get('status'),take=Number(url.searchParams.get('take')||100),skip=Number(url.searchParams.get('skip')||((Number(url.searchParams.get('page')||1)-1)*take));
    return balls.slice(0,totalBalls).filter(r=>(!status||r.status===status)&&(!q||JSON.stringify(r).toLowerCase().includes(q))).slice(skip,skip+Number(url.searchParams.get('take')||100));
  }
  if(p.startsWith('/admin/qualifications/'))return balls.find(r=>r.qualificationId===p.split('/').pop());
  if(p.endsWith('/geo/roots'))return [{id:balls[0].qualificationId,name:balls[0].currentHolder.legalName,ballNo:balls[0].ballNo}];
  if(p.endsWith('/geo/summary'))return {rootBallNo:balls[0].ballNo,time:{asOf:'2026-11-12T00:00:00Z'},status:'AVAILABLE',reason:null,summary:{balls:2,descendantBalls:2,uniqueMembers:2,unlocatedBalls:2,activeBalls:2,newPlacements:0,gpv:'0',leftBalls:1,rightBalls:1},distribution:[],branchComparison:[],carry:null};
  if(p.endsWith('/analytics/overview'))return {asOf:'2026-11-12T00:00:00Z',status:'AVAILABLE',total:6,counts:{P:2,N:1,A:2,S:1,L:0},transitions:null,excludedMissingFormalDates:0,excludedPersonRecords:0};
  if(p.endsWith('/analytics/roots'))return [];
  if(p.endsWith('/admin/products'))return [{productId:'test-only',sku:'QA-01',displayName:'測試商品',currentPrice:'100',ruleProfiles:[]}];
  if(p.endsWith('/admin/marketing'))return {asOf:'2026-11-12T02:00:00Z',summary:{links:15,visitors:21,registrations:3,members:8,balls:10,sharingBalls:2},segments:{START:2,CONNECT:0,REACH:0,CELEBRATE:0},rows:[],total:0,page:1};
}
async function mount(page,site,preference,totalBalls=76) {
  await page.addInitScript(t=>{
    if(location.pathname!=='/login') sessionStorage.setItem('ucell_admin_token','fixture-only');
    localStorage.setItem('ucell.ui-theme-preference.v1',t);
  },preference);
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    // All data queries are isolated. Production receives only public UI assets if not supplied by the build.
    if(url.pathname.startsWith('/api/')) {
      const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,HEAD,OPTIONS'};
      if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
      const meta={request_id:'isolated-qa'}; if(url.pathname.endsWith('/admin/qualifications')){const page=Number(url.searchParams.get('page')||1),take=Number(url.searchParams.get('take')||100);const all=new URL(url);all.searchParams.set('page','1');all.searchParams.set('take',String(totalBalls));const total=mock(all,totalBalls).length;Object.assign(meta,{page,take,total,hasNext:page*take<total});}
      const data=req.method()==='GET'?mock(url,totalBalls):undefined;
      return route.fulfill({status:data===undefined?503:200,headers,json:data===undefined?{error:{code:'SERVICE_UNAVAILABLE',message:'測試服務暫時無法提供資料'}}:{data,meta}});
    }
    if(url.origin!==origin||!['GET','HEAD'].includes(req.method()))return route.abort();
    const filename=path.join(site,url.pathname);
    if(fs.statSync(filename,{throwIfNoEntry:false})?.isFile())return route.fulfill({path:filename});
    const realDocument=site==='PUBLIC'&&req.resourceType()==='document';
    if(!realDocument&&req.resourceType()==='document'&&!url.pathname.startsWith('/topics/'))return route.fulfill({path:path.join(site,'index.html')});
    if(!realDocument&&!/\.(css|js|svg|webp|png|jpg|jpeg|woff2?|ico)$/i.test(url.pathname))return route.fulfill({status:404,body:''});
    if(!publicCache.has(url.href))publicCache.set(url.href,(async()=>{
      const res=await fetch(url.href,{signal:AbortSignal.timeout(12000)});
      const headers=Object.fromEntries(res.headers);for(const k of ['content-length','content-encoding','transfer-encoding'])delete headers[k];
      return {status:res.status,headers,body:Buffer.from(await res.arrayBuffer())};
    })());
    return route.fulfill(await publicCache.get(url.href));
  });
}
module.exports={mount,origin,balls};
