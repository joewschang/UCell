import { UnprocessableEntityException } from '@nestjs/common';
import { OrderService } from '../src/modules/order/order.service';

describe('WEB_MEMBER retail delivery boundary',()=>{
 it('rejects a zero-Ball retail order until the authenticated Person has a current delivery profile',async()=>{
  const tx:any={person:{findUnique:jest.fn().mockResolvedValue({status:'EFFECTIVE'})},qualification:{count:jest.fn().mockResolvedValue(0)},deliveryProfile:{findFirst:jest.fn().mockResolvedValue(null)}};
  const idempotency:any={execute:jest.fn(async (_scope:string,_key:string,_body:unknown,work:any)=>({value:await work(tx),replayed:false}))};
  const service=new OrderService({} as any,idempotency,{write:jest.fn()} as any,{enqueue:jest.fn()} as any);
  await expect(service.createMember({items:[{productId:'11111111-1111-1111-1111-111111111111',quantity:'1'}]},'delivery-key-1','request-1','22222222-2222-2222-2222-222222222222')).rejects.toMatchObject({response:expect.objectContaining({code:'DELIVERY_PROFILE_REQUIRED'})});
  expect(tx.deliveryProfile.findFirst).toHaveBeenCalledWith(expect.objectContaining({where:{personId:'22222222-2222-2222-2222-222222222222',effectiveTo:null}}));
 });
});
