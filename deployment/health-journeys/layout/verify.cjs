const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium, webkit } = require('playwright-core');
const root = path.resolve(__dirname, '..');
const base = 'https://member.ucell.life/health/';
const live = process.argv.includes('--live');
async function check(page, name) {
  const issues = await page.evaluate(() => {
    const root=document.documentElement, errors=[];
    if(root.scrollWidth>innerWidth+1)errors.push('document '+root.scrollWidth+'/'+innerWidth);
    for(const row of document.querySelectorAll('label.choice')){
      const rect=n=>n.getBoundingClientRect();
      const field=rect(row), radio=rect(row.querySelector('input')), text=rect(row.lastElementChild);
      if(radio.width>32 || radio.height>32 || text.width<field.width*.58 || text.right>field.right || radio.right>=text.left) errors.push({radio:radio.width,text:text.width,row:field.width});
    }
    return errors;
  });
  assert.deepEqual(issues,[],name);
}
(async()=>{
 for(const [engine,options] of [[chromium,{executablePath:process.env.CHROME}],[webkit,{}]]) {
  const b=await engine.launch(options);
  try {
   for(const [width,mode,large] of [[320,'light',true],[393,'dark',false],[844,'dark',true],[1280,'light',false]]){
    const p=await b.newPage({viewport:{width,height:width===844?390:852},colorScheme:mode,isMobile:width<1000,hasTouch:width<1000});
    p.setDefaultTimeout(12000);
    if(!live){
      for(const [url,file] of [['/journey/theme.css','theme.css'],['/cognition/style.css','cognition/site/style.css'],['/journey/hub.js','member/hub.js']]){
        await p.route('**/health'+url,r=>r.fulfill({path:path.join(root,file)}));
      }
    }
    await p.route('**/journey/event',r=>r.fulfill({json:{data:{ok:true}}}));
    await p.goto(base);await p.locator('.j-tile').nth(4).waitFor();
    await check(p,'home');await p.locator('.j-tile').nth(4).getByRole('link').click();
    await p.getByRole('button',{name:'我為家人或親友填寫'}).click();
    if(large)await p.locator('#large').click();
    for(let i=0;i<8;i++){
      await p.getByText('第 '+(i+1)+' 題 ／ 共 8 題',{exact:true}).waitFor();
      await check(p,'question '+(i+1));
      await p.locator('label.choice').nth(i%3).click();
      assert(await p.getByRole('radio').nth(i%3).isChecked());
      if(i===0 && width===393 && process.env.JOURNEY_QA){
        await p.locator('fieldset').scrollIntoViewIfNeeded();
        await p.screenshot({path:path.join(process.env.JOURNEY_QA,engine.name()+'-after.png')});
      }
      await p.getByRole('button',{name:i===7?'查看觀察摘要':'下一題'}).click();
    }
    await p.getByText('回看八題答案').click();await check(p,'summary');
    for(const href of ['?read=guide','journey/resources/?game=cognition','journey/invite/','journey/invite/game/','journey/invite/diabetes/','journey/invite/egfr/','journey/invite/blood-pressure/','journey/invite/cognition/']){
      await p.goto(base+href);await p.locator('main :is(a,button)').first().waitFor();await check(p,href);
    }
    console.log('PASS',engine.name(),width,mode,large?'large':'normal');await p.close();
   }
  }finally{await b.close();}
 }
})().catch(e=>{console.error(e);process.exitCode=1;});
