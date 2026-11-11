const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{
 const root=process.argv[2],html=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const script=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
 const main=fs.readFileSync(path.join(root,script),'utf8');
 const code=main.split('xE(document.getElementById("root")).render(')[0]+
 'Kf=async()=>({documents:[],signingContext:{name:"測試",contract:{title:"合約"},version:1}});xE(document.getElementById("root")).render(r.jsx(Fl,{applicationId:"test",onReady:()=>{},readContract:false}));';
 const browser=await chromium.launch({executablePath:process.env.CHROME});
 try{
 const page=await browser.newPage({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
 await page.route('https://test.invalid/**',route=>{
   const url=new URL(route.request().url());
   if(url.pathname==='/')return route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1">'+[...html.matchAll(/<link[^>]+\.css"[^>]*>/g)].map(m=>m[0]).join('')+'<div id="root"></div><script type="module" src="'+script+'"></script>'});
   if(url.pathname===script)return route.fulfill({contentType:'text/javascript',body:code});
   const file=path.join(root,url.pathname);return fs.existsSync(file)?route.fulfill({path:file}):route.abort();
 });
 await page.goto('https://test.invalid/');
 await page.getByLabel('放大簽名區',{exact:true}).click();
 const grip=page.getByText('請用左手按住左側，可以防止畫面移動跳脫',{exact:true}),pad=page.locator('dialog canvas');
 assert(!await grip.isVisible());
 for(const [width,height] of [[844,390],[568,320],[1024,768]]){
   await page.setViewportSize({width,height});
   const g=await grip.boundingBox(),c=await pad.boundingBox();
   assert(g&&c&&g.x+g.width<=c.x&&g.height>40);
   assert(await grip.evaluate(el=>el.scrollWidth<=el.clientWidth+1 && el.scrollHeight<=el.clientHeight+1));
 }
 const g=await grip.boundingBox(),c=await pad.boundingBox();
 const left={id:1,x:g.x+g.width/2,y:g.y+g.height/2};
 const pen={id:2,x:c.x+70,y:c.y+80};
 const cdp=await page.context().newCDPSession(page);
 const touch=(type,touchPoints)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints});
 const ink=()=>pad.evaluate(el=>el.getContext('2d').getImageData(0,0,900,300).data.some(v=>v!==0));
 await touch('touchStart',[left]);assert(!await ink());
 await touch('touchStart',[left,pen]);await touch('touchMove',[left,{...pen,x:pen.x+100,y:pen.y+30}]);await touch('touchEnd',[]);
 assert(await ink());assert(await page.locator('dialog').isVisible());
 await page.getByRole('button',{name:'完成返回'}).last().click();
 assert(await page.locator('.membership-signature canvas').first().evaluate(el=>el.getContext('2d').getImageData(0,0,900,300).data.some(v=>v!==0)));
 console.log('Portrait, three landscape sizes, simultaneous grip and signing, and saved strokes passed');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
