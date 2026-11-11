const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const base=process.argv[2],browser=await chromium.launch({executablePath:process.env.CHROME});
 try{
 for(const site of ['admin','member']){
   const root=path.join(base,site), asset=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/src="([^"]+)"/)[1];
   let source=fs.readFileSync(path.join(root,asset),'utf8');
   const entry=site==='admin'?'pA.createRoot(document.getElementById("root"))':'xE(document.getElementById("root"))';
   const index=source.lastIndexOf(entry);assert(index>0);
   const J=site==='admin'?'e':'r',R=site==='admin'?'f':'h';
   source=source.slice(0,index)+`
   function TestForm(){
     const [code,setCode]=${R}.useState("TW0900000000-01"),[address,apply]=${R}.useState("測試市舊地址");
     return ${J}.jsxs("div",{children:[${J}.jsx("input",{id:"sponsor",value:code,onChange:e=>setCode(e.target.value)}),${J}.jsx(UcSponsorName,{code}),${site==='admin'?'e.jsx(UcAddressHint,{address:"測試市新地址",current:address,apply}),e.jsx(UcPaperCheck,{row:{source:"FORMAL",sourceId:"test"}})':'null'}]});
   }
   ${entry}.render(${J}.jsx(TestForm,{}));`;
   const page=await browser.newPage(),errors=[];
   page.on('pageerror',err=>(console.error(err.message),errors.push(err.message)));
   await page.addInitScript(scope=>sessionStorage.setItem('ucell_'+scope+'_token','synthetic'),site);
   await page.route('**/*',route=>{
     const u=new URL(route.request().url()); if(process.env.DEBUG_CHECK)console.log(u.pathname);
     if(u.pathname==='/')return route.fulfill({contentType:'text/html',body:'<div id="root"></div><script type="module" src="/test.js"></script>'});
     if(u.pathname==='/test.js')return route.fulfill({contentType:'text/javascript',body:source});
     const json=u.pathname.includes('/sponsor-holder/')?{name:'測試法人'}:u.pathname.endsWith('/documents')?[{id:'back',type:'IDENTITY_BACK'}]:u.pathname.endsWith('/detail')?{payload:{communicationAddress:'測試市原地址'}}:u.pathname.endsWith('/recognize')?{registeredAddress:'測試市新地址'}:{};
     return route.fulfill({json:{data:json,meta:{api_version:"v1",request_id:"test",timestamp:new Date().toISOString()}},headers:{'access-control-allow-origin':'*'}});
   });
   await page.goto('https://'+site+'.ucell.life/');
   await page.getByText('推薦人：測試法人',{exact:false}).waitFor({timeout:6000});
   await page.locator('#sponsor').fill('');
   assert.equal(await page.getByText('推薦人：測試法人',{exact:false}).count(),0);
   if(site==='admin'){
     await page.getByText('與通訊地址不同',{exact:false}).first().waitFor();
     await page.getByText('將戶籍地址帶入通訊地址').click();await page.getByText('與通訊地址一致。').first().waitFor();
     await page.getByText('核對身分證背面地址').click();
     await page.getByText('辨識已存的證件背面').click();
     await page.locator('details').getByText('與通訊地址不同',{exact:false}).waitFor();
   }
   assert.deepEqual(errors,[]);await page.close();console.log(site+' passed');
 }
 }finally{await browser.close()}
})().catch(err=>{console.error(err);process.exitCode=1});
