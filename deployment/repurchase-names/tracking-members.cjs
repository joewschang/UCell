'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const {createRequire} = require('node:module');
const {createHash} = require('node:crypto');

function once(text,before,after){
  assert.equal(text.split(before).length,2,'Unexpected deployed tracking component: '+before.slice(0,76));
  return text.replace(before,()=>after);
}

function patchAdmin(main){
  const body='className:"tracking-order-body",children:[e.jsxs("div",{children:[P.items.map';
  const name='e.jsxs("p",{className:"tracking-member-name",style:{overflowWrap:"anywhere"},children:[e.jsx("small",{children:"會員名稱"})," ",e.jsx("strong",{children:P.memberName||"未提供"})]})';
  main=once(main,body,body.replace('P.items.map',name+',P.items.map'));
  main=once(main,'下載 Excel 填寫範本','下載試算表填寫範本');
  main=once(main,'選擇 UTF-8 CSV（最多 500 筆、256 KiB）','選擇配送資料檔（最多 500 筆、262,144 位元組）');
  return once(main,'placeholder:"訂單編號、貨運單號、商品"','placeholder:"訂單編號、會員名稱、貨運單號或商品"');
}

function patchApi(service){
  const original = createHash('sha256').update(service).digest('hex');
  assert.equal(original,'cfbd90d567441d190d94bcb69a63b2116976dc6d469140e648e9165361ff2a93','Tracking service has changed');
  service=once(service,'const rows = mapped.filter','if (search) await require("./tracking-member-names").attachTrackingMemberNames(tx,mapped);\n            const rows = mapped.filter');
  service=once(service,'[o.displayOrderNo,o.orderNo,','[o.memberName, o.displayOrderNo, o.orderNo,');
  service=once(service,'return { counts, orders: rows.slice((page - 1) * 20, page * 20), page, pages,','const pageOrders=rows.slice((page - 1) * 20, page * 20);\n            if (!search) await require("./tracking-member-names").attachTrackingMemberNames(tx,pageOrders);\n            return { counts, orders: pageOrders, page, pages,');
  return service;
}

function buildTrackingHelper(){
  const project=createRequire(path.resolve(__dirname,'../../admin/package.json'));
  const ts=project('typescript');
  const source=fs.readFileSync(path.resolve(__dirname,'../../backend/apps/api/src/modules/order/tracking-member-names.ts'),'utf8');
  return ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
}
module.exports={patchAdmin,patchApi,buildTrackingHelper};
