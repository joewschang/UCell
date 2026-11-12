// Isolated browser QA. Start Vite with VITE_ENABLE_MOCK=true and
// VITE_API_BASE_URL=https://api.ucell.life/api/v1, then run this file.
// Optional: GREETING_POSTER_PATH, PLAYWRIGHT_EXECUTABLE_PATH, SCREENSHOT_DIR.
// All external requests are fulfilled locally or blocked. No real LINE messages are sent.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const {readFileSync, mkdirSync} = require('node:fs');
const {join} = require('node:path');

// Compile the deployed overlay entry against the member dependencies, entirely in memory.
async function checkOverlayPlacement(context, origin, apiBase, widths) {
  const {build} = await import('vite');
  const root = join(__dirname, '..');
  const [{output}] = await build({
    root, configFile: false, logLevel: 'error',
    resolve: {alias: {react: join(root, 'node_modules/react'), 'react-dom': join(root, 'node_modules/react-dom')}},
    define: {'process.env.NODE_ENV': '"production"', 'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiBase)},
    esbuild: {jsx: 'automatic'},
    build: {write: false, lib: {entry: join(root, '../deployment/greeting-overlay/member-entry.tsx'), name: 'UCellGreeting', formats: ['iife']}},
  });
  const bundle = output.find(asset => asset.type === 'chunk' && asset.isEntry);
  const css = output.find(asset => asset.type === 'asset' && asset.fileName.endsWith('.css'));
  assert.ok(bundle && css, 'production greeting overlay must build with its stylesheet');

  const page = await context.newPage();
  try {
    // The deployed overlay attaches to a host page that has no React greeting of its own.
    await page.route(origin + '/explore', route => route.fulfill({contentType: 'text/html', body: '<main><section>探索</section></main>'}));
    await page.route('**/greetings/style.css*', route => route.fulfill({contentType: 'text/css', body: css.source}));
    await page.goto(origin + '/explore');
    await page.addScriptTag({content: bundle.code});
    await page.locator('#ucell-greeting-overlay .uc-daily-greeting').waitFor();
    for (const width of widths) {
      await page.setViewportSize({width, height: 960});
      assert.equal(await page.evaluate(() => {
        const main = document.querySelector('main');
        const extra = document.createElement('section');
        main.append(extra);
        return main.lastElementChild === extra;
      }), true);
      await page.waitForFunction(() => document.querySelector('main').lastElementChild.contains(document.querySelector('.uc-daily-greeting')));
    }
  } finally {await page.close();}
}

(async () => {
  const browser = await chromium.launch({headless: true, ...(process.env.PLAYWRIGHT_EXECUTABLE_PATH ? {executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH} : {})});
  const context = await browser.newContext({viewport: {width: 390, height: 844}, acceptDownloads: true});
  const png = readFileSync(process.env.GREETING_POSTER_PATH || join(__dirname, 'fixtures/daily-greeting-2026-11-11.png'));
  const origin = 'http://127.0.0.1:5174';
  const api = 'https://api.ucell.life/api/v1/public/daily-greetings';
  const date = new Intl.DateTimeFormat('en-CA', {timeZone: 'Asia/Taipei'}).format(new Date());
  let failImage = false, failCurrent = false, reads = 0;
  const errors = [], blockedWrites = [];
  try {
    await context.route('**/*', async route => {
      const request = route.request(), url = request.url();
      if (!['GET', 'HEAD'].includes(request.method())) {blockedWrites.push(request.method() + ' ' + url); return route.abort();}
      if (url === api + '/current') {
        reads++;
        assert.equal(request.headers().authorization, undefined, 'public greeting must not receive member credentials');
        if (failCurrent) return route.fulfill({status: 503, headers: {'access-control-allow-origin': origin}, body: 'unavailable'});
        return route.fulfill({contentType: 'application/json', headers: {'access-control-allow-origin': origin}, body: JSON.stringify({data: {
          date, title: '心有暖陽，歲月有光', message: '珍惜相伴的每個日常，願你所遇皆溫柔，所行皆順心', category: '祝福',
          imageUrl: api + '/' + date + '/image.png', shareUrl: api + '/' + date + '/share',
          availableAt: new Date(Date.now() - 3_600_000).toISOString(), nextRefreshAt: new Date(Date.now() + 86_400_000).toISOString(),
          timeZone: 'Asia/Taipei', renderer: 'template-v1',
        }, meta: {request_id: 'browser-daily-test', api_version: 'v1', timestamp: new Date().toISOString()}})});
      }
      if (url === api + '/' + date + '/image.png') return failImage ? route.fulfill({status: 503, headers: {'access-control-allow-origin': origin}, body: 'unavailable'}) : route.fulfill({contentType: 'image/png', headers: {'access-control-allow-origin': origin}, body: png});
      if (['www.facebook.com','www.threads.net','x.com','www.instagram.com'].includes(new URL(url).hostname)) return route.fulfill({contentType:'text/html',body:'<p>Isolated social destination. No post was sent.</p>'});
      if (url.startsWith('https://social-plugins.line.me/lineit/share?')) return route.fulfill({contentType: 'text/html', body: '<p>Isolated LINE link destination. Nothing was sent.</p>'});
      if (new URL(url).origin === origin) return route.continue();
      return route.abort();
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10_000);
    page.on('pageerror', error => errors.push(error.message));
    const widths = [320, 390, 768, 1280];
    for (const width of widths) {
      await page.setViewportSize({width, height: 960});
      await page.goto(origin + '/explore');
      await page.getByRole('heading', {name: '心有暖陽，歲月有光'}).waitFor();
      const poster = page.getByRole('region', {name: '每日問候'});
      await page.waitForFunction(() => {const image = document.querySelector('.uc-daily-art img'); return image?.complete && image.naturalWidth > 0;});
      assert.equal(await poster.getByRole('button', {name: '儲存圖片'}).isEnabled(), true);
      for(const name of ['Facebook 連結分享','Threads 連結分享','X 連結分享'])assert.equal(await poster.getByRole('link',{name,exact:true}).isVisible(),true);
      assert.equal(await poster.locator('.uc-social-logos svg').count(),4);
      assert.equal(await poster.locator('.uc-social-logos').innerText(),'');
      assert.equal(await poster.evaluate(card => card.parentElement.lastElementChild === card), true, 'greeting follows the Explore content');
      await poster.getByRole('button',{name:'Instagram 圖片發布步驟'}).click();
      assert.equal(await poster.getByRole('link',{name:'開啟 Instagram（不會自動帶入圖片）'}).isVisible(),true);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, width + 'px overflow');
      assert.equal(await page.getByRole('link', {name: /影音中心/}).isVisible(), true);
      if (process.env.SCREENSHOT_DIR) {
        mkdirSync(process.env.SCREENSHOT_DIR, {recursive: true});
        await page.screenshot({path: join(process.env.SCREENSHOT_DIR, 'daily-greeting-' + width + '.png'), fullPage: true});
      }
    }
    const download = page.waitForEvent('download');
    await page.getByRole('button', {name: '儲存圖片'}).click();
    assert.equal((await download).suggestedFilename(), `UCell-每日問候-${date}.png`);
    const popupPromise = page.waitForEvent('popup');
    await page.getByRole('link', {name: 'LINE 連結分享', exact: true}).click();
    const popup = await popupPromise;
    await popup.waitForURL(url => url.hostname === 'social-plugins.line.me' && url.pathname === '/lineit/share');
    assert.equal(new URL(popup.url()).searchParams.get('url'), api + '/' + date + '/share');
    await popup.close();
    failImage = true;
    await page.reload();
    await page.getByRole('alert').filter({hasText: '問候圖暫時無法顯示'}).waitFor();
    assert.equal(await page.getByRole('button', {name: '儲存圖片'}).isDisabled(), true);
    assert.equal(await page.getByRole('link', {name: 'LINE 連結分享', exact: true}).getAttribute('aria-disabled'), 'true');
    failImage = false;
    await page.getByRole('button', {name: '重新載入圖片'}).click();
    await page.waitForFunction(() => {const button = document.querySelector('.uc-daily-actions button'); return button && !button.disabled;});
    failCurrent = true;
    await page.reload();
    await page.getByRole('alert').filter({hasText: '每日問候暫時無法載入'}).waitFor();
    assert.equal(await page.getByRole('link', {name: /影音中心/}).isVisible(), true);
    failCurrent = false;
    await page.getByRole('button', {name: '重新載入每日問候'}).click();
    await page.getByRole('heading', {name: '心有暖陽，歲月有光'}).waitFor();
    const previousReads = reads;
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => {const button = document.querySelector('.uc-daily-actions button'); return button && !button.disabled;});
    assert.ok(reads > previousReads, 'visible resume refreshes the greeting');
    await checkOverlayPlacement(context, origin, new URL(api).origin + '/api/v1', widths);
    assert.deepEqual(errors, []);
    assert.deepEqual(blockedWrites, []);
    console.log('Daily greeting browser smoke passed: 320/390/768/1280px, real PNG download, LINE link activation, failures, retries and visibility resume.');
  } finally {await browser.close();}
})().catch(error => {console.error(error); process.exitCode = 1;});
