import {OrderService} from '../src/modules/order/order.service';

describe('Paper qualification package order',()=>{
 it('resolves the business paper application number before invoking the protected command',async()=>{
  const service:any=new OrderService({paperApplication:{findUnique:jest.fn().mockResolvedValue({paperApplicationId:'paper-id'})}} as any,{} as any,{} as any,{} as any);
  service.createPaperQualification=jest.fn().mockResolvedValue({value:{orderId:'order'}});
  await service.createPaperQualificationByNo({packageVersionId:'version',selections:[{productRuleProfileId:'profile',quantity:1}]},'key','request','operator','PA-1');
  expect(service.createPaperQualification).toHaveBeenCalledWith(expect.anything(),'key','request','operator','paper-id');
 });
 it('uses the package path and binds one OPEN paper application without activating a qualification',async()=>{
  const tx:any={
   person:{findUnique:jest.fn().mockResolvedValue({status:'DRAFT'})},
   paperApplication:{findUnique:jest.fn().mockResolvedValue({personId:'person',orderId:null,status:'OPEN'}),update:jest.fn()},
   qualification:{create:jest.fn().mockResolvedValue({qualificationId:'qualification'}),findUnique:jest.fn()},
   qualificationHolderHistory:{create:jest.fn()},qualificationStatusHistory:{create:jest.fn()},
   order:{create:jest.fn().mockImplementation(async({data}:any)=>({orderId:'order',qualificationId:data.qualificationId,lines:[]}))},
   packagePurchaseSnapshot:{create:jest.fn().mockResolvedValue({packagePurchaseSnapshotId:'snapshot'})},
  };
  const idempotency={execute:jest.fn(async(_scope:string,_key:string,_body:any,work:any)=>({value:await work(tx),replayed:false}))};
  const packages:any={checkoutData:jest.fn().mockResolvedValue({version:{profile:{packageClass:'QUALIFICATION',stableCode:'STARTER'},currency:'TWD',priceAmount:{toString:()=> '14400'},displayName:'Starter',selectableProductQuantity:1,membershipEffect:'FORMAL_ELIGIBILITY',qualificationEffect:'CREATE_QUALIFICATION',activeDurationUnit:null,activeDurationValue:null,recognitionConfigRef:'R1.0B',configHash:'a'.repeat(64),packageProfileVersionId:'version'},selections:[{productRuleProfileId:'profile',quantity:1,profile:{productRuleProfileId:'profile'},product:{productId:'product',sku:'SKU',displayName:'Product'},productConfigHash:'b'.repeat(64)}]})};
  const service=new OrderService({paperApplication:{findUnique:jest.fn().mockResolvedValue({personId:'person'})}} as any,idempotency as any,{write:jest.fn()} as any,{enqueue:jest.fn()} as any,packages);
  const result:any=await service.createPaperQualification({packageVersionId:'version',selections:[{productRuleProfileId:'profile',quantity:1}]},'key','request','operator','paper');
  expect(result.value.qualificationId).toBe('qualification');
  expect(tx.qualification.create).toHaveBeenCalledWith({data:expect.objectContaining({status:'DRAFT',activeFlag:false})});
  expect(tx.paperApplication.update).toHaveBeenCalledWith({where:{paperApplicationId:'paper'},data:{orderId:'order',status:'ORDER_CREATED'}});
  expect(idempotency.execute.mock.calls[0][0]).toBe('admin:paper-package-order:create:paper');
 });
});

