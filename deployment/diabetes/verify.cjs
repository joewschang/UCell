'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
const live = process.argv.includes('--live');
const url = live ? 'https://member.ucell.life' : 'http://game.test';
async function main(){
  const browser = await chromium.launch({executablePath:process.env.CHROME});
  try {
    const scenarios = live ? ['guest'] : ['guest','skip','member','paused'];
    for(const mode of scenarios){
      const page = await browser.newPage({viewport:{width:360,height:780},hasTouch:true,colorScheme:mode==='guest'?'light':'dark'});
      page.setDefaultTimeout(12000);
      const writes=[], errors=[];
      let retry = mode==='member';
      page.on('pageerror',e=>errors.push(e.message));
      if(!live){
        await page.addInitScript(member=>{if(member)sessionStorage.setItem('ucell_member_token','test');},mode==='member');
        await page.route('**/*',async route=>{
          const req=route.request(), u=new URL(req.url());
          if(u.pathname.startsWith('/api/')){
            const name=u.pathname.split('/').pop();
            if(req.method()==='POST'){
              assert.equal(req.postData(),null);writes.push(name);
              if(name==='finish' && retry){retry=false;return route.fulfill({status:503});}
            }
            return route.fulfill({json:{data:{open:mode!=='paused',weeks:0,rows:[],tags:[],resources:[]}}});
          }
          const root=path.resolve(process.argv[2]);
          const file=path.join(root,u.pathname,u.pathname.endsWith('/')?'index.html':'');
          return fs.existsSync(file)?route.fulfill({path:file}):route.fulfill({status:404});
        });
      }
      await page.goto(url+'/health/');
      await page.getByRole('link',{name:'進入肌少症自我檢測'}).waitFor();
      await page.getByRole('link',{name:'進入糖尿病自我檢測'}).click();
      if(mode==='paused'){await page.getByText('本遊戲暫停開放').waitFor();await page.close();continue;}
      await page.getByRole('button',{name:'大字'}).click();
      await page.getByRole('button',{name:'開始六題觀察'}).click();
      for(let i=0;i<6;i++){
        await page.waitForFunction(()=>document.querySelector('.photo img')?.naturalWidth===1280);
        assert.match(await page.locator('.photo img').getAttribute('src'),new RegExp('station-'+(i+1)));
        const next=page.locator('main button.primary'), choices=page.locator('.choices button');
        assert(await next.isDisabled());
        if(i===0){await page.locator('.photo').click();await page.getByRole('button',{name:'關閉圖解'}).click();}
        if(i===2){await page.getByRole('button',{name:'上一題'}).click();assert.equal(await page.locator('.choices [aria-pressed=true]').count(),1);await next.click();}
        if(mode==='skip')await choices.last().click();else await choices.nth(i===2?2:0).click();
        assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
        await next.click();
      }
      await page.getByRole('heading',{name:mode==='skip'?'這次先熟悉了觀察方法':'這些變化值得安排門診討論'}).waitFor();
      assert.equal(await page.locator('ol.record li').count(),6);
      const sharing=decodeURIComponent(await page.getByRole('link',{name:'邀 LINE 好友體驗'}).getAttribute('href'));
      assert(!sharing.includes('口渴')); assert(sharing.includes('/health/diabetes/'));
      const download=page.waitForEvent('download');await page.getByRole('button',{name:'儲存完成卡'}).click();
      assert.match((await download).suggestedFilename(),/糖尿病.*png$/);
      if(mode==='member'){
        await page.getByRole('button',{name:'重新領取'}).click();
        await page.getByText('本週印章已收進健康護照。').waitFor();
        assert.deepEqual(writes,['start','start','finish','start','finish']);
      }else assert.deepEqual(writes,[]);
      assert.deepEqual(errors,[]);await page.close();console.log(mode+' passed');
    }
  }finally{await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
