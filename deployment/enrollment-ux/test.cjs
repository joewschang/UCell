const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const {chromium}=require("playwright-core");
const dir=process.argv[2];
const assets=path.join(dir,"assets");
const js=fs.readFileSync(path.join(assets,path.basename(fs.readFileSync(path.join(dir,"index.html"),"utf8").match(/src="(\/assets\/[^"]+\.js)"/)[1])),"utf8").split('xE(document.getElementById("root")).render(')[0];
const mock=`
const order={orderId:"order1",displayOrderNo:"SL20261111001",packageName:"啟航",total:600,qualificationFee:600,goodsAmount:0,selectableProductQuantity:0,paymentDeadline:"2026-11-13T00:00:00Z"};
ri=async()=>({application:{id:"app",status:"DRAFT"},draft:{documents:ao,version:1},paidPackages:[],pendingPackages:[order]});
let signed=location.pathname!=="/sign"; mR=async()=>{}; Ol=async(id,type,file)=>{if(type!=="SIGNED_APPLICATION_AGREEMENT"||!file.size)throw Error("invalid signature"); signed=true}; Kf=async()=>({documents:signed?[{type:"SIGNED_APPLICATION_AGREEMENT",status:"PRESENT"}]:[],signingContext:{name:"測試",contract:{title:"合約",content:"合約文字",version:"1",id:"contract",contentHash:"test"},snapshotHash:"test",version:1}});
AT=({onReadyChange})=>{h.useEffect(()=>onReadyChange(true),[]);return null};
Xr=async()=>new Blob(["%PDF-1.4 test"],{type:"application/pdf"});
Yf=async()=>({});LR=async()=>({products:[]});xm=async(id,code)=>({originalAmount:14400,discountAmount:0,total:15000,qualificationFee:600,selectableProductQuantity:0,couponCode:code});
const pkg=r.jsx(m0,{offer:{displayName:"啟航",packageClass:"QUALIFICATION",packageCode:"STARTER",packageVersionId:"v",selectableProductQuantity:0},enrollmentFlow:true});
const progress=r.jsx(ProgressPdf,{id:"app"});
Ul=({onAccept})=>r.jsx("button",{onClick:onAccept,children:"測試閱讀並同意"});const view=location.pathname==="/package"?pkg:location.pathname==="/progress"?progress:r.jsx(Xm,{});
xE(document.getElementById("root")).render(r.jsx(Lj,{children:r.jsx(OL,{children:r.jsx(FI,{children:view})})}));
`;
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME});
 try{
 for(const theme of ["light","dark"]){
 const page=await browser.newPage({viewport:{width:360,height:780},colorScheme:theme,hasTouch:true,isMobile:true});
 const errors=[];page.on("pageerror",err=>{errors.push(err.message);console.error(err.stack)});
 await page.route("https://ux.invalid/**",route=>{
 const url=route.request().url();
 if(url.endsWith(".js"))return route.fulfill({contentType:"text/javascript",body:js.replace('const Xr=Zj(al)','let Xr=Zj(al)')+mock});
 if(url.endsWith(".css"))return route.fulfill({contentType:"text/css",body:fs.readFileSync(url.endsWith("base.css")?process.argv[3]:path.join(__dirname,"enrollment.css"))});
 return route.fulfill({contentType:"text/html",body:'<html data-theme="'+theme+'"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/base.css"><link rel="stylesheet" href="/ux.css"><div id="root" class="app"></div><script type="module" src="/test.js"></script></html>'});
 });
 await page.goto("https://ux.invalid/sign"); await page.getByText("測試閱讀並同意").click(); const pad=page.locator(".membership-signature canvas").first(); await pad.scrollIntoViewIfNeeded(); const rect=await pad.boundingBox(); await page.mouse.move(rect.x+10,rect.y+16); await page.mouse.down(); await page.mouse.move(rect.x+90,rect.y+44,{steps:8}); await page.mouse.up(); await page.locator(".membership-signature input[type=checkbox]").check(); await page.getByRole("button",{name:"儲存會員簽名"}).click();
 const pdf=page.locator(".enroll-pdf");
 await pdf.getByRole("button").click({timeout:5000});
 const url=await pdf.locator("a[download]").getAttribute("href");
 assert(url.startsWith("blob:")); const download=page.waitForEvent("download"); await pdf.locator("a[download]").click(); assert.equal((await download).suggestedFilename(),"已簽署會員合約.pdf");
 await page.getByRole("button",{name:"繼續確認既有訂單"}).click();
 const bank=page.getByRole("radio",{name:/銀行匯款/}),cash=page.getByRole("radio",{name:/現金/});
 assert(!(await cash.isChecked())&&!(await bank.isChecked()));
 await bank.check();await page.getByLabel("銀行匯款收款資訊").waitFor();
 await cash.check();assert.equal(await page.getByLabel("銀行匯款收款資訊").count(),0);
 await cash.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,theme+"-payment.png")});
 await page.getByRole("button",{name:/繼續下一步：送出審核/}).click();
 await page.getByText("付款狀態：現金／待收款確認").waitFor();
 assert.equal(await pdf.locator("a[download]").getAttribute("href"),url);
 await page.goto("https://ux.invalid/progress");
 await page.locator(".enroll-pdf button").click();
 assert((await page.locator("a[download]").getAttribute("href")).startsWith("blob:"));
 await page.goto("https://ux.invalid/package");
 const coupon=page.locator(".coupon-entry");await coupon.waitFor();
 await coupon.getByPlaceholder("輸入優惠碼").fill("test");
 await coupon.getByRole("button",{name:"套用優惠碼"}).click();
 await coupon.getByText(/已套用 TEST/).waitFor();
 await coupon.getByRole("button",{name:"不使用優惠碼"}).click();
 assert.equal(await coupon.getByPlaceholder("輸入優惠碼").inputValue(),"");
 await coupon.scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,theme+"-package.png")});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 assert.deepEqual(errors,[]);await page.close();console.log(theme+" passed");
 }
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
