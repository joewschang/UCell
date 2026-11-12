'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {createHash} = require('node:crypto');
const {createRequire} = require('node:module');
const project = createRequire(path.resolve(__dirname, '../../admin/package.json'));
const ts = project('typescript');

function moduleSource() {
  const esbuild = createRequire(project.resolve('vite/package.json'))('esbuild');
  const source = fs.readFileSync(path.resolve(__dirname, '../../admin/src/features/orders/OrderWorkbench.tsx'),'utf8');
  const compiled = esbuild.transformSync(source,{loader:'tsx',jsx:'automatic',target:'es2020',format:'cjs',charset:'utf8',minify:true}).code;
  const host = '{"react":f,"react/jsx-runtime":e,"@tanstack/react-query":{useQuery:Le,useQueryClient:At},"react-router-dom":{useSearchParams:Ui},"../../lib/api":{get:le,qs:ze,command:$e}}';
  return 'const UCellOrderWorkbench=((hostModules)=>{const module={exports:{}};const require=name=>hostModules[name];'+compiled+';return module.exports})('+host+');';
}
function patchOrders(main) {
  const ast=ts.createSourceFile('admin.js',main,ts.ScriptTarget.ES2022,true,ts.ScriptKind.JS);
  function named(name,hash) {
    const fn=ast.statements.find(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
    assert(fn,'Missing production function '+name);
    const text=fn.getText(ast);
    assert.equal(createHash('sha256').update(text).digest('hex'),hash,'Production order function changed: '+name);
    return fn;
  }
  const order=named('eN','ca587d6c939596716f56bf6f4965daa89b59c00d6a1de4d2b66f449d76651c6d');
  const maintain=named('Y8','0134022e6fb28bae1eb131234b0ca1daf49d8a9f7041d979eafbe94c6afddf64');
  // Reuse the running detail, including consolidated payments, exchanges, refunds, delivery, and audit.
  let detail;
  function select(node) {
    if(ts.isCallExpression(node) && node.getText(ast).startsWith('e.jsxs(ae,{title:"訂單作業",'))detail=node.getText(ast);
    else ts.forEachChild(node,select);
  }
  select(order); assert(detail);
  const tabs='e.jsx("div",{className:"order-sections"';
  assert(detail.includes(tabs));
  detail=detail.replace(tabs,'e.jsx(UCellOrderWorkbench.OrderNextAction,{order:F,role:r?.role,onOpen:B,disabled:_}),'+tabs)
    .replace('onClick:()=>B(ge),children:ge','onClick:()=>B(ge),children:({"商品":"商品明細","管理":"修改與作廢"}[ge]??ge)')
    .replace('正在載入所選訂單，若載入失敗請依上方提示重試。','正在載入所選訂單…');
  const replacement = moduleSource() + `function eN(){
    var Pe,Ve,Je,re,he,Ue,je,Ee,qe,Ke;
    const {user:r}=Et(),t=["SUPER_ADMIN","FINANCE"].includes(r?.role),c=At(),[u]=Ui(),route=UCellOrderWorkbench.useOrderRoute(),y=route.id;
    const [n,i]=f.useState(""),[o,l]=f.useState(""),[N,T]=f.useState(null),[_,U]=f.useState(false),[k,B]=f.useState(u.has("feeRefund")?"管理":"商品");
    const V=Le({queryKey:["order",y],queryFn:({signal})=>le("/admin/orders/"+y,{signal}),enabled:!!y}),F=V.error?null:V.data?.data,W=F;
    f.useEffect(()=>{B(u.has("feeRefund")?"管理":"商品");i("");l("");T(null)},[y,u.has("feeRefund")]);
    f.useEffect(()=>{if(!F||!u.has("feeRefund"))return;const timer=setTimeout(()=>{const el=document.getElementById("qualification-fee-refund");el?.scrollIntoView({block:"center"});el?.focus({preventScroll:true})},250);return()=>clearTimeout(timer)},[F?.orderId,u]);
    return e.jsx(UCellOrderWorkbench.OrdersWorkbench,{route,role:r?.role,busy:_,displayNo:qt,displayOwner:$1,displayState:We,children:e.jsxs(e.Fragment,{children:[e.jsx(De,{error:N}),V.isError?e.jsxs("p",{role:"alert",children:["無法讀取這筆訂單。",e.jsx("button",{onClick:()=>V.refetch(),children:"重試"})]}):`+detail+']})})}';
  let maintenance=maintain.getText(ast).replace('[c,u]=f.useState(!1)','[c,u]=f.useState(!0)')
    .replaceAll('刪除未付款訂單','作廢未付款訂單').replaceAll('刪除已退回訂單','封存已退回訂單')
    .replace('children:"修改／刪除訂單"','children:c?"收合維護選項":"展開維護選項"')
    .replace('e.jsx(De,{error:O.error||j})','e.jsx(De,{error:O.error||j}),O.isError&&e.jsx("button",{onClick:()=>O.refetch(),children:"重試載入維護選項"})');
  assert(!maintenance.includes('[c,u]=f.useState(!1)'));
  // Apply by ranges so minified symbols such as $1 remain literal.
  const edits=[[order,replacement],[maintain,maintenance]].sort((a,b)=>b[0].pos-a[0].pos);
  for(const [node,value] of edits)main=main.slice(0,node.getStart(ast))+value+main.slice(node.end);
  const orderLabels=[["刪除／作廢未付款訂單","作廢未付款訂單"],["移至刪除紀錄","移至「已封存或作廢」"],["訂單修改與刪除","訂單修改與作廢"],["修改保留原單並建立更正單；刪除將移至可查詢的紀錄，不會移除帳務證據。已收款的訂單由退貨／退款流程處理。","更正商品會保留原單並建立更正單。作廢與封存後，可在「已封存或作廢」查詢原單。已收款訂單請先辦理退貨或退款。"],["此單已在刪除紀錄中。恢復顯示不會重新啟用舊訂單或資格。","此單已列入「已封存或作廢」。恢復顯示後可從一般清單查詢，原作廢與資格狀態仍會保留。"],["已刪除／作廢紀錄","已封存或作廢"],["修改／刪除歷程","訂單異動歷程"],["已付款未出貨的等價換品可從「商品」操作","已付款未出貨的等價換品可從「商品明細」操作"]];
  for(const [before,after] of orderLabels)main=main.replaceAll(before,after);
  return main;
}
module.exports={patchOrders};
