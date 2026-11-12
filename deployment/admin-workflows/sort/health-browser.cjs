'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {chromium,webkit}=require('playwright-core');
const source=fs.readFileSync(process.argv[2],'utf8'),engine=process.argv[3]||'chromium';
(async()=>{
 const browser=await (engine==='webkit'?webkit.launch():chromium.launch({channel:'msedge'}));
 try{
  const page=await browser.newPage();
  await page.route('https://health.test/**',route=>route.fulfill(route.request().url().endsWith('/manage.js')?
   {body:source,contentType:'text/javascript'}:{body:'<main></main>',contentType:'text/html'}));
  await page.goto('https://health.test/');
  await page.evaluate(async()=>{
   const {mountEditor}=await import('/manage.js'),page=document.querySelector('main');
   const record={id:'game',name:'測試遊戲',description:'測試',campaign:'秋季',pinned:[],cover:'test'};
   const dates=['2026-11-12T05:00:17Z',null,'2026-11-12T05:00:02Z'];
   const model={draft:[record],registry:[record],live:[record],resources:[],tags:[],edges:[],metrics:[],channels:[],revision:3,version:2,
    changes:dates.map((date,i)=>({revision:i+1,action:'publish',created_at:date,reason:'QA',actor:'測試員'})),
    history:dates.map((date,i)=>({version:i+1,created_at:date}))};
   const el=(tag,text='',cls='')=>{const n=document.createElement(tag);n.textContent=text;n.className=cls;return n;};
   const box=(tag,cls,...children)=>{const n=el(tag,'',cls);n.append(...children.filter(Boolean));return n;};
   mountEditor(page,{apiFor:()=>async()=>model,el,box,btn:t=>el('button',t),link:t=>el('a',t),show:(...children)=>page.replaceChildren(...children)}, {value:null});
  });
  const versions=page.locator('label').filter({has:page.getByText('歷史版本',{exact:true})}).locator('select'),versionSort=page.getByRole('button',{name:/版本建立時間/});
  await versionSort.click();assert.deepEqual(await versions.locator('option').evaluateAll(opts=>opts.map(o=>o.value)),['3','1','2']);
  await versionSort.click();assert.deepEqual(await versions.locator('option').evaluateAll(opts=>opts.map(o=>o.value)),['1','3','2']);
  assert.equal(await versions.inputValue(),'2');
  await page.getByText('異動紀錄',{exact:true}).click();
  const eventSort=page.getByRole('columnheader',{name:/時間/}).getByRole('button');
  await eventSort.click();assert.deepEqual(await page.locator('tbody tr td:first-child').allTextContents(),['3','1','2']);
  await eventSort.click();assert.deepEqual(await page.locator('tbody tr td:first-child').allTextContents(),['1','3','2']);
  console.log(engine,'passed health history table and version list; missing timestamps always last, selected version retained');
 }finally {await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
