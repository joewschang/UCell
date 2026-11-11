const assert=require('node:assert/strict'),{chromium}=require('playwright-core');
const base=process.argv.includes('--live')?'https://member.ucell.life':'http://127.0.0.1:39145';
const lineUA='Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Line/15.0.0 LIFF';
async function check(policy,line){
 const browser=await chromium.launch({executablePath:process.env.CHROME,args:['--autoplay-policy='+policy]});
 try{
 const page=await browser.newPage({viewport:{width:390,height:844},...(line?{userAgent:lineUA}:{})});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.setDefaultTimeout(6000);
 await page.addInitScript(()=>{
  sessionStorage.setItem('ucell_member_token','fixture');
  window.soundTest={attempts:0,plays:0};
  const Original=window.Audio;
  window.Audio=class extends Original{
   constructor(url){super(url);this.addEventListener('playing',()=>{if(this.src.includes('ucell-welcome'))window.soundTest.plays++;});}
   play(){if(this.src.includes('ucell-welcome'))window.soundTest.attempts++;return super.play();}
  };
 });
 await page.route('**/api/v1/**',r=>{
  const path=new URL(r.request().url()).pathname;
  let data=[];
  if(path.endsWith('/member/me'))data={name:'測試會員',alias:null,memberNo:'TW0900000000',phone:null,email:null,gender:null,birthDate:null,membershipState:'NETWORK_MEMBER',mobileVerifiedAt:null,emailVerifiedAt:null};
  if(path.endsWith('/application-journey'))data={title:'測試申請進度',memberTasks:[],companyTasks:[],missing:[],action:{label:'查看進度',href:'/me'}};
  if(path.endsWith('/season-theme'))data={theme:'classic'};
  if(path.endsWith('/topics'))data={rows:[],tags:[],edges:[]};
  return r.fulfill({json:{data,meta:{api_version:'v1',request_id:'fixture',timestamp:new Date().toISOString()}}});
 });
 await page.goto(base+'/');await page.locator('#member-main').waitFor();
 if(line){
  await page.waitForFunction(()=>soundTest.attempts===1,{},{timeout:7000});
  if(policy==='user-gesture-required'){
   assert.equal(await page.evaluate(()=>soundTest.plays),0);
   await page.locator('header .uc-member-brand').click();
  }
  await page.waitForFunction(()=>soundTest.plays===1);
 }
 await page.locator('a[href="/me"]').last().click();
 const toggle=page.getByRole('checkbox',{name:'LINE 迎賓音'});await toggle.waitFor();assert(await toggle.isChecked());
 assert.equal(await page.evaluate(()=>soundTest.plays),line?1:0);
 if(line){await page.reload();await toggle.waitFor();assert.equal(await page.evaluate(()=>soundTest.attempts),0);}
 await toggle.uncheck();await page.reload();await toggle.waitFor();assert(!await toggle.isChecked());assert.equal(await page.evaluate(()=>soundTest.attempts),0);
 await page.getByRole('button',{name:'試聽迎賓音'}).click();await page.waitForFunction(()=>soundTest.plays===1);assert(!await toggle.isChecked());
 await toggle.check();await page.goto(base+'/events',{referer:'https://liff.line.me/'});await page.locator('#member-main').waitFor();
 if(line)await page.waitForFunction(()=>soundTest.attempts===1);
 assert.deepEqual(errors,[]);console.log('PASS '+(line?'LINE':'browser')+' '+policy+' • entry, navigation, reload, mute and preview');
 }finally{await browser.close();}
}
(async()=>{await check('no-user-gesture-required',true);await check('user-gesture-required',true);await check('no-user-gesture-required',false);})().catch(e=>{console.error(e);process.exitCode=1;});
