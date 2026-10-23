import {orderTab,orderDelivered} from '../src/modules/member/order-hub-state';
import {OrderHubService} from '../src/modules/member/order-hub.service';
const order=(extra:any={})=>({status:'CONFIRMED',paidAt:null,payments:[],fulfillments:[],...extra});
const batch=(status:string,shipments:string[]=[])=>({status,shipments:shipments.map(status=>({status}))});
it('separates payment, shipping, partial delivery, review and completed',()=>{
 expect(orderTab(order())).toBe('PAYMENT');expect(orderTab(order({paidAt:new Date()}))).toBe('SHIPPING');
 expect(orderTab(order({fulfillments:[batch('DELIVERED',['DELIVERED']),batch('READY')]}))).toBe('RECEIVING');
 const delivered=order({fulfillments:[batch('DELIVERED',['DELIVERED']),batch('CANCELLED')]});
 expect(orderDelivered(delivered)).toBe(true);expect(orderTab(delivered)).toBe('REVIEW');expect(orderTab(delivered,true)).toBe('COMPLETED');
 expect(orderDelivered(order({fulfillments:[batch('DELIVERED',['IN_TRANSIT'])]}))).toBe(false);
 expect(orderDelivered(order({status:'FULFILLED'}))).toBe(false);
 expect(orderTab(order({status:'RETURNED',fulfillments:[batch('DELIVERED')]}))).toBe('OTHER');
 expect(orderTab(order({payments:[{status:'REFUND_PENDING'}],fulfillments:[batch('DELIVERED')]}))).toBe('OTHER');
});
it('checks ownership before any review write and rejects undelivered orders',async()=>{
 const tx:any={packagePurchaseSnapshot:{findMany:jest.fn(async()=>[])},order:{findFirst:jest.fn(async()=>null),findUniqueOrThrow:jest.fn(async()=>order())},$queryRaw:jest.fn(async()=>[])};
 const service=new OrderHubService({} as any,{qualifications:async()=>[]} as any,{execute:async(s:any,k:any,i:any,f:any)=>({value:await f(tx)})} as any,{write:jest.fn()} as any);
 await expect(service.review('person','123',{rating:5},'key','request')).rejects.toThrow('找不到');expect(tx.$queryRaw).not.toHaveBeenCalled();
 expect(tx.order.findFirst.mock.calls[0][0].where.AND[0].OR[0]).toEqual({purchaserPersonId:'person'});
 tx.order.findFirst.mockResolvedValue({orderId:'o'});await expect(service.review('person','123',{rating:5},'key','request')).rejects.toThrow('尚未全數送達');expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
});
it('counts the complete history while returning a page; reviews remove pending badge',async()=>{
 const rows=Array.from({length:121},(_,i)=>({...order(),orderId:String(i),orderNo:BigInt(i+1),netAmount:{toString:()=> '4800'},createdAt:new Date(),purpose:'RETAIL',lines:[{productId:'p1',productNameSnapshot:'商品',skuSnapshot:'TIP-999',quantity:1,lineAmount:4800}],fulfillments:i===0?[batch('DELIVERED')]:[]}));
 const tx:any={packagePurchaseSnapshot:{findMany:async()=>[]},order:{findMany:async()=>rows},$queryRaw:async(sql:any)=>String(sql).includes('commerce.product_review')?[{order_id:'0',product_id:'p1',status:'PENDING'}]:[{order_id:'0',rating:5,comment:'良好',created_at:new Date()}]};
 const service=new OrderHubService({$transaction:(f:any)=>f(tx)} as any,{qualifications:async()=>[]} as any,{} as any,{} as any);
 const result=await service.list('person',{tab:'ALL',page:1});expect(result.counts).toMatchObject({ALL:121,PAYMENT:120,REVIEW:0});expect(result.orders).toHaveLength(20);expect(result.pages).toBe(7);
});
