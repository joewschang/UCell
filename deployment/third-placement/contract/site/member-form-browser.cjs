// Run with a locally assembled member website and a browser engine. All business API responses are synthetic.
'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright-core'),eng=process.argv[3]||'chromium';
const base=path.resolve(process.argv[2]);
const prev='00000002-1111-4111-8111-111111111111',curr='00000003-1111-4111-8111-111111111111',app='00000001-1111-4111-8111-111111111111';
const stamp='2026-11-12T09:00:00Z',oldHash='a'.repeat(64),newHash='b'.repeat(64),current={id:curr,title:'正式會員申請協議',version:'QA-NEXT',content:'測試新版正式會員協議全文',contentHash:'c'.repeat(64),acceptedAt:null},old={...current,id:prev,version:'QA-OLD'};
const docs=['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'];
const payload={applicantType:'INDIVIDUAL',legalName:'示範會員',gender:'UNDISCLOSED',birthDate:'1990-01-01',nationalityCode:'TW',identityDocumentType:'NATIONAL_ID',identityDocumentNumber:'A123456789',communicationAddress:'臺北市中正區示範路10號',phone:'0900000000',email:'before@example.com',bankCode:'004',bankAccount:'123456789',accountHolder:'示範會員',formalContractVersionId:prev};
const heads={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'POST,GET,OPTIONS'};
function api(r,data){return r.fulfill({headers:heads,json:{data,meta:{api_version:'v1',timestamp:stamp,request_id:'qa'}}});}
async function scenario(browser,mode){
 const page=await browser.newPage({serviceWorkers:'block'});page.setDefaultTimeout(5500);
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const signed=['signedSame','signedEdit','wrongHash','wrongId','emptyText'].includes(mode);let version=1,active=false,renewals=0,saves=0,consents=0,uploads=0,savedEmail=null;
 const header={...current};delete header.content;
 const view=()=>({version,current:!active&&!signed?current:header,requiresRefresh:!active&&!signed,preservedSignature:!active&&signed,canRefresh:mode!=='paper',snapshotHash:active?newHash:oldHash});
 await page.addInitScript(()=>sessionStorage.setItem('ucell_member_token','test'));
 await page.route('**/*',async r=>{const req=r.request(),u=new URL(req.url()),p=u.pathname.slice(7);
  if(['blob:','data:'].includes(u.protocol))return r.continue();
  if(!u.pathname.startsWith('/api/')){
   if(req.resourceType()==='document'){const html=fs.readFileSync(base+'/index.html','utf8');return r.fulfill({contentType:'text/html',body:html});}
   const file=[base+u.pathname].find(f=>fs.statSync(f,{throwIfNoEntry:false})?.isFile());
   if(file)return r.fulfill({path:file});
   if(u.pathname.includes('/liff-'))return r.fulfill({contentType:'text/javascript',body:'export default {isInClient:()=>false,isLoggedIn:()=>false};'});
   if(u.pathname==='/welcome-sound/welcome.js')return r.fulfill({contentType:'text/javascript',body:'export function enterMemberCenter(){}'});
   return r.fulfill({status:404,body:''});
  }
  if(req.method()==='OPTIONS')return r.fulfill({status:204,headers:heads});
  if(p==='/member/me')return api(r,{name:payload.legalName,alias:null,memberNo:'TW0900000000',phone:payload.phone,email:null,gender:null,birthDate:null,membershipState:'NETWORK_MEMBER',mobileVerifiedAt:stamp,emailVerifiedAt:null});
  if(['/member/qualifications','/member/represented-legal-entities'].includes(p))return api(r,[]);
  if(p==='/member/messages')return api(r,{items:[],asOf:stamp,dataThrough:stamp,nextCursor:null});
  if(p==='/member/formal-enrollment')return api(r,{membershipState:'NETWORK_MEMBER',feeAmount:'0',currency:'TWD',stagePaymentEnabled:false,feeReceipt:null,application:{id:app,status:mode==='crossRace'?'DRAFT':'NEEDS_MORE_INFO',sourceChannel:mode==='paper'?'ADMIN_PAPER':'MEMBER_WEB',applicantType:'INDIVIDUAL'},paidPackages:[],pendingPackages:[],draft:{version,documents:signed?[...docs,'SIGNED_APPLICATION_AGREEMENT']:docs,payload:{...payload,email:savedEmail||payload.email,formalContractVersionId:active?curr:prev}},bundlePayment:null});
  if(p==='/member/contracts/formal-required')return api(r,[mode==='wrongHash'?{...current,contentHash:'f'.repeat(64)}:mode==='wrongId'?{...current,id:prev}:mode==='emptyText'?{...current,content:'   '}:current]);
  if(p.endsWith('/contract-renewal')){if(req.method()==='POST'){const body=req.postDataJSON();assert.deepEqual(body,{confirmed:true,expectedSnapshotHash:oldHash,contractVersionId:curr,contentHash:current.contentHash});assert(!active);active=true;version++;renewals++;}return api(r,view());}
  if(p.endsWith('/documents')&&req.method()==='POST'){assert.equal(req.postDataJSON().documentType,'BANKBOOK_COVER');assert.equal(savedEmail,'edited@example.com');uploads++;return api(r,{scanStatus:'PRESENT'});}
  if(p.endsWith('/documents')){if(mode==='crossRace'&&!active)version=2;return api(r,{applicationId:app,documents:(signed?[...docs,'SIGNED_APPLICATION_AGREEMENT']:docs).map(type=>({type,status:'PRESENT'})),paperReviewed:[],contractRenewal:view(),signingContext:{version,snapshotHash:active?newHash:oldHash,name:payload.legalName,contract:active?current:old}});}
  if(p==='/member/contracts/'+curr+'/consent'){consents++;return api(r,{contractVersionId:curr,acceptedAt:stamp});}
  if(p==='/member/formal-applications'&&req.method()==='POST'){const body=req.postDataJSON();assert.equal(body.expectedVersion,version);assert.equal(body.formalContractVersionId,curr);savedEmail=body.email;saves++;active=true;version++;return api(r,{id:app,status:'DRAFT',version,applicantType:'INDIVIDUAL',identityDocumentNumberMasked:'***6789',bankAccountMasked:'***6789'});}
  return api(r,null);
 });
 try{
  await page.goto('https://member.ucell.life/membership/upgrade');const form=page.locator('form.formal-profile');
  if(mode==='crossRace'){const sig=page.locator('.membership-signature:visible');await sig.getByRole('button',{name:'切換至新版協議並繼續簽名'}).click();await sig.getByRole('button',{name:'開啟並閱讀會員合約'}).waitFor();assert.equal(version,3);await page.getByRole('button',{name:/1會員資料|1 會員資料/}).click();}
  await form.getByText('此手機已完成簡訊驗證，可繼續申請。').waitFor();
  if(mode!=='signedSame')await form.getByLabel(/Email/).fill('edited@example.com');
  const next=form.getByRole('button',{name:'確認，下一步'});await next.click();await next.click();await next.click();
  if(mode==='file'){const blob=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=180;c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,180,100);return c.toDataURL('image/png').split(',')[1];});await form.locator('fieldset:visible input[type=file]').last().setInputFiles({name:'test.png',mimeType:'image/png',buffer:Buffer.from(blob,'base64')});await form.getByRole('button',{name:'向右旋轉'}).waitFor();}
  const save=form.getByRole('button',{name:'儲存資料，前往合約簽名'});await save.click();
  if(mode==='crossRace'){await form.getByText(/申請已由其他畫面更新/).first().waitFor();assert.equal(saves,0);}
  if(['wrongHash','wrongId','emptyText'].includes(mode)){await form.getByText(/請重新取得有效的協議全文/).first().waitFor();assert.equal(await form.getByRole('button',{name:'同意新版並儲存修改，重新簽名'}).count(),0);assert.equal(saves+consents+renewals,0);}
  if(mode==='signedSame'){await page.locator('.membership-signature:visible').first().waitFor();assert.equal(saves+renewals+consents,0);}
  if(mode==='paper'){await form.getByText(/本案需由承辦人/).waitFor();assert.equal(saves+renewals+consents,0);}
  if(['unsigned','race','file'].includes(mode)){
   const panel=form.getByRole('region',{name:'新版會員協議'});await panel.waitFor();assert.equal(saves+renewals,0);await panel.getByRole('button',{name:'切換至新版協議並繼續簽名'}).click();await form.getByText(/已切換至新版協議/).waitFor();assert.equal(renewals,1);assert.equal(saves,0);assert.equal(await form.getByLabel(/Email/).inputValue(),'edited@example.com');
   if(mode==='race')version++;await save.click();
   if(mode==='race'){await form.getByText(/申請已由其他畫面更新/).first().waitFor();assert.equal(saves,0);}
   else {await page.locator('.membership-signature:visible').first().waitFor();assert.equal(saves,1);assert.equal(savedEmail,'edited@example.com');if(mode==='file')assert.equal(uploads,1);}
  }
  if(mode==='signedEdit'){
   const panel=form.locator('section').filter({has:page.getByRole('heading',{name:'儲存修改後需要重新簽名'})});await panel.getByRole('button',{name:'開啟並閱讀會員合約'}).click();const dlg=page.getByRole('dialog');await dlg.getByText(current.content,{exact:true}).waitFor();await dlg.getByRole('checkbox').check();await dlg.getByRole('button',{name:'同意並繼續'}).click();
   assert.equal(consents+saves+renewals,0);await panel.getByRole('button',{name:'同意新版並儲存修改，重新簽名'}).click();await page.locator('.membership-signature:visible').first().waitFor();assert.equal(consents,1);assert.equal(saves,1);assert.equal(renewals,0);assert.equal(savedEmail,'edited@example.com');
  }
  assert.deepEqual(errors,[]);console.log(eng,mode,'pass');
 }catch(e){console.error(mode,errors,(await page.locator('main').innerText().catch(()=>'' )).slice(-2300));throw e;}finally{await page.close();}
}
(async()=>{const b=eng==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge'});try{for(const x of (process.argv.slice(4).length?process.argv.slice(4):['unsigned','signedSame','signedEdit','paper','race','file','crossRace','wrongHash','wrongId','emptyText']))await scenario(b,x);}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
