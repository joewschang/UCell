import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync,rmSync} from 'node:fs';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),require=createRequire(join(root,'package.json'));
const {createServer}=require('vite'),{chromium}=require('playwright');
const fixture=join(root,'.payouts-browser-'+randomUUID()),screens=process.env.UCELL_BROWSER_OUTPUT??'C:/UCell/logs/payouts-browser-20261001';
mkdirSync(fixture);mkdirSync(screens,{recursive:true});let server,browser;
try{
 writeFileSync(join(fixture,'index.html'),'<html lang="zh-Hant"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><div id="root"></div><script type="module" src="./fixture.tsx"></script></html>');
 writeFileSync(join(fixture,'fixture.tsx'),`import React from 'react';import {createRoot} from 'react-dom/client';import {MemoryRouter} from 'react-router-dom';import MemberPayouts from '../src/MemberPayouts';import RepurchaseDetails from '../src/RepurchaseDetails';import '../src/styles.css';import '@ucell/design-system/styles';import '../src/ucell-theme.css';createRoot(document.getElementById('root')!).render(<MemoryRouter initialEntries={["/payouts"]}><div className="app">{window.location.search.includes('repurchase')?<RepurchaseDetails q={{id:'00000000-0000-4000-8000-000000000011',code:'123',ballNo:'B00001',rank:'STARTER',active:false}}/>:<MemberPayouts q={{id:'00000000-0000-4000-8000-000000000011',code:'123',ballNo:'B00001',rank:'STARTER'}}/>} </div></MemoryRouter>);`);
 server=await createServer({root,configFile:join(root,'vite.config.ts'),server:{host:'127.0.0.1',port:0,strictPort:false}});await server.listen();
 const port=server.httpServer.address().port;browser=await chromium.launch({headless:true,channel:'msedge'});
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));

 let fail=true,empty=false;const calls=[],stamp='2026-10-01T00:00:00.000Z';
 const rows=Array.from({length:53},(_,index)=>({reference:'PAYMENT_RESULT-'+index.toString(16).padStart(40,'0'),status:index===0?'FAILED':'PAID',paidAmount:index===0?'0':'40.0001',netAmount:'100.0001',grossAmount:'110.0001',recoveryOffset:'10',occurredAt:stamp,recordedAt:stamp,periodStart:'2026-09-01T00:00:00.000Z',periodEnd:stamp,batchStatus:'PARTIALLY_PAID'}));
 await page.route('**/*',async route=>{
  const url=new URL(route.request().url());if(url.hostname!=='127.0.0.1')return route.abort();
  if(url.pathname==='/api/v1/member/repurchase/status'){
   const period=url.searchParams.get('period');return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data:{qualificationId:url.searchParams.get('qualificationId'),period,status:'ACTIVE',recognitions:[{id:'00000000-0000-4000-8000-000000000099',status:'RECOGNIZED',dueAt:period+'-15T00:00:00Z'}]},meta:{api_version:'v1',request_id:'REPURCHASE_FIXTURE',timestamp:stamp}})});
  }
  if(url.pathname==='/api/v1/member/payouts'){
   calls.push(Object.fromEntries(url.searchParams));if(fail){fail=false;return route.fulfill({status:503,contentType:'application/json',body:'{}'});}
   const offset=Number(url.searchParams.get('offset')),items=empty?[]:rows.slice(offset,offset+50),data={qualificationNo:'123',items,total:empty?0:53,offset,nextOffset:empty||offset+items.length===53?null:offset+items.length,asOf:stamp};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({data,meta:{api_version:'v1',request_id:'BROWSER_FIXTURE',timestamp:stamp}})});
  }return route.continue();
 });
 await page.goto('http://127.0.0.1:'+port+'/'+fixture.split(/[\\/]/).at(-1)+'/index.html');await page.getByRole('alert').waitFor();await page.getByRole('button',{name:'重新載入',exact:true}).click();await page.getByRole('heading',{name:'付款失敗紀錄',exact:true}).waitFor();
 for(const theme of ['light','dark'])for(const width of [390,1280]){
  await page.setViewportSize({width,height:900});await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true,'horizontal overflow');
  const ratios=await page.locator('.uc-income-nav a').evaluateAll(links=>{const lum=(color)=>{const rgb=color.match(/[0-9.]+/g).slice(0,3).map(Number).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};return links.map(link=>{const style=getComputedStyle(link),a=lum(style.color),b=lum(style.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);});});assert.ok(ratios.every(ratio=>ratio>=4.5),'income link contrast');await page.screenshot({path:join(screens,'payouts-'+theme+'-'+width+'.png')});
 }
 assert.ok((await page.locator('body').innerText()).includes('100.0001 元'));assert.ok(!(await page.locator('body').innerText()).includes('00000000-0000-4000-8000-000000000011'));assert.ok(!(await page.locator('body').innerText()).includes('PARTIALLY_PAID'));
 await page.getByRole('button',{name:'下一頁',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('article').length===3);assert.equal(calls.at(-1).offset,'50');assert.equal(calls.at(-1).asOf,stamp);assert.equal(await page.getByRole('button',{name:'下一頁',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'上一頁',exact:true}).click();await page.getByRole('heading',{name:'付款失敗紀錄',exact:true}).waitFor();assert.equal(calls.at(-1).asOf,stamp);
 empty=true;await page.reload();await page.getByText('尚無付款結果紀錄',{exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'下一頁',exact:true}).isDisabled(),true);assert.deepEqual(errors,[]);
 const sourceURL=new URL(page.url());sourceURL.search='?repurchase=1';await page.goto(sourceURL.href);await page.getByLabel('查詢月份').fill('2026-09');await page.getByText('2026-09 · 已有認列紀錄',{exact:true}).waitFor();assert.ok((await page.locator('body').innerText()).includes('不判定 Active'));assert.ok(!(await page.locator('body').innerText()).includes('00000000-0000-4000-8000-000000000099'));assert.deepEqual(errors,[]);
 console.log('PAYOUTS_BROWSER_PASS: actual component, controlled API envelope, error/retry, exact decimals, pagination/asOf, empty and light/dark mobile/desktop; not real payment or provider evidence');
}finally{
 await browser?.close();await server?.close();assert.ok(fixture.startsWith(root)&&dirname(fixture)===root&&fixture.split(/[\\/]/).at(-1).startsWith('.payouts-browser-'));rmSync(fixture,{recursive:true,force:true});console.log('PAYOUTS_BROWSER_CLEANUP_PASS');
}
