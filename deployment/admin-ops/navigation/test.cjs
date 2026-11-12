const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium,webkit} = require('playwright-core');
const {patchNavigation} = require('./patch.cjs');
const base = process.env.ADMIN_URL || 'https://admin.ucell.life';
const cssPath = '/admin-ops/navigation/navigation.css';
const live = process.argv.includes('--live');

(async () => {
  const browser = process.env.PW_BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch({executablePath:process.env.CHROME});
  try {
    for (const [role, width, theme] of [
      ['SUPER_ADMIN',1360,'light'], ['SUPER_ADMIN',390,'dark'],
      ['CUSTOMER_SERVICE',320,'light'], ['FINANCE',768,'dark']
    ]) {
      const context = await browser.newContext({viewport:{width,height:844}, colorScheme:theme, serviceWorkers:'block'});
      const page = await context.newPage();
      page.setDefaultTimeout(12000);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.addInitScript(() => sessionStorage.setItem('ucell_admin_token','local-navigation-fixture'));
      let entryPath;
      await page.route('**/*', async route => {
        const req = route.request(), url = new URL(req.url());
        if (url.pathname.startsWith('/api/')) {
          let data = [];
          if (url.pathname.endsWith('/auth/admin/me')) data = {role,subject:'UI fixture'};
          if (url.pathname.endsWith('/admin/faq')) data = {categories:[],items:[]};
          return route.fulfill({json:{data,meta:{request_id:'fixture',api_version:'v1'}}});
        }
        if (!['GET','HEAD'].includes(req.method())) return route.abort();
        if (!live && req.resourceType() === 'document') {
          const response = await route.fetch();
          let html = await response.text();
          entryPath = /<script[^>]+type="module"[^>]+src="([^"]+)"/.exec(html)?.[1];
          assert(entryPath, 'expected module entry point');
          html = html.replace('</head>', '<link rel="stylesheet" href="'+cssPath+'"></head>');
          return route.fulfill({response,body:html});
        }
        if (!live && url.pathname === entryPath) {
          const response = await route.fetch();
          return route.fulfill({response,body:patchNavigation(await response.text())});
        }
        if (!live && url.pathname === cssPath) {
          return route.fulfill({contentType:'text/css',body:fs.readFileSync(path.resolve(__dirname,'../../../admin/src/app/navigation.css'))});
        }
        return route.continue();
      });
      const entry = role === 'FINANCE' ? '/payouts' : role === 'CUSTOMER_SERVICE' ? '/faq' : '/content/greetings';
      await page.goto(base + entry);
      const drawer = page.locator('.uc-ops-directory');
      await drawer.waitFor({state:'attached'});
      const toggle = page.locator('.uc-ops-menu-toggle');
      const search = drawer.getByRole('searchbox',{name:'搜尋後台功能'});
      const links = drawer.locator('nav a');
      if (width < 1024) {
        assert.equal(await toggle.getAttribute('aria-expanded'),'false');
        assert.equal(await drawer.isVisible(),false);
        await toggle.click();
        assert.equal(await drawer.isVisible(),true);
        assert(await page.getByRole('button',{name:'登出'}).isVisible());
      } else assert.equal(await toggle.isVisible(),false);
      const paths = await links.evaluateAll(nodes => nodes.map(n=>n.getAttribute('href')));
      assert(paths.includes(entry));
      assert.equal(paths.length, new Set(paths).size);
      assert.equal(await page.getByRole('searchbox',{name:'搜尋後台功能'}).count(),1);
      if (role === 'SUPER_ADMIN') {
        assert(paths.length > 35);
        for (const [query, expected] of [
          ['ＰＮＡＳＬ','/analytics'], ['組織 二元樹','/organization/binary'], ['對碰樹','/organization/binary'],
          ['會員 ＯＣＲ','/document-intake'], ['法人','/people'],
          ['早安圖','/content/greetings'], ['Tag','/topics/'], ['獎金驗算','/bonuses']
        ]) {
          await search.fill(query);
          await page.waitForFunction(path => [...document.querySelectorAll('.uc-ops-directory nav a')].some(a=>a.getAttribute('href')===path),expected);
          const actual = await links.evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));
          assert.deepEqual(actual,[expected],query);
          assert.equal(await drawer.getByRole('status').textContent(),'找到 1 個功能');
        }
        await search.fill('查無這個詞');
        await drawer.getByText(/沒有符合的功能/).waitFor();
        await search.press('Escape');
        assert.equal(await search.inputValue(),'');
        assert.equal(await links.count(),paths.length);
        await search.fill('二元樹');
        await search.press('ArrowDown');
        assert.equal(await page.evaluate(()=>document.activeElement.getAttribute('href')),'/organization/binary');
        await page.keyboard.press('ArrowUp');
        assert(await search.evaluate(n=>n===document.activeElement));
        await search.fill('常見問題');
        await search.press('Enter');
        await page.waitForURL('**/faq');
        await page.locator('#admin-main h1').filter({hasText:'常見問答管理'}).waitFor();
        assert.equal(await page.locator('.uc-ops-directory a[aria-current="page"]').getAttribute('href'),'/faq');
        await page.goBack();
        await page.waitForURL('**/content/greetings');
        await page.waitForFunction(()=>document.querySelector('.ux-nav-search').value==='');
      } else {
        await search.fill('會員360');
        await drawer.getByText(/沒有符合的功能/).waitFor();
        assert.equal(await links.count(),0);
        await search.fill(role === 'FINANCE' ? '撥款' : '常見問題');
        assert.equal(await links.count(),1);
        assert.equal(await links.first().getAttribute('href'),entry);
        await search.press('Enter');
      }
      if (width < 1024) {
        await page.waitForFunction(()=>document.querySelector('.uc-ops-menu-toggle').getAttribute('aria-expanded')==='false');
        // Hidden menu rows must not push the content below the viewport after route selection.
        assert(await page.locator('#admin-main').evaluate(n=>n.getBoundingClientRect().top<150));
        await toggle.click();
        await search.press('Escape');
        assert(await toggle.evaluate(n=>n===document.activeElement));
      }
      assert(await page.locator('.sidebar').evaluate(n=>n.scrollWidth <= n.clientWidth+1));
      assert.deepEqual(errors,[]);
      console.log('PASS',role,width,theme,paths.length,'authorized destinations');
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
