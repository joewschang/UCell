const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const area=process.argv[2],dir=process.argv[3]||'/usr/share/nginx/html';
const index=path.join(dir,'index.html'),html=fs.readFileSync(index,'utf8');
const entry=html.match(/<script type="module" crossorigin src="(\/assets\/[^"]+\.js)"/)[1];
let js=fs.readFileSync(path.join(dir,entry),'utf8');
function edit(a,b){if(js.split(a).length!==2)throw Error('Unexpected '+area+' anchor '+a);js=js.replace(a,()=>b);}
if(area==='member'){
 edit('async function UE(e,t,n,i,s){','async function UE(e,t,n,i,s,couponCode){');
 edit('qualificationId:e.id,items:t,commercialOfferingCode:i,...s?','qualificationId:e.id,items:t,couponCode,commercialOfferingCode:i,...s?');
 edit('function p0({q:e,requestedSku:t}){','function p0({q:e,requestedSku:t}){const [code,setCode]=h.useState(""),[quote,setQuote]=h.useState(null),[checking,setChecking]=h.useState(false),[quoteError,setQuoteError]=h.useState("");');
 edit('function _($,z){y||',`const cartItems=L.map(({offer,product})=>({productId:product.id,quantity:String(l[offer.offeringCode]),commercialOfferingCode:offer.offeringCode}));
 const quoteKey=JSON.stringify([e?.id,code,cartItems,F]),validQuote=quote?.key===quoteKey?quote.value:null,needsQuote=!!code&&!validQuote;
 async function applyCoupon(){setQuote(null);setQuoteError("");if(!e?.id){setQuoteError("請先選擇已生效且活躍的正式會員資格。");return}setChecking(true);try{const value=await q("/member/orders/core-coupon-quote",{method:"POST",body:JSON.stringify({qualificationId:e.id,couponCode:code,items:cartItems})});if(!value||!Number.isFinite(Number(value.total))||value.couponCode!==code)throw Error("請重新核對優惠。");setQuote({key:quoteKey,value})}catch(err){setQuoteError(err.message||"暫時無法核對優惠碼")}finally{setChecking(false)}}
 function _($,z){y||`);
 edit('if(I.current)return;if(!U||!E','if(I.current||checking||needsQuote)return;if(!U||!E');
 edit('expectedTotal:(F/100).toFixed(2)},se=JSON.stringify({qualificationId:', 'expectedTotal:validQuote?.total??(F/100).toFixed(2)},se=JSON.stringify({couponCode:validQuote?.couponCode,qualificationId:');
 edit('await UE(e,$,R.current.key,void 0,z):','await UE(e,$,R.current.key,void 0,z,validQuote?.couponCode):');
 edit('S(fe),c({}),R.current=null','S(fe),setCode(""),setQuote(null),setQuoteError(""),c({}),R.current=null');
 edit('r.jsx("p",{children:"實際金額由系統再次核對；商品價格異動時會要求您重新確認。"})',`r.jsxs("div",{className:"cart-coupon",children:[r.jsxs("label",{children:["主商品優惠碼",r.jsx("input",{value:code,placeholder:"輸入優惠碼",maxLength:40,disabled:y,onChange:event=>{setCode(event.target.value.trim().toUpperCase());setQuote(null);setQuoteError("")}})]}),r.jsx("button",{type:"button",disabled:!code||checking||y,onClick:applyCoupon,children:checking?"正在核對…":"套用優惠碼"}),code&&r.jsx("button",{type:"button",disabled:checking||y,onClick:()=>{setCode("");setQuote(null);setQuoteError("")},children:"移除"}),r.jsx("p",{children:"UCELL168 每滿三盒折一盒，同價或混搭皆可，以較低價商品折抵。限所選活躍正式會員資格，至 2027/02/28。"}),quoteError&&r.jsx("p",{role:"alert",children:quoteError}),validQuote&&r.jsxs("p",{role:"status",children:["已套用 ",code,"，折抵 ",validQuote.freeQuantity," 盒（",Lr(Number(validQuote.discountAmount)),"），應付 ",r.jsx("strong",{children:Lr(Number(validQuote.total))})]})]})`);
 edit('children:[k," 件商品 · ",r.jsx("strong",{children:Lr(X)})]','children:[k," 件商品 · 應付 ",r.jsx("strong",{children:Lr(validQuote?Number(validQuote.total):X)})]');
 edit('blockedReason:[!U&&"請先確認購物車','blockedReason:[needsQuote&&"請先套用或移除優惠碼。",!U&&"請先確認購物車');
 edit('disabled:y||!U||!E||!a&&','disabled:y||checking||needsQuote||!U||!E||!a&&');
}else{
 edit('資格套組優惠、付款期限與完整使用紀錄。','主商品與資格套組優惠、使用期限及訂單紀錄。');
 edit('t&&e.jsx(ae,{title:o?"編輯優惠碼":"新增優惠碼"',`t&&c.code==="UCELL168"&&o?e.jsxs(ae,{title:"主商品優惠設定",children:[e.jsx("p",{children:"UCELL168｜活躍正式會員資格，每滿三盒折一盒。使用次數不限，優惠至 2027/02/28。"}),e.jsxs("label",{children:[e.jsx("input",{type:"checkbox",checked:c.enabled,onChange:F=>T("enabled",F.target.checked)}),"啟用優惠碼"]}),e.jsx("button",{disabled:S.isPending,onClick:()=>S.mutate(),children:"儲存啟用狀態"}),e.jsx("button",{onClick:()=>{l("");u(Qp)},children:"取消"})]}):t&&e.jsx(ae,{title:o?"編輯優惠碼":"新增優惠碼"`);
 edit('children:["規則版本 ",F.revision," · ",F.packageCodes.join(" / ")]','children:["規則版本 ",F.revision," · ",F.category==="CORE_PRODUCT"?"主商品結帳":F.packageCodes.join(" / ")]');
 edit('e.jsxs("td",{children:[F.snapshot.couponCode," · ",F.snapshot.packageCode','F.snapshot.ruleCode==="CORE_BUY3_PAY2_V1"?e.jsxs("td",{children:["UCELL168 · 主商品 ",F.snapshot.quantity," 盒，折抵 ",F.snapshot.freeQuantity," 盒",e.jsx("br",{}),"原價 ",F.snapshot.grossAmount," 元，折抵 ",F.snapshot.discountAmount," 元，應付 ",F.snapshot.total," 元"]}):e.jsxs("td",{children:[F.snapshot.couponCode," · ",F.snapshot.packageCode');
}
const next='/assets/'+area+'-corecoupon-'+crypto.createHash('sha256').update(js).digest('hex').slice(0,16)+'.js';
fs.writeFileSync(path.join(dir,next),js);fs.writeFileSync(index,html.replace(entry,next));

