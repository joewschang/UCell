'use strict';
const assert = require('node:assert/strict');
const { chromium, webkit } = require('playwright-core');
const { mount } = require('../../admin-interaction/qa/fixtures.cjs');
const [site, engine = 'chromium'] = process.argv.slice(2);
const run = '00000001-1111-4111-8111-111111111111', group = '00000002-1111-4111-8111-111111111111';
async function verify(browser, mixed) {
  const page = await browser.newPage({serviceWorkers:'block'});
  await mount(page, site, 'DARK');
  let status = 'APPROVED', results = [], downloads = 0;
  const errors=[];
  page.on('pageerror', error => errors.push(error.message));
  const baseGroup={id:group, memberNo:'QA-CASH', transfer:'300', profile:{legalName:'簽領測試',identityMasked:'****'},lines:[], payoutMethod:'COMPANY_CASH'};
  const groups=[baseGroup];
  if(mixed) groups.push({...baseGroup, id:'00000003-1111-4111-8111-111111111111',memberNo:'QA-BANK',payoutMethod:'BANK_TRANSFER'});
  await page.route('**/api/v1/admin/nhi-payouts**', async route => {
    const req=route.request(), path=new URL(req.url()).pathname;
    const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,OPTIONS'};
    if(req.method()==='OPTIONS') return route.fulfill({status:204,headers});
    let data=[];
    if(path.endsWith('/'+run)) data={id:run,reference:'QA-FIN',status,day:'2026-11-13',snapshot:{groups,totals:{}},events:results.map(payload=>({kind:'PAYMENT',created_at:'2026-11-13T06:00:00Z',payload}))};
    else if(path.endsWith('/nhi-payouts')) data=[{id:run,reference:'QA-FIN',pay_date:'2026-11-13',status}];
    else if(path.endsWith('/downloads/CASH')) {status='EXPORTED';downloads++;data={contentBase64:'Y3N2',fileName:'cash.csv',mediaType:'text/csv'};}
    else if(path.endsWith('/results')) {results.push(req.postDataJSON());data={};}
    return route.fulfill({headers,json:{data,meta:{}}});
  });
  try {
    await page.goto('https://admin.ucell.life/payouts');
    await page.getByRole('button',{name:/QA-FIN/}).click();
    await page.getByText('預計至公司領現金',{exact:true}).waitFor();
    for(const name of ['下載實際匯款清單 CSV','下載銀行專用 XLS']) assert.equal(await page.getByRole('button',{name}).isEnabled(),mixed);
    assert(await page.getByRole('button',{name:/下載補充保費/}).isEnabled());
    await page.getByRole('button',{name:'下載公司領現清單 CSV'}).click();
    const form=page.locator('details').filter({has:page.locator('summary',{hasText:'QA-CASH · 登錄現金簽領'})});
    await form.locator('summary').click();
    assert.equal(downloads,1);
    assert.equal(results.length,0);
    await form.getByLabel('現金簽領憑證編號').fill('QA-CASH-001');
    await form.getByRole('button',{name:'確認現金簽領結果'}).click();
    await page.getByText('QA-CASH · 已簽領現金',{exact:true}).waitFor();
    assert.equal(results.length,1);
    assert.deepEqual([results[0].groupId,results[0].payoutMethod,results[0].status,results[0].amount,results[0].reference],[group,'COMPANY_CASH','PAID','300','QA-CASH-001']);
    assert.equal(await page.getByText('QA-BANK · 登錄銀行結果',{exact:true}).count(),Number(mixed));
    assert.deepEqual(errors,[]);
  } finally {await page.close();}
}
(async()=>{const browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge'});try{await verify(browser,false);await verify(browser,true);console.log(engine+' cash-only and mixed payout download and receipt passed');}finally{await browser.close();}})().catch(error=>{console.error(error);process.exitCode=1;});
