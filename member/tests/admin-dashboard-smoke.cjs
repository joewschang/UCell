// Browser-only fixtures. Never connect to LINE, Entra, or a production backend.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}});
  page.setDefaultTimeout(15000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  let fail=false,role='SUPER_ADMIN';
  let data={persons:12840,qualifications:18620,activeQualifications:14524,
   applications:{draft:15,submitted:28},orders:{today:126,month:2486},
   recoveries:{open:7},payable:{open:43},generatedAt:'2026-09-16T08:00:00Z',ruleVersionCode:'R1.0B'};
  await page.addInitScript(()=>sessionStorage.setItem('ucell_admin_token','isolated-browser-fixture'));
  await page.route('**/*',route=>{
   const req=route.request(),url=new URL(req.url());
   if(url.origin!=='http://127.0.0.1:5175'||req.method()!=='GET')return route.abort();
   if(url.pathname==='/api/v1/auth/admin/me')return route.fulfill({json:{data:{subject:'介面測試管理員',role,provider:'DEV_BYPASS'}}});
   if(url.pathname==='/api/v1/admin/dashboard/summary')return route.fulfill(fail?{status:503,json:{message:'Fixture unavailable'}}:{json:{data}});
   if(url.pathname.startsWith('/api/'))return route.abort();
   return route.continue();
  });
  await page.goto('http://127.0.0.1:5175/');
  await page.getByRole('heading',{name:'營運指揮中心.'}).waitFor();
  await page.getByRole('img',{name:'活躍資格占比 78.0%'}).waitFor();
  await page.getByText('12,840',{exact:true}).waitFor();
  await page.screenshot({path:'test-artifacts/admin-desktop.png',fullPage:true,animations:'disabled'});
  for(const width of [320,390,768,1440]){
   await page.setViewportSize({width,height:1100});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,width+' overflow');
  }
  await page.setViewportSize({width:390,height:1100});
  await page.screenshot({path:'test-artifacts/admin-mobile.png',fullPage:true,animations:'disabled'});
  fail=true;
  await page.getByRole('button',{name:'↻ 更新總覽'}).click();
  await page.getByRole('alert').filter({hasText:'資料更新失敗'}).waitFor();
  await page.getByText('12,840',{exact:true}).waitFor();
  fail=false;data={persons:0,qualifications:0,activeQualifications:0,orders:{today:0,month:0}};
  await page.getByRole('button',{name:'↻ 更新總覽'}).click();
  await page.getByRole('img',{name:'活躍資格占比待提供'}).waitFor();
  assert.equal(await page.getByText('NaN%',{exact:true}).count(),0);
  role='CUSTOMER_SERVICE';await page.reload();
  await page.getByText('您的角色目前沒有此區的處理入口。').waitFor();
  assert.equal(await page.locator('.command-task').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS: desktop/mobile, 320/390/768/1440px, snapshot ratio, zero denominator, refresh error, role-filtered shortcuts; synthetic fixtures only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
