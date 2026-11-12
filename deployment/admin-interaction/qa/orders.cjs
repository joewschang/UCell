const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright-core');
const {mount,origin,balls}=require('./fixtures.cjs');
const [site,out]=process.argv.slice(2);if(!site||!out)throw Error('Usage: node orders.cjs <admin build> <evidence folder>');
const productId='11111111-0000-4000-8000-000000000001',oid='22222222-0000-4000-8000-000000000001';
const stamp='2026-11-12T04:00:00Z',product={productId,sku:'QA-EX',displayName:'範例商品',currentPrice:'250',unit:'盒',status:'ACTIVE',isActive:true,ruleProfiles:[]};
function record(id,paid=false) {
 return {orderId:id,orderNo:paid?'10021':'10023',publicOrderNo:paid?'SL00000010021':'SL00000010023',displayOrderNo:paid?'SL00000010021':'SL00000010023',purpose:'RETAIL',status:paid?'PAID':'CONFIRMED',netAmount:'500',grossAmount:'500',currency:'TWD',
   createdAt:stamp,confirmedAt:stamp,qualificationId:balls[0].qualificationId,qualification:{...balls[0]},purchaserPerson:{legalName:balls[0].currentHolder.legalName,memberNo:'QA01'},links:{},lines:[{lineNo:1,orderLineId:productId,productId,skuSnapshot:'QA-EX',productNameSnapshot:product.displayName,productName:product.displayName,quantity:'2',unitPrice:'250',netAmount:'500',lineAmount:'500',product}],paymentEvents:[],payments:[],fulfillments:[],fulfillmentMethod:'COMPANY_PICKUP'};
}
async function check(browser,width,theme,role){
  const page=await browser.newPage({viewport:{width,height:850},hasTouch:width<500,isMobile:width<500,colorScheme:theme,serviceWorkers:'block'});page.setDefaultTimeout(6500);
  const bundleId=oid.slice(0,-1)+'3',bundleRow=record(bundleId),other=oid.slice(0,-1)+'4';bundleRow.purpose='ENTRY';bundleRow.createdAt='2026-11-01T00:00:00Z';
  bundleRow.enrollmentBundlePayment={bundleId:'qa-group',total:'1000',lines:[bundleId,other].map((orderId,i)=>({orderId,orderNo:String(30001+i),position:i+1,status:'CONFIRMED',amount:'500',createdAt:bundleRow.createdAt,paymentDeadline:null})),report:{amount:'1000',accountLastFive:'12345',paidAt:'2026-11-02T01:10:00Z'},receipt:null};
  let createdKey;const correctionId=oid.slice(0,-1)+'5',newOrderId=oid.slice(0,-1)+'6';const seen=[],errors=[],rows=[record(oid.slice(0,-1)+'2',true),bundleRow,record(correctionId)];let note='',archived=false;
  page.on('pageerror',e=>errors.push(e.message));
  await mount(page,site,theme.toUpperCase());
  await page.route('**/api/v1/**',async r=>{
    const req=r.request(),u=new URL(req.url()),p=u.pathname.slice('/api/v1'.length),method=req.method();
    const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,POST,OPTIONS'};
    const reply=(data,meta={})=>r.fulfill({headers,json:{data,meta:{api_version:'v1',request_id:'qa',timestamp:stamp,page:1,take:20,hasNext:false,...meta}}});
    if(method==='OPTIONS')return r.fulfill({status:204,headers});
    if(p==='/auth/admin/me')return reply({role,provider:'ENTRA',subject:'測試後台'});
    if(p==='/admin/orders/product-options'||p==='/admin/products')return reply([product]);
    if(p==='/admin/orders/qualification-options'||p==='/admin/qualifications')return reply([balls[0]]);
    if(p==='/admin/orders'&&method==='GET')return reply(rows.filter(row=>!archived||row.orderId!==oid),{total:rows.length});
    if(p==='/admin/orders'&&method==='POST'){
      assert.equal(role,'SUPER_ADMIN');const body=req.postDataJSON();
      const key=req.headers()['idempotency-key'];assert(key);if(createdKey){assert.equal(key,createdKey,'lost response must reuse the original key');return reply(rows.find(x=>x.orderId===oid));}createdKey=key;
      seen.push({op:'create',body,key});
      assert.equal(body.qualificationId,balls[0].qualificationId);assert.equal(body.items.length,1);assert.equal(body.items[0].productId,productId);assert.equal(Number(body.items[0].quantity),2);
      rows.unshift(record(oid));return width<500?r.fulfill({status:503,headers,json:{code:'SERVICE_UNAVAILABLE'}}):reply(rows[0]);
    }
    const m=p.match(/^\/admin\/orders\/([^/]+)(?:\/(.+))?$/);if(!m)return r.fallback();
    const row=rows.find(x=>x.orderId===m[1]);if(!row)return r.fulfill({status:404,headers,json:{error:{code:'NOT_FOUND'}}});
    if(!m[2]&&method==='GET')return reply(row);
    if(m[2]==='bundle-payment-confirmations'&&method==='POST'){assert.equal(role,'SUPER_ADMIN');const body=req.postDataJSON();assert.equal(body.amount,'1000.00');assert.equal(body.paymentMethod,'BANK_TRANSFER');assert.equal(body.referenceNo,'QA-BANK');assert(req.headers()['idempotency-key']);seen.push({op:'RECEIPT'});bundleRow.enrollmentBundlePayment.receipt={amount:'1000.00',referenceNo:'QA-BANK',receivedAt:stamp};return reply({});}
    if(m[2]==='maintenance'&&method==='GET')return reply({version:'a'.repeat(64),canReplace:!archived&&row.status==='CONFIRMED',canVoid:!archived&&row.status==='CONFIRMED',canArchive:false,canRebuild:false,note,archived,history:[],blockers:row.status==='PAID'?['已有收款']:[]});
    if(m[2]==='maintenance'&&method==='POST'){assert.equal(role,'SUPER_ADMIN');const body=req.postDataJSON();assert(body.reason.trim());assert.equal(body.version,'a'.repeat(64));seen.push({op:body.action,reason:body.reason,key:req.headers()['idempotency-key']});if(body.action==='REPLACE'){assert.deepEqual(body.replacement.items,[{productId,quantity:'3'}]);assert.equal(body.replacement.expectedTotal,'750.00');row.status='VOIDED';rows.push(record(newOrderId));return reply({orderId:row.orderId,replacementOrderId:newOrderId});}if(body.action==='RESTORE')archived=false;if(body.action==='NOTE')note=body.note;if(body.action==='VOID'){assert.equal(row.status,'CONFIRMED');row.status='VOIDED';archived=true;}return reply({archived,note,orderId:row.orderId});}
    return reply([]);
  });
  async function button(name){await page.getByRole('button',{name}).first().click();}
  async function confirm(reason){const dialog=page.getByRole('dialog');await dialog.waitFor();await dialog.locator('textarea,input').first().fill(reason);await dialog.getByRole('button',{name:/^確認$|確定/}).last().click();}
  try{
    await page.goto(origin+'/orders');
    const add=page.getByRole('button',{name:/^新增訂單$/});
    if(role!=='SUPER_ADMIN'){await page.getByRole('heading',{name:/訂單/}).first().waitFor();assert.equal(await add.count(),0);await page.goto(origin+'/orders?orderId='+bundleId);await button(/^收款$/);await page.getByText(/會員回報匯款/).waitFor();assert.equal(await page.getByRole('button',{name:/^確認整組/}).count(),0);return;}
    await add.click();
    const lookup=page.getByRole('textbox',{name:/歸屬球位/}).or(page.getByRole('searchbox',{name:/歸屬球位/})).first();await lookup.fill('測試');await button(/測試會員01/);
    const purpose=page.getByRole('combobox',{name:/訂單用途/});await purpose.selectOption('RETAIL');
    await button(/下一步.*商品/);const items=page.getByRole('combobox',{name:/加入商品/});await items.selectOption(productId);
    const qty=page.getByRole('textbox',{name:/數量/}).first();await qty.fill('0');assert(await page.getByRole('button',{name:/下一步.*核對訂單/}).isDisabled());await qty.fill('1.2345');assert.match(await page.locator('.ow-estimate').innerText(),/TWD 308\.63/);await qty.fill('2');await button(/下一步.*核對訂單/);assert.match(await page.locator('.ow-estimate').innerText(),/TWD 500\.00/);assert.match(await page.locator('.ow-subtotal').innerText(),/TWD 500\.00/);
    assert.equal(seen.length,0,'review must not create an order');await page.screenshot({path:path.join(out,'orders-'+width+'-'+theme+'-review.png')});
    await button(/確認建立訂單/);if(width<500)await button(/重試建立訂單/);
    await page.getByRole('button',{name:/修改與作廢/}).first().waitFor();
    assert.equal(seen.filter(s=>s.op==='create').length,1);
    await button(/修改與作廢/);
    await button(/^修改作業備註$/);await page.locator('textarea').first().fill('拆兩盒配送');
    await button(/確認修改作業備註/);await confirm('核對會員備註');
    await page.getByText(/備註已儲存/).first().waitFor();assert.equal(note,'拆兩盒配送');
    await button(/^作廢未付款訂單$/);await button(/確認.*作廢/);assert(!archived);await confirm('測試誤建');
    await page.getByText(/已移至.*紀錄|作廢完成|已作廢/).first().waitFor();assert(archived);assert.deepEqual(seen.map(r=>r.op),['create','NOTE','VOID']);
    await button(/^恢復清單顯示$/);await confirm('測試還原清單可見');await page.getByRole('status').filter({hasText:/已恢復清單顯示/}).waitFor();assert.equal(archived,false);assert.equal(rows[0].status,'VOIDED');
    for(const item of seen)assert(item.key,'idempotency key '+item.op);
    await page.goto(origin+'/orders?orderId='+rows[1].orderId);await button(/修改與作廢/);await page.getByRole('button',{name:'修改作業備註'}).waitFor();assert(!await page.getByRole('button',{name:/^作廢未付款訂單$/}).count());
    await page.goto(origin+'/orders?orderId='+bundleId);await button(/^核對整組收款$/);await page.getByText(/會員回報匯款/).waitFor();await page.getByText(/查看逐球分攤金額/).click();assert(await page.getByText(/第 2 球/).isVisible());
    const settle=page.getByRole('button',{name:/^確認整組資格/});assert(await settle.isDisabled());
    await page.getByLabel(/銀行交易序號或收款憑證/).fill('QA-BANK');await page.getByLabel(/實際收款時間/).fill('2026-11-02T12:00');const amount=page.getByLabel(/實收金額/);await amount.fill('999');assert(await settle.isDisabled());await amount.fill('1000.00');await settle.click();await confirm('測試整組核帳');
    await page.getByText(/整組已收款.*QA-BANK/).waitFor();assert.equal(seen.filter(x=>x.op==='RECEIPT').length,1);
    await page.goto(origin+'/orders?orderId='+correctionId);await button(/^修改與作廢$/);await button(/^修改商品／套組$/);await page.getByLabel(/^數量 1$/).fill('3');await button(/^確認修改訂單並建立更正單$/);await confirm('測試更正數量');await page.getByRole('status').filter({hasText:/更正完成/}).waitFor();await page.getByRole('link',{name:/查看更正後的新訂單/}).click();assert.equal(new URL(page.url()).searchParams.get('orderId'),newOrderId);assert.equal(seen.filter(x=>x.op==='REPLACE').length,1);
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+2),false);assert.deepEqual(errors,[]);
    console.log(width,theme,role,'create/read/note/void + reason, paid guard; only fixture writes');
  }catch(e){console.log('FAIL view',page.url(),(await page.locator('body').innerText()).slice(-1200),errors,seen);throw e;}finally{await page.close();}
}
(async()=>{fs.mkdirSync(out,{recursive:true});const engine=process.env.ENGINE||'chromium';const b=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge'});
try{const cases=engine==='webkit'?[[390,'dark','SUPER_ADMIN']]:[[1366,'light','SUPER_ADMIN'],[390,'dark','SUPER_ADMIN'],[390,'dark','COMPLIANCE_AUDIT']];const result=await Promise.allSettled(cases.map(c=>check(b,...c)));for(const r of result)if(r.status==='rejected')throw r.reason;}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
