'use strict';
// Use the actual SPA routes with synthetic accounts and local responses. Only public static resources may use the network.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright-core');
const {mount}=require('../../../admin-interaction/qa/fixtures.cjs');
const [admin,member,engine='chromium']=process.argv.slice(2);
const app='00000001-1111-4111-8111-111111111111', old='00000002-1111-4111-8111-111111111111', id='00000003-1111-4111-8111-111111111111';
const oldHash='a'.repeat(64),newHash='b'.repeat(64),stamp='2026-11-12T09:15:00Z';
const current={id,title:'正式會員申請協議',version:'對照新版',content:'新版測試協議全文',contentHash:'c'.repeat(64),acceptedAt:null};
const previous={...current,id:old,version:'對照原簽版',content:'原簽測試協議全文',contentHash:'d'.repeat(64)};
const images=['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'];
const heads={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,GET,OPTIONS'};
const api=(r,data,status=200)=>r.fulfill({status,headers:heads,json:status===200?{data,meta:{api_version:'v1',timestamp:stamp,request_id:'test'}}:{error:{code:'SERVICE_UNAVAILABLE'}}});
const state=(requiresRefresh,changed,preservedSignature=false)=>({requiresRefresh,canRefresh:true,preservedSignature,snapshotHash:changed?newHash:oldHash,version:changed?2:1,current:requiresRefresh?current:{id:current.id,title:current.title,version:current.version,contentHash:current.contentHash}});
const checkUpdate=(req)=>{assert.deepEqual(req.postDataJSON(),{expectedSnapshotHash:oldHash,contractVersionId:id,contentHash:current.contentHash,confirmed:true});assert(req.headers()['idempotency-key']);};
const fakeAsset=new Map();
async function staticMember(route){
 const req=route.request(),url=new URL(req.url());
 if(url.protocol==='blob:')return route.continue();
 if(req.method()!=='GET'||url.origin!=='https://member.ucell.life')return route.abort();
 const p=url.pathname,file=path.join(member,req.resourceType()==='document'?'index.html':p);
 if(fs.statSync(file,{throwIfNoEntry:false})?.isFile())return route.fulfill({path:file});
 if(!/\.(js|css|png|webp|svg|jpe?g|ico|mp3|woff2?)$/i.test(p))return route.fulfill({status:404,body:''});
 if(!fakeAsset.has(url.href))fakeAsset.set(url.href,(async()=>{const raw=await fetch(url);return {status:raw.status,contentType:raw.headers.get('content-type')||undefined,body:Buffer.from(await raw.arrayBuffer())};})());
 return route.fulfill(await fakeAsset.get(url.href));
}
async function memberScenario(page,preserved,noPermission=false){
 let changed=false,renewed=0,consented=0,submitted=false,signed=preserved;
 await page.addInitScript(()=>sessionStorage.setItem('ucell_member_token','synthetic-only'));
 await page.route('**/*',async r=>{
  const req=r.request(),u=new URL(req.url()),p=u.pathname.slice(7);
  if(!u.pathname.startsWith('/api/'))return staticMember(r);
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:heads});
  if(p==='/member/me')return api(r,{name:'測試申請人',alias:null,memberNo:'TW0900000000',phone:'0900000000',email:null,gender:null,birthDate:null,membershipState:'NETWORK_MEMBER',mobileVerifiedAt:stamp,emailVerifiedAt:null});
  if(['/member/qualifications','/member/represented-legal-entities'].includes(p))return api(r,[]);
  if(p==='/member/messages')return api(r,{items:[],asOf:stamp,dataThrough:stamp,nextCursor:null});
  if(p==='/member/formal-enrollment/applications/'+app+'/submit'&&req.method()==='POST'){assert(signed);submitted=true;return api(r,{applicationId:app,status:'SUBMITTED'});}
  if(p==='/member/formal-enrollment')return api(r,{membershipState:'NETWORK_MEMBER',feeAmount:'0',currency:'TWD',stagePaymentEnabled:false,feeReceipt:null,application:{id:app,status:submitted?'SUBMITTED':'DRAFT',sourceChannel:'MEMBER_WEB',applicantType:'INDIVIDUAL'},paidPackages:[{orderId:app,packageName:'測試啟航'}],pendingPackages:[],draft:{version:changed?2:1,documents:signed?[...images,'SIGNED_APPLICATION_AGREEMENT']:images,payload:{phone:'0900000000',legalName:'測試申請人',formalContractVersionId:changed?id:old}},bundlePayment:null});
  if(p==='/member/contracts/formal-required')return api(r,[current]);
  if(p.endsWith('/contract-renewal')&&req.method()==='POST'){checkUpdate(req);renewed++;changed=true;return api(r,state(false,true));}
  if(p.endsWith('/documents')&&req.method()==='GET')return api(r,{applicationId:app,documents:(signed?[...images,'SIGNED_APPLICATION_AGREEMENT']:images).map(type=>({type,status:'PRESENT'})),paperReviewed:[],contractRenewal:{...state(!changed&&!preserved,changed,preserved),canRefresh:!noPermission},signingContext:changed||preserved?{version:changed?2:1,snapshotHash:changed?newHash:oldHash,name:'測試申請人',contract:changed?current:previous}:null});
  if(p==='/member/contracts/'+id+'/consent'&&req.method()==='POST'){consented++;return api(r,{contractVersionId:id,acceptedAt:stamp});}
  if(p.endsWith('/documents')&&req.method()==='POST'){const body=req.postDataJSON();assert.equal(body.documentType,'SIGNED_APPLICATION_AGREEMENT');assert.equal(body.expectedSnapshotHash,newHash);signed=true;return api(r,{});}
  return api(r,null,503);
 });
 await page.goto('https://member.ucell.life/membership/upgrade');
 const sig=page.locator('.membership-signature:visible').first();await sig.waitFor();
 async function submitCurrent(){await page.getByRole('button',{name:'繼續確認送審'}).click();await page.getByRole('button',{name:'確認送出正式會員申請'}).click();await page.waitForTimeout(150);assert(submitted);}
 if(preserved){await sig.getByText('簽名已保存，後台審查人員可檢視。').waitFor();assert.equal(await sig.locator('.contract-renewal').count(),0);assert.equal(renewed,0);await submitCurrent();return;}
 const panel=sig.getByRole('region',{name:'新版會員協議'});await panel.waitFor();
 if(noPermission){await panel.getByText('請聯絡承辦人核對紙本協議及簽署流程。').waitFor();assert.equal(await panel.getByRole('button').count(),0);assert.equal(renewed,0);return;}
 await panel.getByText('查看新版協議全文').click();
 assert((await panel.innerText()).includes('新版測試協議全文'));await panel.getByRole('button',{name:'切換至新版協議並繼續簽名'}).click();
 const read=sig.getByRole('button',{name:'開啟並閱讀會員合約'});await read.click();
 const dialog=page.getByRole('dialog');assert((await dialog.innerText()).includes(current.version));
 await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:'同意並繼續'}).click();
 await sig.getByRole('button',{name:/上傳.*簽名|簽名照片/}).first().click();
 const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=280;c.height=120;const ink=c.getContext('2d');ink.fillStyle='white';ink.fillRect(0,0,280,120);ink.fillStyle='black';ink.fillText('fixture signature',20,65);return c.toDataURL('image/png').split(',')[1];});
 const pixel=Buffer.from(png,'base64');
 await sig.locator('input[type=file]').first().setInputFiles({name:'test.png',mimeType:'image/png',buffer:pixel});
 await sig.getByRole('checkbox',{name:/本人確認/}).check();
 await sig.getByRole('button',{name:'儲存會員簽名',exact:true}).click();
 await sig.getByText('簽名已保存，後台審查人員可檢視。').waitFor();assert.equal(signed,true);assert.equal(renewed,1);assert.equal(consented,1);await submitCurrent();
}
async function adminScenario(page,type,history=false,readonly=false,paper=false){
 const name=type==='LEGAL_ENTITY'?'測試股份有限公司':'測試申請人';
 const row={id:app,applicantType:type,sourceChannel:'ADMIN_PAPER',personName:name,paperApplicationReference:'QA-PAPER-1',status:history?'APPROVED':'DRAFT',createdAt:stamp,updatedAt:stamp,membershipState:'NETWORK_MEMBER'};
 let changed=false,calls=0,posts=0;
 await mount(page,admin,'LIGHT');
 await page.route('**/api/v1/**',async r=>{
  const req=r.request(),u=new URL(req.url()),p=u.pathname.slice(7);
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:heads});
  if(readonly&&p==='/auth/admin/me')return api(r,{role:'COMPLIANCE_AUDIT',provider:'ENTRA',subject:'測試唯讀'});
  if(p==='/admin/formal-member-applications')return api(r,[row]);
  if(p==='/admin/membership-applications')return api(r,[]);
  if(p.endsWith('/formal-member-applications/contracts/required'))return api(r,[current]);
  if(p.endsWith('/'+app+'/detail'))return api(r,{...row,personId:app,person:{personId:app,memberNo:'TW0900000000'},payload:{applicantType:type,legalName:name,legalEntityName:name,formalContractVersionId:changed?id:old},version:changed?2:1,payloadHash:changed?newHash:oldHash,documents:[],paperEvidence:[],evidence:[],conflicts:[],checklist:{},gate:{ready:false,codes:[]}});
  if(p.endsWith('/'+app+'/documents'))return api(r,history?[{id:old,type:'SIGNED_APPLICATION_AGREEMENT',status:'PRESENT'}]:[]);
  if(p.endsWith('/'+app+'/contract-renewal')){calls++;if(req.method()==='POST'){checkUpdate(req);changed=true;posts++;}return api(r,state(!changed&&!history,changed,history));}
  return r.fallback();
 });
 if(paper){await page.goto('https://admin.ucell.life/applications/formal-paper');const version=page.getByLabel('正式會員契約版本');await page.waitForFunction(value=>Array.from(document.querySelectorAll('select')).some(select=>select.value===value),id);assert.equal(await version.inputValue(),id);await page.getByLabel('申請類型').selectOption(type);assert.equal(await version.inputValue(),id);page.once('dialog',dialog=>dialog.accept());await page.getByRole('button',{name:'繼續編輯／補傳照片'}).click();const panel=page.getByRole('region',{name:'新版會員協議'});await panel.waitFor();assert.equal(await version.inputValue(),old);const ref=page.getByLabel(/紙本申請編號/).first();await ref.fill('QA-KEEP-ME');await panel.getByRole('button',{name:'將本案切換至新版協議'}).click();await panel.waitFor({state:'detached'});assert.equal(await version.inputValue(),id);assert.equal(await ref.inputValue(),'QA-KEEP-ME');assert.equal(posts,1);return;}
 await page.goto('https://admin.ucell.life/applications');
 const pick=page.getByRole('button',{name,exact:true});await pick.click();
 await page.locator('#uc-review-documents').waitFor();
 if(readonly||history){assert.equal(await page.getByRole('region',{name:'新版會員協議'}).count(),0);assert.equal(calls,0);return;}
 const panel=page.getByRole('region',{name:'新版會員協議'});await panel.waitFor();await panel.getByRole('button',{name:'將本案切換至新版協議'}).click();await panel.waitFor({state:'detached'});assert.equal(posts,1);
}
(async()=>{
 const browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge'});
 try{
  for(const [action,args] of [[memberScenario,[false]],[memberScenario,[true]],[memberScenario,[false,true]],[adminScenario,['INDIVIDUAL']],[adminScenario,['LEGAL_ENTITY']],[adminScenario,['INDIVIDUAL',true]],[adminScenario,['INDIVIDUAL',false,true]],[adminScenario,['INDIVIDUAL',false,false,true]],[adminScenario,['LEGAL_ENTITY',false,false,true]]]){
   const page=await browser.newPage({viewport:{width:engine==='webkit'?390:1280,height:860},isMobile:engine==='webkit',hasTouch:engine==='webkit',serviceWorkers:'block'});page.setDefaultTimeout(7000);
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   try{await action(page,...args);assert.deepEqual(errors,[]);console.log(engine,action.name,...args,'pass');}
   catch(e){console.error('page errors',errors);console.error((await page.locator('main').innerText().catch(()=>'' )).slice(-4200));throw e;}finally{await page.close();}
  }
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
