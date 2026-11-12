const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright-core');
const {mount,origin,balls}=require('./fixtures.cjs');
const [site,out]=process.argv.slice(2);
if(!site||!out)throw Error('Usage: node picker.cjs <assembled admin site> <evidence folder>');
async function exercise(browser,width,scheme,engine){
  const phone=width<=760;
  const context=await browser.newContext({viewport:{width,height:phone?844:920},hasTouch:phone,isMobile:phone,colorScheme:scheme,serviceWorkers:'block',reducedMotion:'reduce'});
  const page=await context.newPage();page.setDefaultTimeout(5500);let requests=[];
  await mount(page,site,'AUTO',124);
  page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('/admin/qualifications'))requests.push(Object.fromEntries(new URL(r.url()).searchParams));});
  const rows=page.locator('.qp-row'),pager=page.getByRole('navigation',{name:'球清單分頁'}),search=page.getByRole('searchbox',{name:'搜尋球位'}),status=page.getByRole('combobox',{name:/資格狀態/});
  const detail=page.locator('#ball-detail'),toggle=page.locator('.qp-switch');
  try {
    await page.goto(origin+'/qualifications?source=qa');
    await rows.first().waitFor();assert.equal(await rows.count(),8);
    assert(await pager.getByRole('button',{name:'上一頁'}).isDisabled());
    const coverage=page.getByLabel('顯示重銷效期');await coverage.check();assert.equal(await page.locator('.qp-coverage').count(),8);await coverage.uncheck();
    await pager.getByRole('button',{name:'下一頁'}).click();await rows.first().filter({hasText:'測試會員09'}).waitFor();
    await rows.nth(2).click();await detail.getByText('測試會員11',{exact:true}).first().waitFor();
    assert.equal(new URL(page.url()).searchParams.get('qualificationId'),balls[10].qualificationId);
    assert.equal(new URL(page.url()).searchParams.get('source'),'qa');
    if(phone){assert.equal(await toggle.getAttribute('aria-expanded'),'false');assert(await page.getByRole('button',{name:'切換球位'}).isVisible());await toggle.click();}
    assert(await rows.nth(2).getAttribute('aria-pressed')==='true');assert.match(await pager.textContent(),/第 2 頁/);
    await search.fill(balls[118].currentHolder.phone);await rows.first().filter({hasText:'測試會員119'}).waitFor();assert.equal(await rows.count(),1);
    assert.match(await pager.textContent(),/第 1 頁/);
    assert(await detail.getByText('測試會員11',{exact:true}).first().isVisible()||phone);
    await rows.first().click();await detail.getByText('測試會員119',{exact:true}).first().waitFor();
    const deepLink=page.url();await page.reload();await detail.getByText('測試會員119',{exact:true}).first().waitFor();
    assert.equal(page.url(),deepLink);if(phone)await toggle.click();
    await status.selectOption('SUSPENDED');await page.getByText(/找不到符合條件的球位/).waitFor();await page.getByRole('button',{name:'清除條件'}).click();
    await rows.first().filter({hasText:'測試會員01'}).waitFor();assert.equal(await rows.count(),8);
    // Last page, with more records than the old 100-item retrieval bound.
    for(let index=1;index<16;index++) {
      await pager.getByRole('button',{name:'下一頁'}).click();
      await rows.first().filter({hasText:balls[index*8].currentHolder.legalName}).waitFor();
    }
    assert.equal(await rows.count(),4);assert(await pager.getByRole('button',{name:'下一頁'}).isDisabled());
    await rows.last().click();await detail.getByText('測試會員124',{exact:true}).first().waitFor();
    assert(requests.some(r=>r.page==='16'&&r.take==='8'));
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);assert(overflow<=2);
    console.log(engine,width,scheme,'8 per page; page 2 restored, search and state filters, 124th reachable, selected ID/deep link retained; overflow',overflow);
  }finally{await context.close();}
}
(async()=>{fs.mkdirSync(out,{recursive:true});const engine=process.env.ENGINE||'chromium',browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge',headless:true});try{
  const configs=engine==='webkit'?[[390,'dark']]:[[1366,'light'],[390,'dark']];
  const settled=await Promise.allSettled(configs.map(c=>exercise(browser,...c,engine)));for(const r of settled)if(r.status==='rejected')throw r.reason;
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
