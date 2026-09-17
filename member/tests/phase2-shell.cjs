// Local shell QA only. All Admin API requests are intercepted; no backend required.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const output=path.resolve(__dirname,'../../governance/ux-v2-phase2');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL||'msedge'});
 const checks=[];
 try {
  const page=await browser.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('**/*',route=>{
   const request=route.request(),url=new URL(request.url());
   if(!['http://127.0.0.1:5184','http://127.0.0.1:5185'].includes(url.origin)||request.method()!=='GET')return route.abort();
   if(url.pathname.startsWith('/api/')){
    if(url.pathname.endsWith('/auth/admin/me')) return route.fulfill({json:{data:{role:'SUPER_ADMIN',subject:'Local shell fixture',provider:'TEST'}}});
    return route.fulfill({status:503,json:{message:'Local shell QA: data unavailable'}});
   }
   return route.continue();
  });
  for(const width of [375,390,430,768]){
   await page.setViewportSize({width,height:844});
   await page.goto('http://127.0.0.1:5184/performance');
   await page.getByRole('navigation',{name:'主要功能',exact:true}).waitFor();
   assert.equal(await page.locator('nav a[aria-current="page"]').innerText(),'收益');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(output,`member-${width}.png`),fullPage:true});
   checks.push(`Member ${width}px: income deep link and no horizontal overflow`);
  }
  await page.goto('http://127.0.0.1:5184/');
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').innerText(),'跳至主要內容');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'),'member-main');
  await page.getByLabel('目前資格').selectOption('q2');
  await page.getByRole('navigation',{name:'主要功能',exact:true}).getByText('收益',{exact:true}).click();
  assert.equal(await page.getByLabel('目前資格').inputValue(),'q2');
  await page.getByRole('navigation',{name:'收益分類'}).getByText('我的業績',{exact:true}).click();
  await page.goBack();
  assert.equal(await page.locator('nav a[aria-current="page"]').innerText(),'收益');
  await page.goForward();await page.reload();
  assert.equal(await page.getByLabel('目前資格').inputValue(),'q2');
  checks.push('Member skip focus, income links, history, reload and Ball persistence');
  await page.addInitScript(()=>sessionStorage.setItem('ucell_admin_token','local-shell-fixture'));
  for(const width of [768,1366,1440]){
   await page.setViewportSize({width,height:900});
   await page.goto('http://127.0.0.1:5185/provider-operations');
   await page.getByRole('navigation',{name:'後台主要功能'}).waitFor();
   assert.equal(await page.locator('.uc-nav-group').count(),8);
   assert.equal(await page.locator('.uc-nav-group[open] summary').innerText(),'系統與發布');
   assert.equal(await page.locator('.sidebar nav a').count(),21);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:path.join(output,`admin-${width}.png`),fullPage:true});
   checks.push(`Admin ${width}px: eight groups, 21 links, current group open and no horizontal overflow`);
  }
  await page.goto('http://127.0.0.1:5185/');
  await page.getByRole('navigation',{name:'後台主要功能'}).waitFor();
  await page.keyboard.press('Tab');
  assert.equal(await page.locator(':focus').innerText(),'跳至主要內容');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('id'),'admin-main');
  checks.push('Admin skip link moves keyboard focus to content');
  for(const [port,width] of [[5184,768],[5185,1440]]){
   await page.setViewportSize({width,height:1000});
   await page.goto(`http://127.0.0.1:${port}/`);
   await page.getByRole('navigation',{name:port===5184?'主要功能':'後台主要功能',exact:true}).waitFor();
   await page.evaluate(()=>document.documentElement.style.zoom='2');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   checks.push(`${port===5184?'Member':'Admin'} 200% CSS zoom reflow: no horizontal overflow (not browser UI zoom certification)`);
  }
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'browser-checks.json'),JSON.stringify({mode:'Local mock Member / intercepted Admin API; not UAT',checks,errors},null,2));
  console.log(checks.join('\n'));
 } finally {await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
