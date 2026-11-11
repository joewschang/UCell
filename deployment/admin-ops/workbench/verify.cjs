// Test actual admin assets using browser-isolated API fixtures. No real login or writes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium} = require('playwright-core');
const {patchWorkbench} = require('./patch.cjs');
const {patchNavigation} = require('../navigation/patch.cjs');
const origin = process.env.SITE_ORIGIN || 'https://admin.ucell.life';
const input = process.argv[2]==='--live' ? undefined : process.argv[2]; // Optional pre-release bundle.
const bundle = input && patchWorkbench(patchNavigation(fs.readFileSync(input, 'utf8')));
const css = input ? ['../../../admin/src/app/navigation.css','../../../admin/src/app/contrast.css','workbench.css']
  .map(file=>fs.readFileSync(path.join(__dirname,file),'utf8')).join('\n') : '';
const staticFiles = new Map();
const now = '2026-11-12T01:09:00.000Z';
const groups = [
  {code:'ZERO',title:'等待備貨',owner:'物流',hours:48,count:0,overdue:0},
  {code:'REVIEW',title:'申請審核',owner:'會員營運',hours:24,count:7,overdue:0},
  {code:'PAID',title:'回報付款',owner:'財務',hours:8,count:2,overdue:2}
];
const marketing = {
  asOf:now, summary:{links:15,visitors:21,registrations:3,sharingBalls:7,balls:9,boundMembers:5,members:9},
  segments:{CONNECT:2,START:3}, page:1,total:0,rows:[]
};
const summary = {
  generatedAt:now,ruleVersionCode:'QA',members:5,companies:1,persons:4,qualifications:6,
  activeQualifications:4,applications:{submitted:3},orders:{today:1,month:2},recoveries:{open:0},payable:{open:0}
};
async function exercise(browser, role, mode, theme, width) {
  const page = await browser.newPage({viewport:{width,height:850},colorScheme:theme,serviceWorkers:'block'});
  page.setDefaultTimeout(8000);
  const calls = [], errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  let fail = mode === 'error';
  await page.addInitScript(role => {
    sessionStorage.setItem('ucell_admin_token','ui-fixture-token');
    sessionStorage.setItem('ucell_admin_user',JSON.stringify({role,provider:'ENTRA'}));
  }, role);
  await page.route('**/*', async route => {
    const req = route.request(), url = new URL(req.url());
    if (!['GET','HEAD'].includes(req.method())) throw new Error('Unexpected write ' + url.pathname);
    if (url.pathname.includes('/api/') || url.hostname !== new URL(origin).hostname) {
      calls.push(url);
      let data;
      if (url.pathname.endsWith('/auth/admin/me')) data={role,provider:'ENTRA',person:{legalName:'QA'}};
      else if (url.pathname.endsWith('/admin/dashboard/summary')) data=summary;
      else if (url.pathname.endsWith('/admin/observability/compensation/summary')) data={awards:{},recoveries:{},latestSettlements:[]};
      else if (url.pathname.endsWith('/admin/daily-operations/items')) data={total:0,rows:[],path:'/applications'};
      else if (url.pathname.endsWith('/admin/daily-operations/health')) data={scheduler:{},jobs:{}};
      else if (url.pathname.endsWith('/admin/daily-operations') && !fail) data={
        asOf:now,groups:mode==='empty'?groups.map(g=>({...g,count:0,overdue:0})):groups
      };
      else if (url.pathname.endsWith('/admin/marketing') && !fail) data=marketing;
      else if (url.pathname.endsWith('/admin/content-insights/marketing')) data={links:[]};
      return route.fulfill({status:data===undefined?503:200,json:{data,meta:{request_id:'qa',timestamp:now}}});
    }
    if(bundle && url.pathname==='/assets/ops-workbench-fixture.js') {
      return route.fulfill({contentType:'text/javascript',body:bundle});
    }
    const doc = req.resourceType()==='document';
    const key = doc ? origin + '/' : url.href;
    if (!staticFiles.has(key)) staticFiles.set(key,(async()=>{
      const response=await route.fetch({url:key,timeout:20000});
      let body=await response.body();
      if(bundle && doc) {
        const html=body.toString().replace(/(<script type="module"[^>]*src=")[^"]+(")/,
          '$1/assets/ops-workbench-fixture.js$2');
        body=Buffer.from(html.replace('</head>','<style>'+css+'</style></head>'));
      }
      const reply={contentType:response.headers()['content-type'],status:response.status(),body};
      await response.dispose(); return reply;
    })());
    return route.fulfill(await staticFiles.get(key));
  });
  const api = suffix => calls.filter(url=>url.pathname.endsWith(suffix));
  const open = async to => {await page.goto(origin+to);await page.locator('#admin-main').waitFor();};
  try {
    await open('/');
    if(role==='CUSTOMER_SERVICE') {
      await page.getByRole('navigation',{name:'角色常用作業'}).waitFor();
      assert.equal(api('/daily-operations').length,0);assert.equal(api('/marketing').length,0);
    } else if(role==='FINANCE') {
      await page.getByRole('heading',{name:'優先處理'}).waitFor();assert.equal(api('/marketing').length,0);
      await page.getByText('您可查看的類別目前都沒有待辦。').waitFor();
    } else if(mode==='error') {
      await page.getByText('待辦讀取失敗。').waitFor({timeout:20000});
      await page.getByText('分享成效讀取失敗。').waitFor({timeout:20000});
      assert.equal(await page.locator('.opsw-queue-value').count(),0);
      fail=false;
      await page.locator('.opsw-panel').first().getByRole('button',{name:'重新讀取'}).click();
      await page.locator('.opsw-queue-link').first().waitFor();
    } else {
      const rows=page.locator('.opsw-queue-link');
      await rows.first().waitFor();assert.match(await rows.first().innerText(),/回報付款/);
      assert.equal(await rows.count(),2);
      await page.getByRole('link',{name:/查看已有造訪、尚無新註冊的球/}).waitFor();
      assert.deepEqual(await page.locator('.opsw-stats dd').allTextContents(),['15','21','3']);
      if(width<500) {
        const jump=page.getByRole('link',{name:'分享成效 ↓'});
        const bounds=await jump.boundingBox();
        assert(bounds && bounds.y+bounds.height<=page.viewportSize().height);
        await jump.focus();await page.keyboard.press('Enter');
        assert.equal(await page.evaluate(()=>document.activeElement.id),'opsw-growth-title');
        await page.keyboard.press('Tab');
        assert.match(await page.evaluate(()=>document.activeElement.getAttribute('href')),/segment=CONNECT/);
      }
      assert.equal(await page.locator('.opsw-detail').getAttribute('open'),null);
      await page.locator('.opsw-detail summary').click();await page.getByText('有效會員總數',{exact:true}).waitFor();
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
      await rows.last().click(); await page.locator('.daily-filter').first().waitFor();
      assert.equal(new URL(page.url()).searchParams.get('category'),'REVIEW');
      assert.match(await page.locator('.daily-cards [aria-pressed=true]').innerText(),/申請審核/);
      await page.getByRole('button',{name:/回報付款/}).click();
      assert.equal(new URL(page.url()).searchParams.get('category'),'PAID');
      await page.reload(); await page.locator('.daily-filter').first().waitFor();
      assert.match(await page.locator('.daily-cards [aria-pressed=true]').innerText(),/回報付款/);
      await open('/daily-operations?category=UNAUTHORIZED');
      await page.locator('.daily-filter').first().waitFor();
      assert.equal(api('/daily-operations/items').some(u=>u.searchParams.get('category')==='UNAUTHORIZED'),false);
      await open('/');
      await page.getByRole('link',{name:/查看已有造訪、尚無新註冊的球/}).click();
      await page.locator('.marketing-segments [aria-pressed=true]').waitFor();
      assert.equal(new URL(page.url()).searchParams.get('segment'),'CONNECT');
      assert.match(await page.locator('.marketing-segments [aria-pressed=true]').innerText(),/支持交流/);
      assert(api('/marketing').some(url=>url.searchParams.get('segment')==='CONNECT'));
    }
    assert.deepEqual(errors,[]);
    console.log('PASS',role,mode,theme,width);
  } finally {await page.close();}
}
(async()=>{
  const browser=await chromium.launch({
    headless:true,...(process.env.CHROME?{executablePath:process.env.CHROME}:{channel:'chrome'})
  });
  try {
    await exercise(browser,'SUPER_ADMIN','data','light',1280);
    await exercise(browser,'SUPER_ADMIN','data','dark',375);
    await exercise(browser,'FINANCE','empty','dark',375);
    await exercise(browser,'CUSTOMER_SERVICE','restricted','light',375);
    await exercise(browser,'SUPER_ADMIN','error','dark',375);
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
