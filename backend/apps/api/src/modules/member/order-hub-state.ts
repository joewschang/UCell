export const ORDER_TABS=['PAYMENT','SHIPPING','RECEIVING','REVIEW','ALL'] as const;
export function orderDelivered(order:any){
 const batches=order.fulfillments.filter((f:any)=>f.status!=='CANCELLED');
 return batches.length>0&&batches.every((f:any)=>{const shipments=f.shipments.filter((s:any)=>s.status!=='CANCELLED');return shipments.length?shipments.every((s:any)=>s.status==='DELIVERED'):f.status==='DELIVERED';});
}
export function orderTab(order:any,reviewed=false){
 if(['VOIDED','RETURNED','PARTIAL_RETURN'].includes(order.status)||order.payments.some((p:any)=>['REFUND_PENDING','REFUNDED','PARTIALLY_REFUNDED'].includes(p.status)))return 'OTHER';
 if(orderDelivered(order))return reviewed?'COMPLETED':'REVIEW';
 if(order.fulfillments.some((f:any)=>['SHIPPED','DELIVERED','EXCEPTION'].includes(f.status)||f.shipments.some((s:any)=>['PICKED_UP','IN_TRANSIT','DELIVERED','DELIVERY_FAILED','RETURNING','RETURNED'].includes(s.status))))return 'RECEIVING';
 return order.paidAt||['PAID','FULFILLED'].includes(order.status)||order.payments.some((p:any)=>p.status==='CAPTURED')?'SHIPPING':'PAYMENT';
}
