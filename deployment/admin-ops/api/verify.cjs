// Exercises the production module with an in-memory transaction and no network or database.
const assert = require("node:assert/strict");
const {createRequire} = require("node:module");
const load = createRequire("/app/apps/api/dist/modules/order/order.service.js");
const {Prisma} = load("@ucell/database");
const {Reflector} = load("@nestjs/core");
const {OrderService} = load("./order.service");
const {OrderController} = load("./order.controller");
const {AdminOrderPaymentContextController} = load("./order-payment-context.controller");
const {AdminRoleGuard} = load("../auth/admin-role.guard");
const {validateManualPaymentReview} = load("./manual-payment-review");
const createdAt = new Date(Date.now()-86400_000);
const req = {requestId:"review-fixture",user:{personId:"actor"}};
const standard = {paymentMethod:"BANK_TRANSFER",referenceNo:"proof-001",amount:"80.00",occurredAt:new Date().toISOString()};
function fixture({total=80,snapshot=null,stopAtInsert=false}={}) {
  const events=[], saved=new Map(), state={status:"CONFIRMED"};
  const tx={
    $queryRaw:async()=>[],
    order:{findUnique:async()=>({...state,orderId:"order",netAmount:new Prisma.Decimal(total),createdAt,lines:[]}),update:async({data})=>Object.assign(state,data)},
    packagePurchaseSnapshot:{findUnique:async()=>snapshot},
    paymentEvent:{create:async({data})=>{
      if(stopAtInsert) throw Error("QUALIFIED_FOR_INSERT");
      events.push(data);return {paymentEventId:"event"};
    }}
  };
  const idempotency={execute:async(scope,key,input,work)=>{
    if(saved.has(scope+key))return {value:saved.get(scope+key),replayed:true};
    const value=await work(tx); saved.set(scope+key,value);return {value,replayed:false};
  }};
  const service=new OrderService({},idempotency,{write:async()=>{}},{enqueue:async()=>{}});
  const orders=new OrderController(service);
  const applications=new AdminOrderPaymentContextController({assertApplicationOrder:async()=>{}},service);
  return {service,events, direct:(input,key="one")=>orders.confirmPayment("order",input,key,req),
    formal:(input,key="one")=>applications.applicationPayment({orderId:"order",id:"application"},input,key,req)};
}
function guard(role, controller, method) {
  const req={user:{role,subject:"tester",provider:"ENTRA"},originalUrl:"/api/v1/admin/orders/order/payment-confirmations"};
  return new AdminRoleGuard(new Reflector()).canActivate({
    getType:()=>"http", getHandler:()=>controller.prototype[method], getClass:()=>controller,
    switchToHttp:()=>({getRequest:()=>req})
  });
}
async function main() {
  for(const who of ["FINANCE","ORDER_OPS","SUPER_ADMIN"]){ assert.equal(guard(who,OrderController,"confirmPayment"),true); }
  assert.throws(()=>guard("COMPLIANCE_AUDIT",OrderController,"confirmPayment"));
  assert.equal(guard("COMPLIANCE_AUDIT",OrderController,"get"),true);
  assert.equal(guard("MEMBERSHIP_OPS",AdminOrderPaymentContextController,"applicationPayment"),true);
  assert.throws(()=>guard("COMPLIANCE_AUDIT",AdminOrderPaymentContextController,"applicationPayment"));
  for(const fn of ["direct","formal"]) {
    for(const [patch,code] of [
      [{paymentMethod:"  "},"MANUAL_PAYMENT_METHOD_INVALID"],[{paymentMethod:"COUPON_WAIVER"},"MANUAL_PAYMENT_METHOD_INVALID"],
      [{referenceNo:" \t　"},"MANUAL_PAYMENT_REFERENCE_REQUIRED"],[{occurredAt:new Date(+createdAt-1).toISOString()},"MANUAL_PAYMENT_TIME_INVALID"],
      [{occurredAt:new Date(Date.now()+120000).toISOString()},"MANUAL_PAYMENT_TIME_INVALID"]
    ]){
      const f=fixture();
      await assert.rejects(f[fn]({...standard,...patch}),e=>e.response?.code===code);
      assert.equal(f.events.length,0);
    }
    for(const method of ["CASH","BANK_TRANSFER","LEGACY_BRANCH_RECEIPT"]) {
      const f=fixture(), input={...standard,paymentMethod:method,occurredAt:createdAt.toISOString()};
      assert.equal((await f[fn](input)).data.status,"PAID");
      assert.equal((await f[fn](input)).meta.replayed,true);
      await assert.rejects(f[fn](input,"new-key"),e=>e.response?.code==="ORDER_LOCKED");
      assert.equal(f.events.length,1);assert.equal(f.events[0].paymentMethod,method);
    }
  }
  const waiver={...standard,paymentMethod:"COUPON_WAIVER"};
  assert.doesNotThrow(()=>validateManualPaymentReview(waiver,true,createdAt,new Date()));
  assert.throws(()=>validateManualPaymentReview(standard,true,createdAt,new Date()));
  const zero={...waiver,amount:"0.00"};
  const incomplete=fixture({total:0});
  await assert.rejects(incomplete.direct(zero),e=>e.response?.code==="COUPON_WAIVER_CONFIRMATION_INVALID");
  assert.equal(incomplete.events.length,0);
  const eligible=fixture({total:0,stopAtInsert:true,snapshot:{packageCode:"LEADER",
    discountAmount:new Prisma.Decimal(72600),qualificationFee:new Prisma.Decimal(0),selectableProductQuantity:0}});
  await assert.rejects(eligible.formal(zero),/QUALIFIED_FOR_INSERT/);
  const internal=fixture();
  await internal.service.confirmPayment("order",{...standard,paymentMethod:"STAGE_SIMULATED",occurredAt:new Date(+createdAt-1).toISOString()},"stage-key","test","actor");
  assert.equal(internal.events[0].paymentMethod,"STAGE_SIMULATED");
  console.log("Passed both manual receipt controllers, method-specific authorization, custom channels, date/proof limits, replay and internal path isolation.");
}
main().catch(error=>{console.error(error);process.exitCode=1;});
