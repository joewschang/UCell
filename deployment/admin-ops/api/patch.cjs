const fs = require("node:fs");
const path = require("node:path");
const {createRequire} = require("node:module");
const order = "/app/apps/api/dist/modules/order";
const load = createRequire(path.join(order, "order.service.js"));
const ts = load("typescript");
function replace(text, from, to) {
  if (text.split(from).length !== 2) throw Error("Expected one production anchor: " + from);
  return text.replace(from, () => to);
}
const update = (name, transform) => {
  const file = path.join(order,name);
  fs.writeFileSync(file,transform(fs.readFileSync(file,"utf8")));
};
const helper = fs.readFileSync(path.join(__dirname,"manual-payment-review.ts"),"utf8");
fs.writeFileSync(path.join(order,"manual-payment-review.js"), ts.transpileModule(helper,{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}
}).outputText);
update("order.service.js",source => {
  let result=replace(source,'async confirmPayment(orderId, dto, key, requestId, actorId) {','async confirmPayment(orderId, dto, key, requestId, actorId, reviewMode) {');
  return replace(result,'const occurredAt = new Date(dto.occurredAt);',
    'const occurredAt = new Date(dto.occurredAt);\n            if (reviewMode === "MANUAL_ADMIN") require("./manual-payment-review").validateManualPaymentReview(dto, amount.eq(0), order.createdAt, occurredAt);');
});
update("order.controller.js",source => {
  let result=replace(source,'this.service.confirmPayment(orderId, dto, key, req.requestId, req.user?.personId)', 'this.service.confirmPayment(orderId, dto, key, req.requestId, req.user?.personId, "MANUAL_ADMIN")');
  return replace(result,"(0, common_1.Post)(':orderId/payment-confirmations'),", "(0, common_1.Post)(':orderId/payment-confirmations'),\n    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'ORDER_OPS', 'FINANCE'),");
});
update("order-payment-context.controller.js", source=>replace(source,
  'this.orders.confirmPayment(p.orderId, b, key, req.requestId, req.user?.personId)',
  'this.orders.confirmPayment(p.orderId, b, key, req.requestId, req.user?.personId, "MANUAL_ADMIN")'));
