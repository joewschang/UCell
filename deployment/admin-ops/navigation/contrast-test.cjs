const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium,webkit} = require('playwright-core');
const base = process.env.ADMIN_URL || 'https://admin.ucell.life';

function measureText(element) {
  // Resolve CSS Color 4 syntax through the browser, then composite ancestor backgrounds.
  const ctx = document.createElement('canvas').getContext('2d', {willReadFrequently:true});
  function rgba(color) {
    ctx.clearRect(0,0,1,1);
    ctx.fillStyle = color;
    ctx.fillRect(0,0,1,1);
    const [r,g,b,a] = ctx.getImageData(0,0,1,1).data;
    return [r,g,b,a / 255];
  }
  const over = (color, bg) => bg.map((v,i) => v * (1-color[3]) + color[i]*color[3]);
  const ancestors = [];
  for (let el=element; el; el=el.parentElement) ancestors.unshift(el);
  let bg = [255,255,255];
  for (const el of ancestors) bg = over(rgba(getComputedStyle(el).backgroundColor),bg);
  const style = getComputedStyle(element);
  const property = element instanceof SVGElement ? style.fill : style.color;
  const fg = over(rgba(property),bg);
  function lum(rgb) {
    const l = rgb.map(c => c / 255).map(c => c <= .04045 ? c/12.92 : ((c+.055)/1.055)**2.4);
    return l[0]*.2126+l[1]*.7152+l[2]*.0722;
  }
  const [min,max] = [lum(bg),lum(fg)].sort((a,b)=>a-b);
  const hex = colors => '#' + colors.map(v=>Math.round(v).toString(16).padStart(2,'0')).join('');
  return {ratio: Number(((max+.05)/(min+.05)).toFixed(2)), fg:hex(fg), bg:hex(bg)};
}

function sample(pathname) {
  if (pathname.endsWith('/auth/admin/me')) return {role:'SUPER_ADMIN',subject:'contrast-fixture'};
  if (pathname.endsWith('/analytics/overview')) return {status:'STALE',asOf:'2026-11-01T00:00:00Z',policyVersion:'fixture'};
  if (pathname.endsWith('/analytics/roots')) return [{id:'root',label:'DEMO-01'}];
  if (/\/analytics\/sonar\/sponsor\/root$/.test(pathname)) return {
    status:'AVAILABLE',asOf:'2026-11-10T00:00:00Z',policyVersion:'fixture',heat:{label:'WATCH'},
    health:{coverage:75,score:61,components:[{key:'active',weight:30,value:.5}]},
    generations:Array.from({length:12},(_,i)=>({generation:i+1,qualificationCount:3,systemCount:0,personCount:3,
      activeRate:.75,repurchaseRate:.5,newRate:null,riskRate:null})),activeRateDelta:null
  };
  if (pathname.endsWith('/analytics/nasl/history')) return {rows:[]};
  if (pathname.endsWith('/analytics/policy-versions')) return [];
  if (pathname.endsWith('/notification-hub')) return {totals:[],settings:{marketing_weekly_limit:2},contacts:{opted_in:1},
    rules:[{code:'NOTIFY',title:'會員通知',enabled:true,description:'行銷訊息',marketing:true,
      preview:{title:'活動通知',body:'活動報名已開放。',path:'/events'}}]};
  if (pathname.endsWith('/notification-hub/records')) return {rows:[],total:0};
}

(async()=>{
  const browser = process.env.PW_BROWSER === 'webkit' ? await webkit.launch() : await chromium.launch({executablePath:process.env.CHROME});
  try {
    for(const theme of ['light','dark']) {
      const context = await browser.newContext({colorScheme:theme,viewport:{width:390,height:844},serviceWorkers:'block'});
      const page = await context.newPage(), errors = [];
      page.on('pageerror',e=>errors.push(e.message));
      await page.addInitScript(theme=>{
        sessionStorage.setItem('ucell_admin_token','local-contrast-fixture');
        localStorage.setItem('ucell.ui-theme-preference.v1',theme.toUpperCase());
      },theme);
      await page.route('**/api/**',route=>{
        assert.equal(route.request().method(),'GET');
        const data = sample(new URL(route.request().url()).pathname);
        return data===undefined ? route.fulfill({status:503,json:{message:'Fixture unavailable'}})
          : route.fulfill({json:{data,meta:{api_version:'v1',request_id:'fixture'}}});
      });
      async function inspect(label,selectors) {
        const rows = {};
        for (const [field,selector] of Object.entries(selectors)) {
          const item = page.locator(selector).first();
          await item.waitFor({state:'visible'});
          rows[field] = await item.evaluate(measureText);
        }
        console.log(theme,label,JSON.stringify(rows));
        return rows;
      }
      for(const area of ['analytics','notification-hub']){
        await page.goto(base+'/'+area);
        await page.waitForFunction(t=>document.documentElement.dataset.theme===t,theme);
        let selectors;
        if(area==='analytics') {
          await page.locator('.analytics-controls select').first().selectOption('root');
          await page.locator('.analytics-radar').waitFor();
          selectors={
            stale:'.analytics-evidence.analytics-stale strong', staleDate:'.analytics-stale span',
            fresh:'.analytics-evidence:not(.analytics-stale) strong', freshDate:'.analytics-evidence:not(.analytics-stale) span',
            chartAxis:'.analytics-radar g text', chartScale:'.analytics-radar svg > text',
            activeLegend:'.analytics-radar figcaption', repeatLegend:'.analytics-repurchase',
            weight:'.analytics-components dt small', historySummary:'.nasl-history-panel summary',
            error:'.analytics-page [role="alert"] p'
          };
        } else {
          await page.getByRole('button',{name:'規則與範本'}).click();
          await page.getByText('預覽訊息（虛擬範例）').click();
          selectors={preview:'.hub-preview strong', previewBody:'.hub-preview p', previewFoot:'.hub-preview small',
            subtitle:'.notification-hub .uc-header p', activeTab:'.hub-tabs .primary'};
        }
        const before = await inspect(area+' before',selectors);
        if (process.argv.includes('--measure')) continue;
        if (!process.argv.includes('--live')) {
          await page.addStyleTag({content:fs.readFileSync(path.resolve(__dirname,'../../../admin/src/app/contrast.css'),'utf8')});
        }
        const after = await inspect(area+' after',selectors);
        for(const [field,result] of Object.entries(after)) assert(result.ratio>=4.5, theme+' '+area+' '+field+' '+result.ratio);
      }
      assert.deepEqual(errors,[]);
      await context.close();
    }
  } finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
