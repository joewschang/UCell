import {randomUUID} from 'node:crypto';
import {writeFileSync} from 'node:fs';

// Called only by the fresh isolated Golden harness. No provider bypass, token or
// monetary allocation is exposed through a production configuration flag.
export async function runMemberAdminIntegration({server,db,memberToken,adminToken,financeToken,personId,qualificationIds,equal}) {
  const startCount = await db.pvLedger.count(), awardCount = await db.bonusAward.count();
  const results = [];
  const check = (actual, expected, label) => {equal(actual, expected, 'Member/Admin integration: '+label);results.push({label,result:'PASS'});};
  const request = (method,path,token,body,key=randomUUID()) => server.inject({
    method,url:'/api/v1/'+path,
    headers:{authorization:'Bearer '+token,'x-request-id':randomUUID(),...(['POST','PATCH'].includes(method)?{'idempotency-key':key}:{})},
    ...(body?{payload:body}:{}),
  });
  const read = async (path,token) => {const r=await request('GET',path,token);check(r.statusCode,200,'GET '+path.split('?')[0]);return r.json();};
  const sku='CROSS_END_TEST_ONLY_'+randomUUID(), productBody={sku,displayName:'CROSS END TEST ONLY',price:'399.99',gpvRate:'0.60',ruleVersionCode:'R1.0B'};
  check((await request('POST','admin/products',financeToken,productBody)).statusCode,403,'Finance cannot configure catalog');
  const productResponse=await request('POST','admin/products',adminToken,productBody);
  check(productResponse.statusCode,201,'Admin configures actual Core product');
  const productId=productResponse.json().data.productId;
  const originalProfile=await db.productRuleProfile.findFirst({where:{productId}});
  const adminCatalogBefore=await read('admin/products',adminToken),memberCatalogBefore=await read('member/products',memberToken);
  check(adminCatalogBefore.data.find(p=>p.productId===productId).currentPrice,'399.99','Admin catalog uses Core Decimal');
  check(memberCatalogBefore.data.find(p=>p.id===productId).price,399.99,'Member catalog sees Admin price');
  check(memberCatalogBefore.data.find(p=>p.id===productId).available,true,'Member orderability follows configured profile');
  check(memberCatalogBefore.data.find(p=>p.id===productId).pv,null,'catalog does not imply approved PV mapping');
  const memberBalls=await read('member/qualifications',memberToken),adminBalls=await read(`admin/persons/${personId}/qualifications`,adminToken);
  check(memberBalls.data.map(q=>q.id).sort(),adminBalls.data.map(q=>q.qualificationId).sort(),'both endpoints identify the same owned balls');
  const adminPerson=await read(`admin/persons/${personId}`,adminToken),memberPerson=await read('member/me',memberToken);
  check(memberPerson.data.name,adminPerson.data.preferredName??adminPerson.data.legalName,'Person display name is shared across ends');
  check((await request('GET','admin/orders',memberToken)).statusCode,401,'Member bearer cannot enter Admin');
  check((await request('GET','member/me',adminToken)).statusCode,401,'Admin bearer cannot enter Member');
  const body={qualificationId:qualificationIds[0],items:[{productId,quantity:'2'}]},key='CROSS_END_CHECKOUT_'+randomUUID();
  const checkout=await request('POST','member/orders',memberToken,body,key);
  check(checkout.statusCode,201,'Member creates shared Core order');
  const orderCreate=checkout.json(),orderId=orderCreate.data.id;
  check([orderCreate.data.total,orderCreate.data.status,orderCreate.data.paymentStatus],['799.98','CONFIRMED','PENDING'],'Core checkout is priced and unpaid');
  const adminOrderBefore=await read(`admin/orders/${orderId}`,adminToken),memberOrderBefore=await read(`member/orders/${orderId}?qualificationId=${qualificationIds[0]}`,memberToken);
  check([adminOrderBefore.data.orderId,adminOrderBefore.data.qualificationId,adminOrderBefore.data.netAmount],[orderId,qualificationIds[0],'799.98'],'Admin sees exact Member order and ball');
  check([memberOrderBefore.data.id,memberOrderBefore.data.total,memberOrderBefore.data.status],[orderId,'799.98','CONFIRMED'],'Member detail reads same Core record');
  const memberOrdersBefore=await read(`member/orders?qualificationId=${qualificationIds[0]}`,memberToken);
  check((await request('GET',`member/orders/${orderId}?qualificationId=${qualificationIds[1]}`,memberToken)).statusCode,404,'other owned ball cannot read detail');
  check((await request('GET',`member/orders/${orderId}?qualificationId=${qualificationIds[2]}`,memberToken)).statusCode,403,'foreign ball cannot read detail');
  const filtered=await read(`admin/orders?qualificationId=${qualificationIds[0]}`,adminToken);
  check(filtered.data.some(o=>o.orderId===orderId),true,'Admin ball filter finds Member checkout');
  check(filtered.data.every(o=>o.qualificationId===qualificationIds[0]),true,'Admin filter leaks no other ball');
  const update={...productBody,price:'499.99'};
  check((await request('POST','admin/products',adminToken,update)).statusCode,201,'Admin prospectively updates reference price');
  const memberCatalogAfter=await read('member/products',memberToken),adminCatalogAfter=await read('admin/products',adminToken);
  check(memberCatalogAfter.data.find(p=>p.id===productId).price,499.99,'Member reload sees updated catalog');
  const checkoutReplay=(await request('POST','member/orders',memberToken,body,key)).json();
  check([checkoutReplay.data.id,checkoutReplay.data.total,checkoutReplay.data.replayed],[orderId,'799.98',true],'lost-response retry preserves original order/price');
  check((await request('POST','member/orders',memberToken,{...body,items:[{productId,quantity:'1'}]},key)).statusCode,409,'changed cart cannot reuse the original key');
  const newCheckoutResponse=await request('POST','member/orders',memberToken,body);
  check(newCheckoutResponse.statusCode,201,'new attempt creates order at current price');
  const newCheckout=newCheckoutResponse.json();check(newCheckout.data.total,'999.98','new order uses updated Core price');
  check(newCheckout.data.id!==orderId,true,'new attempt has distinct order identity');
  check((await request('POST','admin/products',adminToken,{...update,price:'999.99',gpvRate:'0.90'})).statusCode,409,'unapproved rate change rejected');
  check((await db.productReference.findUnique({where:{productId}})).currentPrice.toString(),'499.99','rejected rate change also rolls back price');
  check(JSON.stringify(await db.productRuleProfile.findFirst({where:{productId}})),JSON.stringify(originalProfile),'original profile remains immutable');
  const paymentPath=`admin/orders/${orderId}/payment-confirmations`,payment={amount:adminOrderBefore.data.netAmount,paymentMethod:'BANK_TRANSFER',referenceNo:'CROSS_END_TEST_ONLY',occurredAt:new Date().toISOString()},paymentKey='CROSS_END_PAYMENT_'+randomUUID();
  check((await request('POST',paymentPath,adminToken,{...payment,amount:'0.01'})).statusCode,422,'underpayment rejected');
  check(await db.paymentEvent.count({where:{orderId}}),0,'rejected payment leaves no payment fact');
  const paymentResponse=await request('POST',paymentPath,adminToken,payment,paymentKey);
  check(paymentResponse.statusCode,201,'Admin confirms Core full amount');
  const paymentConfirmed=paymentResponse.json();
  check((await request('POST',paymentPath,adminToken,payment,paymentKey)).statusCode,201,'same payment key replays');
  check((await request('POST',paymentPath,adminToken,payment)).statusCode,409,'second payment command is locked');
  check(await db.paymentEvent.count({where:{orderId}}),1,'one committed payment fact');
  check(await db.outboxEvent.count({where:{aggregateId:orderId,eventType:'SALE_CONFIRMED'}}),1,'one transactional SALE_CONFIRMED event');
  const adminOrderAfter=await read(`admin/orders/${orderId}`,adminToken),memberOrderAfter=await read(`member/orders/${orderId}?qualificationId=${qualificationIds[0]}`,memberToken);
  const memberOrdersAfter=await read(`member/orders?qualificationId=${qualificationIds[0]}`,memberToken);
  check([adminOrderAfter.data.status,memberOrderAfter.data.status],['PAID','PAID'],'both detail endpoints reload PAID');
  const listOrder=memberOrdersAfter.data.orders.find(o=>o.id===orderId);
  check([listOrder.status,listOrder.paymentStatus,listOrder.shipmentStatus],['PAID','PAID','FULFILLMENT_PENDING'],'Member list reflects payment without claiming shipment');
  check(memberOrdersAfter.data.orders.every(o=>o.id!==undefined),true,'Member list identities present');
  const otherBallOrders=await read(`member/orders?qualificationId=${qualificationIds[1]}`,memberToken);
  check(otherBallOrders.data.orders.some(o=>[orderId,newCheckout.data.id].includes(o.id)),false,'new orders stay out of second owned ball');
  check((await read(`admin/orders/${orderId}`,adminToken)).data.netAmount,'799.98','paid historical total survives catalog update');
  check(await db.pvLedger.count(),startCount,'payment queues event but does not invent PV recognition');
  check(await db.bonusAward.count(),awardCount,'integration commands grant no bonus');
  if(process.env.MEMBER_CONTRACT_OUTPUT_DIR){
    const bundle={kind:'CONNECTED_DEV_TEST_ONLY',operationalCredentialsVerified:false,productId,qualificationId:qualificationIds[0],orderCreate,adminOrderBefore,memberOrderBefore,adminOrderAfter,memberOrderAfter,checkoutReplay,newCheckout,paymentConfirmed,
      memberOrdersBefore:{...memberOrdersBefore,data:{...memberOrdersBefore.data,orders:memberOrdersBefore.data.orders.filter(o=>o.id===orderId)}},
      adminCatalogBefore:{...adminCatalogBefore,data:adminCatalogBefore.data.filter(p=>p.productId===productId)},memberCatalogBefore:{...memberCatalogBefore,data:memberCatalogBefore.data.filter(p=>p.id===productId)},
      adminCatalogAfter:{...adminCatalogAfter,data:adminCatalogAfter.data.filter(p=>p.productId===productId)},memberCatalogAfter:{...memberCatalogAfter,data:memberCatalogAfter.data.filter(p=>p.id===productId)},
      memberOrdersAfter:{...memberOrdersAfter,data:{...memberOrdersAfter.data,orders:memberOrdersAfter.data.orders.filter(o=>[orderId,newCheckout.data.id].includes(o.id))}}};
    writeFileSync(process.env.MEMBER_CONTRACT_OUTPUT_DIR+'/member-admin-contract.json',JSON.stringify(bundle,null,2)+'\n');
    writeFileSync(process.env.MEMBER_CONTRACT_OUTPUT_DIR+'/member-admin-journey.json',JSON.stringify({kind:'CONNECTED_DEV_TEST_ONLY',operationalCredentialsVerified:false,result:'PASS',assertions:results.length,results},null,2)+'\n');
  }
  console.log(`MEMBER_ADMIN_INTEGRATION_PASS: ${results.length} actual HTTP/DB assertions; catalog, two balls, checkout, Admin payment, Member reload and credential isolation; provider credentials NOT VERIFIED`);
}
