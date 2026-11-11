const fs=require("node:fs"), path=require("node:path"), crypto=require("node:crypto");
const root=process.argv[2], index=path.join(root,"index.html");
let html=fs.readFileSync(index,"utf8");
const asset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];
let js=fs.readFileSync(path.join(root,asset),"utf8");
function edit(old,value) {
  if(js.split(old).length!==2) throw Error("Unexpected enrollment bundle near "+old.slice(0,80));
  js=js.replace(old,()=>value);
}
edit("function Xm(){",fs.readFileSync(path.join(__dirname,"components.js"),"utf8")+"\nfunction Xm(){const [pdfKey,setPdfKey]=h.useState(null);");
edit("readContract:i=!0,reconfirm:s})","readContract:i=!0,reconfirm:s,onPdfChange,externalPdf=false})");
edit("h.useEffect(()=>{t(W||m)}","h.useEffect(()=>{onPdfChange?.(!ne&&(W||m)?e:null)},[onPdfChange,e,ne,W,m]),h.useEffect(()=>{t(W||m)}");
edit("r.jsx(qR,{id:e})","!externalPdf&&r.jsx(qR,{id:e})");
edit("P?r.jsxs(\"section\",{className:\"card\",role:\"status\"","pdfKey&&pdfKey===I&&i&&r.jsx(EnrollmentPdf,{id:I},I),P?r.jsxs(\"section\",{className:\"card\",role:\"status\"");
edit("applicationId:I,onReady:s","applicationId:I,onReady:s,onPdfChange:setPdfKey,externalPdf:true");
edit("g&&r.jsxs(\"section\",{\"aria-label\":\"手機驗證後補簽\"","f.application&&!g&&!f.missing.some(item=>item.type===\"SIGNED_APPLICATION_AGREEMENT\")&&r.jsx(ProgressPdf,{id:f.application.id},f.application.id),g&&r.jsxs(\"section\",{\"aria-label\":\"手機驗證後補簽\"");
const start=js.indexOf('r.jsxs("label",{children:["付款方式",r.jsxs("select",{value:u===T.orderId');
const end=js.indexOf(',r.jsx(lo,{method:u===T.orderId',start);
if(start<0||end<start)throw Error("Payment selector missing");
edit(js.slice(start,end),'r.jsx(EnrollmentPayment,{orderId:T.orderId,value:u===T.orderId?l:"",onChange:method=>{d(T.orderId);c(method);v.current=crypto.randomUUID()}})');
edit('children:[r.jsx(Bl,{code:e.packageCode}),r.jsx("h3",{children:e.displayName}),_&&','children:[r.jsxs("div",{className:"enroll-plan-title",children:[r.jsx(Bl,{code:e.packageCode,compact:true}),r.jsx("h3",{children:e.displayName})]}),_&&');
edit('推薦球號可先留白，由公司後台指定；指定完成後才可確認收款及進行後續安置。若已知推薦人，請填寫有效球號。','已知推薦人請填球號；留白仍可建單，由公司補指定後確認收款及安置。');
edit('!T&&r.jsx("p",{role:"status",children:"尚未指定推薦球，可繼續申請與建立訂單，後續由公司後台補指定。"}),','');
edit('children:"正式會員合約與簽名已保存。"','children:i?"正式會員合約與簽名已保存。":"請返回合約步驟完成簽名。"');
function writeAsset(ext,data){
  const url="/assets/enrollment-"+crypto.createHash("sha256").update(data).digest("hex").slice(0,12)+"."+ext;
  fs.writeFileSync(path.join(root,url),data);return url;
}
html=html.replace(asset,writeAsset("js",js)).replace("</head>",'<link rel="stylesheet" href="'+writeAsset("css",fs.readFileSync(path.join(__dirname,"enrollment.css")))+'"></head>');
fs.writeFileSync(index,html);
