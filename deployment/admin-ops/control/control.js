// Inserted into the existing admin module by patch-payment.cjs.
function ucReviewText(value) {
  return String(value ?? "").normalize("NFKC").toLowerCase().replace(/[\s()-]+/g, "");
}
function ucFilterReviews(rows, query) {
  const terms = query.trim().split(/\s+/).map(ucReviewText).filter(Boolean);
  if (!terms.length) return rows;
  return rows.filter(row => {
    const fields = [row.personName, row.personNameMasked, row.representativeName, row.displayMemberNo].map(ucReviewText);
    return terms.every(term => fields.some(field => field.includes(term)));
  });
}
function ucReviewPicker({ query, change, loaded, matches, loading, failed, mode, switchMode, applied, search, retry }) {
  const directory=mode==="directory";
  return e.jsxs("form", { className: "uc-review-picker", onSubmit:event=>{event.preventDefault();if(directory)search(query.trim());}, children: [
    e.jsxs("div",{className:"uc-review-modes",role:"group","aria-label":"搜尋範圍",children:[
      ["directory","全部會員主檔"],["batch","最近申請的送審名稱"]
    ].map(([key,label])=>e.jsx("button",{type:"button","aria-pressed":mode===key,onClick:()=>switchMode(key),children:label},key))}),
    e.jsx("label", { htmlFor: "uc-review-search", children: directory?"搜尋正式會員申請":"篩選本批正式會員申請" }),
    e.jsxs("div", { className: "uc-review-inputs", children: [
      e.jsx("input", { id: "uc-review-search", type: "search", autoComplete: "off", maxLength: 120, value: query,
        placeholder: "姓名、法人、代表人或會員編號", onChange: event => change(event.target.value) }),
      directory && e.jsx("button",{type:"submit",children:"搜尋"}),
      (query||applied) && e.jsx("button", { type: "button", onClick: () => {
        change(""); search(""); document.getElementById("uc-review-search")?.focus();
      }, children: "清除" })
    ] }),
    e.jsx("p",{children:directory?"搜尋所有頁面的會員主檔。若送審名稱尚未寫入主檔，可切換至最近申請。":"依目前申請狀態篩選最近更新的 100 筆，可查送審時填寫的姓名。"}),
    e.jsx("p", { role: "status", children: failed ? "清單讀取失敗，請重試。" : loading ? "正在載入申請清單…" :
      directory ? (applied ? "搜尋「"+applied+"」 · " : "")+"本頁 "+loaded+" 筆" :
      (query.trim() ? "符合 " + matches + " 筆／本批 " + loaded + " 筆" : "本批 " + loaded + " 筆") }),
    failed && e.jsx("button",{type:"button",onClick:retry,children:"重試申請清單"})
  ] });
}
function ucReviewPages({ page, more, change, loading }) {
  if(page===1&&!more)return null;
  return e.jsxs("nav",{className:"uc-review-pages","aria-label":"正式會員申請分頁",children:[
    e.jsx("button",{type:"button",disabled:page<=1||loading,onClick:()=>change(page-1),children:"上一頁"}),
    e.jsx("span",{children:"第 "+page+" 頁"}),
    e.jsx("button",{type:"button",disabled:!more||loading,onClick:()=>change(page+1),children:"下一頁"})
  ]});
}
function ucReviewContext({ detail }) {
  const name = detail.applicantType === "LEGAL_ENTITY"
    ? detail.legalEntity?.registeredName || detail.payload?.legalEntityName
    : detail.payload?.legalName || detail.person?.legalName;
  const memberNo = detail.legalEntity?.memberNo || detail.person?.memberNo;
  function jump(id) {
    const section = document.getElementById(id);
    if (!section) return;
    section.focus({ preventScroll: true }); section.scrollIntoView({ block: "start", behavior: "instant" });
  }
  return e.jsxs("section", { className: "uc-review-context", "aria-label": "目前審查案件", children: [
    e.jsx("span", { children: detail.applicantType === "LEGAL_ENTITY" ? "法人申請" : "會員申請" }),
    e.jsx("strong", { children: name || "尚未提供名稱" }),
    e.jsx("small", { children: memberNo || "尚無會員編號" }),
    e.jsx("nav", { "aria-label": "審查段落", children: [
      ["application-reconciliation", "收款對帳"], ["uc-review-documents", "申請附件"], ["uc-review-profile", "申請資料"]
    ].map(([id, label]) => e.jsx("button", { type: "button", onClick: () => jump(id), children: label }, id)) })
  ] });
}
function ucValidReceivable(value) {
  return (typeof value === "number" || (typeof value === "string" && /^\d+(?:\.\d+)?$/.test(value.trim()))) &&
    Number.isFinite(Number(value)) && Number(value) >= 0;
}
