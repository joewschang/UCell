export const noShippingAction='ORDER_NO_SHIPPING_COMPLETED';
export async function attachNoShippingCompletion(db:any,orders:any[]){
 if(!orders.length)return;
 const events=await db.auditEvent.findMany({where:{action:noShippingAction,entityId:{in:orders.map(o=>o.orderId)}},select:{entityId:true}});
 const ids=new Set(events.map((e:any)=>e.entityId));for(const o of orders)o.noShippingCompletion=o.status==='FULFILLED'&&ids.has(o.orderId);
}
export function zeroGoodsCoupon(pack:any){
 return pack?.packageClass==='QUALIFICATION'&&!!pack.couponCode?.trim()&&pack.selectableProductQuantity===0;
}
export function noShippingBlocks(order:any,pack:any){
 const reasons:string[]=[];
 if(!zeroGoodsCoupon(pack)||pack?.selections?.some((x:any)=>Number(x.quantity)>0))reasons.push('僅適用商品數量為零的優惠碼會員資格訂單。');
 if(!order.paidAt||!['PAID','FULFILLED'].includes(order.status))reasons.push('尚未確認收款，或已進入退貨／取消流程。');
 if(order.payments.some((p:any)=>['REFUND_PENDING','REFUNDED','PARTIALLY_REFUNDED'].includes(p.status))||order.paymentEvents?.some((e:any)=>e.eventType==='QUALIFICATION_FEE_REFUNDED'))reasons.push('訂單已有退款處理紀錄。');
 if(order.lines.some((l:any)=>Number(l.quantity)>0))reasons.push('訂單含有實體商品。');
 if(order.fulfillments.some((f:any)=>f.status!=='CANCELLED'))reasons.push('訂單已有實體配送批次。');
 return reasons;
}
// Call inside the payment transaction, or under the same order lock during backfill.
export async function autoCompleteZeroGoods(tx:any,audit:any,orderId:string,requestId:string,correlationId:string){
 const pack=await tx.packagePurchaseSnapshot.findUnique({where:{orderId},include:{selections:true}});
 if(!zeroGoodsCoupon(pack))return false;
 const order=await tx.order.findUniqueOrThrow({where:{orderId},include:{payments:true,paymentEvents:true,lines:true,fulfillments:true}});
 if(noShippingBlocks(order,pack).length||!order.paymentEvents.some((e:any)=>e.eventType==='PAYMENT_CONFIRMED'))return false;
 const prior=await tx.auditEvent.findFirst({where:{action:noShippingAction,entityId:orderId},select:{entityId:true}});
 if(order.status==='FULFILLED'&&prior)return false;
 await tx.order.update({where:{orderId},data:{status:'FULFILLED'}});
 await audit.write(tx,{actorType:'SYSTEM',action:noShippingAction,entityType:'ORDER',entityId:orderId,beforeData:{status:order.status},afterData:{status:'FULFILLED',tab:'COMPLETED',noPhysicalShipment:true,couponCode:pack.couponCode,reason:'零商品資格訂單已確認收款'},requestId,correlationId});
 return true;
}
