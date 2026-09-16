// Visual fixtures ONLY: Member mock UI and real isolated Admin DEV reads.
// This does not verify LINE, Entra, UAT, or Production.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const require=createRequire(new URL('../../member/package.json',import.meta.url));
const {chromium}=require('playwright');
const directory=new URL('./ux2/references/',import.meta.url);mkdirSync(directory,{recursive:true});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const browser=await chromium.launch({headless:true,channel:process.env.PLAYWRIGHT_CHANNEL??'msedge'});
const results=[];
try{
 for(const kind of ['member','admin']){
  const page=await browser.newPage();page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',route=>{const r=route.request(),u=new URL(r.url());return ['GET','HEAD'].includes(r.method())&&['http://127.0.0.1:5174','http://127.0.0.1:4173','http://127.0.0.1:3001'].includes(u.origin)?route.continue():route.abort()});
  if(kind==='admin'){await page.goto('http://127.0.0.1:4173/login');await page.getByRole('button',{name:'DEV：Super Admin',exact:true}).click();await page.getByRole('heading',{name:'營運總覽',exact:true}).waitFor()}
  const states=kind==='member'?[['dashboard','/','您好，示範會員'],['organization','/organization','我的組織'],['bonus','/bonuses','獎金明細']]:[['dashboard','/','營運總覽'],['person-qualification','/people','會員／自然人'],['bonus-settlement','/bonuses','獎金／結算營運']];
  for(const width of kind==='member'?[375,390,430,768]:[1366,1440,1920,768]){
   await page.setViewportSize({width,height:kind==='member'?844:900});
   for(const [state,path,title] of states){
    await page.goto(`http://127.0.0.1:${kind==='member'?5174:4173}${path}`);await page.getByRole('heading',{name:title,exact:true}).waitFor();await page.evaluate(()=>document.fonts.ready);
    if(kind==='admin'&&state==='person-qualification'){await page.getByLabel('姓名／手機／Email').fill('ADMIN PHASE2 ROOT FIXTURE');await page.waitForLoadState('networkidle');await page.getByRole('button',{name:/^查看 /}).first().click();await page.getByRole('dialog').waitFor();await page.getByRole('heading',{name:'Qualifications／Balls'}).waitFor();await page.waitForLoadState('networkidle');const qualification=page.getByRole('dialog').locator('button.list-row').first();await qualification.waitFor();await qualification.click();await page.getByRole('tab',{name:'Overview',exact:true}).waitFor();await page.waitForLoadState('networkidle')}
    if(kind==='member'){await page.getByLabel('目前資格').waitFor();await assert.doesNotReject(()=>page.getByText('目前為示範資料，不代表真實業績、獎金或訂單。',{exact:true}).waitFor())}
    if(kind==='admin'&&state==='person-qualification'){assert.equal(await page.getByRole('tab').count(),10,'owned Qualification must expose all ten detail tabs');await page.locator('.uc-qualification-detail').scrollIntoViewIfNeeded()}
    if(kind==='member'&&state==='dashboard'){assert.equal(await page.locator('.uc-member-identity').evaluate(n=>getComputedStyle(n).backgroundColor),'rgb(16, 47, 67)','shared navy token must load; white identity text requires dark surface')}
    if(kind==='member'&&state==='bonus'){assert.ok(await page.locator('.uc-award-timeline').count()>0,'Chinese lifecycle must replace legacy badge list');await page.locator('.uc-award-timeline').first().getByText('等待生效',{exact:true}).waitFor()}
    // Wait for actual read requests to settle rather than capturing skeletons.
    await page.waitForLoadState('networkidle');
    const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,`${kind}/${state}/${width} overflow`);
    const image=`${kind}-${state}-${width}.png`;await page.screenshot({path:new URL(image,directory).pathname.replace(/^\/([A-Za-z]:)/,'$1'),fullPage:false});
    results.push({kind,state,width,height:kind==='member'?844:900,overflow,image,sourceCommit:sha,fixture:kind==='member'?'EXPLICIT_MOCK_VISUAL_ONLY':'ISOLATED_ADMIN_DEV_HTTP_READS',productionVerified:false});
   }
  }
  if(kind==='admin'){
   await page.setViewportSize({width:1440,height:900});await page.goto('http://127.0.0.1:4173/people');const opener=page.getByRole('button',{name:/^查看 /}).first();await opener.click();const dialog=page.getByRole('dialog');await dialog.waitFor();assert.equal(await dialog.getAttribute('aria-labelledby')!==null,true);
   for(let i=0;i<12;i++){await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement?.closest('dialog')!==null),true,'native modal focus containment')}
   for(let i=0;i<6;i++){await page.keyboard.press('Shift+Tab');assert.equal(await page.evaluate(()=>document.activeElement?.closest('dialog')!==null),true,'reverse modal focus containment')}
   await page.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});
   assert.equal(await opener.evaluate(node=>node===document.activeElement),true,'modal restores focus to opener');
  }else{
   await page.goto('http://127.0.0.1:5174/');await page.getByLabel('目前資格').selectOption('q2');await page.getByRole('status').filter({hasText:'已切換至'}).waitFor();assert.equal(await page.getByLabel('目前資格').inputValue(),'q2');
   const targets=await page.locator('nav[aria-label="主要功能"] a').evaluateAll(nodes=>nodes.map(n=>({height:n.getBoundingClientRect().height,width:n.getBoundingClientRect().width})));assert.ok(targets.every(t=>t.height>=44&&t.width>=44),'mobile navigation touch targets');
  }
  assert.deepEqual(errors,[]);await page.close();
 }
 writeFileSync(new URL('results.json',directory),JSON.stringify({sourceCommit:sha,results,modalFocusTrap:'PASS',reverseTabAndRestoreFocus:'PASS',phase:'UX-2_REFINEMENT_REVIEW_ONLY',qualificationFeedback:'PASS',mobileNavTouchTargets:'PASS',formalLiff:'NOT_VERIFIED',formalEntra:'NOT_VERIFIED'},null,2)+'\n');console.log(`UX2_VISUAL_RESPONSIVE_PASS: ${results.length} references; modal keyboard containment/Escape; qualification feedback; mobile navigation touch targets. Member visual MOCK ONLY.`);
}finally{await browser.close()}
