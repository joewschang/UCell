// Exercise the verified live member entry's enrollment screen, with synthetic membership and payment records.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('../../../member/node_modules/playwright');
const [candidate,baseCss,screens]=process.argv.slice(2),manifest=require(path.resolve(candidate,'member-manifest.json'));
const src=fs.readFileSync(path.join(candidate,'overlay',manifest.jsPath),'utf8');
const bootstrap='children:r.jsx(ML,{})';
assert.equal(src.split(bootstrap).length,2);
const harness=src.replace(bootstrap,'children:location.pathname.startsWith("/orders/")?r.jsx(XE,{orderNo:"SL00000000031",initiallyOpen:true}):r.jsx(Xm,{})'); // enter the existing formal application after synthetic sign-in
const style=fs.readFileSync(baseCss,'utf8')+'\n'+fs.readFileSync(path.join(candidate,'overlay',manifest.cssPath),'utf8');
const id=(n)=>String(n).padStart(8,'0')+'-1111-4111-8111-111111111111';
const app=id(1),q=id(2),rep=id(3),prod=id(4),now=new Date().toISOString(),phone='0900000000';
const pk={packageVersionId:q,packageCode:'STARTER',displayName:'啟航資格',packageClass:'QUALIFICATION',version:1,currency:'TWD',priceAmount:'4800',selectableProductQuantity:3,selectionMode:'EXACT_QUANTITY',membershipEffect:'FORMAL_MEMBER',qualificationEffect:'CREATE_QUALIFICATION',activeDurationUnit:null,activeDurationValue:null,targetQualificationRequired:false,effectiveFrom:now,effectiveTo:null,configHash:'a'.repeat(64)};
const rp={...pk,packageVersionId:rep,packageCode:'ACTIVE_QUARTER',displayName:'季活躍',packageClass:'ACTIVE_DURATION',priceAmount:'300',selectableProductQuantity:2,activeDurationUnit:'MONTH',activeDurationValue:3,targetQualificationRequired:true};
const product={productRuleProfileId:prod,productId:id(5),sku:'DEMO',displayName:'測試商品',available:true,minQty:1,maxQty:null,selectionIncrement:1,sortOrder:1};
const order=(n,r=false)=>({orderId:String(n),orderNo:'SL'+String(n).padStart(11,'0'),packageName:r?rp.displayName:pk.displayName,total:r?'300':'5400',status:'CONFIRMED',paymentDeadline:new Date(Date.now()+3600000).toISOString()});
const contract={id:id(12),title:'正式會員合約',content:'測試用合約',contentHash:'b'.repeat(64),acceptedAt:now,version:'測試'};
const documentTypes=['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER','SIGNED_APPLICATION_AGREEMENT'];
const fixture=(receipt,report)=>({membershipState:'NETWORK_MEMBER',feeAmount:'0',currency:'TWD',stagePaymentEnabled:false,feeReceipt:null,application:{id:app,status:'DRAFT',sourceChannel:'MEMBER_WEB',applicantType:'INDIVIDUAL'},paidPackages:[],pendingPackages:[],draft:{version:1,documents:documentTypes,payload:{phone}},bundlePayment:receipt?{bundleId:receipt.bundleId,qualificationCount:3,paidQualifications:0,qualificationTotal:'16200',outstandingQualificationTotal:'16200',currency:'TWD',rootOrderId:'10',rootPaid:false,paymentReported:!!report}:null});
(async()=>{
const browser=await chromium.launch({channel:'msedge',headless:true});
try{for(const [theme,width,excellence] of [['light',1024,false],['dark',390,false],['light',1024,true],['dark',390,true]]){
 const total=excellence?'17100':'16800', formatted=excellence?'17,100':'16,800';
 const context=await browser.newContext({viewport:{width,height:844},colorScheme:theme}),page=await context.newPage();
 const errors=[],requests=[];let receipt=null,report=null,created=null,submitted=false,settled=false,approved=false,eligibility='individual';
 page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(String(e)));
 const fakeOrigin='https://member.example.test';
 await page.route('**/*',async route=>{
   const req=route.request(),url=new URL(req.url()),p=url.pathname,body=req.postDataJSON?.();
   if(p==='/membership/upgrade'||p==='/orders/SL00000000031/payment')return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="zh-Hant" data-theme="'+theme+'"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/style.css"></head><body><div id="root"></div><script type="module" src="/candidate.js"></script></body></html>'});
   if(p==='/style.css')return route.fulfill({contentType:'text/css',body:style});
   if(p.startsWith('/assets/liff-'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(candidate,'..','liff-sdk.js'))});
   if(p==='/welcome-sound/welcome.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(candidate,'..','welcome.js'))});
   if(p==='/candidate.js')return route.fulfill({contentType:'text/javascript',body:harness});
   if(!p.startsWith('/api/v1/'))return route.fulfill({status:404,body:''});
   const headers={'Access-Control-Allow-Origin':fakeOrigin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET, POST, OPTIONS'};
   if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
   const api=p.slice(7);requests.push([req.method(),api]);let data;
   if(api==='/member/formal-enrollment'){data=fixture(receipt,report);
     if(settled&&data.bundlePayment)data.bundlePayment.rootPaid=true;
     if(approved){data.membershipState='FORMAL_MEMBER';data.application.status='APPROVED';}
     if(eligibility==='paper')data.application.sourceChannel='ADMIN_PAPER';if(eligibility==='corporate')data.application.applicantType='LEGAL_ENTITY';}
   else if(api==='/member/order-payments/SL00000000031')data={enrollmentBundle:{combinedPayment:true,isEntry:false,applicationId:app},orderNo:'SL00000000031',total:'300',report:null,receipts:[],canReport:false};
   else if(api==='/member/contracts/formal-required')data=[contract];
   else if(api==='/member/represented-legal-entities')data=[];
   else if(api==='/member/me')data={name:'測試會員',alias:null,memberNo:'TW0900000000',email:null,phone,gender:null,birthDate:null,membershipState:'NETWORK_MEMBER',mobileVerifiedAt:now,emailVerifiedAt:null};
   else if(api.endsWith('/documents'))data={documents:documentTypes.map(type=>({type,status:'PRESENT'})),paperReviewed:['SIGNED_APPLICATION_AGREEMENT'],signingContext:null};
   else if(api==='/member/packages')data=[url.searchParams.get('class')==='QUALIFICATION'?pk:rp];
   else if(api.endsWith('/products'))data={package:api.includes(q)?pk:rp,products:[product]};
   else if(api==='/member/package-quote'){const qual=body.packageVersionId===q;data={packageVersionId:body.packageVersionId,originalAmount:qual?'4800':'300',goodsAmount:qual?'4800':'300',qualificationFee:qual?'600':'0',discountAmount:'0',total:qual?'5400':'300',selectableProductQuantity:qual?3:2,quoteHash:(qual?'a':'b').repeat(64),couponCode:null};}
   else if(api==='/member/delivery-profile')data={recipientName:null,phone:null,countryCode:'TW',postalCode:null,region:null,city:null,address:null,complete:false,updatedAt:null};
   else if(api.endsWith('/bundle')){if(req.method()==='POST'){
       assert(req.headers()['idempotency-key']);created=body;assert.equal(body.balls.length,3);assert.deepEqual(body.balls.map(b=>!!b.repurchase),[true,true,excellence]);assert.equal(body.planCode,excellence?'EXCELLENCE':undefined);
       assert.equal(body.sponsorCode,undefined);assert.equal(body.fulfillmentMethod,'COMPANY_PICKUP');
       for(const b of body.balls){for(const p of [b.qualification,b.repurchase].filter(Boolean))assert.deepEqual(p.selections,[{productRuleProfileId:prod,quantity:p.packageVersionId===q?3:2}]);}
       receipt={planCode:excellence?'EXCELLENCE':'CUSTOM',paymentPolicy:'COMBINED',payableTotal:total,bundleId:id(10),applicationId:app,rootSponsor:null,qualificationTotal:'16200',repurchaseTotal:excellence?'900':'600',total,currency:'TWD',mayRestart:false,balls:body.balls.map((b,i)=>({position:i+1,parentPosition:i===0?null:1,side:[null,'LEFT','RIGHT'][i],qualificationId:id(20+i),ballNo:null,qualificationStatus:'PENDING',placementStatus:'PLANNED',qualification:order(10+i),repurchase:b.repurchase?order(30+i,true):null,repurchasePayable:false}))};if(theme==='dark')return route.fulfill({status:503,headers,contentType:'application/json',body:JSON.stringify({message:'Test lost acknowledgement'})});}data=receipt;}
   else if(api.endsWith('/bundle/sponsor-candidate'))data={ballNo:url.searchParams.get('code'),name:'測試推薦人'};
   else if(api.endsWith('/root-sponsor')){receipt.rootSponsor={ballNo:body.sponsorCode,name:'測試推薦人'};data=receipt.rootSponsor;}
   else if(api.endsWith('/payment-report')){if(req.method()==='POST'){assert.equal(body.amount,total);report={...body,bundleId:id(10),actorReportedAt:now};}data=report;}
   else if(api.endsWith('/submit')){assert(!body);submitted=true;data={id:app};}
   else data=null;
   return route.fulfill({contentType:'application/json',headers,body:JSON.stringify({data,meta:{api_version:'v1',request_id:'fixture',timestamp:now}})});
 });
 try{
 await page.goto(fakeOrigin+'/membership/upgrade');
 await page.getByRole('button',{name:'繼續選擇資格套組'}).click();
 if(!excellence&&theme==='light'){
   await page.getByRole('button',{name:'選擇套組商品'}).first().click();
   await page.getByRole('button',{name:'返回套組清單'}).click();
 }
 await page.getByRole('button',{name:excellence?'選擇卓越方案':'開始多球申購'}).click();
 if(excellence){assert(!await page.getByLabel('本次資格球數').count());assert.equal(await page.locator('.eb-tree-three li').count(),3);}else await page.getByLabel('本次資格球數').fill('3');
 assert(await page.getByText('第 1 球的右區').isVisible());
 const sponsorInput=page.getByLabel('第 1 球推薦球號（選填）');await sponsorInput.fill('TW0900000000-01');await page.getByText(/推薦球已核對.*測試推薦人/).waitFor();await sponsorInput.fill('');
 await shot('tree');await page.getByRole('button',{name:'下一步，逐球選購'}).click();
 if(!excellence)await page.getByLabel('會員資格套組',{exact:true}).selectOption(q);
 for(let i=0;i<3;i++)await page.locator('.eb-package').first().getByRole('button',{name:'增加測試商品'}).click();
 if(!excellence)await page.getByLabel('第 1 球的重銷套組（選購）').selectOption(rep);
 for(let i=0;i<2;i++)await page.locator('.eb-package').last().getByRole('button',{name:'增加測試商品'}).click();
 assert(!(await page.locator('section.eb').innerText()).includes('季活躍'));
 assert((await page.locator('section.eb').innerText()).includes('重銷（三個月）'));
 await shot('packages');
 if(theme==='light'){await page.getByRole('button',{name:/套用到其餘 2 顆空白球/}).click();await page.getByLabel('正在設定的球').selectOption('2');}
 else {await page.getByRole('button',{name:'繼續設定其他球'}).click();await page.getByRole('button',{name:'套用上一球的套組與商品'}).click();
   await page.getByRole('button',{name:'繼續設定其他球'}).click();await page.getByRole('button',{name:'套用上一球的套組與商品'}).click();}
 if(!excellence)await page.getByLabel('第 3 球的重銷套組（選購）').selectOption('');
 await page.getByRole('button',{name:'核對整組訂單'}).click();
 await page.getByLabel('取貨方式',{exact:true}).selectOption('COMPANY_PICKUP');
 await page.getByText('NT$ '+formatted,{exact:true}).waitFor();await shot('review');
 await page.getByRole('button',{name:'確認送出 3 顆球的訂單'}).click();
 await page.getByRole('heading',{name:'整組合併付款'}).waitFor();
 await page.getByLabel('第 1 球推薦球號',{exact:true}).fill('TW0900000000-01');
 await page.getByText(/推薦球已核對.*測試推薦人/).waitFor();
 await page.getByRole('button',{name:'確認第 1 球推薦人'}).click();
 await page.getByRole('button',{name:'確認第 1 球推薦人'}).waitFor({state:'hidden'});
 await page.getByLabel('匯出帳號末五碼').fill('03123');
 await page.getByRole('button',{name:'回報本次合併匯款'}).click();
 await page.getByText('已回報 NT$ '+formatted,{exact:false}).waitFor();await shot('receipt');
 if(excellence){await page.goto(fakeOrigin+'/orders/SL00000000031/payment');
   const groupLink=page.getByRole('link',{name:'查看整組付款'}),target=await groupLink.getAttribute('href');
   assert.equal(target,'/membership/upgrade?bundlePayment='+app);assert.equal(await page.locator('form').count(),0);assert(!await page.getByText('應付金額：',{exact:false}).count());
   await page.goto(fakeOrigin+target);await page.getByRole('heading',{name:'整組合併付款'}).waitFor();
   await page.goto(fakeOrigin+'/membership/upgrade');
 }
 await page.reload();await page.getByRole('button',{name:'繼續確認送審'}).waitFor();
 await page.getByRole('button',{name:/4付款確認|4 付款確認/}).click();
 assert(!await page.getByRole('button',{name:'回報本次合併匯款'}).count());
 receipt.balls[1].repurchasePayable=true;await page.getByRole('button',{name:'更新訂單進度'}).click();
 await page.locator('summary').filter({hasText:'第 2 球'}).first().click();
 assert(!(await page.locator('.eb-receipt-line').nth(1).innerText()).includes('季活躍'));
 const link=page.getByRole('link',{name:'前往第 2 球的重銷付款 →'});assert.equal(await link.count(),0);
 if(!excellence){receipt.paymentPolicy='QUALIFICATION_ONLY';receipt.payableTotal='16200';report.amount='16200';await page.getByRole('button',{name:'更新訂單進度'}).click();
   await page.getByRole('heading',{name:'資格合併付款'}).waitFor();const historical=page.locator('.eb-receipt-line').nth(1);if(!await historical.evaluate(el=>el.open))await historical.locator('summary').click();assert.equal(await link.getAttribute('href'),'/orders/'+order(31,true).orderNo+'/payment');}
 receipt.balls[0].qualification.paymentDeadline=new Date(Date.now()-1000).toISOString();await page.getByRole('button',{name:'更新訂單進度'}).click();
 await page.getByText(/聯絡公司人工核對，請勿再次匯款/).waitFor();
 await page.getByRole('button',{name:'繼續送出申請 →'}).click();
 await page.getByRole('button',{name:'確認送出正式會員申請'}).click();
 await page.waitForTimeout(200);assert(submitted&&created);assert.deepEqual(errors,[]);
 assert.equal(requests.filter(([m,p])=>m==='POST'&&p.endsWith('/bundle')).length,1);
 // A settled combined group may reach approval before its root sponsor and setup exist.
 settled=true;receipt.rootSponsor=null;
 for(const b of receipt.balls){b.qualificationStatus='DRAFT';b.placementStatus=null;}
 if(!excellence)for(const b of receipt.balls){b.qualification.status='PAID';b.qualification.paymentDeadline=new Date(Date.now()+60000).toISOString();}
 if(excellence){await page.goto(fakeOrigin+'/membership/upgrade?bundlePayment='+app);
   await page.getByLabel('第 1 球推薦球號',{exact:true}).waitFor();
   await page.getByText('整組款項已核對。',{exact:false}).waitFor();
 }
 approved=true;await page.reload();await page.getByRole('heading',{name:'新增會員資格'}).waitFor();
 const sponsorField=page.getByLabel('第 1 球推薦球號',{exact:true});
 if(excellence){
   await sponsorField.fill('TW0900000000-03');await page.getByText(/推薦球已核對.*測試推薦人/).waitFor();
   const before=requests.filter(([m,p])=>m==='POST'&&p.endsWith('/root-sponsor')).length;
   await page.getByRole('button',{name:'確認第 1 球推薦人'}).click();await sponsorField.waitFor({state:'hidden'});
   assert.equal(receipt.rootSponsor.ballNo,'TW0900000000-03');
   assert.equal(requests.filter(([m,p])=>m==='POST'&&p.endsWith('/root-sponsor')).length,before+1);
   await page.reload();await page.getByText('第 1 球組外推薦　TW0900000000-03 · 測試推薦人',{exact:true}).waitFor();
   assert.equal(await page.getByRole('button',{name:'回報本次合併匯款'}).count(),0);
 }else {await page.getByRole('heading',{name:'資格合併付款'}).waitFor();assert.equal(await sponsorField.count(),0);}
 approved=false;settled=false;
 receipt=null;report=null;eligibility='paper';await page.reload();await page.getByRole('button',{name:'繼續選擇資格套組'}).click();await page.getByRole('heading',{name:'公司正在處理紙本資格套組訂單'}).waitFor();assert.equal(await page.getByRole('button',{name:'開始多球申購'}).count(),0);
 eligibility='corporate';await page.reload();await page.getByRole('button',{name:'繼續選擇資格套組'}).click();await page.getByRole('heading',{name:'選擇會員資格套組',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'開始多球申購'}).count(),0);
 console.log('PASS',excellence?'excellence':'custom',theme,width,'3 balls, per-ball repurchase, combined payment, sponsor, reload, exact repurchase order, submit');
 }catch(e){console.error('requests',requests,'errors',errors,'disabled',await page.locator('.eb-counter button').evaluateAll(nodes=>nodes.map(x=>[x.ariaLabel,x.disabled])),'page',(await page.locator('body').innerText()).slice(-2300));throw e;}finally{await context.close();}
 async function shot(name){const eb=page.locator('section.eb').first();assert(await eb.evaluate(e=>e.scrollWidth<=e.clientWidth+1));if(screens){fs.mkdirSync(screens,{recursive:true});await eb.screenshot({path:path.join(screens,(excellence?'excellence':'custom')+'-'+theme+'-'+name+'.png')})}}
}}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
