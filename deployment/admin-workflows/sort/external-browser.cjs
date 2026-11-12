'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');

const site=process.env.ADMIN_PREVIEW, base=process.env.ADMIN_BASE||site;
const root='https://admin.ucell.life', stamp=n=>'2026-10-'+String(n).padStart(2,'0')+'T08:10:00Z';
const ids=Array.from({length:27},(_,i)=>i+1);
const docs=[3,2,1].map(n=>({id:String(n),title:'文件'+n,filename:'file'+n,created_at:stamp(n),source:'MANUAL',status:'REVIEW',ocr:'PENDING',missingCount:1}));
const batches=ids.toReversed().map(n=>({id:'batch-'+n,periodEnd:stamp(n),ruleVersion:'R'+n,kind:'BINARY_K1'}));
const cases=ids.map(n=>({key:'case-'+n,name:'會員'+n+'號',reason:'INSTALLMENT',verifiedAt:null,expected:'1',recorded:'1',difference:'0',evidence:{earnedAt:stamp(n),due:n===13?null:stamp(28-n)}}));
const paginate=(items,n)=>({items:items.slice((n-1)*25,n*25),hasMore:items.length>n*25});

async function main(){
  assert(site,'Set ADMIN_PREVIEW to the patched admin website');
  const browser=await chromium.launch({channel:process.env.CHROMIUM_CHANNEL||'msedge'});
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  page.setDefaultTimeout(8500);
  const errors=[],calls=[],assets=new Map();
  page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{sessionStorage.setItem('ucell_admin_token','fixture-only');sessionStorage.setItem('ucell_admin_user',JSON.stringify({role:'SUPER_ADMIN',provider:'ENTRA'}));});
  await page.route('**/*',async route=>{
    const u=new URL(route.request().url()),p=u.pathname.replace(/^\/api\/v1/,'');
    assert(['GET','OPTIONS','HEAD'].includes(route.request().method()));
    if(u.pathname.startsWith('/api/')){
      let data;
      calls.push(p+u.search);
      if(p.endsWith('/auth/admin/me'))data={role:'SUPER_ADMIN',person:{legalName:'測試人員'}};
      else if(p==='/admin/document-intake')data={rows:docs,total:250,capabilities:{}};
      else if(p.endsWith('/contracts/required'))data=[];
      else if(p==='/admin/compensation-period-control/verification')data=paginate(batches,Number(u.searchParams.get('page')));
      else if(p.endsWith('/cases'))data=paginate(cases,Number(u.searchParams.get('page')));
      else return route.fulfill({status:404,json:{error:{code:'NO_FIXTURE'}}});
      return route.fulfill({status:200,json:{data}});
    }
    const file=route.request().resourceType()==='document'?'index.html':u.pathname.slice(1);
    for(const dir of [site,base]){
      const local=path.join(dir,file);
      if(fs.statSync(local,{throwIfNoEntry:false})?.isFile())return route.fulfill({path:local});
    }
    if(u.origin!==root)return route.abort();
    if(!assets.has(u.href))assets.set(u.href,fetch(u).then(async r=>({status:r.status,body:Buffer.from(await r.arrayBuffer()),contentType:r.headers.get('content-type')||undefined})));
    return route.fulfill(await assets.get(u.href));
  });
  try{
    await page.goto(root+'/document-intake');
    const queue=page.locator('.intake-queue button');
    await queue.nth(2).waitFor();
    assert.match(await queue.first().textContent(),/文件3/);
    await page.getByRole('button',{name:'收件時間，切換為升冪'}).click();
    assert.match(await queue.first().textContent(),/文件1/);
    await page.getByRole('button',{name:'收件時間，切換為降冪'}).click();
    assert.match(await queue.first().textContent(),/文件3/);
    assert.equal(await calls.filter(p=>p==='/admin/document-intake').length,1);
    console.log('文件收件匣：真實 lazy chunk，升冪與降冪皆正確。');
    await page.goto(root+'/compensation-period-control');
    const panel=page.locator('ucell-award-verification');
    const summary=panel.locator('details summary');
    await summary.nth(24).waitFor();
    await panel.getByRole('button',{name:'到期日，切換為升冪'}).click();
    await page.waitForFunction(()=>document.querySelector('ucell-award-verification details summary')?.textContent.includes('會員27號'));
    assert(calls.some(p=>p.includes('/cases?') && p.includes('page=2') && p.includes('status=open')));
    await panel.getByRole('button',{name:'到期日，切換為降冪'}).click();
    assert.match(await summary.first().textContent(),/會員1號/);
    await panel.getByRole('button',{name:'下一頁'}).last().click();
    assert.equal(await summary.count(),2);
    assert.match(await summary.last().textContent(),/會員13號/);
    await panel.getByRole('button',{name:'獎金發生時間，切換為升冪'}).click();
    assert.match(await summary.first().textContent(),/會員1號/);
    await panel.getByRole('button',{name:'獎金發生時間，切換為降冪'}).click();
    assert.match(await summary.first().textContent(),/會員27號/);
    await panel.getByRole('button',{name:'批次截止日，切換為升冪'}).click();
    const options=panel.locator('select').first().locator('option');
    await page.waitForFunction(()=>document.querySelector('ucell-award-verification select option')?.value==='batch-1');
    assert.equal(await options.last().getAttribute('value'),'batch-25');
    await panel.getByRole('button',{name:'批次截止日，切換為降冪'}).click();
    assert.equal(await options.first().getAttribute('value'),'batch-27');
    assert.deepEqual(errors,[]);
    console.log('獎金驗算：日期雙向，全域跨頁，保留案件篩選，空日期排列最後。');
  }catch(e){console.error(errors,(await page.locator('body').innerText()).slice(-1000),calls.slice(-8));throw e;}
  finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
