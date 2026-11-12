// Crawl the shipped router. State is forced on real rendered controls; fixtures isolate business data.
const fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright-core');
const {mount,origin}=require('./fixtures.cjs');
const {readText}=require('./contrast.cjs');
const [site,out]=process.argv.slice(2);
if(!site||!out)throw Error('Usage: node routes.cjs <assembled admin site> <output folder>');
const html=fs.readFileSync(path.join(site,'index.html'),'utf8');
const entry=html.match(/<script type="module"[^>]+src="([^"]+)"/)[1];
const js=fs.readFileSync(path.join(site,entry),'utf8');
const routes=[...new Set([...js.matchAll(/path:"(\/[^"]*)",element:/g)].map(row=>row[1].replace('/:id?','')))];
if(routes.length<45)throw Error('Expected full admin route inventory');
const reports=[];
function targets() {
  const controls=document.querySelectorAll('#admin-main :is(button,a[href],summary,[role=button],[role=tab],.click-row),header :is(button,a[href]),aside :is(button,a[href])');
  const seen=new Set();let n=0;
  for(const el of controls){
    if(el.matches(':disabled,[aria-disabled=true]')||!el.getClientRects().length||!el.textContent.trim())continue;
    const label=el.textContent.trim();
    const key=[el.tagName,el.className,el.getAttribute('role'),el.getAttribute('aria-pressed'),el.getAttribute('aria-selected'),el.getAttribute('aria-current'),el.parentElement.className,el.closest('header,aside,#admin-main')?.tagName].join('/');
    if(seen.has(key))continue;
    seen.add(key);el.setAttribute('data-qa-color-target',String(n++));
  }
}
async function chunk(browser,scheme,paths) {
  const ctx=await browser.newContext({viewport:{width:1280,height:900},colorScheme:scheme,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await ctx.newPage();await mount(page,site,scheme.toUpperCase());const cdp=await ctx.newCDPSession(page);
  await Promise.all([cdp.send('DOM.enable'),cdp.send('Runtime.enable')]);await cdp.send('CSS.enable');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    for(const route of paths){
      const r={scheme,route,errors:[],states:{},issues:[]};reports.push(r);const from=errors.length;
      try{
        await page.goto(origin+route,{waitUntil:'domcontentloaded'});
        await page.locator('main h1,main h2,h1').first().waitFor({timeout:3500}).catch(()=>{});
        if(route==='/organization/geo'){
          await page.getByRole('region',{name:'選擇根球'}).getByRole('button',{name:/測試會員01/}).click();
          await page.locator('.geo-map-controls button').first().waitFor({timeout:3500});
        }
        if(route==='/analytics')await page.locator('.pnasl-period button').first().waitFor({timeout:3500});
        if(route==='/marketing')await page.locator('.marketing-tabs button').first().waitFor({timeout:3500});
        await page.addStyleTag({content:'*,*::before,*::after{transition-duration:0s!important;animation-duration:0s!important}'});
        await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
        await page.evaluate(targets);
        const {root}=await cdp.send('DOM.getDocument');const {nodeIds}=await cdp.send('DOM.querySelectorAll',{nodeId:root.nodeId,selector:'[data-qa-color-target]'});
        const keyset=new Set();
        for(const [state,ps] of [['rest',[]],['hover',['hover']],['focus',['focus','focus-visible']],['active',['hover','active']]]){
          if(ps.length)await Promise.all(nodeIds.map(nodeId=>cdp.send('CSS.forcePseudoState',{nodeId,forcedPseudoClasses:ps}).catch(()=>{})));
          const output=await page.evaluate(({fn})=>{
            const measure=Function('return ('+fn+')')();
            const heading=document.querySelector('main h1,main h2,h1');
            return {heading:heading?.textContent.trim()||'',elements:[...document.querySelectorAll('[data-qa-color-target]')].map(el=>({tag:el.tagName,cls:String(el.className),anc:el.parentElement.className,txt:measure(el)}))};
          },{fn:readText.toString()});
          r.heading=output.heading;r.states[state]={controls:output.elements.length,textRuns:0,complex:0,failed:0};
          for(const e of output.elements){for(const t of e.txt){
            r.states[state].textRuns++;if(t.complex)r.states[state].complex++;
            if(t.pass)continue;r.states[state].failed++;
            const key=[e.cls,e.anc,t.label,t.ratio,state].join('|');
            if(!keyset.has(key)){keyset.add(key);r.issues.push({state,cls:e.cls,anc:e.anc,label:t.label,ratio:t.ratio,fg:t.foreground,bg:t.background,limit:t.limit});}
          }}
        }
      }catch(e){r.failure=e.message;}
      r.errors=errors.slice(from);
    }
  }finally{await ctx.close();}
}
(async()=>{
  fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const schemes=process.env.ONLY_THEME?[process.env.ONLY_THEME]:['dark','light'];
    const jobs=[];for(const scheme of schemes)for(let n=0;n<2;n++)jobs.push(chunk(browser,scheme,routes.filter((_,i)=>i%2===n)));
    await Promise.all(jobs);fs.writeFileSync(path.join(out,'routes.json'),JSON.stringify(reports,null,2));
    for(const scheme of schemes){const rows=reports.filter(r=>r.scheme===scheme);const patterns=new Set(rows.flatMap(r=>r.issues.map(i=>[i.state,i.cls,i.anc,i.ratio,i.fg,i.bg].join(' '))));
      console.log(scheme,rows.length+' routes',rows.filter(r=>r.failure||r.errors.length).length+' rendering errors',patterns.size+' contrast patterns');}
    if(process.env.QA_BASELINE!=='1'&&reports.some(r=>r.failure||r.errors.length||r.issues.length))process.exitCode=1;
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
