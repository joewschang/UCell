// Mount the assembled admin SPA using a synthetic, isolated application and ledger.
const {chromium}=require('playwright-core');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const [site,evidence]=process.argv.slice(2);
const id='00000000-0000-4000-8000-000000000051', member='測試卓越會員';
const date=new Date(Date.now()-86400000).toISOString();
function group(paid) {
  const purchase=(n,kind)=>({orderId:id.slice(0,-2)+String((kind==='ENTRY'?10:20)+n),orderNo:String(10000+n),packageName:kind==='ENTRY'?'啟航資格':'重銷（三個月）',total:kind==='ENTRY'?'15000.00':'6000.00',status:'CONFIRMED'});
  return {bundleId:id,planCode:'EXCELLENCE',paymentPolicy:'COMBINED',paymentVerified:paid,qualificationTotal:'45000.00',repurchaseTotal:'18000.00',total:'63000.00',rootSponsor:null,
    balls:[1,2,3].map(n=>({position:n,parentPosition:n===1?null:1,side:n===1?null:n===2?'LEFT':'RIGHT',qualificationStatus:'DRAFT',ballNo:null,qualification:purchase(n,'ENTRY'),repurchase:purchase(n,'REPURCHASE')}))};
}
async function test(browser,theme,width) {
  const ctx=await browser.newContext({viewport:{width,height:850},colorScheme:theme});
  const page=await ctx.newPage(),errors=[],writes=[];let paid=false,approved=false;
  const row=()=>({id,personId:id,personName:member,personNameMasked:member,applicantType:'INDIVIDUAL',sourceChannel:'MEMBER_WEB',membershipState:approved?'FORMAL_MEMBER':'FORMAL_PENDING',status:approved?'APPROVED':'UNDER_REVIEW',updatedAt:date});
  const receipt=()=>({bundleId:id,total:'63000.00',paymentPolicy:'COMBINED',report:{amount:'63000.00',paidAt:date,accountLastFive:'12345'},receipt:paid?{amount:'63000',referenceNo:'QA-ONLY',receivedAt:date}:null,
    lines:group().balls.flatMap(b=>[[b.qualification,'ENTRY'],[b.repurchase,'REPURCHASE']].map(([p,kind])=>({position:b.position,orderId:p.orderId,orderNo:p.orderNo,kind,amount:p.total,status:'CONFIRMED',createdAt:date})))});
  await page.addInitScript(t=>{sessionStorage.setItem('ucell_admin_token','fixture-only');localStorage.setItem('ucell.ui-theme-preference.v1',t.toUpperCase());},theme);
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url()),p=u.pathname;
    if(p.startsWith('/api/')){
      const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
      const reply=data=>route.fulfill({headers,json:{data,meta:{request_id:'qa'}}});
      if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
      if(req.method()==='POST'){
        const body=req.postDataJSON();writes.push(p);
        if(p.endsWith('/bundle-payment-confirmations')){assert.equal(body.amount,'63000');paid=true;return reply({receiptId:id});}
        if(p.endsWith('/approve')){assert(paid);approved=true;return reply({status:'APPROVED',approvedQualifications:3});}
        throw Error('Unexpected test write: '+p);
      }
      if(p.endsWith('/auth/admin/me'))return reply({role:'SUPER_ADMIN',subject:'Test administrator'});
      if(p.endsWith('/detail')&&p.includes('formal-member-applications'))return reply({...row(),person:{legalName:member,memberNo:'QA'},payload:{legalName:member},crossLineReviewStatus:'CLEAR',enrollmentBundle:group(paid)});
      if(p.endsWith('/formal-member-applications')||p.endsWith('/formal-member-applications/directory'))return reply([row()]);
      if(p.includes('/admin/orders/')&&p.endsWith(group().balls[0].qualification.orderId))return reply({orderId:group().balls[0].qualification.orderId,enrollmentBundlePayment:receipt()});
      if(p.endsWith('/documents'))return reply([]);
      return reply([]);
    }
    if(u.host!=='admin.ucell.life')return route.fulfill({body:''});
    const file=req.resourceType()==='document'?path.join(site,'index.html'):path.join(site,p);
    if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
    if(p==='/health/journey/inline.js')return route.fulfill({contentType:'text/javascript',body:'export function healthRoute(){return null;}'});
    return route.fulfill({status:404,body:''});
  });
  try {
    await page.goto('https://admin.ucell.life/applications');
    const button=page.getByRole('button',{name:member});
    if(!await button.count())await button.first().waitFor({timeout:10000}).catch(e=>{throw Error('Missing fixture member: '+page.url()+' '+errors.join('|'));});
    await button.first().click();
    const panel=page.getByRole('region',{name:'多球申請審核'});
    await panel.waitFor();assert.match(await panel.textContent(),/卓越方案/);
    assert.equal(await panel.locator('details li').count(),3);assert.match(await panel.textContent(),/待指定/);
    await panel.screenshot({path:path.join(evidence,'review-'+theme+'.png')});
    await panel.getByRole('button',{name:'開啟整組收款核對'}).click();
    const pay=panel.getByRole('region',{name:'整組資格與重銷收款'});await pay.waitFor();
    assert.match(await pay.textContent(),/3 顆球/);assert.equal(await pay.locator('li').count(),6);
    await pay.getByLabel('實收金額（新台幣）').fill('63000');
    await pay.getByLabel('銀行交易序號或收款憑證').fill('QA-ONLY');
    const stamp=await page.evaluate(()=>{const d=new Date(Date.now()-180000);return new Date(d.getTime()-60000*d.getTimezoneOffset()).toISOString().slice(0,19);});
    await pay.getByLabel('實際收款時間').fill(stamp);
    async function confirm(b){await b.click();const dialog=page.getByRole('dialog');const field=dialog.locator('textarea,input').first();if(await field.count())await field.fill('測試資料已核對');await dialog.locator('button').last().click();}
    await confirm(pay.getByRole('button',{name:'確認整組資格與重銷收款'}));
    await pay.getByText(/整組已收款/).waitFor();
    await confirm(page.getByRole('button',{name:'核准整組 3 顆資格'}));
    await page.getByText(/已完成 3 顆資格的整組審核/).waitFor();
    assert.equal(writes.length,2);
    assert.equal(errors.length,0,errors.join('|'));
    console.log(theme,width,'six allocations, one payment, one group approval');
  } finally {await ctx.close();}
}
(async()=>{fs.mkdirSync(evidence,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});try{await test(browser,'light',1100);await test(browser,'dark',390);}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
