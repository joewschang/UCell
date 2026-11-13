'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {chromium} = require('playwright-core');
// node verify.cjs <preview-directory | --live> [scenarios...]
// Every identity and API response is isolated. Only public UI assets are loaded.
const origin = 'https://admin.ucell.life';
const preview = process.argv[2] && process.argv[2] !== '--live' ? path.resolve(process.argv[2]) : null;
const scenarios = process.argv.slice(3);
const user = {preferredName:'稽核測試', role:'CUSTOMER_SERVICE', personId:'00000000-0000-4000-8000-000000000001', provider:'ENTRA'};
const expiry = new Date(Date.now()+3600000).toISOString();
const fakeToken = 'isolated-test-session';
const envelope = data => ({data, meta:{request_id:'isolated-test',api_version:'v1',timestamp:new Date().toISOString()}});
const attachment = path.resolve(__dirname, '../../admin/public/assets/audio/admin_login_triumphant_fanfare.mp3');
const expectedDigest = crypto.createHash('sha256').update(fs.readFileSync(attachment)).digest('hex');
async function check(scenario) {
  const gesture = scenario.includes('gesture');
  const fail = scenario === 'failure';
  const restore = scenario === 'restore';
  const noAuth = scenario === 'anonymous';
  const expired = scenario === 'expired';
  const afterLogin = !fail && !restore && !noAuth && !expired;
  const browser = await chromium.launch({
    executablePath: process.env.CHROME || undefined,
    args: ['--autoplay-policy=' + (gesture ? 'document-user-activation-required' : 'no-user-gesture-required')]
  });
  try {
    const context = await browser.newContext({serviceWorkers:'block',viewport:{width:1180,height:900}});
    const page = await context.newPage();
    const events = [];
    page.on('pageerror',error => events.push(error.message));
    let exchanges=0, restored=0, loads=0, digest, mainPath;
    await context.addInitScript(({restore,expired,gesture,fakeToken,user,expiry}) => {
      window.auditAudio = {calls:0,playing:0,failures:[],sources:[]};
      if((restore||expired)&&!sessionStorage.getItem('qa_seeded')) {
        sessionStorage.setItem('qa_seeded','1');
        sessionStorage.setItem('ucell_admin_token',fakeToken);
        sessionStorage.setItem('ucell_admin_user',JSON.stringify({name:user.preferredName,role:user.role,personId:user.personId,provider:user.provider,expiresAt:expiry}));
      }
      const originalPlay=HTMLMediaElement.prototype.play;
      HTMLMediaElement.prototype.play=function(...args) {
        if(!this.src.includes('.mp3')) return originalPlay.apply(this,args);
        window.playedAudio=this;
        window.auditAudio.calls++;
        window.auditAudio.sources.push(this.src);
        if(!this.auditObserved) {
          this.auditObserved=true;
          this.addEventListener('playing',()=>window.auditAudio.playing++);
        }
        // Force the browser's policy rejection on the automatic attempt. A real
        // click or keyboard event must subsequently start and decode the MP3.
        const attempt=gesture && window.auditAudio.calls===1
          ? Promise.reject(new DOMException('Require trusted interaction','NotAllowedError'))
          : originalPlay.apply(this,args);
        attempt.catch(error=>window.auditAudio.failures.push(error.name));
        return attempt;
      };
    },{restore,expired,gesture,fakeToken,user,expiry});
    await context.route('**/*',async route=>{
      const req=route.request(),url=new URL(req.url());
      if(url.pathname.startsWith('/api/') || url.hostname==='api.ucell.life') {
        if(url.pathname.endsWith('/auth/admin/entra/exchange')) {
          exchanges++;
          assert.equal(req.method(),'POST');
          assert.equal(req.postDataJSON().idToken,'isolated-id-token');
          return route.fulfill({status:fail?403:200,json:fail?{}:envelope({accessToken:fakeToken,expiresAt:expiry,user})});
        }
        if(url.pathname.endsWith('/auth/admin/me')) {
          restored++;
          return route.fulfill({status:expired?401:200,json:envelope({subject:'qa',role:user.role,expiresAt:expiry,provider:user.provider,person:user})});
        }
        if(!['GET','HEAD','OPTIONS'].includes(req.method())) return route.fulfill({status:403,json:{fixture:'blocked'}});
        return route.fulfill({status:503,json:{fixture:'dashboard reads unavailable'}});
      }
      if(url.origin!==origin || !['GET','HEAD'].includes(req.method())) return route.abort();
      const local=preview && path.join(preview,...url.pathname.split('/').filter(Boolean));
      if(req.isNavigationRequest()) {
        let index=preview?fs.readFileSync(path.join(preview,'index.html'),'utf8'):await (await route.fetch()).text();
        mainPath=index.match(/<script type="module" crossorigin src="([^"]+)"/)[1];
        return route.fulfill({status:200,contentType:'text/html',body:index});
      }
      if(url.pathname===mainPath) {
        let body=local&&fs.existsSync(local)?fs.readFileSync(local,'utf8'):await (await route.fetch()).text();
        // Substitute only the Microsoft identity callback. The admin exchange,
        // its success/failure branches, and all session handling execute normally.
        const anchor='async function cE(){if(!mu)return null;';
        assert.equal(body.split(anchor).length,2,'Microsoft browser callback anchor changed');
        body=body.replace(anchor,'async function cE(){return location.search.includes("qa-callback=1")?"isolated-id-token":null;if(!mu)return null;');
        return route.fulfill({status:200,contentType:'text/javascript',body});
      }
      if(url.pathname.endsWith('.mp3')) {
        const bytes=local&&fs.existsSync(local)?fs.readFileSync(local):await (await route.fetch()).body();
        const measured=crypto.createHash('sha256').update(bytes).digest('hex');
        assert.equal(measured,expectedDigest,'Chromium requested audio differs from attachment');
        digest=measured; loads++;
        return route.fulfill({status:200,contentType:'audio/mpeg',body:bytes});
      }
      if(local&&fs.existsSync(local)&&fs.statSync(local).isFile()) return route.fulfill({path:local});
      return route.continue();
    });
    const result=()=>page.evaluate(()=>window.auditAudio);
    const loginScreen=()=>page.getByRole('button',{name:/Microsoft/}).waitFor();
    const loggedIn=()=>page.waitForFunction(()=>sessionStorage.getItem('ucell_admin_token')==='isolated-test-session' && location.pathname!=='/login');
    await page.goto(origin+((restore||expired)?'/':'/login')+((fail||afterLogin)?'?qa-callback=1':''));
    if(gesture) await page.getByRole('button',{name:'播放登入音樂',exact:true}).waitFor({timeout:8000});
    if(fail || expired || noAuth) {
      await loginScreen();
      if(fail) await page.getByText(/Microsoft 登入未完成/).waitFor();
      await page.waitForTimeout(250);
      assert.equal((await result()).calls,0,'unexpected clip on failed or anonymous login');
      assert.equal(exchanges,fail?1:0);
      if(expired) assert.equal(restored,1);
    } else {
      await loggedIn();
      if(restore) {
        await page.waitForTimeout(250);
        assert.equal((await result()).calls,0);
      } else {
        await page.waitForFunction(()=>window.auditAudio.calls>0);
        if(gesture) {
          assert.deepEqual((await result()).failures, ['NotAllowedError']);
          assert.equal((await result()).playing,0);
          const skip=page.getByRole('button',{name:'略過',exact:true});
          const play=page.getByRole('button',{name:'播放登入音樂',exact:true});
          await skip.waitFor();await play.waitFor();
          if(scenario==='gesture-skip'){
            await skip.click();
            await page.locator('body').click({position:{x:5,y:5}});
            assert.equal((await result()).calls,1);
            assert.equal((await result()).playing,0);
            await skip.waitFor({state:'hidden'});
            console.log('PASS gesture-skip');return;
          }
          if(scenario==='gesture-logout') {
            await page.evaluate(()=>window.dispatchEvent(new CustomEvent('ucell:admin-unauthorized')));
            await loginScreen();
            await page.locator('h1').click();
            assert.equal((await result()).calls,1);
            assert.equal((await result()).playing,0);
            console.log('PASS '+scenario+' (gesture after session ended stayed silent)');return;
          }
          if(scenario==='gesture-explicit') await play.click();
          else if(scenario==='gesture-keyboard') await page.keyboard.press('Enter');
          else await page.locator('body').click({position:{x:5,y:5}});
        }
        await page.waitForFunction(()=>window.auditAudio.playing===1);
        assert.equal((await result()).calls,gesture?2:1);
        assert.equal(digest,expectedDigest);
        const stop=page.getByRole('button',{name:'停止登入音樂',exact:true});await stop.waitFor();
        if(scenario==='success') {
          const duration=await page.evaluate(()=>window.playedAudio.duration);
          assert.ok(duration>50,'expected complete one-minute soundtrack');
          await stop.click();
          await stop.waitFor({state:'hidden'});
          assert.ok(await page.evaluate(()=>window.playedAudio.paused));
          console.log('Full submitted MP3 decodes to '+duration.toFixed(2)+'s. Stop succeeded.');
        }
      }
      assert.equal(exchanges,restore?0:1);
      const previous=await result();
      await page.evaluate(()=>{
        const link=Array.from(document.querySelectorAll('nav a[href^="/"]')).find(a=>a.getAttribute('href')!=='/'&&a.getAttribute('href')!=='/login');
        if(link) link.click();
        else throw new Error('No authorized navigation target');
      });
      await page.waitForTimeout(250);
      assert.equal((await result()).playing,previous.playing);
      await page.reload();
      await page.waitForFunction(()=>sessionStorage.getItem('ucell_admin_token')==='isolated-test-session');
      await page.waitForTimeout(300);
      assert.equal((await result()).calls,0,'replayed on refresh');
      assert.ok(restored>0);
    }
    assert.deepEqual(events,[]);
    console.log('PASS '+scenario+' (exchanges='+exchanges+', restores='+restored+', fetched audio='+loads+')');
  }finally{await browser.close();}
}
const allScenarios = ['success','gesture','failure','restore','anonymous','expired','gesture-logout','gesture-skip','gesture-explicit','gesture-keyboard'];
(async () => {
  for (const scenario of scenarios.length ? scenarios : allScenarios) await check(scenario);
})().catch(error => { console.error(error); process.exitCode=1; });
