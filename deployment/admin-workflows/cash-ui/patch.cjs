'use strict';
const assert = require('node:assert/strict');
const {createReviewPayoutMethod} = require('../../../admin/src/features/applications/review-payout-method.mjs');
function replaceOnce(source, from, to) {
  assert.equal(source.split(from).length, 2, 'Missing or ambiguous cash UI anchor: '+from);
  return source.replace(from,()=>to);
}
function admin(code) {
  function change(a,b){code=replaceOnce(code,a,b);}
  change('function Q7({id:r})','const ReviewPayoutMethod=('+createReviewPayoutMethod.toString()+')(f);function Q7({id:r})');
  const anchor='D.enrollmentBundle?e.jsx(UCellGroupReview.EnrollmentReview';
  change(anchor,'e.jsx(ReviewPayoutMethod,{detail:D,canEdit:t,blocked:Y||j,setBusy:ce,save:$e,reload:()=>Promise.all([F.refetch(),W.refetch()])},D.id+"-"+D.payoutMethodVersion),'+anchor);
  const docs='["IDENTITY_FRONT","IDENTITY_BACK","BANKBOOK_COVER","SIGNED_APPLICATION_AGREEMENT","CORPORATE_REGISTRATION"]';
  change(docs+'.map(He=>e.jsx(s8',docs+'.filter(type=>D.payoutMethod!=="COMPANY_CASH"||type!=="BANKBOOK_COVER").map(He=>e.jsx(s8');
  change('(D.paperEvidence??[]).map(He=>','(D.paperEvidence??[]).filter(doc=>D.payoutMethod!=="COMPANY_CASH"||!["BANKBOOK_COVER","CORPORATE_BANK_PROOF"].includes(doc.type)).map(He=>');
  change('Vl(be).filter(He=>!'+docs,'Vl(be).filter(doc=>D.payoutMethod!=="COMPANY_CASH"||doc.type!=="CORPORATE_BANK_PROOF").filter(He=>!'+docs);
  change('e.jsxs("div",{className:"review-pair",children:[e.jsx("div",{children:k?e.jsx(ql','r.payoutMethod!=="COMPANY_CASH"&&e.jsxs("div",{className:"review-pair",children:[e.jsx("div",{children:k?e.jsx(ql');
  change('...Hy,...Vy].map(([w])','...Hy,...(r.payoutMethod==="COMPANY_CASH"?[]:Vy)].map(([w])');
  change('J7.map(b=>','J7.filter(field=>r.payoutMethod!=="COMPANY_CASH"||field!=="銀行資料").map(b=>');
  change('Object.entries(X7).map(([b,C])','Object.entries(X7).filter(([type])=>r.payoutMethod!=="COMPANY_CASH"||type!=="BANKBOOK_COVER").map(([b,C])');
  change('例如：已修正通訊地址，請核對並補傳清晰的存摺封面。','例如：請核對通訊地址，並確認補件項目。');

  // New paper cases can select cash before saving their first application.
  change('function WE(){const[r,t]','function WE(){const [paperMethod,setPaperMethod]=f.useState("BANK_TRANSFER");const cash=paperMethod==="COMPANY_CASH";const[r,t]');
  change('function oe(){i("NEW"),Zt({}),gn([]),Ce.current=null','function oe(){setPaperMethod("BANK_TRANSFER");i("NEW"),Zt({}),gn([]),Ce.current=null');
  change('const ut=gt.payload;S(ut.legalName','setPaperMethod(gt.payoutMethod??"BANK_TRANSFER");const ut=gt.payload;S(ut.legalName');
  change('for(const[vn,jr]of Object.entries(en))try{An[vn]=await g8(jr)}','for(const[vn,jr]of Object.entries(en).filter(([type])=>!cash||type!=="BANKBOOK_COVER"))try{An[vn]=await g8(jr)}');
  change('bankCode:Ue.replace(/\\s/g,""),bankAccount:Ee.replace(/[\\s-]/g,""),accountHolder:Ke.trim()', '...(cash?{}:{bankCode:Ue.replace(/\\s/g,""),bankAccount:Ee.replace(/[\\s-]/g,""),accountHolder:Ke.trim()})');
  change('"/admin/formal-member-applications/paper",{...lr,...ba}', '"/admin/formal-member-applications/paper",{...lr,...ba,payoutMethod:paperMethod}');
  const begin='e.jsxs(ae,{title:"4. 收款銀行帳戶",children:[e.jsx("p",{children:"會員領取款項的帳戶，請與存摺核對。"}),';
  change(begin,'e.jsxs(ae,{title:"4. 獎金領取方式",children:[e.jsxs("label",{children:["領取方式",e.jsxs("select",{"aria-label":"領取方式",value:paperMethod,disabled:!!Ce.current,onChange:ev=>{setPaperMethod(ev.target.value);wt(false);un(true)},children:[e.jsx("option",{value:"BANK_TRANSFER",children:"銀行匯款"}),e.jsx("option",{value:"COMPANY_CASH",children:"至公司領現金"})]})]}),Ce.current&&e.jsx("small",{children:"已建檔的申請可在正式會員審核中變更領取方式。"}),cash?e.jsx("p",{children:"至公司領現金，免填銀行資料及檢附存摺照片。"}):e.jsxs(e.Fragment,{children:[e.jsx("p",{children:"請核對存摺上的銀行代碼、帳號與戶名。"}),');
  change('法人文件的人工核對結果。"})]})]}),e.jsxs(ae,{title:"5. 證件、銀行與簽署文件"', '法人文件的人工核對結果。"})]})]})]}),e.jsxs(ae,{title:"5. 證件與簽署文件"');
  change('（公司名義適用）"]].map(([ue,Ne])','（公司名義適用）"]].filter(([type])=>!cash||type!=="BANKBOOK_COVER").map(([ue,Ne])');
  change('e.jsx("dt",{children:"預計匯款"}),e.jsx("dd",{children:e.jsx("strong",{children:Ci(t.transfer)', 'e.jsx("dt",{children:t.payoutMethod==="COMPANY_CASH"?"預計至公司領現金":"預計匯款"}),e.jsx("dd",{children:e.jsx("strong",{children:Ci(t.transfer)');
  change('e.jsx("button",{disabled:v,onClick:()=>Y(async()=>e1((await $e("/admin/nhi-payouts/"+i+"/downloads/BANK"', 'T.some(group=>group.payoutMethod==="COMPANY_CASH")&&e.jsx("button",{disabled:v,onClick:()=>Y(async()=>e1((await $e("/admin/nhi-payouts/"+i+"/downloads/CASH",{})).data)),children:"下載公司領現清單 CSV"}),e.jsx("button",{disabled:v||!T.some(group=>group.payoutMethod!=="COMPANY_CASH"),onClick:()=>Y(async()=>e1((await $e("/admin/nhi-payouts/"+i+"/downloads/BANK"');
  change('disabled:v,onClick:()=>Y(async()=>e1((await $e("/admin/nhi-payouts/"+i+"/downloads/BANK_XLS"', 'disabled:v||!T.some(group=>group.payoutMethod!=="COMPANY_CASH"),onClick:()=>Y(async()=>e1((await $e("/admin/nhi-payouts/"+i+"/downloads/BANK_XLS"');
  change('useStagedBank:!!g.stagedBank','useStagedBank:g.payoutMethod!=="COMPANY_CASH"&&!!g.stagedBank');
  change('o.stagedBank&&e.jsxs("label"', 'o.payoutMethod!=="COMPANY_CASH"&&o.stagedBank&&e.jsxs("label"');
  change('Object.entries(h).filter(([g])=>!c.useStagedBank||','Object.entries(h).filter(([g])=>(o.payoutMethod!=="COMPANY_CASH"&&!c.useStagedBank)||');
  change('encodeURIComponent(n),c);return l({...o,profile:y.data','encodeURIComponent(n),o.payoutMethod==="COMPANY_CASH"?Object.fromEntries(Object.entries(c).filter(([key])=>!["bankBranchCode","accountNumber","accountName","useStagedBank","stagedVersion"].includes(key))):c);return l({...o,profile:y.data');
  change('" · 收款帳號 ",((p=o.profile)==null?void 0:p.accountMasked)??"尚未登錄"', 'o.payoutMethod==="COMPANY_CASH"?" · 至公司領現金":" · 收款帳號 "+(((p=o.profile)==null?void 0:p.accountMasked)??"尚未登錄")');
  change('function pN({group:r,date:t,busy:n,events:i,submit:o}){const[l,c]', 'function pN({group:r,date:t,busy:n,events:i,submit:o}){const cash=r.payoutMethod==="COMPANY_CASH";const[l,c]');
  change('S?"已確認匯款":"登錄銀行結果"', 'cash?(S?"已簽領現金":"登錄現金簽領"):S?"已確認匯款":"登錄銀行結果"');
  change('o({groupId:r.id,status:l,amount:u,reference:m','o({...(cash?{payoutMethod:"COMPANY_CASH"}:{}),groupId:r.id,status:l,amount:u,reference:m');
  change('children:["銀行結果",e.jsxs("select",{value:l','children:[cash?"簽領結果":"銀行結果",e.jsxs("select",{value:l');
  change('value:"PAID",children:"全額匯款成功"','value:"PAID",children:cash?"已全額領現":"全額匯款成功"');
  change('value:"FAILED",children:"匯款失敗"','value:"FAILED",children:cash?"領現未完成":"匯款失敗"');
  change('children:["銀行交易／回覆編號",e.jsx("input",{required:!0,value:m','children:[cash?"現金簽領憑證編號":"銀行交易／回覆編號",e.jsx("input",{required:!0,value:m');
  change('e.jsx("button",{children:"確認銀行結果"})','e.jsx("button",{children:cash?"確認現金簽領結果":"確認銀行結果"})');
  return code;
}
function member(code) {
  function change(a,b){code=replaceOnce(code,a,b);}
  change('const o=["手機認證","證件正面","證件反面","存摺封面"]','const cash=s?.application?.payoutMethod==="COMPANY_CASH"||s?.draft?.payoutMethod==="COMPANY_CASH";const requiredDocs=cash?ao.filter(type=>type!=="BANKBOOK_COVER"):ao;const o=["手機認證","證件正面","證件反面",cash?"領取方式":"存摺封面"]');
  change('k&&ao.every(B=>!!v[B]))},[v,k,u,V,n]','k&&requiredDocs.every(B=>!!v[B]))},[v,k,u,V,n,cash]');
  change('if(!v.BANKBOOK_COVER&&!y.BANKBOOK_COVER)','if(!cash&&!v.BANKBOOK_COVER&&!y.BANKBOOK_COVER)');
  change('Ce=le.filter(H=>!W[H].trim())','Ce=le.filter(H=>(!cash||!["bankCode","bankAccount","accountHolder"].includes(H))&&!W[H]?.trim())');
  change('const Ye=["IDENTITY_FRONT","IDENTITY_BACK","BANKBOOK_COVER"];if(Object.values(y).some(H=>','const Ye=requiredDocs;if(Ye.map(type=>y[type]).some(H=>');
  change('bankCode:W.bankCode,bankAccount:W.bankAccount,accountHolder:W.accountHolder','...(cash?{}:{bankCode:W.bankCode,bankAccount:W.bankAccount,accountHolder:W.accountHolder})');
  change('for(const J of["IDENTITY_FRONT","IDENTITY_BACK","BANKBOOK_COVER"])','for(const J of Ye)');
  change('Ye.indexOf(J)+1}/3','Ye.indexOf(J)+1}/${Ye.length}');
  change('const je=ao.filter(J=>!ue[J])','const je=Ye.filter(J=>!ue[J])');
  change('r.jsxs("fieldset",{hidden:a!==3,disabled:a!==3,children:[r.jsx("legend",{children:"存摺封面與收款帳戶"})','cash?a===3&&r.jsx("p",{children:"獎金領取方式為至公司領現金，免填銀行資料及檢附存摺照片。"}):r.jsxs("fieldset",{hidden:a!==3,disabled:a!==3,children:[r.jsx("legend",{children:"存摺封面與收款帳戶"})');
  change('E.identityDocumentNumberMasked??"未提供","，帳號 ",E.bankAccountMasked','E.identityDocumentNumberMasked??"未提供",cash?"，至公司領現金":"，帳號 "+E.bankAccountMasked');
  change('!n.bankAccountMasked.startsWith("***")','!(n.bankAccountMasked?.startsWith("***")||(!n.bankAccountMasked&&(n.payoutMethod==="COMPANY_CASH"||e.bankCode===undefined)))');
  change('!ao.every(D=>{var V;return(V=T.draft)', '!ao.filter(type=>T.application?.payoutMethod!=="COMPANY_CASH"||type!=="BANKBOOK_COVER").every(D=>{var V;return(V=T.draft)');
  change('for(const g of ao){const x=i[g]','for(const g of ao.filter(type=>n.data?.payoutMethod!=="COMPANY_CASH"||type!=="BANKBOOK_COVER")){const x=i[g]');
  change('ao.map(g=>{var E,j;const x=p.find','ao.filter(type=>n.data?.payoutMethod!=="COMPANY_CASH"||type!=="BANKBOOK_COVER").map(g=>{var E,j;const x=p.find');
  change('FORMAL_ENROLLMENT_DOCUMENTS_REQUIRED:"請補齊身分證正反面、存摺封面及會員簽名"','FORMAL_ENROLLMENT_DOCUMENTS_REQUIRED:"請確認本案所需的身分文件及會員簽名均已齊備"');
  return code;
}
module.exports={admin,member};
