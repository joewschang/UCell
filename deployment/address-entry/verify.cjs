const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
(async()=>{const context=await chromium.launchPersistentContext(process.env.TEST_PROFILE,{headless:true,executablePath:process.env.CHROME,viewport:{width:390,height:844},isMobile:true});
try{
 for(const file of fs.readdirSync('dist/assets').filter(x=>x.endsWith('.js')).sort().reverse()){
 const fixed=file.startsWith('address-entry'),page=await context.newPage();
 const bundle=fs.readFileSync(path.join('dist/assets',file),'utf8').split('xE(document.getElementById("root")).render(')[0];
 const testView=`function Test(){const [value,set]=h.useState("");window.importAddress=set;return r.jsxs(r.Fragment,{children:[r.jsx(wT,{value,onChange:set,required:true}),r.jsx("output",{children:value}),r.jsx(lh,{profile:{},refresh:()=>{}})]})}xE(document.getElementById("root")).render(r.jsx(Test,{}));`;
 await page.route('https://test.invalid/**',route=>route.fulfill(route.request().url().endsWith('.js')?{contentType:'text/javascript',body:bundle+testView}:{contentType:'text/html',body:'<meta charset="utf-8"><div id="root"></div><script type="module" src="/form.js"></script>'}));
 await page.goto('https://test.invalid/');
 const group=page.locator('fieldset.uc-address'),street=group.locator('textarea');
 await group.getByLabel('縣市',{exact:true}).selectOption('臺北市');
 await street.fill('中正區公所旁');await page.waitForTimeout(100);
 if(!fixed){assert.equal(await street.inputValue(),'公所旁');console.log('Reproduced street text moved into district');await page.close();continue}
 assert.equal(await street.inputValue(),'中正區公所旁');assert.equal(await group.getByLabel('鄉鎮市區').inputValue(),'');
 await group.getByLabel('鄉鎮市區').selectOption('大安區');await street.fill('和平東路');await street.focus();
 const cdp=await context.newCDPSession(page);await cdp.send('Input.imeSetComposition',{text:'二段',selectionStart:2,selectionEnd:2});await cdp.send('Input.insertText',{text:'二段'});await page.keyboard.insertText('10號 ');
 assert.equal(await street.inputValue(),'和平東路二段10號 ');assert(await street.evaluate(el=>el===document.activeElement));assert.equal(await page.locator('output').innerText(),'臺北市大安區和平東路二段10號');
 await page.evaluate(()=>window.importAddress('407台中市西屯區臺灣大道三段99號'));await page.waitForFunction(()=>document.querySelector('.uc-address textarea').value==='臺灣大道三段99號');
 const shipping=page.getByLabel('配送地址（路街、巷弄、門牌及樓層）');await shipping.fill('民權東路一段12號');assert.equal(await shipping.inputValue(),'民權東路一段12號');await page.close();console.log('Passed district, street, OCR import, IME focus and delivery input');
 }
}finally{await context.close()}})().catch(e=>{console.error(e);process.exitCode=1});
