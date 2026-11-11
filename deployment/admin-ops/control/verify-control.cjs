// Render the real release using isolated, synthetic applications and receipts.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require(process.env.PLAYWRIGHT_CORE || "playwright-core");
const [assets, bundle] = process.argv.slice(2);
const live=assets==="--live";
const list = [
  {id:"application-a",personName:"春光有限公司",displayMemberNo:"TW0900111222",applicantType:"LEGAL_ENTITY",representativeName:"林春梅"},
  {id:"application-b",personName:"張秋實",displayMemberNo:"TW0900333444",applicantType:"INDIVIDUAL"}
].map(row => ({...row, sourceChannel:"ADMIN_PAPER", status:"DRAFT",membershipState:"FREE_MEMBER",updatedAt:"2026-01-01T01:00:00Z"}));
const orders = ["0.00","3500.00",null].map((total,i) => ({orderId:"o"+i, orderNo:"SL1234567890"+i,name:"測試訂單",total,status:"CONFIRMED"}));
async function main() {
 const opts = { headless:true };
 if(process.env.CHROME_BIN) opts.executablePath = process.env.CHROME_BIN;
 const browser = await chromium.launch(opts);
 try {
  const page = await browser.newPage({viewport:{width:390,height:844}});
  let reportVersion=1; const writes=[]; const errors=[];
  page.on("pageerror", e=>errors.push(e.message));
  await page.addInitScript(() => {
    sessionStorage.setItem("ucell_admin_token","isolated-fixture");
    sessionStorage.setItem("ucell_admin_user",JSON.stringify({role:"SUPER_ADMIN",provider:"ENTRA"}));
  });
  await page.route("**/*", async route => {
    const req=route.request(), url=new URL(req.url()), p=url.pathname;
    if(p.startsWith("/api/v1/")){
      let data=[],meta;
      if(req.method()==="POST") { writes.push({p,body:req.postDataJSON()}); data={}; }
      else if(p.endsWith("/auth/admin/me")) data={role:"SUPER_ADMIN",provider:"ENTRA",subject:"測試人員"};
      else if(p.endsWith("/admin/formal-member-applications")) {
        if(url.searchParams.has("page")) {
          const page=Number(url.searchParams.get("page")),term=url.searchParams.get("q");
          const archive={...list[1],id:"old-application",personName:"第百零一件陳秋梅"};
          data=term ? [archive].filter(row=>row.personName.includes(term)) : page===1?list:[archive];
          meta={page,pageSize:25,hasNext:page===1&&!term};
        } else data=list;
      }
      else if(p.endsWith("/application-a/detail")) data={...list[0],payload:{legalEntityName:list[0].personName},legalEntity:{memberNo:list[0].displayMemberNo,registeredName:list[0].personName},person:{legalName:"林春梅"},paperEvidence:[]};
      else if(p.endsWith("/payment-orders")) data={orders};
      else if(p.endsWith("/payment-context")){
        const order=orders.find(it=>p.includes("/"+it.orderId+"/"));
        data={...order,member:{memberNo:"TW0900111222",legalName:"林春梅"},receipts:[],createdAt:"2025-01-01T00:00:00Z",selectedPaymentMethod:"BANK_TRANSFER",report:{
          amount:order.total, paymentMethod:"BANK_TRANSFER",version:reportVersion,paidAt:"2026-01-01T00:00:00Z",reportedAt:"2026-01-01T00:00:00Z"
        }};
      }
      return route.fulfill({json:{data,meta},headers:{"access-control-allow-origin":"*","access-control-allow-headers":"*"}});
    }
    if(live) return url.hostname==="admin.ucell.life" && ["HEAD","GET"].includes(req.method()) ? route.continue() : route.abort();
    if(p==="/applications") return route.fulfill({contentType:"text/html",body:fs.readFileSync(path.join(assets,"index.html"),"utf8").replace("</head>",'<link rel="stylesheet" href="/control.css"></head>')});
    if(p==="/health/journey/inline.js") return route.fulfill({contentType:"text/javascript",body:"export function healthRoute() { return null; }"});
    if(p==="/control.css") return route.fulfill({contentType:"text/css",path:path.join(__dirname,"control.css")});
    if(p.startsWith("/assets/award-audit-")&&p.endsWith(".js")) return route.fulfill({contentType:"text/javascript",path:bundle});
    const local=path.join(assets,p.slice(1).replaceAll("/","__"));
    if(p.endsWith(".css")&&fs.existsSync(local)) return route.fulfill({contentType:"text/css",path:local});
    return route.fulfill({contentType:p.endsWith(".js")?"text/javascript":"text/plain",body:""});
  });
  await page.goto("https://admin.ucell.life/applications");
  const input=page.locator("#uc-review-search"), rows=page.locator("#formal-applications-list tbody tr");
  try { await input.waitFor({timeout:10000}); } catch(e) {throw Error(errors.join("\n")+"\n"+(await page.locator("body").innerText()).slice(0,900));}
  await rows.first().waitFor(); assert.equal(await rows.count(),2);
  const directory=page.locator("#formal-applications-list");
  await directory.getByRole("navigation",{name:"正式會員申請分頁"}).getByRole("button",{name:"下一頁",exact:true}).click(); await directory.getByText("第百零一件陳秋梅").waitFor();
  await directory.getByRole("navigation",{name:"正式會員申請分頁"}).getByRole("button",{name:"上一頁",exact:true}).click(); await directory.getByText("春光有限公司",{exact:true}).waitFor();
  await input.fill("陳秋梅"); await input.press("Enter"); await directory.getByText("第百零一件陳秋梅").waitFor(); assert.equal(await rows.count(),1);
  await directory.getByRole("button",{name:"清除",exact:true}).click();await directory.getByText("春光有限公司",{exact:true}).waitFor();
  await directory.getByRole("button",{name:"最近申請的送審名稱",exact:true}).click();
  await directory.getByText("春光有限公司",{exact:true}).waitFor();
  for(const [q,count] of [["林春梅",1],["TW0900-111-222",1],["春光 林春梅",1],["找不到的人",0]]){
    await input.fill(q);assert.equal(await rows.count(),count);
  }
  assert.match(await page.locator("#formal-applications-list").innerText(),/本批沒有相符申請/);
  await page.getByRole("button",{name:"清除",exact:true}).click();
  for(const [width,theme] of [[320,"light"],[390,"dark"],[1280,"light"],[1280,"dark"]]){
    await page.setViewportSize({width,height:844});
    await page.evaluate(theme=>{document.documentElement.setAttribute("data-theme",theme);},theme);
    const r=await rows.first().boundingBox();
    assert.ok(r.width>210&&r.x+r.width<=width+1,"row overflows "+JSON.stringify({width,r}));
  }
  await page.getByRole("button",{name:"春光有限公司",exact:true}).click();
  const ctx=page.locator(".uc-review-context"); await ctx.waitFor({timeout:6000}).catch(()=>{throw Error(errors.join("\n"));});
  assert.match(await ctx.innerText(),/TW0900111222/);
  await ctx.getByRole("button",{name:"申請附件"}).click();
  assert.equal(await page.evaluate(()=>document.activeElement.id),"uc-review-documents");
  await ctx.getByRole("button",{name:"收款對帳"}).click();
  await page.getByRole("button",{name:"開啟收款對帳"}).click();
  const choose= i=>page.getByRole("button",{name:new RegExp("訂單 "+orders[i].orderNo)}).click();
  const panel=page.locator(".payment-review-panel");
  await choose(0); await panel.getByText("優惠全額減免（無實際收款）",{exact:true}).waitFor();
  assert.equal(await panel.locator("select").count(),0);
  const confirm=panel.getByRole("button",{name:/^確認會員/});
  assert.equal(await confirm.isDisabled(),true);
  await panel.locator('input[maxlength="200"]').fill("WAIVE-001");
  await panel.getByRole("checkbox").check();
  assert.equal(await confirm.isEnabled(),true);
  // Invalidate the reviewed snapshot when a member amends their report.
  reportVersion=2;await panel.getByRole("button",{name:"更新會員付款回報"}).click();
  await panel.getByText(/第 2 次/).waitFor();
  assert.equal(await panel.getByRole("checkbox").isChecked(),false);
  assert.equal(await confirm.isDisabled(),true);
  await panel.getByRole("checkbox").check();await confirm.click();
  const dialog=page.getByRole("dialog");
  await dialog.locator("textarea,input:not([type=checkbox])").first().fill("核對測試憑證");
  const checks=dialog.getByRole("checkbox");if(await checks.count()) await checks.first().check();
  const dialogButtons=await dialog.getByRole("button").all();
  await dialogButtons[dialogButtons.length-1].click();
  await page.waitForFunction(()=>!!document.querySelector(".payment-review-panel")?.innerText.includes("已確認全額減免"));
  assert.equal(writes.length,1);assert.equal(writes[0].body.paymentMethod,"COUPON_WAIVER");assert.equal(Number(writes[0].body.amount),0);
  await choose(1); await panel.getByRole("combobox").waitFor();assert.equal(await panel.getByRole("combobox").inputValue(),"BANK_TRANSFER");
  assert.equal(await panel.getByRole("combobox").locator("option").count(),3);
  assert.equal(await panel.getByRole("checkbox").isChecked(),false); assert.equal(await panel.locator('input[maxlength="200"]').inputValue(),"");
  await choose(2); await panel.getByRole("button",{name:"重新查詢金額"}).waitFor();
  assert.equal(await panel.getByRole("checkbox").count(),0);assert.equal(writes.length,1);assert.deepEqual(errors,[]);
  console.log("Passed real release UI: 4 viewport/theme combinations, list lookup, detail focus, receipt method, changed report, positive/unknown total. Synthetic POST only.");
 } finally {await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
