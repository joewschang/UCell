// Exercise the production admin SPA using the responses exported by the isolated PostgreSQL regression test.
// Only public assets can leave the browser. All API calls use local fixtures and mutation attempts fail.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright-core');
const {mount, origin} = require('../admin-interaction/qa/fixtures.cjs');

const [fixture, out, site='PUBLIC'] = process.argv.slice(2);
if (!fixture || !out) throw Error('Usage: node browser.cjs <PostgreSQL pages.json> <report directory> [admin site|PUBLIC]');
const data = JSON.parse(fs.readFileSync(fixture,'utf8'));
const tabs = {PLACEMENT_PENDING:'待安置',PLACEMENT_OVERDUE:'已逾期',PLACED:'已完成',ALL:'全部'};
const monitor='/admin/qualification-placements/dashboard';
const trees='/admin/organization/trees';
const tree=data.perTree[0]?.tree??{binaryTreeId:'bebadffa-0000-4000-8000-000000000001',treeCode:'QA-SORT',treeName:'測試組織',status:'ACTIVE',topologyVersion:1};
const now='2026-11-12T04:00:00.000Z';
function usec(s) {
  if (s===null||s===undefined||s==='') return null;
  const ms=Date.parse(s);assert(Number.isFinite(ms),'invalid time');
  return BigInt(ms)*1000n+BigInt(((s.match(/\.(\d+)/)?.[1]||'').padEnd(6,'0').slice(3,6))||0);
}
function checkOrder(rows, key, desc, label) {
  for(let i=1;i<rows.length;i++){
    const left=usec(key(rows[i-1])),right=usec(key(rows[i]));
    if(right!==null) assert(left!==null&&(desc?right<=left:right>=left),'wrong time order at '+label+' row '+(i+1));
  }
  const ids=rows.map(r=>r.qualificationId);
  assert(!ids.includes(null)&&!ids.includes(undefined),'invalid fixture id');
  assert.equal(new Set(ids).size,rows.length,label+' repeated a record');
}
function oracle(pages) {
  assert(pages.length>=2,'fixture must span a page boundary');
  const map=new Map();
  for(let i=0;i<pages.length;i++){
    const cursor=i===0?'':pages[i-1].nextCursor;
    assert.equal(typeof cursor,'string','missing cursor');
    assert(!map.has(cursor),'duplicate cursor');
    map.set(cursor,pages[i]);
  }
  assert.equal(pages.at(-1).nextCursor,null);
  return map;
}
const pageMaps={}, inventory={};
for(const code of Object.keys(tabs)){
  const pages=data[code];pageMaps[code]=oracle(pages);
  const rows=pages.flatMap(p=>p.items);
  assert.equal(rows.length,pages[0].total);
  if(code!=='ALL')assert(rows.every(r=>r.status===code),code+' leaked a different status');
  const field=code==='PLACED'?r=>r.placedAt:code==='ALL'?r=>r.placedAt??r.requestedAt:r=>r.requestedAt;
  checkOrder(rows,field,code==='PLACED'||code==='ALL',code);
  const values=rows.map(field);const equalTime=rows.slice(1).some((r,i)=>values[i]&&values[i]===values[i+1]);
  inventory[code]={rows:rows.length,pages:pages.length,equalTime};
}
assert(Object.values(inventory).some(i=>i.equalTime),'regression fixture should include an equal time');
const all=new Map(data.ALL.flatMap(p=>p.items).map(r=>[r.qualificationId,r]));
const perTree=data.perTree.map(state=>state.pending??state);
const stateByPage=new Map(data.perTree.map((state,i)=>[perTree[i],state]));
const treeMap=oracle(perTree);
checkOrder(perTree.flatMap(page=>page.items),r=>r.requestedAt??all.get(r.qualificationId)?.requestedAt,false,'per tree');
async function run(browser,width,scheme) {
  const page=await browser.newPage({viewport:{width,height:width<600?844:900},hasTouch:width<600,isMobile:width<600,colorScheme:scheme,serviceWorkers:'block'});
  const requests=[],errors=[];
  page.setDefaultTimeout(7500);page.on('pageerror',e=>errors.push(e.message));
  await mount(page,site,scheme.toUpperCase());
  await page.route('**/api/v1/**',async route=>{
    const req=route.request(),u=new URL(req.url()),path=u.pathname.slice('/api/v1'.length);
    if(req.method()==='OPTIONS')return route.fulfill({status:204});
    assert.equal(req.method(),'GET','unwanted write: '+path);
    const reply=data=>route.fulfill({json:{data,meta:{api_version:'v1',request_id:'fixture',timestamp:now}}});
    if(path===monitor){
      const tab=u.searchParams.get('status')||'ALL',after=u.searchParams.get('after')||'';
      requests.push({tab,after});const answer=pageMaps[tab]?.get(after);assert(answer,'UI requested unknown cursor');
      return reply(answer);
    }
    if(path===trees+'/current')return reply({items:[tree],nextCursor:null});
    if(path===trees+'/'+tree.binaryTreeId+'/current-state'){
      const after=u.searchParams.get('after')||'';requests.push({tab:'tree',after});
      assert(treeMap.has(after),'UI requested unknown tree cursor');
      const pending=treeMap.get(after),actual=stateByPage.get(pending);
      return reply(actual.tree?actual:{tree,observedAt:now,pending,candidate:null,breadcrumbs:[],nodes:[]});
    }
    return route.fallback();
  });
  // A pending ball may not have a number yet. The fixture gives each order a unique public SL number.
  const seq=(rows)=>rows.map(r=>{assert.match(r.displayOrderNo,/^SL\d{11,}$/);return r.displayOrderNo;});
  async function checkRows(table,expected){
    await table.locator('tbody tr').nth(expected.length-1).waitFor({state:'attached'});
    await page.waitForFunction(({selector,first,last,n})=>{
      const list=[...document.querySelectorAll(selector+' tbody tr td:nth-child(2)')].map(el=>el.textContent.trim());
      return list.length===n&&list[0]===first&&list[list.length-1]===last;
    },{selector:table===mainTable?'.ct-monitor-table table':'.ct-pending table',first:expected[0],last:expected.at(-1),n:expected.length});
    assert.deepEqual(await table.locator('tbody tr td:nth-child(2)').allTextContents(),expected);
  }
  const mainTable=page.locator('.ct-monitor-table table'),panel=page.locator('.ct-monitor'),nav=page.getByRole('navigation',{name:'安置狀態篩選'});
  try {
    await page.goto(origin+trees);
    for(const [code,label] of Object.entries(tabs)){
      await nav.getByRole('button',{name:new RegExp('^'+label)}).click();
      const pages=data[code],next=panel.getByRole('button',{name:'下一頁'}),prev=panel.getByRole('button',{name:'上一頁'});
      for(let i=0;i<pages.length;i++){
        await checkRows(mainTable,seq(pages[i].items));
        const datesMatch=await mainTable.evaluate((table,items)=>{
          const format=new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'short'});
          const display=(at,empty)=>at?format.format(new Date(at)):empty;
          return [...table.tBodies[0].rows].every((row,idx)=>row.cells[4].innerText.includes(display(items[idx].requestedAt,'尚未提供'))&&row.cells[5].innerText===display(items[idx].placedAt,'尚未完成'));
        },pages[i].items);
        assert(datesMatch,'time labels differ from service data: '+code+' page '+(i+1));
        assert.equal(await prev.isDisabled(),i===0);assert.equal(await next.isDisabled(),i===pages.length-1);
        if(i+1<pages.length)await next.click();
      }
      const lastCursor=pages[pages.length-2].nextCursor;
      const start=requests.length;await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/v1'+monitor),panel.getByRole('button',{name:'更新監控'}).click()]);

      assert(requests.slice(start).some(r=>r.tab===code&&r.after===lastCursor),'refresh did not query active page');
      await checkRows(mainTable,seq(pages.at(-1).items));
      for(let i=pages.length-2;i>=0;i--){await prev.click();await checkRows(mainTable,seq(pages[i].items));}
      assert.equal(await prev.isDisabled(),true);
    }
    await panel.getByRole('button',{name:'下一頁'}).click();await checkRows(mainTable,seq(data.ALL[1].items));
    await nav.getByRole('button',{name:/^已完成/}).click();await checkRows(mainTable,seq(data.PLACED[0].items));
    assert.equal(await panel.getByRole('button',{name:'上一頁'}).isDisabled(),true,'tab change must reset cursor');
    await page.getByRole('complementary',{name:'樹清單'}).getByRole('button').filter({hasText:tree.treeCode}).click();
    await page.getByRole('navigation',{name:'組織檢視'}).getByRole('button',{name:/待安置球/}).click();
    const list=page.locator('.ct-pending'),table=list.locator('table'),more=list.getByRole('button',{name:'載入更多待安置球'}),expected=[];
    for(let i=0;i<perTree.length;i++){
      expected.push(...seq(perTree[i].items));await checkRows(table,expected);
      if(i+1<perTree.length)await more.click();
    }
    assert.equal(await more.count(),0);
    assert.equal(requests.filter(r=>r.tab==='tree').length,perTree.length);
    assert.deepEqual(errors,[]);
    return {width,scheme,inventory,tree:{rows:expected.length,pages:perTree.length},errors};
  } finally {await page.unrouteAll({behavior:'ignoreErrors'});await page.close();}
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const engine=process.env.ENGINE||'chromium',browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge'});
  try {
    const modes=engine==='webkit'?[[390,'dark']]:[[1366,'light'],[390,'dark']];
    const result=await Promise.allSettled(modes.map(([w,t])=>run(browser,w,t)));
    fs.writeFileSync(path.join(out,engine+'.json'),JSON.stringify(result.map(r=>r.status==='fulfilled'?r.value:{error:r.reason.message}),null,2));
    for(const r of result)if(r.status==='rejected')throw r.reason;
    console.log(engine,JSON.stringify(inventory),perTree.length+' per-tree pages verified');
  } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
