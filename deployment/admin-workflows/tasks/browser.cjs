'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');
const {taskTarget} = require('../../../backend/apps/api/src/daily-task-routes.cjs');
const site = process.env.ADMIN_PREVIEW;
const base = process.env.ADMIN_BASE || site;
const root = 'https://admin.ucell.life';
const id = n => '00000000-0000-4000-8000-' + String(n).padStart(12,'0');
const date = '2026-11-13T04:30:00Z';
const codes = ['REVIEW','SUPPLEMENT','PAPER_ORDER','PAYMENT','SPONSOR','PLACEMENT','SHIPMENT','PAYOUT'];
function row(code,n) {
  const data = {id:id(n),name:'測試會員 '+n,reference:'QA-'+n,state:'SUBMITTED',since:date,overdue:false,
    tree_id:id(10),ball_no:'TW0999999999-0'+n,order_no:String(9000+n),fulfillment_key:'pack-'+n,run_id:id(20),group_id:id(n)};
  return {...data,targetPath:taskTarget(code,data)};
}
async function main(){
  assert(site,'Set ADMIN_PREVIEW to the actual patched member-administration frontend');
  const browser = await chromium.launch({channel:process.env.CHROMIUM_CHANNEL || 'msedge'});
  const assets=new Map();
  try {for(const code of codes){
    const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'}),calls=[];
    const formal=id(2), newest=id(3), target=row(code,2), last=row(code,3);
    page.setDefaultTimeout(8500);
    await page.addInitScript(()=>{sessionStorage.setItem('ucell_admin_token','fixture-only');sessionStorage.setItem('ucell_admin_user',JSON.stringify({role:'SUPER_ADMIN',provider:'ENTRA'}));});
    await page.route('**/*',async route=>{
      const u=new URL(route.request().url()),p=u.pathname.replace(/^\/api\/v1/,'');
      assert(['GET','OPTIONS','HEAD'].includes(route.request().method()),'No business writes allowed');
      if(u.pathname.startsWith('/api/')){
        calls.push(u.pathname+u.search);let data;
        if(p.endsWith('/auth/admin/me')) data={role:'SUPER_ADMIN',provider:'ENTRA',person:{legalName:'測試承辦'}};
        else if(p==='/admin/daily-operations') data={asOf:date,groups:codes.map(code=>({code,title:code,owner:'測試',hours:24,count:4,overdue:0}))};
        else if(p==='/admin/daily-operations/items') data={total:4,rows:[last,target],latestTargetPath:last.targetPath};
        else if(p==='/admin/daily-operations/health') data={scheduler:{},jobs:{}};
        else if(p==='/admin/paper-order-workbench/pending') data=[1,2,3].map(n=>({source:'FORMAL',sourceId:id(n),memberNo:'M'+n,memberName:'測試會員 '+n,paperApplicationNo:'P'+n,applicationStatus:'DRAFT'}));
        else if(p.endsWith('/detail') && p.includes('/formal-member-applications/')) data={id:formal,status:'SUBMITTED',applicantType:'INDIVIDUAL',payload:{legalName:'測試會員 2'},person:{legalName:'測試會員 2'},paperEvidence:[]};
        else if(p==='/admin/orders/'+formal) data={orderId:formal,orderNo:'9002',status:'CONFIRMED',netAmount:'100',purpose:'RETAIL',lines:[],paymentEvents:[]};
        else if(p==='/admin/fulfillment/orders/9002') data={orderId:formal,orderNo:'9002',fulfillments:[1,2].map(n=>({fulfillmentKey:'pack-'+n,status:'PACKED',sources:[],shipments:[]}))};
        else if(p==='/admin/nhi-payouts/'+id(20)) data={id:id(20),reference:'QA-001',status:'EXPORTED',day:'2026-11-13',snapshot:{groups:[1,2].map(n=>({id:id(n),memberNo:'M'+n,transfer:'300',profile:{legalName:'測試',identityMasked:'****'},lines:[]})),totals:{}},events:[]};
        else if(p==='/admin/qualifications/'+formal) data={qualificationId:formal,ballNo:'TW0999999999-02',status:'DRAFT',kind:'MEMBER_ORIGIN',currentHolder:{memberNo:'M2',legalName:'測試會員 2'},sponsorRelation:{},activePeriods:[],planHistory:[],placementHistory:[]};
        else if(p.endsWith('/current-state')) data={tree:{treeName:'測試樹',binaryTreeId:id(10),status:'ACTIVE'},candidate:{ballNo:target.ball_no},pending:{total:1,items:[]},nodes:[],breadcrumbs:[],observedAt:date};
        else if(p.endsWith('/current')) data={items:[]};
        else if(p.endsWith('/dashboard')&&p.includes('placement')) data={counts:{},items:[]};
        else if(p.endsWith('/return-reviews')) data=[];
        else if(p.includes('/qualification-placements/')&&p.endsWith('/sponsor')) data={qualificationId:formal};
        else if(p==='/admin/formal-member-applications'||p==='/admin/membership-applications'||p.includes('/documents')||p==='/admin/nhi-payouts'||p==='/admin/operations/payout-batches'||p==='/admin/packages'||p==='/admin/products'||p==='/admin/paper-applications'||p==='/admin/qualifications') data=[];
        else return route.fulfill({status:404,json:{error:{code:'NO_FIXTURE'}}});
        return route.fulfill({status:200,json:{data,meta:{page:1,take:20,total:0}}});
      }
      const file=route.request().resourceType()==='document'?'index.html':u.pathname.slice(1);
      for(const dir of [site,base]){const local=path.join(dir,file);if(fs.statSync(local,{throwIfNoEntry:false})?.isFile())return route.fulfill({path:local});}
      if(u.origin!==root)return route.abort();
      if(!assets.has(u.href))assets.set(u.href,fetch(u).then(async r=>({status:r.status,body:Buffer.from(await r.arrayBuffer()),contentType:r.headers.get('content-type')||undefined})));
      return route.fulfill(await assets.get(u.href));
    });
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    try{
      await page.goto(root+'/daily-operations?category='+code);
      assert.equal(await page.getByRole('link',{name:'處理最新一筆'}).getAttribute('href'),last.targetPath);
      const match=page.locator('tr').filter({hasText:'測試會員 2'}).getByRole('link',{name:'前往處理'});
      assert.equal(await match.getAttribute('href'),target.targetPath);
      await match.click();
      await page.waitForURL(url=>url.pathname+url.search===target.targetPath);
      if(['REVIEW','SUPPLEMENT'].includes(code)) await page.getByText('正式會員審查詳情',{exact:true}).waitFor();
      if(code==='PAPER_ORDER') await page.getByText('已選取 測試會員 2 · M2',{exact:true}).waitFor();
      if(code==='PAYMENT') await page.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='收款'&&(b.className.includes('primary')||b.getAttribute('aria-pressed')==='true')));
      if(code==='SPONSOR') await page.getByRole('heading',{name:'推薦關係',exact:true}).waitFor();
      if(code==='PLACEMENT') await page.getByText('正在安置 '+target.ball_no,{exact:true}).waitFor();
      if(code==='SHIPMENT') await page.waitForFunction(()=>document.activeElement.textContent.includes('pack-2'));
      if(code==='PAYOUT') await page.locator('details[open]').filter({hasText:'M2 · 登錄銀行結果'}).waitFor();
      assert.equal(errors.length,0,errors.join('\n'));
      console.log(code,'exact row opened');
    }catch(e){console.error(code,errors.join(';'),(await page.locator('body').innerText()).slice(-950),calls.filter(c=>c.includes('/admin/')).slice(-7));throw e}
    finally{await page.close()}
  }} finally{await browser.close()}
}
main().catch(e=>{console.error(e);process.exitCode=1});
