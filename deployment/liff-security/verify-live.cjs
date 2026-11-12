const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require('../../member/node_modules/playwright'),m=require('./manifest.json');
(async()=>{const origin='https://member.ucell.life',browser=await chromium.launch({headless:true,channel:'msedge'});try{
 const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage();
 await page.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await page.goto(origin+'/',{waitUntil:'domcontentloaded'});await page.waitForFunction(()=>window.liff?.getVersion()==='2.31.1');
 const actual=await page.evaluate(()=>window.liff.getVersion());assert.equal(actual,'2.31.1');
 const request=context.request,root=await request.get(origin+'/'),html=await root.text();assert.match(root.headers()['cache-control'],/no-store/);
 const assets=[];for(const url of [m.sdkPath,...m.changes.map(c=>c.new)]){const response=await request.get(origin+url);assert.equal(response.status(),200);const bytes=await response.body();assert.deepEqual(bytes,fs.readFileSync(path.join(__dirname,'output',url)));assets.push({url,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),cache:response.headers()['cache-control']});}
 for(const c of m.changes){assert(html.includes(c.new));assert(!html.includes(c.old+'"'));const old=await request.get(origin+c.old,{maxRedirects:0});assert.match(old.headers()['cache-control'],/no-store/);if(c.old==='/greetings/entry.js'){assert.equal(old.status(),200);assert((await old.text()).includes(c.new));}else{assert.equal(old.status(),302);assert.equal(new URL(old.headers().location,origin).href,origin+c.new);}}
 const retired=m.retiredPaths.find(p=>!m.changes.some(c=>c.old===p));assert.equal((await request.get(origin+retired)).status(),410);
 const result={verifiedAtUTC:new Date().toISOString(),version:actual,source:'actual production window.liff.getVersion(), no SDK mocking',htmlCache:root.headers()['cache-control'],assets,legacyPaths:'main 302 safe relative target, greeting 200 dynamic import, retired sample 410; all no-store',limitations:'External LINE/API requests blocked during browser readback; no real account login/share or physical-device cache claim'};
fs.writeFileSync(path.join(__dirname,'evidence/live.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
