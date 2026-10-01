import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(join(root,'package.json'));
const {createServer}=require('vite'),{chromium}=require('playwright');
const fixture=join(root,'.line-binding-browser-'+randomUUID()),screens=process.env.UCELL_BROWSER_OUTPUT??'C:/UCell/logs/line-binding-browser-20261001';
mkdirSync(fixture);mkdirSync(screens,{recursive:true});let server,browser;
try{
 writeFileSync(join(fixture,'index.html'),'<html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="./fixture.tsx"></script></html>');
 writeFileSync(join(fixture,'fixture.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import {LineBinding} from '../src/LineBindingPage';import '../src/styles.css';import '@ucell/design-system/styles';import '../src/ucell-theme.css';createRoot(document.getElementById('root')!).render(<LineBinding onComplete={()=>{document.body.dataset.completed='true'}} onRecheck={()=>{document.body.dataset.rechecked='true'}}/>);`);
 server=await createServer({root,configFile:join(root,'vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false}});await server.listen();
 const port=server.httpServer.address().port;browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
 await page.goto('http://127.0.0.1:'+port+'/'+fixture.split(/[\\/]/).at(-1)+'/index.html');await page.getByRole('heading',{name:'綁定 UCell 會員',exact:true}).waitFor();
 for(const theme of ['light','dark'])for(const width of [390,1280]){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'horizontal overflow');
  await page.screenshot({path:join(screens,'binding-'+theme+'-'+width+'.png'),fullPage:true});
 }
 await page.getByLabel('會員編號',{exact:true}).fill('2609250001');await page.getByLabel('客服核驗案件參考').fill('CASE-001');await page.getByRole('button',{name:'送出綁定申請'}).click();
 await page.getByRole('status').filter({hasText:'LINE 登入已失效'}).waitFor();assert.equal(await page.evaluate(()=>document.body.dataset.completed),undefined);
 await page.getByRole('button',{name:'重新檢查綁定狀態'}).click();assert.equal(await page.evaluate(()=>document.body.dataset.rechecked),'true');assert.equal(await page.evaluate(()=>document.body.dataset.completed),undefined);
 assert.deepEqual(errors,[]);console.log('LINE_BINDING_BROWSER_PASS: actual component, mobile/desktop light/dark, missing-token denial and recheck callback; no real LINE authorization or backend session proof');
}finally{
 await browser?.close();await server?.close();assert.ok(fixture.startsWith(root)&&dirname(fixture)===root&&fixture.split(/[\\/]/).at(-1).startsWith('.line-binding-browser-'));rmSync(fixture,{recursive:true,force:true});console.log('LINE_BINDING_BROWSER_CLEANUP_PASS');
}
