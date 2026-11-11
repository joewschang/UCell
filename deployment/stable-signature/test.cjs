const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const {chromium} = require("playwright-core");
(async () => {
  const root = process.argv[2];
  const assets = path.join(root,"assets");
  const js = fs.readFileSync(path.join(assets,fs.readdirSync(assets).find(f=>/^signature-.*\.js$/.test(f))),"utf8");
  const code = js.split('xE(document.getElementById("root")).render(')[0] +
    'Kf=async()=>({documents:[],signingContext:{name:"測試",contract:{title:"合約"},version:1}});xE(document.getElementById("root")).render(r.jsx(Fl,{applicationId:"test",onReady:()=>{},readContract:false}));';
  const browser = await chromium.launch({executablePath:process.env.CHROME,headless:true});
  try {
    const page = await browser.newPage({hasTouch:true,isMobile:true,viewport:{width:390,height:844}});
    await page.route("https://test.invalid/**",route=>route.fulfill(route.request().url().endsWith(".js") ?
      {contentType:"text/javascript",body:code} : {contentType:"text/html",body:'<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div><script type="module" src="/app.js"></script>'}));
    await page.goto("https://test.invalid/");
    await page.addStyleTag({path:process.argv[3]});
    await page.addStyleTag({path:path.join(__dirname,"signature.css")});
    await page.getByLabel("放大簽名區",{exact:true}).click();
    await page.setViewportSize({width:844,height:390});
    const canvas = page.locator("dialog canvas");
    const rect = await canvas.boundingBox();
    assert(rect.x>=20 && rect.y>20 && rect.x+rect.width<835 && rect.y+rect.height<380);
    const cdp = await page.context().newCDPSession(page);
    for (const [type,offset] of [["touchStart",0],["touchMove",40],["touchMove",80],["touchEnd",0]]) {
      await cdp.send("Input.dispatchTouchEvent",{type,touchPoints:type==="touchEnd"?[]:[{x:rect.x+80+offset,y:rect.y+80+offset/2}]});
    }
    const images = () => page.locator("canvas").evaluateAll(cs=>cs.map(c=>c.toDataURL()));
    const signed = await images();
    assert.equal(signed.length,2);
    assert.equal(signed[0],signed[1]);
    assert(await canvas.evaluate(c=>c.getContext("2d").getImageData(0,0,900,300).data.some(v=>v!==0)));
    await page.getByRole("button",{name:"完成返回"}).last().click();
    await page.setViewportSize({width:390,height:844});
    assert.equal((await images())[0],signed[0]);
    await page.locator(".membership-signature input[type=checkbox]").check();
    assert(await page.getByRole("button",{name:"儲存會員簽名"}).isEnabled());
    await page.getByLabel("放大簽名區",{exact:true}).click();
    await page.locator("dialog").getByText("清除重簽").click();
    assert.notEqual((await images())[0],signed[0]);
    console.log("Touch, rotation, stroke mirroring, return, consent and clear passed");
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1});
