const {chromium}=require('../../member/node_modules/playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({channel:'chrome'});
 try{
  const p=await browser.newPage({viewport:{width:390,height:845}});
  await p.route('**/assets/member-flow-v1-*.js',async route=>{
   const response=await route.fetch();let js=await response.text();
   if(!route.request().url().match(/member-flow-v1-[a-f0-9]{12}\.js$/))return route.fulfill({response});
   const mount='xE(document.getElementById("root")).render(';
   assert(js.includes(mount));
   js=js.slice(0,js.lastIndexOf(mount))+mount+`r.jsxs(r.Fragment,{children:[
    r.jsx(NT,{value:"0912345678",onReady:()=>{}}),
    r.jsx(th,{type:"IDENTITY_FRONT",onSelect:()=>{},onReady:()=>{}}),
    r.jsx(Km,{}),r.jsx(OT,{sponsorQualificationId:"fixture"})
   ]}));`;
   js=js.replace('function NT({value:e,disabled:t,onReady:n}){','function NT({value:e,disabled:t,onReady:n}){const oo=async()=>({}),ld=async body=>{window.saves=(window.saves||0)+1;return {phone:body.phone,mobileVerifiedAt:"now"}},Zr=({onVerified})=>r.jsx("button",{onClick:()=>onVerified("verified"),children:"測試驗證成功"});');
   js=js.replace('function Km({q:e}){','function Km({q:e}){const ae=()=>({data:[{title:"TIP–363",id:"a",type:"EXTERNAL_LINK"},{title:"健康知識",id:"b",type:"EXTERNAL_LINK"}]});');
   js=js.replace('function OT({sponsorQualificationId:e}){','function OT({sponsorQualificationId:e}){const ae=()=>({data:[{pendingBallNo:"TW0900000000-01",pendingMemberName:"測試會員",placementReference:"P1",status:"PLACEMENT_PENDING"}]});');
   const wrapper='r.jsx(FI,{children:';
   const real=await response.text();
   assert(real.slice(real.lastIndexOf(mount)).includes(wrapper));
   js=js.replace(mount,mount+wrapper).replace(/\]\}\)\);\s*$/,']})}));');   return route.fulfill({response,body:js});
  });
  p.on('pageerror',error=>console.error(error.message)); await p.goto('https://member.ucell.life/?qa=member-flow',{waitUntil:'domcontentloaded'});
  await p.getByRole('button',{name:'測試驗證成功'}).click({timeout:10000});
  await p.getByText('此手機已完成簡訊驗證，可繼續申請。').waitFor();
  assert.equal(await p.evaluate(()=>window.saves),1);
  await p.getByLabel('內容主題').selectOption('健康知識');
  await p.getByText('1 則內容').waitFor();
  await p.getByText('TW0900000000-01 · 測試會員').waitFor();
  const img=await p.evaluate(()=>{const c=document.createElement('canvas');c.width=400;c.height=300;const ctx=c.getContext('2d');ctx.fillRect(0,0,400,300);ctx.fillStyle='white';ctx.fillRect(40,45,320,210);return c.toDataURL().split(',')[1]});
  await p.locator('input[type=file]').first().setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from(img,'base64')});
  await p.getByText('調整裁切範圍').click();assert.equal(await p.locator('.uc-crop-handle').count(),8);
  const handle=p.getByLabel('調整裁切框右下');await handle.scrollIntoViewIfNeeded();
  const before=await handle.boundingBox();const x=before.x+before.width/2,y=before.y+before.height/2;
  await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x-20,y-15,{steps:5});await p.mouse.up();
  assert((await handle.boundingBox()).x<before.x-8);
  await p.getByText('套用裁切與校正').click();await p.getByText('調整裁切範圍').waitFor();
  console.log('PASS automatic OTP persistence, name, category filter, automatic bounds, eight handles, drag and apply');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});


