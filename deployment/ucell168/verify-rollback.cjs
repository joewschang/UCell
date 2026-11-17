const {PrismaClient,Prisma}=require('/app/packages/database/node_modules/@prisma/client');
const assert=require('node:assert/strict'),uuid=require('crypto').randomUUID;
const req=p=>require('/app/apps/api/dist/'+p),db=new PrismaClient();
const core=req('modules/order/core-coupon.cjs');
const D=n=>new Prisma.Decimal(n);
function line(price,qty,sku){return {skuSnapshot:sku,commercialOfferingSnapshot:{offeringType:'CORE_PRODUCT'},quantity:D(qty),unitPrice:D(price),lineAmount:D(price).mul(qty),gpvRateSnapshot:D('.6')}}
(async()=>{
 for(const [prices,expected] of [[[4800,4800,4800],9600],[[3000,4800,5000],9800],[[10,20,30,40,50,60],180]]){
 const lines=prices.map((p,i)=>line(p,1,String(i)));const v=core.price(lines,D(prices.reduce((a,b)=>a+b,0)));assert.equal(+v.total,expected);assert.equal(lines.reduce((a,b)=>a+Number(b.lineAmount),0),expected)}
 assert.throws(()=>core.price([line(4800,2,'A')],D(9600)));
 const obj=await db.couponDefinition.findUniqueOrThrow({where:{code:'UCELL168'}});
 const fake={couponDefinition:{findUnique:async()=>obj},activePeriod:{findFirst:async()=>null}};
 await assert.rejects(()=>core.eligible(fake,uuid(),new Date(),'UCELL168'));await assert.rejects(()=>core.eligible(fake,uuid(),obj.endsAt,'UCELL168'));
 const rollback=Error('ROLLBACK'),orderIds=[];
 try{await db.$transaction(async tx=>{
 const at=new Date(),active=await tx.activePeriod.findMany({where:{activeFrom:{lte:at},OR:[{activeTo:null},{activeTo:{gt:at}}]},select:{qualificationId:true}});
 const ball=await tx.qualification.findFirstOrThrow({where:{qualificationId:{in:active.map(q=>q.qualificationId)},status:'EFFECTIVE',currentHolderPersonId:{not:null},kind:{not:'COMPANY_BOOTSTRAP'}}});
 const personId=ball.currentHolderPersonId,qid=ball.qualificationId;
 const offers=await tx.commercialOffering.findMany({where:{offeringType:'CORE_PRODUCT',status:'ACTIVE'},include:{versions:{where:{status:'ACTIVE'}}}});
 const selected=offers.find(o=>o.versions.some(v=>v.channels.includes('WEB_MEMBER')&&(v.composition?.length===1||v.selectionRule?.eligibleSkus?.length===1)));
 const v=selected.versions.find(v=>v.channels.includes('WEB_MEMBER')&&(v.composition?.length===1||v.selectionRule?.eligibleSkus?.length===1));
 const product=await tx.productReference.findFirstOrThrow({where:{sku:v.composition?.[0]?.sku??v.selectionRule.eligibleSkus[0],isActive:true}});
 const body={couponCode:'UCELL168',qualificationId:qid,items:[{productId:product.productId,commercialOfferingCode:selected.offeringCode,quantity:'3'}]};
 const inline={execute:async(scope,key,body,fn)=>({value:await fn(tx),replayed:false})};
 const bridge=new Proxy(tx,{get:(target,key)=>key==='$transaction'?async fn=>fn(tx):target[key]});
 const service=new (req('modules/order/order.service').OrderService)(bridge,inline,new (req('common/audit/audit.service').AuditService)(),{enqueue:async()=>{}});
 const quote=await core.quote(service,personId,body);
 assert.equal(quote.total,product.currentPrice.mul(2).toFixed(2));
 await assert.rejects(()=>core.quote(service,uuid(),body));
 const checkout={paymentMethod:'CASH',fulfillmentMethod:'COMPANY_PICKUP',expectedTotal:quote.total};
 await assert.rejects(()=>service.createMember({...body,checkout:{...checkout,expectedTotal:quote.grossAmount}},uuid(),uuid(),personId));
 for(let i=0;i<2;i++){
 const {value:order}=await service.createMember({...body,checkout},uuid(),uuid(),personId);orderIds.push(order.orderId);
 assert(order.netAmount.eq(quote.total));assert(order.grossAmount.eq(quote.grossAmount));assert(order.lines[0].lineAmount.eq(order.netAmount));
 await service.confirmPaymentInTransaction(tx,order.orderId,{amount:quote.total,occurredAt:new Date().toISOString(),paymentMethod:'CASH',referenceNo:'ROLLBACK-TEST'},uuid(),uuid(),null,'MANUAL_ADMIN');
 const marker=await tx.pvLedger.findFirstOrThrow({where:{sourceId:order.orderId,pvType:'EPV',eventType:'EPV_CREATED'}});
 const envelope=await tx.historicalReplaySnapshot.findFirstOrThrow({where:{kind:'EPV',sourceId:marker.eventId}});
 const data=JSON.parse(JSON.stringify(envelope));const key=Object.values(data).find(v=>v&&typeof v==='object'&&v.inputs);
 assert(key&&D(key.inputs.consumption).eq(quote.total),'EPV snapshot must use net consideration');
 assert((await tx.couponRedemption.findUniqueOrThrow({where:{orderId:order.orderId}})).redeemedAt);
 }
 throw rollback;
 },{timeout:60000,isolationLevel:'Serializable'})}catch(e){if(e!==rollback)throw e}
 assert.equal(await db.order.count({where:{orderId:{in:orderIds}}}),0);console.log('VERIFIED_REPORT PASS price, mixed, six boxes, ineligible, expiry, holder, stale total, repeat checkout, payment, EPV and rollback');
})().catch(e=>console.log('REPORT_CHECK_FAILED '+String(e.stack).slice(0,2100).replace(/\n/g,' '))).finally(()=>db.$disconnect());

