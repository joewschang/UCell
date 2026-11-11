const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{chromium}=require('playwright-core');
(async()=>{const root=process.argv[2],html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const asset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
let js=fs.readFileSync(path.join(root,asset),'utf8').split('xE(document.getElementById("root")).render(')[0];
js=js.replace('[a,l]=h.useState(0),c=ae("formal-contracts",pR,!0,!0)','[a,l]=h.useState(2),c={data:[{id:"test"}]}');
js+='th=({onFields,type})=>r.jsx("button",{type:"button",onClick:()=>onFields({communicationAddress:"臺中市西屯區測試路1號"}),children:"模擬辨識"+type});const testRoot=xE(document.getElementById("root"));window.showTestDraft=(initial)=>testRoot.render(r.jsx(AT,{initial}));window.showTestDraft();';
const b=await chromium.launch({executablePath:process.env.CHROME});try{
const p=await b.newPage({viewport:{width:390,height:844},hasTouch:true});
await p.route('**/*',route=>route.request().url().endsWith('test.js')?route.fulfill({contentType:'text/javascript',body:js}):route.fulfill({contentType:'text/html',body:'<div id=root></div><script type=module src="/test.js"></script>'}));
await p.goto('https://test.invalid/');const group=p.locator('fieldset.uc-address:visible'),street=group.locator('textarea');
await p.getByText('模擬辨識IDENTITY_BACK',{exact:true}).click();await p.waitForFunction(()=>document.querySelector('fieldset.uc-address textarea')?.value==='測試路1號',{},{timeout:4000});assert.equal(await street.inputValue(),'測試路1號');
await group.getByLabel('縣市',{exact:true}).selectOption('臺北市');await group.getByLabel('鄉鎮市區',{exact:true}).selectOption('大安區');
await street.fill('');await street.focus();const cdp=await p.context().newCDPSession(p);
await cdp.send('Input.imeSetComposition',{text:'和平東路',selectionStart:4,selectionEnd:4});await cdp.send('Input.insertText',{text:'和平東路'});await p.keyboard.insertText('二段10號');
assert.equal(await street.inputValue(),'和平東路二段10號');assert(await street.evaluate(el=>el===document.activeElement));
await p.evaluate(()=>window.showTestDraft({prefill:{communicationAddress:'臺南市中西區舊資料1號'}}));
await p.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
assert.equal(await street.inputValue(),'和平東路二段10號');
await p.getByText('模擬辨識IDENTITY_BACK',{exact:true}).click();assert.equal(await street.inputValue(),'和平東路二段10號');
await p.getByRole('button',{name:'使用辨識地址'}).click();await p.waitForFunction(()=>document.querySelector('fieldset.uc-address textarea')?.value==='測試路1號',{},{timeout:4000});assert.equal(await street.inputValue(),'測試路1號');
console.log('Formal ID-back step: OCR, county/district change, IME focus, manual correction and explicit replacement passed');
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1})
