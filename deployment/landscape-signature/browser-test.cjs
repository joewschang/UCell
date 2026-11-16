const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, webkit } = require('playwright-core');

// Run against directories containing the old and proposed member index.html and assets.
// NODE_PATH must resolve playwright-core. CHROME may point to a system Chromium / Edge.
const [baseRoot, candidateRoot, evidenceDir] = process.argv.slice(2);
assert(baseRoot && candidateRoot && evidenceDir, 'Usage: node browser-test.cjs BASE CANDIDATE EVIDENCE');
fs.mkdirSync(evidenceDir, { recursive: true });
const application = '00000000-0000-4000-8000-000000000123';
const origin = 'https://signature.invalid';
const portrait = { width: 390, height: 844 };
const landscape = { width: 844, height: 390 };
const by = name => `[data-signature="${name}"]`;

async function mount(browser, root, viewport, theme, approvedResign=false) {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const src = html.match(/<script\b[^>]*\bsrc=["'](\/assets\/[^"']+\.js)["']/)?.[1];
  assert(src, 'Member app entry is missing');
  const js = fs.readFileSync(path.join(root, src), 'utf8');
  const marker = 'xE(document.getElementById("root")).render(';
  assert.equal(js.split(marker).length, 2, 'Member entry point changed');
  const code = js.slice(0, js.indexOf(marker)) + `
    Kf = async () => ({documents:[], signingContext:{name:"測試會員", version:1,
      snapshotHash:"qa-snapshot", contract:{id:"test-contract",title:"測試用合約",version:"r1",contentHash:"qa-hash"}}});
    mR = async (contract,key) => { window.testConsent = [contract,key]; };
    Ol = async (id,type,file,hash) => {window.testUpload = {id,type,hash,file};};
    ${approvedResign ? `
    q = async (url,request) => {
      if(url.endsWith("/view")) return {paper:"QA",reason:"測試",fields:{legalName:"測試會員"},
        contract:{id:"test-contract",title:"測試用合約",version:"r1",content:"請確認本段測試資料。"},
        digest:"qa-snapshot",declaration:"測試簽名聲明"};
      if(url.endsWith("/sign")) {window.testSign = {path:url,method:request.method,...JSON.parse(request.body)};return {};}
      throw new Error("Unexpected request: "+url);
    };
    ${marker}r.jsx(Em,{task:{status:"OPEN",requested_at:"2026-11-12",id:"${application}"},refresh:()=>{}}));`
    :`${marker}r.jsx(Fl,{applicationId:"${application}",onReady:()=>{},readContract:false}));`}
  `;
  // Retain deployed style order, including inline styles. Unrelated member services stay offline.
  const styles = (html.match(/<link\b[^>]*rel=["']stylesheet["'][^>]*>|<style\b[^>]*>[\s\S]*?<\/style>/g) || []).join('');
  const ctx = await browser.newContext({ viewport, colorScheme: theme, hasTouch: true, isMobile: true });
  await ctx.addInitScript(() => {
    // Simulate a LINE webview that can neither request fullscreen nor lock orientation.
    HTMLElement.prototype.requestFullscreen = () => Promise.reject(new DOMException('Unsupported', 'NotSupportedError'));
    if (screen.orientation) Object.defineProperty(screen.orientation, 'lock', {value:() => Promise.reject(new Error('Unsupported'))});
  });
  await ctx.route('**/*', route => {
    const u = new URL(route.request().url());
    if (u.origin !== origin) return route.abort();
    if (u.pathname === '/') return route.fulfill({contentType:'text/html', body:`<!doctype html><html lang="zh-Hant" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">${styles}<div id="root"></div><script type="module" src="${src}"></script></html>`});
    if (u.pathname === src) return route.fulfill({contentType:'text/javascript', body:code});
    if (u.pathname.includes('/welcome-sound/')) return route.fulfill({contentType:'text/javascript',body:'export function enterMemberCenter(){}'});
    if (u.pathname.includes('/liff-')) return route.fulfill({contentType:'text/javascript',body:'export default {}'});
    // The candidate is deployed as an overlay. Retain every inherited base asset.
    for(const dir of [root,baseRoot]) {
      const target=path.join(dir,u.pathname);
      if(fs.existsSync(target) && fs.statSync(target).isFile()) return route.fulfill({path:target});
    }
    if (u.pathname.endsWith('.css') && !u.pathname.includes('signature') && !u.pathname.startsWith('/assets/index-')) return route.fulfill({contentType:'text/css',body:''});
    return route.fulfill({status:404,body:''});
  });
  const page = await ctx.newPage();
  page.on('pageerror', err => console.error('Page error:', err.message));
  page.setDefaultTimeout(6000);
  await page.goto(origin);
  await page.locator(approvedResign?'article':'.membership-signature').waitFor();
  return {ctx, page, touch:browser.browserType().name()==='chromium'?await ctx.newCDPSession(page):null};
}

function touchPoint(x, y, id) { return {x, y, id, radiusX:3, radiusY:3, force:0.6}; }
async function send(touch, type, touchPoints) {
  await touch.send('Input.dispatchTouchEvent', {type, touchPoints});
}

// Draw equal physical distances along the paper's own horizontal/vertical directions.
// In locked portrait mode the entire paper is CSS-rotated. Use only its orientation
// here, not the application's point mapping or the buffer-to-screen scaling factors.
async function drawL(touch, paper, leftHand) {
  const geom = await paper.evaluate(c => {
    const r = c.getBoundingClientRect();
    let m = new DOMMatrix();
    for (let el = c; el instanceof Element; el = el.parentElement) {
      const trans = getComputedStyle(el).transform;
      if (trans !== 'none') m = new DOMMatrix(trans).multiply(m);
    }
    return {cx:r.x+r.width/2, cy:r.y+r.height/2, side:Math.min(r.width,r.height)*0.44,
      ax:m.a/Math.hypot(m.a,m.b), ay:m.b/Math.hypot(m.a,m.b),
      bx:m.c/Math.hypot(m.c,m.d), by:m.d/Math.hypot(m.c,m.d)};
  });
  const {cx,cy,side,ax,ay,bx,by} = geom;
  const pt = (x,y) => touchPoint(cx+((x-.5)*ax+(y-.5)*bx)*side,cy+((x-.5)*ay+(y-.5)*by)*side,2);
  const grip = [];
  if (leftHand) {
    const box = await leftHand.boundingBox();
    assert(box && box.width>0 && box.height>0, 'Left-hand grip is missing');
    grip.push(touchPoint(box.x+box.width/2,box.y+box.height/2,1));
    await send(touch, 'touchStart', grip);
    assert.equal(await leftHand.getAttribute('data-held'),'true','Grip did not register the first finger');
  }
  await send(touch, 'touchStart', [...grip,pt(0,0)]);
  for(let i=1;i<=5;i++) await send(touch,'touchMove',[...grip,pt(0,i/5)]);
  for(let i=1;i<=5;i++) await send(touch,'touchMove',[...grip,pt(i/5,1)]);
  if(leftHand) assert.equal(await leftHand.getAttribute('data-held'),'true','Grip was released while the other hand was writing');
  await send(touch,'touchEnd',[]);
}

// Also runs inside Chromium to inspect decoded PNG pixels, independently of the ink model.
function measureInk(canvas, area) {
  const [x,y,w,h] = area ?? [0,0,canvas.width,canvas.height];
  const pixels=canvas.getContext('2d').getImageData(x,y,w,h).data;
  const darkAt=(xx,yy) => {
    const i=(yy*w+xx)*4, a=pixels[i+3]/255;
    return 255*(1-a)+a*Math.max(pixels[i],pixels[i+1],pixels[i+2])<100;
  };
  let left=w, right=-1, top=h, bottom=-1, count=0;
  for(let yy=0;yy<h;yy++) for(let xx=0;xx<w;xx++) if(darkAt(xx,yy)){
    left=Math.min(left,xx);right=Math.max(right,xx);top=Math.min(top,yy);bottom=Math.max(bottom,yy);count++;
  }
  if(!count) return null;
  const width=right-left+1, height=bottom-top+1;
  const hasNear=(xx,yy) => {
    for(let j=-3;j<=3;j++) for(let i=-3;i<=3;i++) if(darkAt(Math.round(xx+i),Math.round(yy+j))) return true;
    return false;
  };
  return {width,height,left,top,ratio:width/height,
    arms:[hasNear(left+1,top+height*.5),hasNear(left+width*.5,bottom-1)],
    emptyCorner:!hasNear(right-1,top+1)};
}

function assertShape(ink) {
  assert(ink && ink.width>25 && ink.height>25, 'Missing or tiny handwritten mark');
  assert(Math.abs(ink.ratio-1)<.055, `Square was distorted: ${JSON.stringify(ink)}`);
  assert.deepEqual(ink.arms,[true,true], 'Mark rotated, mirrored, clipped, or bridged');
  assert(ink.emptyCorner, 'Stray mark in the upper-right');
}

async function checkSaved(page, preview, label, expectSquare=true) {
  const ink = await preview.evaluate(measureInk);
  if(expectSquare) assertShape(ink);
  await page.locator('.membership-signature input[type="checkbox"]').check();
  await page.getByRole('button',{name:'儲存會員簽名',exact:true}).click();
  await page.waitForFunction(() => window.testUpload?.file,null,{timeout:6000});
  const result = await page.evaluate(async () => {
    const {file,id,hash,type} = window.testUpload;
    const image = await createImageBitmap(file);
    const canvas = document.createElement('canvas');
    canvas.width=image.width; canvas.height=image.height;
    canvas.getContext('2d').drawImage(image,0,0);
    window.testEvidenceCanvas=canvas;
    return {id,hash,type,mime:file.type,name:file.name,width:canvas.width,height:canvas.height,
      contract:window.testConsent[0],key:window.testConsent[1],png:canvas.toDataURL()};
  });
  assert.equal(result.id,application);
  assert.equal(result.type,'SIGNED_APPLICATION_AGREEMENT');
  assert.equal(result.hash,'qa-snapshot');
  assert.equal(result.contract,'test-contract');
  assert.match(result.key,/^[\da-f-]{36}$/);
  assert.equal(result.mime,'image/png');
  assert.equal(result.name,'membership-signature.png');
  assert.deepEqual([result.width,result.height],[1100,760]);
  const evidence = await page.evaluateHandle(() => window.testEvidenceCanvas);
  // 80,390 is the signature origin. Skip the surrounding 1px document border.
  const finalInk = await evidence.evaluate(measureInk,[82,392,896,296]);
  const deltas=[finalInk.width-ink.width,finalInk.height-ink.height,finalInk.left+2-ink.left,finalInk.top+2-ink.top];
  assert(deltas.every(v=>Math.abs(v)<=1),`PNG ink differs from the accepted preview by ${deltas} pixels`);
  if(expectSquare) assertShape(finalInk);
  fs.writeFileSync(path.join(evidenceDir,label+'-stored.png'),Buffer.from(result.png.split(',')[1],'base64'));
  return finalInk;
}

async function baseline(browser) {
  const {ctx,page,touch}=await mount(browser,baseRoot,portrait,'light');
  try {
    await page.getByLabel('放大簽名區',{exact:true}).click();
    const paper=page.locator('dialog canvas');
    await drawL(touch,paper);
    const dim=await paper.boundingBox();
    await page.locator('dialog').getByRole('button',{name:'完成返回'}).last().click();
    const ink=await checkSaved(page,page.locator('canvas').first(),'before',false);
    assert(Math.abs(ink.ratio-1)>.15,'Could not reproduce the reported distortion on the old deployed page');
    return {pad:[dim.width,dim.height],stored:[ink.width,ink.height],ratio:ink.ratio};
  } finally { await ctx.close(); }
}

async function visibleInside(page,selector) {
  const el = page.locator(by(selector));
  await el.waitFor({state:'visible'});
  const box = await el.boundingBox(), vp=page.viewportSize();
  assert(box && box.x>=-1 && box.y>=-1 && box.x+box.width<=vp.width+1 && box.y+box.height<=vp.height+1,
    `${selector} is outside the viewport: ${JSON.stringify(box)}`);
}

async function screenshot(page,name) {
  await page.screenshot({path:path.join(evidenceDir,name+'.png'),animations:'disabled'});
}

async function contrast(locator) {
  const {foreground,background}=await locator.evaluate(el=>{
    let bg;
    for(let n=el;n;n=n.parentElement) {
      bg=getComputedStyle(n).backgroundColor;
      if(bg!=='rgba(0, 0, 0, 0)' && bg!=='transparent') break;
    }
    return {foreground:getComputedStyle(el).color,background:bg};
  });
  const luminance=color=>{
    const c=color.match(/[\d.]+/g).slice(0,3).map(Number).map(n=>n/255).map(n=>n<=.04045?n/12.92:((n+.055)/1.055)**2.4);
    return c[0]*.2126+c[1]*.7152+c[2]*.0722;
  };
  const [low,high]=[luminance(foreground),luminance(background)].sort((a,b)=>a-b);
  const ratio=(high+.05)/(low+.05);
  assert(ratio>=4.5,`Text contrast ${ratio.toFixed(2)}: ${foreground} on ${background}`);
  return ratio;
}

async function exercise(browser, theme, mode) {
  const {ctx,page,touch}=await mount(browser,candidateRoot,portrait,theme);
  const sel=name=>page.locator(by(name));
  const click=name=>sel(name).click();
  try {
    await click('open');
    await visibleInside(page,'orientation');
    await visibleInside(page,'fallback');
    assert.equal(await sel('paper').isVisible(),false,'Portrait gate should prevent vertical signing');
    const contrasts = [await contrast(sel('orientation').getByRole('heading')),await contrast(sel('fallback'))];
    await screenshot(page,`${theme}-rotate`);
    if(mode==='native') await page.setViewportSize(landscape);
    else await click('fallback');
    for(const key of ['paper','grip','cancel','finish']) await visibleInside(page,key);
    await drawL(touch,sel('paper'),sel('grip'));
    const first = await sel('paper').evaluate(measureInk);
    assertShape(first);
    for(const locator of [sel('grip').locator('span'),sel('cancel'),sel('finish')]) contrasts.push(await contrast(locator));
    await screenshot(page,`${theme}-${mode}`);
    if(mode==='native') {
      await page.setViewportSize(portrait);
      await visibleInside(page,'orientation');
      await page.setViewportSize(landscape);
      await visibleInside(page,'paper');
    } else {
      await click('flip');
      await visibleInside(page,'paper');
    }
    assert.deepEqual(await sel('paper').evaluate(measureInk),first,'Rotation changed the ink');
    await click('undo');
    assert.equal(await sel('paper').evaluate(measureInk),null);
    await drawL(touch,sel('paper'),sel('grip'));
    assertShape(await sel('paper').evaluate(measureInk));
    await click('finish');
    const accepted = await sel('preview').evaluate(c=>c.toDataURL());
    await click('open');
    if(mode==='fallback' && await sel('orientation').isVisible()) await click('fallback');
    await click('clear');
    assert.equal(await sel('paper').evaluate(measureInk),null);
    await click('cancel');
    await click('discard');
    assert.equal(await sel('preview').evaluate(c=>c.toDataURL()),accepted,'Cancelled clear changed the accepted signature');
    await page.setViewportSize(portrait);
    const ink=await checkSaved(page,sel('preview'),`${theme}-${mode}`);
    return {...ink,minTextContrast:Math.min(...contrasts)};
  } finally { await ctx.close(); }
}

async function approved(browser) {
  const {ctx,page,touch}=await mount(browser,candidateRoot,landscape,'dark',true);
  const sel=name=>page.locator(by(name));
  try {
    await page.getByRole('button',{name:'開啟並核對合約'}).click();
    assert.equal(await sel('open').count(),0);
    await page.getByRole('button',{name:'開啟並閱讀會員合約'}).click();
    await page.locator('.contract-scroll').evaluate(el=>{el.scrollTop=el.scrollHeight;el.dispatchEvent(new Event('scroll'));});
    await page.getByLabel('我已閱讀並同意本版本會員合約與隱私告知').check();
    await page.getByRole('button',{name:'同意並繼續'}).click();
    await sel('open').click();
    await drawL(touch,sel('paper'),sel('grip'));
    await sel('finish').click();
    assertShape(await sel('preview').evaluate(measureInk));
    const submit=page.getByRole('button',{name:'確認並送出簽名'});
    assert(await submit.isDisabled(),'The existing final declaration must be agreed separately');
    await page.getByLabel('測試簽名聲明').check();
    await submit.click();
    await page.waitForFunction(()=>window.testSign,null,{timeout:6000});
    const {ink,digest,agree,path:target,method}=await page.evaluate(()=>window.testSign);
    assert.equal(target,'/member/application-journey/approved-resign/'+application+'/sign');
    assert.equal(method,'POST');
    assert.equal(agree,true);
    assert.equal(digest,'qa-snapshot');
    assert.equal(ink.length,1,'Grip or touch release added extra strokes');
    const points=ink[0];
    assert(points.length>=3 && points.every(pair=>pair.length===2 && pair.every(n=>Number.isInteger(n)&&n>=0&&n<=1000)));
    const xs=points.map(p=>p[0]), ys=points.map(p=>p[1]);
    const width=(Math.max(...xs)-Math.min(...xs))*.9, height=(Math.max(...ys)-Math.min(...ys))*.3;
    assert(Math.abs(width/height-1)<.055,'Normalized re-sign coordinates distorted the mark');
    assert(points[0][0]<points.at(-1)[0] && points[0][1]<points.at(-1)[1],'Re-sign coordinates rotated or mirrored');
    return {strokes:ink.length,points:points.length,ratio:width/height};
  } finally { await ctx.close(); }
}

async function circleAndRotation(browser,lockedPortrait=false) {
  const compact={width:568,height:265};
  const {ctx,page}=await mount(browser,candidateRoot,lockedPortrait?portrait:compact,'dark');
  const sel=name=>page.locator(by(name));
  try {
    await sel('open').click();
    if(lockedPortrait) {await visibleInside(page,'orientation');await sel('fallback').click();}
    for(const key of ['paper','grip','undo','clear','finish','cancel']) await visibleInside(page,key);
    const box=await sel('paper').boundingBox();
    assert(Math.abs(Math.max(box.width,box.height)/Math.min(box.width,box.height)-3)<.03);
    const cx=box.x+box.width/2,cy=box.y+box.height/2,rad=Math.min(box.width,box.height)*.27;
    await page.mouse.move(cx+rad,cy);
    await page.mouse.down();
    for(let i=1;i<=32;i++) {
      const angle=i*2*Math.PI/32;
      await page.mouse.move(cx+rad*Math.cos(angle),cy+rad*Math.sin(angle));
    }
    const drawn=await sel('paper').evaluate(measureInk);
    assert(drawn && Math.abs(drawn.ratio-1)<.055,'The reference circle became elliptical');
    // Rotate while the pointer is still down. Moving that same pointer after rotation must
    // not connect the end of the discarded pointer capture to the new viewport.
    if(!lockedPortrait) {
      await page.setViewportSize(portrait);
      await visibleInside(page,'orientation');
    }
    await page.setViewportSize(compact);
    await visibleInside(page,'paper');
    await page.mouse.move(box.x+box.width*.9,cy);
    await page.mouse.up();
    assert.deepEqual(await sel('paper').evaluate(measureInk),drawn,'Rotation drew an extra connecting line');
    if(lockedPortrait) {
      await page.setViewportSize(portrait);
      await sel('fallback').click();
      await sel('flip').click();
      assert.deepEqual(await sel('paper').evaluate(measureInk),drawn,'Flipping a locked viewport changed the circle');
    }
    await sel('finish').click();
    const engine=browser.browserType().name();
    const ink=await checkSaved(page,sel('preview'),engine+(lockedPortrait?'-locked-circle':'-compact-circle'),false);
    assert(Math.abs(ink.ratio-1)<.055,'The saved circle became elliptical');
    return {width:ink.width,height:ink.height,ratio:ink.ratio,viewport:lockedPortrait?portrait:compact};
  } finally { await ctx.close(); }
}

(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROME || undefined,headless:true});
  try {
    const report={before:await baseline(browser)};
    console.log('Original square reproduction',report.before);
    if(candidateRoot!=='--baseline-only') {
      report.light=await exercise(browser,'light','native');
      report.dark=await exercise(browser,'dark','fallback');
      report.approvedResign=await approved(browser);
      report.compactCircle=await circleAndRotation(browser);
      if(process.env.WEBKIT) {
        const wk=await webkit.launch({executablePath:process.env.WEBKIT,headless:true});
        try {report.webkit={version:wk.version(),landscape:await circleAndRotation(wk),locked:await circleAndRotation(wk,true)};}
        finally {await wk.close();}
      }
    }
    fs.writeFileSync(path.join(evidenceDir,'results.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify(report,null,2));
  } finally { await browser.close(); }
})().catch(error=>{console.error(error);process.exitCode=1;});
