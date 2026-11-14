const assert=require('node:assert/strict');
const {chromium}=require('../../member/node_modules/playwright');
(async()=>{const browser=await chromium.launch({channel:'chrome'});try{
 const p=await browser.newPage({viewport:{width:390,height:844}});let posted;
 await p.route('**/auth/admin/staff-accounts',route=>{
 if(route.request().method()==='POST')posted=route.request().postDataJSON();
 return route.fulfill({json:{data:posted?[]:[{id:'fixture',name:'測試管理員',provider:'ENTRA',role:'SUPER_ADMIN',status:'ACTIVE',self:true}]}});
 });
 await p.route('**/assets/admin-staff-*.js',async route=>{
 const res=await route.fetch();let js=await res.text();const match=[...js.matchAll(/([\w$]+)\(document.getElementById\("root"\)\)\.render\(/g)].pop();
 assert(match);js=js.slice(0,match.index)+match[0]+'e.jsx(StaffAccounts,{}));';
 return route.fulfill({response:res,body:js});});
 await p.goto('https://admin.ucell.life/staff-accounts',{waitUntil:'domcontentloaded'});
 await p.getByText('測試管理員').waitFor();assert.equal(await p.getByText('停用授權',{exact:true}).count(),0);
 await p.getByText('新增後台登入帳號',{exact:true}).click();
 await p.getByLabel('管理員姓名').fill('測試');await p.getByLabel(/Microsoft Entra 使用者/).fill('00000000-0000-4000-8000-000000000001');
 await p.getByLabel('角色').selectOption('ORDER_OPS');await p.getByLabel('異動原因').fill('測試表單');
 await p.getByText('確認儲存',{exact:true}).click();await p.getByText('後台授權已更新。').waitFor();
 assert.equal(posted.role,'ORDER_OPS');console.log('PASS simulated mobile staff directory, self protection and create form');
 }finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
