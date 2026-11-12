'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

function patch(source) {
  function once(before, after) {
    assert.equal(source.split(before).length, 2, 'Daily action anchor: ' + before);
    source = source.replace(before, () => after);
  }
  const helpers = fs.readFileSync(path.join(__dirname,'../../../admin/src/features/operations-control/daily-task.js'),'utf8').replaceAll('export function ', 'function ');
  once('function JI({role:r})', helpers + '\nfunction JI({role:r})');
  once('e.jsx(It,{to:y.data.data.path,children:"前往處理 →"})','k.targetPath?e.jsx(It,{to:k.targetPath,children:"前往處理 →"}):e.jsx("span",{children:"請更新待辦後再開啟"})');
  once('e.jsx("div",{className:"daily-table",children:', 'y.data.data.latestTargetPath&&y.data.data.total>1&&e.jsx(It,{className:"button-link",to:y.data.data.latestTargetPath,children:"處理最新一筆 →"}),e.jsx("div",{className:"daily-table",children:');
  once('[k,B]=f.useState(null),[H,z]=f.useState(null),[q,O]=f.useState(null),[Y,ce]=f.useState(!1),[ucQuery,ucChange]',
    '[k,B]=f.useState(()=>taskValue("REVIEW|SUPPLEMENT","applicationId")),[H,z]=f.useState(null),[q,O]=f.useState(null),[Y,ce]=f.useState(!1),[ucQuery,ucChange]');
  once('function aT({membershipAllowed:r=!1}){const[t,n]=f.useState(r?"scan":"operations"),[i,o]=f.useState([r?"scan":"operations"])',
    'function aT({membershipAllowed:r=!1}){const initial=taskValue("PAPER_ORDER","applicationId")?"operations":r?"scan":"operations",[t,n]=f.useState(initial),[i,o]=f.useState([initial])');
  once('function nT(){var K,ne,Z;const r=At()', 'function nT(){var K,ne,Z;const taskId=taskValue("PAPER_ORDER","applicationId"),taskOpened=f.useRef(null),r=At()');
  once('function W(ee){o(ee),p(null),h(""),c(""),A({}),N(""),k(null),H(null)}',
    'f.useEffect(()=>{if(!taskId||taskOpened.current===taskId||!z.data)return;const match=w.find(x=>x.source==="FORMAL"&&x.sourceId===taskId);if(match){taskOpened.current=taskId;W(match)}},[taskId,z.data]);function W(ee){o(ee),p(null),h(""),c(""),A({}),N(""),k(null),H(null)}');
  once('e.jsxs(ae,{title:"建立紙本資格套組訂單",children:[e.jsx("p",',
    'e.jsxs(ae,{title:"建立紙本資格套組訂單",children:[taskId&&z.data&&!taskOpened.current&&!w.some(x=>x.source==="FORMAL"&&x.sourceId===taskId)&&e.jsx("p",{role:"status",ref:focusTaskElement,tabIndex:-1,children:"這筆申請已離開待建單清單，請返回待辦重新整理。"}),e.jsx("p",');
  once('i&&e.jsxs("fieldset",{disabled:T,style:{border:"1px solid #bfd2dc"', 'i&&e.jsxs("fieldset",{ref:taskId===i.sourceId?focusTaskElement:null,tabIndex:-1,disabled:T,style:{border:"1px solid #bfd2dc"');
  once('function hm({id:r}){var U,k,B,H,z,q,O,Y,ce,V,P;const[t,n]=f.useState(!1),[i,o]=f.useState("Overview")',
    'function hm({id:r}){var U,k,B,H,z,q,O,Y,ce,V,P;const[t,n]=f.useState(!1),[i,o]=f.useState(()=>taskValue("SPONSOR","qualificationId")===r?"Sponsor":"Overview")');
  once('id:l+"-panel",role:"tabpanel"', 'ref:taskValue("SPONSOR|PLACEMENT","qualificationId")===r?focusTaskElement:null,tabIndex:-1,id:l+"-panel",role:"tabpanel"');
  once('h.candidate&&e.jsxs("div",{className:"ct-selection"', 'h.candidate&&e.jsxs("div",{ref:taskValue("PLACEMENT","candidateBallNo")===h.candidate.ballNo?focusTaskElement:null,tabIndex:-1,className:"ct-selection"');
  once('[k,B]=f.useState(u.has("feeRefund")?"管理":"商品")','[k,B]=f.useState(u.has("feeRefund")?"管理":taskValue("PAYMENT","orderId")===y?"收款":"商品")');
  once('B(u.has("feeRefund")?"管理":"商品");i("");l("");T(null)},[y,u.has("feeRefund")]', 'B(u.has("feeRefund")?"管理":taskValue("PAYMENT","orderId")===y?"收款":"商品");i("");l("");T(null)},[y,u.has("feeRefund"),u.get("daily")]');
  once('j.data.data.fulfillments.map(A=>{var R;return e.jsxs("section",{children:', 'j.data.data.fulfillments.map(A=>{var R;return e.jsxs("section",{ref:taskValue("SHIPMENT","fulfillment")===A.fulfillmentKey?focusTaskElement:null,tabIndex:-1,children:');
  once('function uN(){var P,w,F,W,G;const{user:r}=Et(),t=["FINANCE","SUPER_ADMIN"].includes((r==null?void 0:r.role)??""),n=At(),[i,o]=f.useState("")',
    'function uN(){var P,w,F,W,G;const{user:r}=Et(),t=["FINANCE","SUPER_ADMIN"].includes((r==null?void 0:r.role)??""),n=At(),[i,o]=f.useState(()=>taskValue("PAYOUT","run")||"")');
  once('S=i.some(b=>b.kind==="PAYMENT"&&b.payload.groupId===r.id&&b.payload.status==="PAID");return e.jsxs("details",{children:',
    'S=i.some(b=>b.kind==="PAYMENT"&&b.payload.groupId===r.id&&b.payload.status==="PAID");const selected=taskValue("PAYOUT","group")===r.id;return e.jsxs("details",{ref:selected?focusTaskElement:null,tabIndex:-1,open:selected||void 0,children:');
  // Read-only staff see the matched group in the same authenticated run details.
  once('t&&N.status==="EXPORTED"&&T.map(K=>e.jsx(pN,','(!t||N.status!=="EXPORTED")&&T.filter(K=>taskValue("PAYOUT","group")===K.id).map(K=>e.jsx("p",{ref:focusTaskElement,tabIndex:-1,children:K.memberNo+" · 本筆匯款資料請由財務核對"},K.id)),t&&N.status==="EXPORTED"&&T.map(K=>e.jsx(pN,');
  return source;
}
module.exports = {patch};
