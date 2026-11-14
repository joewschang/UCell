const {chromium}=require('../../member/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({channel:'chrome'});try{
for(const [width,path] of [[1280,'/'],[390,'/'],[390,'/staff-accounts']]){
 const p=await b.newPage({viewport:{width,height:844}}),errors=[];
 p.on('pageerror',err=>errors.push(err.message));
 const role='SUPER_ADMIN';
 await p.addInitScript(role=>{sessionStorage.setItem('ucell_admin_token','fixture');sessionStorage.setItem('ucell_admin_user',JSON.stringify({role,name:'測試',provider:'ENTRA',personId:'fixture'}))},role);
 await p.route('**/api/v1/**',route=>{
 const url=new URL(route.request().url()).pathname;
 if(!url.endsWith('/auth/admin/me')&&!url.endsWith('/auth/admin/staff-accounts'))return route.fulfill({status:503,json:{message:'測試資料暫時無法取得'}});
 return route.fulfill({json:{data:url.endsWith('/me')?{role,provider:'ENTRA',person:{personId:'fixture',legalName:'測試'}}:[],meta:{api_version:'v1',request_id:'fixture',timestamp:new Date().toISOString()}}});
 });
 await p.goto('https://admin.ucell.life'+path,{waitUntil:'domcontentloaded'});
 if(path==='/staff-accounts')await p.getByRole('heading',{name:'後台登入帳號',exact:true}).waitFor({timeout:10000});
 else await p.getByRole('heading',{name:'營運總覽',exact:true}).first().waitFor({timeout:10000});
 assert.equal(errors.length,0,errors.join('\n'));assert((await p.locator('body').innerText()).length>40);
 console.log('PASS authenticated shell',width,path);await p.close();
}
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});

