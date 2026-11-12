/** Public SL order number for display; numeric orderNo remains an internal API reference. */
export function orderNumber(order:{displayOrderNo?:string|null;orderNo?:string|number|bigint|null}){return [order.displayOrderNo,String(order.orderNo??'')].find((value):value is string=>typeof value==='string'&&/^SL[0-9]{11,}$/.test(value))??'訂單編號待同步';}
