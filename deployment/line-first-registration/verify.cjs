const { chromium } = require('../../member/node_modules/playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({channel:'chrome'});
  try {
    for (const scenario of ['new-line', 'browser', 'returning-line']) {
      const page = await browser.newPage();
      await page.route('**/assets/member-line-entry-*.js', async route => {
        const response = await route.fetch();
        const code = await response.text();
        const marker = 'async function P1(){';
        assert.equal(code.split(marker).length, 2);
        const loggedIn = scenario !== 'browser';
        const sdk = 'const Ze={init:async()=>{},isLoggedIn:()=>'+loggedIn+',isInClient:()=>'+loggedIn+',getIDToken:()=>"test-id"};';
        await route.fulfill({response, body:code.replace(marker, marker+sdk)});
      });
      let returned = false;
      await page.route('**/auth/member/line/exchange', route => {
        if (scenario === 'returning-line') returned = true;
        return route.fulfill(returned ? {json:{data:{accessToken:'test-member',expiresAt:new Date(Date.now()+60000).toISOString()},meta:{api_version:'v1',request_id:'test',timestamp:new Date().toISOString()}}} : {status:401,json:{code:'LINE_ACCOUNT_UNBOUND'}});
      });
      page.on('pageerror',e=>console.error(e.message)); await page.goto('https://member.ucell.life/', {waitUntil:'domcontentloaded'});
      if (scenario === 'new-line') {
        await page.locator('form.uc-auth-form input[autocomplete=name]').waitFor();
        await page.getByText('會員姓名',{exact:false}).first().waitFor();
      } else if (scenario === 'browser') {
        await page.getByText('歡迎回來，請使用已綁定的方式登入。').waitFor();
      } else {
        await page.waitForFunction(()=>sessionStorage.getItem('ucell_member_token')==='test-member');
        assert(returned);
      }
      await page.close();
      console.log('PASS',scenario);
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});


