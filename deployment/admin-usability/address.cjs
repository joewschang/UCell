const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),root=process.argv[2];
const index=path.join(root,'index.html'),html=fs.readFileSync(index,'utf8'),asset=html.match(/src="(\/assets\/[^"]+\.js)"/)[1];let js=fs.readFileSync(path.join(root,asset),'utf8');
function change(a,b){if(js.split(a).length!==2)throw Error(a);js=js.replace(a,()=>b);}
change('function AT({onSubmitted:e,onSaved:t,onReadyChange:n,draftOnly:i=!1,initial:s}={}){','function AT({onSubmitted:e,onSaved:t,onReadyChange:n,draftOnly:i=!1,initial:s}={}){const [addressProposal,setAddressProposal]=h.useState("");const addressEdited=h.useRef(false);');
change('const se=(B,le)=>{F(!0)','const se=(B,le)=>{if(B==="communicationAddress")addressEdited.current=true;F(!0)');
change('...((le=s.draft)==null?void 0:le.payload)??s.prefill??{}}}),','...((le=s.draft)==null?void 0:le.payload)??s.prefill??{},...(addressEdited.current?{communicationAddress:B.communicationAddress}:{})}}),');
change('if(B==="IDENTITY_BACK" && current.communicationAddress!==W.communicationAddress)return current;', 'if(B==="IDENTITY_BACK" && (addressEdited.current || current.communicationAddress.trim()))return current;');
change('const Ye={};for(const ke of B==="IDENTITY_FRONT"', 'if(B==="IDENTITY_BACK")setAddressProposal(Ce.communicationAddress||""); const Ye={};for(const ke of B==="IDENTITY_FRONT"');
change('me=(B,le)=>{F(!0)','me=(B,le)=>{if(B==="IDENTITY_BACK")setAddressProposal("");F(!0)');
change('r.jsx(wT,{required:!0,value:W.communicationAddress,onChange:B=>se("communicationAddress",B)})','r.jsx(wT,{required:!0,value:W.communicationAddress,onChange:B=>se("communicationAddress",B)}),addressProposal&&addressProposal!==W.communicationAddress&&r.jsxs("div",{className:"card",children:[r.jsx("p",{children:"證件背面辨識地址："+addressProposal}),r.jsx("button",{type:"button",onClick:()=>se("communicationAddress",addressProposal),children:"使用辨識地址"})]})');
change('if(I!==v.current)return;c(N.fields),j(t==="BANKBOOK_COVER"', 'if(I!==v.current)return;c(N.fields),j(t==="IDENTITY_BACK"&&N.fields.communicationAddress?"已辨識戶籍地址，請核對下方地址後繼續。":t==="BANKBOOK_COVER"');
const next='/assets/enroll-address-'+crypto.createHash('sha256').update(js).digest('hex').slice(0,12)+'.js';
fs.writeFileSync(path.join(root,next),js);
fs.writeFileSync(index,html.replace(asset,next).replace('</head>','<style>@media(max-width:800px){.formal-profile .uc-address :is(select,textarea){font-size:max(16px,1rem);max-width:100%;box-sizing:border-box}}</style></head>'));
