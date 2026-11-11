function EnrollmentPayment({orderId, value, onChange}) {
  const methods = [
    ["BANK_TRANSFER", "銀行匯款／ATM", "選擇後可查看公司收款帳號。"],
    ["CASH", "現金", "交款時請提供訂單編號，供公司核對。"]
  ];
  return r.jsxs("fieldset", {className:"enroll-payment", children:[
    r.jsx("legend",{children:"選擇這筆訂單的付款方式"}),
    ...methods.map(([code,title,hint])=>r.jsxs("label", {children:[
      r.jsx("input",{type:"radio",name:"payment-"+orderId,value:code,checked:value===code,onChange:()=>onChange(code)}),
      r.jsxs("span",{children:[r.jsx("strong",{children:title}),r.jsx("small",{children:hint})]})
    ]}, code))
  ]});
}
function EnrollmentPdf({id}) {
  return r.jsxs("section",{className:"enroll-pdf","aria-label":"已簽署的會員合約",children:[
    r.jsx("h3",{children:"已簽署的會員合約"}),
    r.jsx("p",{children:"可立即下載，也可稍後回到「我的」的申請進度查看。"}),
    r.jsx(qR,{id},id)
  ]});
}
function ProgressPdf({id}) {
  const docs=ae("progress-pdf:"+id, signal=>Kf(id,signal),true,true);
  if (docs.error) return r.jsx("button",{type:"button",onClick:docs.retry,children:"重新查詢已簽署合約"});
  return docs.data?.documents?.some(doc=>doc.type==="SIGNED_APPLICATION_AGREEMENT" && doc.status==="PRESENT")
    ? r.jsx(EnrollmentPdf,{id},id) : null;
}
