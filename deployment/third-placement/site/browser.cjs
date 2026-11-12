'use strict';
// Run against the assembled admin and member directories. All business API traffic is fulfilled locally.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium, webkit} = require('playwright-core');
const {mount} = require('../../admin-interaction/qa/fixtures.cjs');

const [admin, member, engine='chromium'] = process.argv.slice(2);
const stamp='2026-11-12T03:45:00Z';
const treeId='10000000-0000-4000-8000-000000000001';
const targetId='10000000-0000-4000-8000-000000000002';
const sponsorId='10000000-0000-4000-8000-000000000003';
const target='TW0900000002-01', sponsor='TW0900000001-01';
const tree={binaryTreeId:treeId,treeCode:'T',treeName:'測試樹',status:'ACTIVE',topologyVersion:8};
const q={id:sponsorId,code:sponsor,qualificationNo:'12',rank:'STARTER',active:true,ballLabel:'啟航',monthReference:'2026-11',activeInterval:null};
const waiting={pendingBallNo:target,placementReference:'P3',pendingMemberNo:'TW0900000002',packageType:'STARTER',sponsorBallNo:sponsor,paymentState:'CONFIRMED',requestedAt:stamp,dueAt:stamp,placedAt:null,status:'PLACEMENT_PENDING',agingBucket:'0_24H',policyVersion:'fixture'};
const pendingBall={qualificationId:targetId,ballNo:target,memberNo:waiting.pendingMemberNo,sponsorBallNo:sponsor};
const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
const meta={api_version:'v1',timestamp:stamp,request_id:'fixture'};
const api=(route,data,status=200)=>route.fulfill({status,headers,json:status===200?{data,meta}:{error:{code:'SERVICE_UNAVAILABLE',message:'測試環境無此資料'}}});
function node(slots) { return {qualificationId:sponsorId,ballNo:sponsor,memberName:'一般會員甲',position:'1',kind:'MEMBER_ORIGIN',leftBallNo:null,rightBallNo:null,slots}; }
const slots=()=>['LEFT','RIGHT'].map(side=>({side,reason:null}));

async function adminPlacement(page, side, blocked) {
  const posts=[],previews=[];
  await mount(page,admin,'DARK');
  await page.route('**/api/v1/admin/organization/**',async r=>{
    const req=r.request(),url=new URL(req.url()),p=url.pathname;
    if(req.method()==='OPTIONS')return r.fulfill({status:204,headers});
    if(p.endsWith('/trees/current'))return api(r,{items:[tree],nextCursor:null});
    if(p.endsWith('/current-state')){
      const selected=!!url.searchParams.get('candidateBallNo');
      const options=slots();if(blocked)options[1].reason='SPONSOR_SUBTREE_REQUIRED';
      return api(r,{tree,observedAt:stamp,pending:{items:[pendingBall],total:1,nextCursor:null},candidate:selected?{...pendingBall,sequence:3,blocked:null}:null,breadcrumbs:[{ballNo:sponsor}],nodes:[node(selected?options:[])]});
    }
    if(p.endsWith('/placement-preview')){
      previews.push(Object.fromEntries(url.searchParams));
      return api(r,{ballNo:target,parentBallNo:sponsor,preflightToken:'a'.repeat(64),expectedVersion:8,side:url.searchParams.get('side')});
    }
    if(p.endsWith('/placements')&&req.method()==='POST'){
      posts.push(req.postDataJSON());
      return api(r,{ballNo:target,parentBallNo:sponsor,side:req.postDataJSON().side,placedAt:stamp});
    }
    return api(r,null,503);
  });
  await page.goto('https://admin.ucell.life/admin/organization/trees/'+treeId);
  await page.getByRole('button',{name:'待安置球（1）',exact:true}).click();
  await page.getByRole('button',{name:'選擇安置',exact:true}).click();
  const textSide=side==='RIGHT'?'右側':'左側';
  const slot=page.locator('.ct-vacancy button').filter({hasText:textSide});
  await slot.waitFor();
  if(blocked){assert(await slot.isDisabled());assert.equal(previews.length,0);return;}
  assert(await slot.isEnabled());await slot.click();
  const dialog=page.getByRole('dialog',{name:'確認安置位置'});await dialog.waitFor();
  assert((await dialog.innerText()).includes(textSide));
  assert.equal(previews[0].side,side);assert.equal(previews[0].binaryParentBallNo,sponsor);
  await dialog.getByPlaceholder('請填寫原因，供日後查核').fill('一般會員指定位置（測試）');
  await dialog.getByRole('button',{name:'確認安置',exact:true}).click();
  await page.getByText(/安置完成/).first().waitFor();
  assert.equal(posts.length,1);assert.equal(posts[0].side,side);assert.equal(posts[0].qualificationId,targetId);
}

async function memberPlacement(page,side,blocked){
  const posts=[];
  await page.addInitScript(()=>sessionStorage.setItem('ucell_member_token','synthetic-only'));
  await page.route('**/*',async r=>{
    const req=r.request(),url=new URL(req.url()),p=url.pathname;
    if(p.startsWith('/api/')){
      if(req.method()==='OPTIONS')return r.fulfill({status:204,headers});
      if(p.endsWith('/member/me'))return api(r,{name:'一般會員甲',alias:null,memberNo:'TW0900000001',phone:null,email:null,gender:null,birthDate:null,membershipState:'FORMAL_MEMBER',mobileVerifiedAt:null,emailVerifiedAt:null});
      if(p.endsWith('/member/qualifications'))return api(r,[q]);
      if(p.endsWith('/placements/pending'))return api(r,[waiting]);
      if(p.endsWith('/placements/pending/P3/branch')){
        const options=slots();if(blocked)options[1].reason='SPONSOR_SUBTREE_REQUIRED';
        return api(r,{observedAt:stamp,ballNo:target,sponsorBallNo:sponsor,sequence:3,blocked:null,breadcrumbs:[{ballNo:sponsor}],nodes:[node(options)]});
      }
      if(p.endsWith('/placements/pending/P3/place')&&req.method()==='POST'){
        const data=req.postDataJSON();posts.push(data);
        return api(r,{...data,ballNo:target,placedAt:stamp,evidenceHash:'b'.repeat(64)});
      }
      if(p.endsWith('/member/messages'))return api(r,{items:[],asOf:stamp,dataThrough:stamp,nextCursor:null});
      return api(r,null,503);
    }
    if(req.method()!=='GET'||url.origin!=='https://member.ucell.life')return r.abort();
    const file=path.join(member,req.resourceType()==='document'?'index.html':p);
    if(fs.statSync(file,{throwIfNoEntry:false})?.isFile())return r.fulfill({path:file});
    if(!/\.(js|css|png|webp|svg|jpe?g|ico|mp3|woff2?)$/i.test(p))return r.fulfill({status:404,body:''});
    const raw=await fetch(url), bytes=Buffer.from(await raw.arrayBuffer());
    return r.fulfill({status:raw.status,contentType:raw.headers.get('content-type')||undefined,body:bytes});
  });
  await page.goto('https://member.ucell.life/organization');
  await page.getByRole('button',{name:'選擇安置位置',exact:true}).click();
  const region=page.getByRole('region',{name:'選擇安置位置'});await region.waitFor();
  const textSide=side==='RIGHT'?'右側':'左側';
  const slot=region.getByRole('button',{name:sponsor+' '+textSide+'安置'});
  await slot.waitFor();
  assert((await region.innerText()).includes('一般會員球可在推薦球下方選擇左側或右側的可用空位。'));
  if(blocked){assert(await slot.isDisabled());assert.equal(posts.length,0);return;}
  await slot.click();
  const confirm=region.getByRole('region',{name:'確認安置'});
  assert((await confirm.innerText()).includes(sponsor+' · '+textSide));
  await confirm.getByRole('button',{name:'確認並完成安置'}).click();
  await page.getByText(/安置完成：/).waitFor();
  assert.equal(posts.length,1);assert.equal(posts[0].side,side);assert.equal(posts[0].binaryParentBallNo,sponsor);assert.equal(posts[0].sponsorQualificationId,sponsorId);
}
async function applicationPreview(page) {
  const preflight=[];
  await mount(page,admin,'LIGHT');
  await page.route('**/api/v1/**',async r=>{
    const req=r.request(),u=new URL(req.url());
    if(req.method()==='OPTIONS')return r.fulfill({status:204,headers});
    if(u.pathname.endsWith('/admin/persons'))return api(r,[{personId:targetId,legalName:'申請人乙'}]);
    if(u.pathname.endsWith('/admin/qualifications'))return api(r,[{qualificationId:sponsorId,qualificationNo:'1',planLevelCode:'STARTER',currentHolder:{legalName:'一般會員甲'}}]);
    if(u.pathname.endsWith('/organization/placement-preview')){
      preflight.push(Object.fromEntries(u.searchParams));
      return api(r,{valid:true,nextSponsorSequenceNo:3,firstThirdLeftRequired:true});
    }
    return r.fallback();
  });
  await page.goto('https://admin.ucell.life/applications/new');
  for (let step=1;step<=3;step++){
    await page.locator('.search-select input').fill('測試');
    await page.locator('.search-option').first().click();
    if(step===3){
      await page.locator('select').filter({has:page.locator('option[value="RIGHT"]')}).selectOption('RIGHT');
      await page.getByRole('button',{name:'預檢安置合法性'}).click();
      await page.getByText('安置預檢通過',{exact:true}).waitFor();
      assert.match(await page.locator('main').innerText(),/下一直推序號：3/);
      assert(!/左子樹限制/.test(await page.locator('main').innerText()));
    }
    await page.getByRole('button',{name:'下一步',exact:true}).click();
  }
  await page.getByText('核准時會重新確認推薦序號、推薦範圍與安置位置是否仍可用。',{exact:true}).waitFor();
  assert.equal(preflight.length,1);assert.equal(preflight[0].binarySide,'RIGHT');
  assert.equal(preflight[0].sponsorQualificationId,sponsorId);
}


(async()=>{
  const browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge'});
  try{
    const width=engine==='webkit'?390:1360;
    const wizard=await browser.newPage({viewport:{width,height:840},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});
    wizard.setDefaultTimeout(9000);
    try{await applicationPreview(wizard);console.log(engine,'application right preflight and confirmation');}
    catch(error){console.error(await wizard.locator('body').innerText().catch(()=>''));throw error;}
    finally{await wizard.close();}
    for(const action of [adminPlacement,memberPlacement]){
      for(const [side,blocked] of [['RIGHT',false],['LEFT',false],['RIGHT',true]]){
        const page=await browser.newPage({viewport:{width,height:840},isMobile:width<600,hasTouch:width<600,serviceWorkers:'block'});page.setDefaultTimeout(9000);
        const errors=[];page.on('pageerror',e=>errors.push(e.message));
        try{await action(page,side,blocked);assert.deepEqual(errors,[]);console.log(engine,action.name,side,blocked?'scope block':'confirmed');}
        catch(error){console.error(await page.locator('body').innerText().catch(()=>''));throw error;}
        finally{await page.close();}
      }
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
