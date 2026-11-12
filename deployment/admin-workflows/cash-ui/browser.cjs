'use strict';
const {mount}=require('../../admin-interaction/qa/fixtures.cjs');
const {chromium,webkit}=require('playwright-core');
const assert=require('node:assert/strict');
const [site,engine='chromium']=process.argv.slice(2);
const id='00000001-1111-4111-8111-111111111111',stamp='2026-11-13T00:00:00Z';
async function scenario(browser,readonly=false){
  const page=await browser.newPage({serviceWorkers:'block',viewport:{width:900,height:850}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(9000);
  let method='BANK_TRANSFER',version=0;
  const row={id,applicantType:'INDIVIDUAL',sourceChannel:'ADMIN_PAPER',personName:'領取方式測試',paperApplicationReference:'TEST-PAPER',status:'UNDER_REVIEW',createdAt:stamp,updatedAt:stamp};
  await mount(page,site,'DARK');
  await page.route('**/api/v1/**',async route=>{
    const request=route.request(),uri=new URL(request.url()).pathname.slice(7);
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
    const ok=data=>route.fulfill({headers,json:{data,meta:{api_version:'v1',timestamp:stamp}}});
    if(request.method()==='OPTIONS')return route.fulfill({status:204,headers});
    if(readonly&&uri==='/auth/admin/me')return ok({role:'COMPLIANCE_AUDIT',provider:'ENTRA',subject:'測試唯讀'});
    if(uri==='/admin/formal-member-applications')return ok([row]);
    if(uri==='/admin/membership-applications')return ok([]);
    if(uri.endsWith('/formal-member-applications/contracts/required'))return ok([{id,title:'正式會員協議',version:'現行版'}]);
    if(uri.endsWith('/'+id+'/detail'))return ok({...row,payoutMethod:method,payoutMethodVersion:version,personId:id,person:{personId:id},payload:{legalName:row.personName},version:1,paperEvidence:[{type:'BANKBOOK_COVER',status:'PENDING',id}],gate:{ready:false,codes:[]}});
    if(uri.endsWith('/'+id+'/documents'))return ok([]);
    if(uri.endsWith('/'+id+'/payout-method')){
      assert(!readonly);assert(request.headers()['idempotency-key']);const data=request.postDataJSON();
      assert.equal(method,data.expectedMethod);assert.equal(version,data.expectedVersion);
      method=data.method;version++;return ok({method,version,editable:true});
    }
    return route.fallback();
  });
  try {
    await page.goto('https://admin.ucell.life/applications');
    await page.getByRole('button',{name:row.personName,exact:true}).click();
    const panel=page.getByRole('region',{name:'獎金領取方式'});
    await panel.getByText('銀行匯款',{exact:true}).first().waitFor();
    if(readonly){assert.equal(await panel.locator('select').count(),0);return;}
    for(const target of ['COMPANY_CASH','BANK_TRANSFER']){
      await panel.locator('select').selectOption(target);
      await panel.getByRole('button',{name:'儲存領取方式'}).click();
      await panel.locator('strong').getByText(target==='COMPANY_CASH'?'至公司領現金':'銀行匯款',{exact:true}).waitFor();
      assert.equal(await page.locator('.formal-review-editor').getByLabel('銀行帳號').count(),target==='COMPANY_CASH'?0:1);
      assert.equal(await page.locator('#uc-review-documents').getByText('存摺封面',{exact:true}).count()>0,target==='BANK_TRANSFER');
    }
    assert.equal(version,2);
    await page.goto('https://admin.ucell.life/applications/formal-paper');
    await page.getByLabel('領取方式',{exact:true}).selectOption('COMPANY_CASH');
    assert.equal(await page.getByLabel(/銀行帳號/).count(),0);
    assert.equal(await page.getByLabel(/銀行帳戶封面/).count(),0);
    assert(await page.getByLabel(/身分證正面/).count()>0);
    await page.getByLabel('領取方式',{exact:true}).selectOption('BANK_TRANSFER');
    assert(await page.getByLabel(/銀行帳號/).count()>0);
  }catch(e){console.error((await page.locator('main').innerText().catch(()=>'' )).slice(-1600));throw e;}finally{await page.close();assert.deepEqual(errors,[]);}
}
(async()=>{const b=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge'});try{await scenario(b);await scenario(b,true);console.log(engine+' review payout changes, paper intake, read-only: passed');}finally{await b.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
