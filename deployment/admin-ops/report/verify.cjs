const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
const {patchReport} = require('./patch.cjs');
const origin = process.env.SITE_ORIGIN || 'https://admin.ucell.life';
const original = process.argv[2], compiled = process.argv[3];
const candidate = original && patchReport(fs.readFileSync(original,'utf8'),fs.readFileSync(compiled,'utf8'));
const figures = {
  persons:4,qualifications:5,orders:{count:12},returns:{lineCount:3,gpvReversal:'123.0770'},
  paidOrdersByCurrency:[{currency:'TWD',count:'9007199254740993',amount:'9007199254740993.012300'},{currency:'USD',count:1,amount:'0.01'}],
  returnsByCurrency:[{currency:'USD',count:3,amount:'-1.1750'}],
  applications:[],awards:[],payouts:{_count:1,_sum:{totalNet:'10.25'}}
};
function wire(from,to) {return {from,to,endExclusive:'true'};}
async function verify(browser,zone,role,mode) {
  const page=await browser.newPage({timezoneId:zone,viewport:{width:375,height:812},serviceWorkers:'block',colorScheme:'dark'});
  const reads=[],errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.setDefaultTimeout(11000);
  await page.clock.setFixedTime(new Date('2028-02-29T16:15:00Z')); // Mar 1 in Taipei, Feb 29 in LA.
  await page.addInitScript(role=>{
    sessionStorage.setItem('ucell_admin_token','fixture');
    sessionStorage.setItem('ucell_admin_user',JSON.stringify({role,provider:'ENTRA'}));
  },role);
  await page.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    assert.equal(req.method(),'GET');
    if(u.pathname.includes('/api/')||u.hostname!==new URL(origin).hostname) {
      reads.push(u);
      let data;
      if(u.pathname.endsWith('/auth/admin/me')) data={role,subject:'QA'};
      else if(u.pathname.endsWith('/reports/operations')&&mode!=='error') data=figures;
      else if(u.pathname.endsWith('/integrity-alerts')) data={counts:{critical:1,high:0,total:1},alerts:[{severity:'CRITICAL',code:'RECOVERY_BALANCE_MISMATCH',entityType:'QA',entityId:'test',detail:{reason:'test'}}]};
      else if(u.pathname.includes('/exports/'))data={content:'data\r\n1',filename:'qa.csv',contentType:'text/csv'};
      return route.fulfill({status:data===undefined?503:200,json:{data}});
    }
    if(candidate&&u.pathname==='/test-report.js') return route.fulfill({contentType:'text/javascript',body:candidate});
    if(candidate&&req.resourceType()==='document') {
      const res=await route.fetch({url:origin+'/'});
      const html=(await res.text()).replace(/(<script type="module"[^>]*src=")[^"]+(")/,'$1/test-report.js$2');
      return route.fulfill({contentType:'text/html',body:html.replace('</head>','<style>'+fs.readFileSync(require('node:path').join(require('node:path').dirname(compiled),'report.css'),'utf8')+'</style></head>')});
    }
    return route.continue();
  });
  const reports=()=>reads.filter(url=>url.pathname.endsWith('/reports/operations'));
  const params=url=>Object.fromEntries(['from','to','endExclusive'].map(key=>[key,url.searchParams.get(key)]));
  try{
    await page.goto(origin+'/reports');
    await page.getByRole('heading',{name:'營運報表'}).waitFor();
    if(mode==='error'){
      await page.getByRole('alert').first().waitFor({timeout:25000});
      assert.equal(await page.locator('.ops-report-amount').count(),0);
    } else {
      const paid=page.getByRole('table',{name:'已付款訂單'});
      await paid.waitFor();assert.match(await paid.innerText(),/9,007,199,254,740,993\.012300/);
      assert.match(await page.getByRole('table',{name:'退貨申報'}).innerText(),/-1\.1750/);
      assert.match(await page.locator('.ops-report-amount').filter({hasText:'建立訂單'}).innerText(),/暫無法取得/);
      assert.deepEqual(params(reports()[0]),wire('2028-02-29T16:00:00.000Z','2028-03-01T16:00:00.000Z'));
      const latest=async(expected)=>{
        for(let n=0;n<60;n++){if(reports().length && JSON.stringify(params(reports().at(-1)))===JSON.stringify(expected))return;await page.waitForTimeout(25);}
        assert.deepEqual(params(reports().at(-1)),expected);
      };
      await page.getByRole('button',{name:'上月',exact:true}).click();
      await latest(wire('2028-01-31T16:00:00.000Z','2028-02-29T16:00:00.000Z'));
      await page.getByRole('button',{name:'近 7 天',exact:true}).click();
      await latest(wire('2028-02-23T16:00:00.000Z','2028-03-01T16:00:00.000Z'));
      await page.getByRole('button',{name:'今日',exact:true}).click();
      await page.getByText(/目前報表與匯出期間為 2028-03-01 至 2028-03-01/).waitFor();
      const before=reports().length;
      const start=page.getByLabel('開始日期'), end=page.getByLabel('結束日期');
      await end.fill('2028-02-20');assert(await page.getByRole('button',{name:'套用期間'}).isDisabled());
      await start.fill('2028-02-10');assert(await page.getByRole('button',{name:'訂單 CSV'}).isDisabled());
      assert.equal(reports().length,before);
      await page.getByRole('button',{name:'套用期間'}).click();
      const range=wire('2028-02-09T16:00:00.000Z','2028-02-20T16:00:00.000Z');
      await latest(range);
      for(const [label,name] of [['資格 CSV','QUALIFICATIONS'],['訂單 CSV','ORDERS'],['付款批次 CSV','PAYOUTS']]){
        await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:label}).click()]);
        const call=reads.find(url=>url.pathname.endsWith('/exports/'+name));assert(call);
        assert.deepEqual(params(call),range);
      }
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false);
    }
    if(role==='FINANCE') {
      assert.equal(reads.some(url=>url.pathname.endsWith('/integrity-alerts')),false);
      assert.equal(await page.getByRole('heading',{name:'資料完整性警示'}).count(),0);
    }else{
      await page.getByRole('heading',{name:'資料完整性警示'}).waitFor();
      await page.getByText('RECOVERY_BALANCE_MISMATCH',{exact:true}).first().waitFor();
      assert.match(await page.locator('.ops-report').innerText(),/獎金回收餘額不一致/);
    }
    assert.deepEqual(errors,[]);console.log('PASS report',zone,role,mode);
  }finally{await page.close();}
}
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.CHROME?{executablePath:process.env.CHROME}:{channel:'chrome'})});
  try{
    await verify(browser,'America/Los_Angeles','FINANCE','data');
    await verify(browser,'Asia/Taipei','COMPLIANCE_AUDIT','data');
    await verify(browser,'Pacific/Auckland','FINANCE','error');
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
