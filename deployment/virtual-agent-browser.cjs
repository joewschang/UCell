// Visual/UI verification with synthetic answers only; no production API requests.
const fs=require('fs'),path=require('path'),http=require('http'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),out='C:/UCell/virtual-agent-20261022';
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
(async()=>{
 fs.mkdirSync(out,{recursive:true});
 const html=path.join(root,'member/virtual-agent-preview.html'),tsx=path.join(root,'member/src/VirtualAgentPreview.tsx');
 assert.ok(!fs.existsSync(html)&&!fs.existsSync(tsx));
 fs.writeFileSync(html,'<html lang="zh-Hant"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/src/VirtualAgentPreview.tsx"></script></html>');
 fs.writeFileSync(tsx,`import React from 'react';import{createRoot}from'react-dom/client';import{Assistant}from'../../shared/ai-assistant/Assistant';import{ServiceWelcome}from'../../shared/ai-assistant/Persona';
 const audience=new URLSearchParams(location.search).get('audience')==='admin'?'admin':'member';
 const request=async(path:string)=>path.endsWith('/capabilities')?{capabilities:[],notice:'測試資料，僅限本人查詢。'}:path.endsWith('/conversations')?{id:'test',contextVersion:1}:path.endsWith('/turns')?{turnId:'test'}:{turnId:'test',status:'COMPLETED',answer:{status:'AVAILABLE',title:'測試查詢結果',text:'您的資料已取得。這是介面驗證用資料。',facts:[{label:'測試筆數',value:'3'}],sources:[{label:'測試資料來源',ref:'test-fixture'}],definitionVersion:'test-v1',updatedAt:new Date().toISOString()}};
 document.body.style.cssText='margin:0;padding:20px;background:#f3f7f6;font-family:Arial,sans-serif;box-sizing:border-box';const style=document.createElement('style');style.textContent='*{box-sizing:border-box}';document.head.append(style);
 createRoot(document.getElementById('root')!).render(<><ServiceWelcome/><Assistant audience={audience} request={request as any}/></>);`);
 const {createServer}=await import(require('url').pathToFileURL(path.join(root,'member/node_modules/vite/dist/node/index.js')).href);
 const vite=await createServer({root:path.join(root,'member'),server:{host:'127.0.0.1',port:55174,strictPort:true}});await vite.listen();
 const web=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const file=path.resolve(root,'website','.'+(url.pathname==='/'?'/index.html':url.pathname));if(!file.startsWith(path.join(root,'website')+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file));});await new Promise(r=>web.listen(55175,'127.0.0.1',r));
 const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 try{for(const width of [1440,390]){
  const page=await browser.newPage({viewport:{width,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  for(const audience of ['admin','member']){await page.goto('http://127.0.0.1:55174/virtual-agent-preview.html?audience='+audience);await page.getByRole('button',{name:audience==='admin'?'目前會員數有多少？':'我有哪些會員資格？',exact:true}).click();await page.getByText('測試查詢結果',{exact:true}).waitFor();assert.ok(await page.locator('.uc-ai-representative img').evaluate(el=>el.complete&&el.naturalWidth>0));assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,audience+'-'+width+'.png'),fullPage:true});}
  await page.goto('http://127.0.0.1:55175/contact.html');await page.locator('.virtual-service>summary').click();assert.ok(await page.locator('.virtual-service').evaluate(el=>el.open));assert.equal(await page.locator('.virtual-service-body a').count(),4);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(out,'website-'+width+'.png'),fullPage:true});await page.keyboard.press('Escape');assert.equal(await page.locator('.virtual-service').evaluate(el=>el.open),false);await page.locator('.virtual-service>summary').click();await page.getByRole('button',{name:'關閉客服選單'}).click();assert.equal(await page.locator('.virtual-service').evaluate(el=>el.open),false);assert.deepEqual(errors,[]);await page.close();
 }console.log('PASS: admin/member synthetic query, images, desktop/mobile overflow, website service links, Escape and close controls');
 }finally{await browser.close();await vite.close();await new Promise(r=>web.close(r));fs.unlinkSync(html);fs.unlinkSync(tsx);}
})().catch(e=>{console.error(e);process.exitCode=1});
