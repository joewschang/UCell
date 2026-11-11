'use strict';
const fs=require('node:fs'),crypto=require('node:crypto'),path=require('node:path');
const root=process.argv[2],index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8');
const old=html.match(/src="(\/assets\/index-[^"]+\.js)"/)[1];
let s=fs.readFileSync(path.join(root,old),'utf8');
function replace(from,to){if(s.split(from).length!==2)throw Error('Unexpected member asset: '+from.slice(0,90));s=s.replace(from,()=>to);}
replace('N=await Xr("/member/formal-enrollment/read-document"','N=await q("/member/formal-enrollment/read-document"');
replace('c(N.fields),j(Object.keys(N.fields).length?', 'c(N.fields),j(t==="BANKBOOK_COVER"&&Object.keys(N.fields).length&&(!N.fields.bankAccount||!N.fields.accountHolder)?"已帶入可辨識欄位，請核對並補填空白欄位。":Object.keys(N.fields).length?');
replace('catch{I===v.current&&j("辨識未完成，可重新辨識或手動填寫。")}', 'catch(error){I===v.current&&j(({401:"登入已過期，請重新登入。",403:"請先完成手機驗證，再辨識照片。",413:"照片過大，請裁切存摺封面後重試。",422:"照片格式無法讀取，請重新選擇 JPG 或 PNG。",429:"本小時已達辨識次數上限，可先手動填寫。",503:"辨識服務暫時無法使用，請重試或手動填寫。"})[error?.status]||"照片辨識未完成，請確認連線後重試或手動填寫。")}');
replace('Ye.identityDocumentNumber&&(Ye.identityDocumentNumber=', 'if(/^第一(?:商業)?銀行(?:股份有限公司)?$/.test(Ce.bankName??""))Ye.bankCode="007";if(Ye.bankAccount&&/^[0-9\\s-]+$/.test(Ye.bankAccount))Ye.bankAccount=Ye.bankAccount.replace(/[\\s-]/g,"");Ye.identityDocumentNumber&&(Ye.identityDocumentNumber=');
replace('function Ul({contract:e,accepted:t,disabled:n,onAccept:i}){const s=', 'function Ul({contract:e,accepted:t,disabled:n,onAccept:i}){const [size,setSize]=h.useState(100);const s=');
replace('className:"contract-dialog","aria-labelledby":s','className:"contract-dialog",style:{"--agreement-font":(16*size/100)+"px"},"aria-labelledby":s');
replace('r.jsxs("div",{ref:p,className:"contract-scroll"', 'r.jsxs("div",{className:"agreement-tools",children:[r.jsx("button",{type:"button",disabled:size<=85,onClick:()=>setSize(Math.max(85,size-15)),children:"縮小"}),r.jsx("span",{"aria-live":"polite",children:size+"%"}),r.jsx("button",{type:"button",disabled:size>=190,onClick:()=>setSize(Math.min(190,size+15)),children:"放大"})]}),r.jsxs("div",{ref:p,className:"contract-scroll"');
replace('r.jsx(HR,{content:e.content})','r.jsx(HR,{content:e.previewContent||e.content})');
const asset='/assets/enrollment-reader-'+crypto.createHash('sha256').update(s).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(root,asset),s);
fs.copyFileSync(path.join(__dirname,'reader.css'),path.join(root,'assets/enrollment-reader-261111.css'));
fs.writeFileSync(index,html.replace(old,asset).replace('</head>','<link rel="stylesheet" href="/assets/enrollment-reader-261111.css"></head>'));
