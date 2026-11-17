const fs = require('node:fs');
const root = '/usr/share/nginx/html';
const before = '/assets/admin-assisted-8d233f0ab6e2f5b7.js';
const after = '/assets/admin-payment-owner-5ebf603327cdda91.js';
const edits = [
  [
    "F=V.error?null:V.data?.data,W=F;",
    "F=V.error?null:V.data?.data,W=F; const ownerQuery=Le({queryKey:[\"order-payment-context\",y,undefined],queryFn:({signal})=>le(\"/admin/orders/\"+y+\"/payment-context\",{signal}),enabled:!!F&&F.orderId===y}); const context=ownerQuery.data?.data; const ownerName=context?.orderId===y&&(context.member?.legalName?.trim()||context.member?.preferredName?.trim());"
  ],
  [
    "children:[$1(W),\" · \",We(F.status)",
    "children:[ownerName||($1(W)!==\"姓名尚未提供\"?$1(W):ownerQuery.isFetching?\"讀取會員姓名中…\":ownerQuery.isError?e.jsx(\"button\",{type:\"button\",onClick:()=>ownerQuery.refetch(),children:\"重試讀取會員姓名\"}):\"姓名尚未提供\"),\" · \",We(F.status)"
  ],
  [
    "付款期限已過，請先處理款項核對，不能直接確認。",
    "付款期限已過。請先查核公司實際入帳。已匯款：保留原訂單號、金額、入帳時間與交易憑證，交財務核對，請勿要求會員再次付款。確認未收款：如需重訂，請至「修改與作廢」查看原單是否可作廢，再依原申請流程重新建單。"
  ],
  [
    "資格付款期限已過。如會員已匯款，請依原始訂單號與收款憑證辦理逾期款項核對。",
    "整組付款期限已過。已匯款請以整組訂單號、金額、實際入帳時間與交易憑證交財務核對，請勿拆單確認或重複付款。未收款且仍要購買，請先由承辦確認整組狀態，再安排重新申請。"
  ]
];
let code = fs.readFileSync(root + before, 'utf8');
for (const [oldText, newText] of edits) {
  if (code.split(oldText).length !== 2) throw Error('Unexpected admin bundle');
  code = code.replace(oldText, () => newText);
}
fs.writeFileSync(root + after, code);
const index = root + '/index.html';
const html = fs.readFileSync(index, 'utf8');
if (!html.includes(before)) throw Error('Unexpected entry point');
fs.writeFileSync(index, html.replaceAll(before, after));
