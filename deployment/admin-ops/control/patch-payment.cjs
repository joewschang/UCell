const fs = require("node:fs");
const path = require("node:path");
const helpers = fs.readFileSync(path.join(__dirname, "control.js"), "utf8");
function once(text, from, to) {
  const start = text.indexOf(from);
  if (start === -1 || text.indexOf(from, start + from.length) !== -1) throw Error("Expected one anchor: " + from);
  return text.slice(0, start) + to + text.slice(start + from.length);
}
function patch(bundle) {
  // Patch only this release's component contracts. Fail before writing if they drift.
  const start = bundle.indexOf("function gm({orderId:r,onBusy:t,applicationId:n");
  const end = bundle.indexOf("function i8({applicationId:r", start);
  if (start < 0 || end < 0) throw Error("Payment review component boundary missing.");
  let payment = bundle.slice(start, end);
  const replacePay = (from, to) => { payment = once(payment, from, to); };
  replacePay("U=f.useRef(\"\"),k=f.useRef(\"\");", `U=f.useRef(""),k=f.useRef("");
    const amountKnown=ucValidReceivable(h?.total),waived=amountKnown&&Number(h.total)===0;
    const method=waived?"COUPON_WAIVER":(["CASH","BANK_TRANSFER"].includes(m)?m:"");
    const reviewKey=JSON.stringify([r,h?.status,h?.total,h?.report?.version,h?.report?.reportedAt,h?.paymentDeadline,method,g,v]);
    const checked=S===reviewKey;`);
  replacePay("if(!h||C||!S)return;", "if(!h||o||u.error||C||!checked||!method||!amountKnown||h.status!==\"CONFIRMED\")return;");
  replacePay("paymentMethod:m,referenceNo:", "paymentMethod:method,referenceNo:");
  replacePay('_("已確認收款，訂單付款狀態已更新。")','_(waived?"已確認全額減免，訂單付款狀態已更新。":"已確認收款，訂單付款狀態已更新。")');
  replacePay('children:e.jsx("strong",{children:Lt(h.total)})','children:e.jsx("strong",{children:amountKnown?Lt(h.total):"金額待確認"})');
  replacePay('children:Number(h.total)===0?"公司確認全額減免"', 'children:waived?"公司確認全額減免"');
  replacePay('Number(h.total)===0&&e.jsx("p",{children:"此訂單應付 0 元，不需匯款；請選擇「優惠全額減免」，完成核對後仍須依流程審核與安置。"})', 'waived&&e.jsx("p",{children:"此訂單應付 0 元。請核對減免依據，並記錄優惠碼或憑證。"})');
  replacePay('h.status==="CONFIRMED"&&!o?e.jsxs("div"', '!amountKnown?e.jsxs("div",{children:[e.jsx("p",{role:"alert",children:"應收金額未能核實。請重新載入付款資料後再核對。"}),e.jsx("button",{type:"button",onClick:()=>void u.refetch(),children:"重新查詢金額"})]}):h.status==="CONFIRMED"&&!o?e.jsxs("div"');
  replacePay('label:"實際收款方式",children:e.jsxs("select",{value:m,disabled:C', 'label:waived?"減免方式":"實際收款方式",children:waived?e.jsx("output",{children:"優惠全額減免（無實際收款）"}):e.jsxs("select",{value:method,disabled:C');
  replacePay(',Number(h.total)===0&&e.jsx("option",{value:"COUPON_WAIVER",children:"優惠全額減免（無實際收款）"})', '');
  replacePay('label:m==="COUPON_WAIVER"?', 'label:waived?');
  replacePay('label:"實際入帳日期與時間（臺北時間）"', 'label:waived?"減免核對日期與時間（臺北時間）":"實際入帳日期與時間（臺北時間）"');
  replacePay('["本次確認全額收款：",', '[waived?"本次應付金額：":"本次確認全額收款：",');
  replacePay('checked:S,disabled:C,onChange:K=>b(K.target.checked)', 'checked,disabled:C,onChange:K=>b(K.target.checked?reviewKey:false)');
  replacePay('Number(h.total)===0?"我已核對', 'waived?"我已核對');
  replacePay('disabled:C||!m||!g.trim()||!S||!z||!!H', 'disabled:C||!!u.error||!method||!g.trim()||!checked||!z||!!H');
  replacePay('qt(h)," 全額收款 ",Lt(h.total)', 'qt(h),waived?" 全額減免 · 應付 ":" 全額收款 ",Lt(h.total)');
  replacePay('全額收款 ",Lt(h.total)]})]})', '全額收款 ",Lt(h.total)]},reviewKey+":"+Boolean(u.error))]})');
  let output = bundle.slice(0, start) + helpers + "\n" + payment + bundle.slice(end);
  const replace = (from, to) => { output = once(output, from, to); };
  replace('V=Le({queryKey:["applications",b,A]', '[ucQuery,ucChange]=f.useState(""),[ucMode,ucModeChange]=f.useState("directory"),[ucApplied,ucApply]=f.useState(""),[ucPage,ucPageChange]=f.useState(1),V=Le({queryKey:["applications",b,A]');
  replace('queryKey:["formal-applications",_],queryFn:()=>le("/admin/formal-member-applications"+ze({status:_||void 0,take:100}))',
    'queryKey:["formal-applications",_,ucMode,ucApplied,ucPage],queryFn:()=>le("/admin/formal-member-applications"+ze(ucMode==="directory"?{status:_||void 0,take:20,page:ucPage,q:ucApplied||void 0}:{status:_||void 0,take:100}))');
  replace('K=((Ve=P.data)==null?void 0:Ve.data)??[],ne=', 'K=((Ve=P.data)==null?void 0:Ve.data)??[],ucMatches=ucMode==="batch"?ucFilterReviews(K,ucQuery):K,ne=');
  replace('"正式會員申請狀態",value:_,onChange:D=>U(D.target.value)', '"正式會員申請狀態",value:_,onChange:D=>{U(D.target.value);ucPageChange(1)}');
  replace('e.jsx(De,{error:P.error}),e.jsx("div",{className:"table-wrap",children:e.jsxs(kt,{children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"申請人"})',
    'e.jsx(ucReviewPicker,{query:ucQuery,change:ucChange,loaded:K.length,matches:ucMatches.length,mode:ucMode,applied:ucApplied,switchMode:mode=>{if(mode!==ucMode){ucModeChange(mode);ucChange("");ucApply("");ucPageChange(1)}},search:text=>{ucApply(text);ucPageChange(1)},retry:()=>P.refetch(),loading:P.isLoading,failed:P.isError}),e.jsx(De,{error:P.error}),e.jsx("div",{className:"table-wrap",children:e.jsxs(kt,{ucFormal:true,children:[e.jsx("thead",{children:e.jsxs("tr",{children:[e.jsx("th",{children:"申請人"})');
  replace('function kt({children:r}){', 'function kt({children:r,ucFormal=false}){');
  replace('render:p=>{var g,y;return e.jsx("span",{className:(g=p.cells[m])', 'render:p=>{var g,y;return e.jsx("span",{"data-uc-label":ucFormal&&m?h:void 0,className:(g=p.cells[m])');
  replace('label:"資料清單："+l.join("／"),searchable:!0','label:"資料清單："+l.join("／"),searchable:!ucFormal');
  replace('children:K.map(D=>{var xe,be;', 'children:ucMatches.map(D=>{var xe,be;');
  replace('e.jsxs("td",{children:[c8[D.applicantType]', 'e.jsxs("td",{"data-uc-field":"類型／來源",children:[c8[D.applicantType]');
  replace('e.jsx("td",{children:u8[D.membershipState]', 'e.jsx("td",{"data-uc-field":"會員狀態",children:u8[D.membershipState]');
  replace('e.jsx("td",{children:e.jsx(ot,{tone:D.status==="APPROVED"', 'e.jsx("td",{"data-uc-field":"申請狀態",children:e.jsx(ot,{tone:D.status==="APPROVED"');
  replace('e.jsx("td",{children:yt(D.updatedAt)})]},D.id)})})]})}),!P.isLoading&&!K.length', 'e.jsx("td",{"data-uc-field":"更新時間",children:yt(D.updatedAt)})]},D.id)})})]})}),!P.isLoading&&!P.isError&&K.length>0&&!ucMatches.length&&e.jsx("p",{className:"uc-review-empty",children:"本批沒有相符申請。請改用部分姓名、會員編號，或清除篩選。"}),!P.isLoading&&!P.isError&&!K.length');
  replace('e.jsx("p",{children:"目前沒有正式會員申請。"})]})}),k&&',
    'e.jsx("p",{children:ucApplied?"沒有符合條件的會員主檔申請。":"本頁目前沒有正式會員申請。"}),ucMode==="directory"&&e.jsx(ucReviewPages,{page:ucPage,more:P.data?.meta?.hasNext===true,change:page=>{ucPageChange(page);document.getElementById("formal-applications-list")?.focus()},loading:P.isFetching})]})}),k&&');
  replace('be=((Ge=W.data)==null?void 0:Ge.data)??[];return e.jsxs(e.Fragment,{children:[', 'be=((Ge=W.data)==null?void 0:Ge.data)??[];return e.jsxs(e.Fragment,{children:[e.jsx(ucReviewContext,{detail:D}),');
  replace('e.jsxs("section",{"aria-label":"申請附件",children:', 'e.jsxs("section",{id:"uc-review-documents",tabIndex:-1,"aria-label":"申請附件",children:');
  replace('e.jsx(l8,{detail:D,readOnly:!t', 'e.jsx("div",{id:"uc-review-profile",tabIndex:-1,children:e.jsx(l8,{detail:D,readOnly:!t');
  replace('}},"edit-"+k),e.jsxs("dl"', '}},"edit-"+k)}),e.jsxs("dl"');
  return output;
}
if (require.main === module) {
  const file = process.argv[2];
  fs.writeFileSync(file, patch(fs.readFileSync(file, "utf8")));
}
module.exports = { patch };
