// SITE_DIR optionally points at an assembled candidate site. By default test the public admin SPA.
// Only HTML and static assets come from the server. All API requests use synthetic records.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {chromium, webkit} = require('playwright-core');
const origin = new URL(process.env.ADMIN_URL || 'https://admin.ucell.life');
const candidate = process.env.SITE_DIR && path.resolve(process.env.SITE_DIR);
const prefix = '/api/v1/admin/observability/organization/';
const baseline = process.argv.includes('--baseline');
const evidence={mode:candidate?'candidate':'live',engine:process.env.ENGINE||'chromium',entry:null,passed:[],minimumTextContrast:{}};
const fixture = [
  [1,null,0,'林根球'],[2,1,1,'陳甲'],[3,1,2,'黃乙'],[4,1,3,'第三直推公司'],
  [5,2,1,'李孫球'],[6,5,1,'張曾孫球'],[7,6,1,'第四代'],[8,null,0,'另一支組織'],[9,8,1,'另一支直推']
].map(([n,parentNo,sequence,name]) => ({
  id:'00000000-0000-4000-8000-'+String(n).padStart(12,'0'),
  ballNo:'QA-'+String(n).padStart(2,'0'), name, parentNo, sequence, n
}));
const ball = n => fixture.find(row=>row.n===n);
const children = row => fixture.filter(candidate=>candidate.parentNo===row.n);
function sponsorReply(route,state,headers,meta){
  if(state.scenario==='loading')return new Promise(resolve=>{state.release=()=>resolve(sponsorReply(route,{scenario:'normal'},headers,meta));});
  if(state.scenario==='error')return route.fulfill({headers,status:503,json:{error:{code:'SERVICE_UNAVAILABLE',message:'組織暫無法讀取'},meta}});
  if(state.scenario==='conflict')return route.fulfill({headers,status:409,json:{error:{code:'SPONSOR_MAP_INTEGRITY_ERROR',message:'資料不一致'},meta}});
  const rows = state.scenario==='empty'?[]:[4,1,2,9,5,6,7,8,3].map(n=>{
    const row=ball(n);
    return {id:row.id,parentId:ball(row.parentNo)?.id??null,ballNo:row.ballNo,name:row.name,
      plan:n===4?'ELITE':'STARTER',active:n!==8,sponsorSequenceNo:row.sequence||null,createdAt:'2026-11-01T00:00:00Z'};
  });
  if(state.scenario==='invalid-parent')rows[0].parentId='missing';
  if(state.scenario==='duplicate')rows.push(rows[0]);
  if(state.scenario==='cycle')rows.find(row=>row.id===ball(1).id).parentId=ball(7).id;
  if(state.scenario==='wide'){
    for(let i=1;i<=61;i++){
      rows.push({id:'extra-root-'+String(i).padStart(2,'0'),parentId:null,name:'分支 '+i,ballNo:'ROOT-'+i,
        plan:'STARTER',active:true,sponsorSequenceNo:null,createdAt:'2026-11-12T00:00:00Z'});
    }
    for(let i=1;i<=200;i++){
      rows.push({id:'extra-direct-'+i,parentId:ball(1).id,name:'直推 '+i,ballNo:'DIRECT-'+i,
        plan:'STARTER',active:true,sponsorSequenceNo:i+3,createdAt:'2026-11-12T00:00:00Z'});
    }
  }
  const complete=state.scenario!=='incomplete';
  const total=rows.length+Number(state.scenario==='wrong-total');
  return route.fulfill({headers,json:{data:rows,meta:{...meta,complete,total,asOf:'2026-11-12T00:00:00Z'}}});
}
const legacyRows = (root,depth) => {
  const result=[];
  function visit(row,level,parentId) {
    result.push({qualification_id:row.id,parent_qualification_id:parentId,depth:level,ball_no:row.ballNo,
      legal_name:row.name,qualification_kind:'MEMBER_ORIGIN',plan_level_code:'STARTER',active_flag:true,
      sponsor_sequence_no:row.sequence});
    if(level<depth)children(row).forEach(child=>visit(child,level+1,row.id));
  }
  visit(root,0,null);
  return result;
};

async function open(browser,{width,theme,role='SUPER_ADMIN',scenario='normal'}) {
  const context=await browser.newContext({viewport:{width,height:850},colorScheme:theme,serviceWorkers:'block'});
  const page=await context.newPage();
  page.setDefaultTimeout(10000);
  const requests=[],writes=[],errors=[];
  const state={scenario};
  page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message);});
  if(process.env.QA_DEBUG){
    page.on('console',message=>{if(message.type()==='error')console.error('Browser console:',message.text());});
    page.on('requestfailed',request=>console.error('Failed:',new URL(request.url()).pathname,request.failure()?.errorText));
  }
  await page.addInitScript(theme=>{
    sessionStorage.setItem('ucell_admin_token','ui-fixture-only');
    localStorage.setItem('ucell.ui-theme-preference.v1',theme.toUpperCase());
  },theme);
  await page.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url()),p=url.pathname;
    if(p.startsWith('/api/')){
      const headers={'access-control-allow-origin':'*','access-control-allow-headers':'*','access-control-allow-methods':'GET,OPTIONS'};
      if(req.method()==='OPTIONS')return route.fulfill({status:204,headers});
      requests.push(p+url.search);
      const meta={request_id:'tree-synthetic',api_version:'v1'};
      if(req.method()!=='GET'){writes.push(req.method()+' '+p);return route.fulfill({status:405,headers,json:{error:{message:'Read only'}}});}
      const reply=(data,extra={})=>route.fulfill({headers,json:{data,meta:{...meta,...extra}}});
      if(p.endsWith('/auth/admin/me'))return reply({role,subject:'Synthetic browser QA'});
      if(p.startsWith('/api/v1/admin/qualifications/')){
        const row=fixture.find(node=>node.id===p.split('/').pop());
        if(row)return reply({qualificationId:row.id,ballNo:row.ballNo,planLevelCode:'STARTER',activeFlag:true,status:'EFFECTIVE'});
      }
      if(p===prefix+'tree-roots'){
        const term=url.searchParams.get('q')||'';
        const rows=fixture.filter(row=>!term||row.name.includes(term)||row.ballNo.includes(term)||term==='0912000111'&&row.n===1);
        return reply(rows.map(row=>({id:row.id,name:row.name,ballNo:row.ballNo})),{page:1,hasNext:false});
      }
      if(p===prefix+'binary-map')return reply([{binaryTreeId:'binary-subject',treeName:'測試對碰樹',treeCode:'B',status:'ACTIVE'}]);
      if(p===prefix+'binary-map/binary-subject')return reply([1,2,3].map(n=>({...ball(n),position:String(n),plan:'STARTER',active:true})));
      if(p.startsWith(prefix+'sponsor-tree/')){
        const root=fixture.find(row=>row.id===p.split('/').pop());
        assert(root,'Unexpected sponsor root '+p);
        return reply(legacyRows(root,Number(url.searchParams.get('depth')||2)));
      }
      if(p===prefix+'sponsor-map')return sponsorReply(route,state,headers,meta);
      return route.fulfill({status:404,headers,json:{error:{code:'FIXTURE_ROUTE_MISSING',message:'此測試無資料'},meta}});
    }
    if(req.method()!=='GET'&&req.method()!=='HEAD'){writes.push(req.method()+' '+p);return route.abort();}
    if(url.origin!==origin.origin)return route.abort();
    if(candidate){
      const file=path.resolve(candidate,'.'+decodeURIComponent(p));
      assert(file===candidate||file.startsWith(candidate+path.sep),'Unexpected static path');
      if(fs.existsSync(file)&&fs.statSync(file).isFile())return route.fulfill({path:file});
      if(req.resourceType()==='document')return route.fulfill({path:path.join(candidate,'index.html')});
      return route.abort();
    }
    return route.continue();
  });
  return {page,context,requests,writes,errors,state,width,theme};
}

async function newPageAt(page,pathname) {
  await page.goto(new URL(pathname,origin).href);
  await page.waitForFunction(()=>document.documentElement.dataset.theme);
  const entry=await page.locator('script[type="module"][src]').first().getAttribute('src');
  assert(entry,'Admin module is missing');
  assert(!evidence.entry||evidence.entry===entry,'The admin build changed during this run');
  evidence.entry=entry;
  if(process.env.EXPECT_MAIN)assert.equal(path.posix.basename(entry),process.env.EXPECT_MAIN);
}

async function testExisting(ui) {
  const {page,requests}=ui;
  await newPageAt(page,'/organization/binary');
  const bm=page.getByRole('region',{name:'二元樹全貌'});
  await bm.getByRole('button',{name:/QA-01.*查看球 360/}).waitFor();
  await bm.getByRole('button',{name:'放大',exact:true}).click();
  assert.equal(await bm.getByTitle('還原為 100%').textContent(),'140%');
  await bm.getByTitle('還原為 100%').click();
  await bm.getByRole('button',{name:'顯示全樹'}).click();
  await page.getByLabel('組織類型').selectOption('SPONSOR');
  assert.equal(await bm.count(),0);
  const picker=page.getByRole('region',{name:'選擇根球'});
  const field=picker.getByRole('searchbox');
  await field.fill('0912000111');
  await picker.getByRole('button',{name:/林根球/}).click();
  const pathNav=page.getByRole('navigation',{name:'展開路徑'});
  const explore=(n)=>page.getByRole('button',{name:'以 '+ball(n).ballNo+' 展開組織',exact:true});
  await explore(4).waitFor();
  assert(requests.some(item=>item.includes('tree-roots?')&&item.includes('q=0912000111')));
  for(const n of [2,5,6]){
    await explore(n).click();
    await pathNav.getByRole('button',{name:ball(n).ballNo,exact:true}).waitFor();
    assert(requests.some(item=>item.includes('sponsor-tree/'+ball(n).id)));
  }
  await pathNav.getByRole('button',{name:ball(1).ballNo,exact:true}).click();
  await explore(4).waitFor();
  await field.fill('QA-08');
  await picker.getByRole('button',{name:/另一支組織/}).click();
  await explore(9).waitFor();
  assert.equal(await explore(4).count(),0);
}

const region=page=>page.getByRole('region',{name:'推薦樹全貌',exact:true});
const memberNode=(map,n)=>map.getByRole('button',{name:new RegExp(ball(n).ballNo+'.*查看球 360')});
const mapRequests=ui=>ui.requests.filter(request=>request===prefix+'sponsor-map').length;

async function savePreview(ui,map){
  if(!process.env.QA_RESULTS_DIR||process.env.ENGINE==='webkit')return;
  if(!((ui.width===1366&&ui.theme==='light')||(ui.width===390&&ui.theme==='dark')))return;
  fs.mkdirSync(process.env.QA_RESULTS_DIR,{recursive:true});
  await map.screenshot({path:path.join(process.env.QA_RESULTS_DIR,'sponsor-'+ui.width+'-'+ui.theme+'.png'),animations:'disabled'});
}

async function testMap(ui){
  const {page}=ui;
  await newPageAt(page,'/organization');
  const map=region(page),root=map.getByRole('combobox',{name:'全貌起點'});
  await memberNode(map,1).waitFor();
  await map.getByText(/已編球號且未作廢、未關閉的球.*目前有效推薦關係中的球/).waitFor();
  assert.equal(await page.locator('html').getAttribute('data-theme'),ui.theme);
  const initialRequests=mapRequests(ui);
  await map.getByRole('button',{name:'顯示全樹',exact:true}).click();
  await map.getByText(/9 顆球.*2 個起點.*5 層/).waitFor();
  const boxes=new Map();
  for(const row of fixture){
    const node=memberNode(map,row.n);
    await node.waitFor();
    assert((await node.getAttribute('aria-label')).includes(row.name),'Node name: '+row.name);
    boxes.set(row.n,await node.boundingBox());
  }
  for(const row of fixture.filter(row=>row.parentNo)){
    assert(boxes.get(row.parentNo).y<boxes.get(row.n).y,'Parent above child: '+row.name);
  }
  assert(boxes.get(2).x<boxes.get(3).x&&boxes.get(3).x<boxes.get(4).x,'Three siblings in sponsor order');
  for(const n of [1,8]){
    const contrasts=await memberNode(map,n).evaluate(node=>{
      const lightness=color=>{
        const [r,g,b]=color.match(/[\d.]+/g).slice(0,3).map(n=>Number(n)/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
        return r*.2126+g*.7152+b*.0722;
      };
      const bg=lightness(getComputedStyle(node).backgroundColor);
      return ['strong','small','.sov-node-top','.sov-ball-no'].map(selector=>{
        const fg=lightness(getComputedStyle(node.querySelector(selector)).color);
        return [selector,(Math.max(fg,bg)+.05)/(Math.min(fg,bg)+.05)];
      });
    });
    for(const [label,ratio] of contrasts){
      assert(ratio>=4.5,ui.theme+' '+label+' contrast '+ratio.toFixed(2));
      evidence.minimumTextContrast[ui.theme]=Math.min(evidence.minimumTextContrast[ui.theme]??Infinity,Number(ratio.toFixed(2)));
    }
  }
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'Document horizontal overflow');
  await savePreview(ui,map);
  await memberNode(map,1).focus();
  for(const [key,n] of [['ArrowDown',2],['ArrowRight',3],['ArrowRight',4],['ArrowUp',1]]){
    await page.keyboard.press(key);
    assert.equal(await memberNode(map,n).evaluate(node=>node===document.activeElement),true,'Keyboard '+key+' → '+ball(n).ballNo);
  }
  const reset=map.getByRole('button',{name:'還原為 100%'});
  await reset.click();
  const defaultZoom=await reset.textContent();
  await map.getByRole('button',{name:'放大',exact:true}).click();
  assert.notEqual(await reset.textContent(),defaultZoom);
  await map.getByRole('button',{name:'縮小',exact:true}).click();
  await reset.click();
  assert.equal(await reset.textContent(),defaultZoom);
  await root.selectOption(ball(1).id);
  await memberNode(map,4).waitFor();
  assert.equal(await memberNode(map,8).count(),0);
  for(const n of [2,5,6]){
    await map.getByRole('button',{name:'顯示整個支系'}).click();
    await memberNode(map,n).click();
    const drawer=page.getByRole('dialog',{name:new RegExp(ball(n).ballNo)});
    await drawer.getByRole('button',{name:'以此球為起點'}).click();
    await map.getByRole('button',{name:'顯示整個支系'}).click();
    await memberNode(map,7).waitFor();
    assert.equal(await memberNode(map,ball(n).parentNo).count(),0);
  }
  await map.getByRole('button',{name:'返回上一個起點'}).click();
  assert.equal(await root.inputValue(),ball(5).id);
  await root.selectOption(ball(8).id);
  await memberNode(map,9).waitFor();
  assert.equal(await memberNode(map,5).count(),0);
  await map.getByRole('button',{name:'返回全部推薦樹'}).click();
  await memberNode(map,3).waitFor();
  assert.equal(mapRequests(ui),initialRequests,'Reframing must not query the complete forest again');
  await memberNode(map,3).click();
  const detail=page.getByRole('dialog',{name:/QA-03/});
  await detail.waitFor();
  await detail.getByText(/黃乙/).first().waitFor();
  await detail.getByRole('button',{name:'關閉'}).click();
  assert.equal(await detail.count(),0);
  await page.getByLabel('組織類型').selectOption('BINARY');
  await page.getByRole('region',{name:'二元樹全貌'}).getByRole('button',{name:/QA-01.*查看球 360/}).waitFor();
  assert.equal(await map.count(),0);
  await page.getByLabel('組織類型').selectOption('SPONSOR');
  await memberNode(map,4).waitFor();
  const picker=page.getByRole('region',{name:'選擇根球'});
  await picker.getByRole('searchbox').fill('第三直推公司');
  await Promise.all([page.waitForRequest(request=>request.url().includes('sponsor-tree/'+ball(4).id)),picker.getByRole('button',{name:/第三直推公司/}).click()]);
  await map.getByText(/1 顆球.*1 個起點.*1 層/).waitFor();
  await memberNode(map,4).waitFor();
  assert.equal(await root.inputValue(),ball(4).id,'Legacy root selector also updates the full overview');
  assert(ui.requests.some(request=>request.includes('sponsor-tree/'+ball(4).id)),'Legacy view still resolves the selected member');
}

async function testStates(browser){
  const options={width:390,theme:'dark'};
  const denied=await open(browser,{...options,role:'FINANCE'});
  await newPageAt(denied.page,'/organization');
  await denied.page.getByRole('heading',{name:'無權存取此後台頁面'}).waitFor();
  assert.equal(await region(denied.page).count(),0);
  assert.equal(mapRequests(denied),0);
  await finish(denied);
  passed('FINANCE: route denied without organization API data');
  for(const scenario of ['loading','empty','error','conflict','incomplete','wrong-total','invalid-parent','duplicate','cycle']){
    const ui=await open(browser,{...options,scenario});
    await newPageAt(ui.page,'/organization');
    const map=region(ui.page);
    if(scenario==='loading'){
      await map.getByText(/載入/).first().waitFor();
      assert.equal(await memberNode(map,1).count(),0);
      if(!ui.state.release)await ui.page.waitForRequest(request=>new URL(request.url()).pathname===prefix+'sponsor-map');
      assert.equal(typeof ui.state.release,'function');
      await ui.state.release();
      await memberNode(map,1).waitFor();
    }else if(scenario==='empty'){
      await map.getByText(/尚無|沒有|無推薦/).first().waitFor();
      assert.equal(await map.getByRole('button',{name:/查看球 360/}).count(),0);
    }else{
      const error=map.getByRole('alert');
      await error.waitFor();
      assert((await error.textContent()).trim().length>0);
      if(scenario==='conflict')assert.match(await error.textContent(),/推薦關係資料不一致.*核對目前的推薦紀錄/);
      assert.equal(await map.getByRole('button',{name:/查看球 360/}).count(),0);
      if(scenario==='error'){
        ui.state.scenario='normal';
        await map.getByRole('button',{name:/重試|重新載入/}).click();
        await memberNode(map,1).waitFor();
      }
    }
    await finish(ui);
    passed('sponsor map '+scenario);
  }
  const wide=await open(browser,{...options,scenario:'wide'});
  await newPageAt(wide.page,'/organization');
  const map=region(wide.page);
  await map.getByText(/270 顆球.*63 個起點.*5 層/).waitFor();
  await map.getByRole('button',{name:'顯示全樹'}).click();
  await map.getByRole('button',{name:'下一頁起點'}).click();
  await map.getByRole('combobox',{name:'全貌起點'}).selectOption('extra-root-61');
  await map.getByRole('button',{name:/ROOT-61.*查看球 360/}).waitFor();
  await map.getByText(/1 顆球.*1 個起點.*1 層/).waitFor();
  await map.getByRole('button',{name:'返回全部推薦樹'}).click();
  await map.getByText(/270 顆球.*63 個起點.*5 層/).waitFor();
  assert.equal(mapRequests(wide),1);
  await finish(wide);
  passed('270 balls, 203 direct referrals, 63 roots, last-page root selection');
}

function passed(scenario){evidence.passed.push(scenario);console.log('PASS',scenario);}
function finish(ui){
  assert.deepEqual(ui.errors,[],'Uncaught browser errors');
  assert.deepEqual(ui.writes,[],'Unexpected writes');
  return ui.context.close();
}

(async()=>{
  const browser=process.env.ENGINE==='webkit'?await webkit.launch():await chromium.launch({executablePath:process.env.CHROME});
  try{
    for(const [width,theme,role] of [[1366,'light','SUPER_ADMIN'],[390,'dark','COMPLIANCE_AUDIT'],[390,'light','MEMBERSHIP_OPS'],[1366,'dark','SUPER_ADMIN']]){
      const ui=await open(browser,{width,theme,role});
      await testExisting(ui);
      if(!baseline)await testMap(ui);
      await finish(ui);
      passed([role,width,theme,baseline?'binary map + legacy sponsor':'binary map + sponsor overview + legacy sponsor'].join(' '));
    }
    if(!baseline)await testStates(browser);
    if(process.env.QA_RESULTS_DIR){
      fs.mkdirSync(process.env.QA_RESULTS_DIR,{recursive:true});
      const name=[evidence.mode,evidence.engine,baseline?'baseline':'verification'].join('-')+'.json';
      fs.writeFileSync(path.join(process.env.QA_RESULTS_DIR,name),JSON.stringify({...evidence,verifiedAt:new Date().toISOString()},null,2)+'\n');
    }
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
