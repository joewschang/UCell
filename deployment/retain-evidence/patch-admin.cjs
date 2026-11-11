const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=process.argv[2],index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8');
const asset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
let js=fs.readFileSync(path.join(root,asset),'utf8');
function edit(old,value){
 if(js.split(old).length!==2)throw Error('Unexpected admin source near '+old.slice(0,60));
 js=js.replace(old,()=>value);
}
edit('!["image/jpeg","image/png"].includes(h.type)||!h.size||h.size>10*1024*1024','!(b?["application/pdf","image/jpeg","image/png"]:["image/jpeg","image/png"]).includes(h.type)||!h.size||h.size>(b?5:10)*1024*1024');
edit('new Error("請選擇 10 MB 內的 JPG／PNG 影像；PDF 請先轉成圖片。")','new Error(b?"營登可上傳 5 MB 內的 PDF、JPG 或 PNG。":"請選擇 10 MB 內的 JPG 或 PNG。")');
edit('C,"影像（JPG／PNG，最多 10 MB）",e.jsx("input",{type:"file",accept:"image/jpeg,image/png"','C,b?"（PDF、JPG、PNG，最多 5 MB）":"影像（JPG／PNG，最多 10 MB）",e.jsx("input",{type:"file",accept:b?"application/pdf,image/jpeg,image/png":"image/jpeg,image/png"');
edit('o&&e.jsx("img",{src:o,alt:Lu(r.type)','o&&r.mimeType==="application/pdf"&&e.jsx("a",{href:o,download:"營業登記.pdf",children:"下載營業登記 PDF"}),o&&r.mimeType!=="application/pdf"&&e.jsx("img",{src:o,alt:Lu(r.type)');
edit('u&&A&&e.jsx(ql,{document:A})','u&&A&&e.jsx(ql,{document:A}),l==="SIGNED_APPLICATION_AGREEMENT"&&n.filter(item=>item.historicalSignature).map(item=>e.jsxs("details",{children:[e.jsx("summary",{children:"查看原申請版本的簽名 · "+(item.uploadedAt?new Date(item.uploadedAt).toLocaleDateString("zh-TW"):"日期未提供")}),e.jsx("p",{children:"這份簽名對應當時的申請資料。"}),e.jsx(ql,{document:item})]},item.id))');
edit('children:A?"已保存":"尚未提供"','children:A?(A.fromMemberProfile?"已保存於會員資料":"已保存"):n.some(item=>item.type===l&&item.historicalSignature)?"原簽名已保留，新版尚待簽署":"尚未提供"');
edit('?"已保存，可於下方檢視":"尚未保存。可於下方上傳會員已簽署的文件，或請會員至「我的 → 會員資料／文件與補簽名」簽署。"','?"已保存，可於下方檢視":be.some(doc=>doc.historicalSignature)?"原申請簽名已保存，可於申請附件查看；目前版本尚待簽署。":"尚未保存。可於下方上傳會員已簽署的文件，或請會員至「我的 → 會員資料／文件與補簽名」簽署。"');
edit('function s8(',`function HistoricalSignature({item}){
 const [open,setOpen]=f.useState(false);
 return e.jsxs("details",{onToggle:evt=>setOpen(evt.currentTarget.open),children:[
  e.jsx("summary",{children:"查看原申請版本的簽名 · "+(item.uploadedAt?new Date(item.uploadedAt).toLocaleDateString("zh-TW"):"日期未提供")}),
  open&&e.jsx("p",{children:"這份簽名對應當時的申請資料。"}),open&&e.jsx(ql,{document:item})
 ]});
}function s8(`);
edit('map(item=>e.jsxs("details",{children:[e.jsx("summary",{children:"查看原申請版本的簽名 · "+(item.uploadedAt?new Date(item.uploadedAt).toLocaleDateString("zh-TW"):"日期未提供")}),e.jsx("p",{children:"這份簽名對應當時的申請資料。"}),e.jsx(ql,{document:item})]},item.id))','map(item=>e.jsx(HistoricalSignature,{item},item.id))');
const out='/assets/evidence-'+crypto.createHash('sha256').update(js).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(root,out),js);fs.writeFileSync(index,html.replace(asset,out));
