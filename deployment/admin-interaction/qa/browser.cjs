const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright-core');
const {mount,origin}=require('./fixtures.cjs');
const {readText}=require('./contrast.cjs');
const [site,out,phase='candidate']=process.argv.slice(2);
if(!site||!out)throw Error('Usage: node browser.cjs <assembled admin site> <evidence folder> [baseline]');
fs.mkdirSync(out,{recursive:true});
const baseline=phase==='baseline', report=[];
async function run(browser,engine,width,scheme,preference){
  const phone=width<500;
  const ctx=await browser.newContext({viewport:{width,height:phone?844:920},isMobile:phone,hasTouch:phone,colorScheme:scheme,reducedMotion:'reduce',serviceWorkers:'block'});
  const page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(9000);
  const label=[engine,width,scheme,preference].join('-'),result={label,steps:[],errors};report.push(result);
  async function visit(route){await page.goto(origin+route);await page.addStyleTag({content:'*,*::before,*::after{transition-duration:0s!important;scroll-behavior:auto!important}'});}
  async function measure(control,state){
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const text=await control.evaluate(readText);result.steps.push({state,text});assert(text.length>0,'no visible text '+state);
  }
  try{
    await mount(page,site,preference);
    await visit('/daily-operations');
    const cards=page.locator('.daily-cards'),card=cards.getByRole('button',{name:/待補件/});
    await card.waitFor();
    await measure(card,'daily-default');
    if(!phone){
      await card.hover();await measure(card,'daily-hover');
      await page.mouse.move(0,0);
      await cards.getByRole('button').first().focus();await page.keyboard.press('Tab');
      assert(await card.evaluate(el=>el===document.activeElement),'keyboard focus moved to the target');
      await measure(card,'daily-keyboard-focus');
      const box=await card.boundingBox();await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
      await measure(card,'daily-pointer-active');await page.mouse.up();
      await page.keyboard.press('Tab');await page.mouse.move(0,0);
    }else await card.tap();
    await page.waitForFunction(()=>document.querySelector('.daily-cards button:nth-child(2)')?.getAttribute('aria-pressed')==='true');
    await measure(card,phone?'daily-tapped':'daily-selected');
    await page.locator('.daily-operations').screenshot({path:path.join(out,label+'-daily.png')});
    await visit('/qualifications');
    const initial=page.getByRole('button').filter({hasText:/測試會員/});
    await initial.first().waitFor();
    const list=page.locator('#qualification-ball-list');
    result.initialRows=await initial.count();
    if(phase!=='baseline')await list.screenshot({path:path.join(out,label+'-picker.png')});
    result.listHeight=await list.count()?Math.round((await list.boundingBox())?.height??0):null;
    if(!phone)await initial.first().hover();
    await measure(initial.first(),'qualification-row');
    if(phone)await initial.first().tap();else await initial.first().click();
    const detail=page.locator('#ball-detail');
    await detail.getByText('測試會員01',{exact:true}).first().waitFor();
    result.selectedFirst=true;
    const firstTab=detail.getByRole('tab').first();
    if(await firstTab.count()){await measure(firstTab,'qualification-360-selected-tab');}
    result.scrollWidth=await page.evaluate(()=>document.documentElement.scrollWidth-innerWidth);
    result.postSelectRows=await initial.count();
    result.detailTop=await detail.evaluate(el=>Math.round(el.getBoundingClientRect().top));
    await page.screenshot({path:path.join(out,label+'-360.png')});
    if(!baseline){
      assert(result.initialRows<=15,'bounded initial qualification rows');
      assert(result.scrollWidth<=2,'qualifications overflow '+result.scrollWidth);
      const bad=result.steps.flatMap(s=>s.text.filter(t=>!t.pass).map(t=>[s.state,t.label,t.ratio,t.limit]));
      assert.equal(bad.length,0,'low contrast '+JSON.stringify(bad));
      assert.equal(errors.length,0,errors.join('|'));
    }
  }finally{await ctx.close();}
}
(async()=>{
  const engine=process.env.ENGINE||'chromium';
  const browser=engine==='webkit'?await webkit.launch():await chromium.launch({channel:'msedge',headless:true});
  try{
    const configs=engine==='webkit'?[[390,'dark','AUTO'],[390,'light','AUTO']]:[[1366,'dark','DARK'],[1366,'light','LIGHT'],[390,'dark','AUTO'],[390,'light','AUTO']];
    const batches=await Promise.allSettled(configs.map(c=>run(browser,engine,...c)));
    fs.writeFileSync(path.join(out,engine+'-targeted.json'),JSON.stringify(report,null,2));
    console.log(JSON.stringify(report.map(r=>({label:r.label,initialRows:r.initialRows,postSelectRows:r.postSelectRows,listHeight:r.listHeight,detailTop:r.detailTop,overflow:r.scrollWidth,errors:r.errors,contrast:r.steps.map(s=>[s.state,Math.min(...s.text.map(t=>t.ratio))])}))));
    for(const b of batches)if(b.status==='rejected')throw b.reason;
  }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
