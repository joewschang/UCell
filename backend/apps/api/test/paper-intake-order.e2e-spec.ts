import {OrderService} from '../src/modules/order/order.service';
import {Prisma} from '@ucell/database';

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
 it('revalidates the selected sponsor and creates PLACEMENT_PENDING after paper package payment without activating the Ball',async()=>{
  const occurredAt='2026-09-26T08:00:00.000Z';
  const tx:any={
   order:{findUnique:jest.fn().mockResolvedValue({orderId:'order',status:'CONFIRMED',qualificationId:'qualification',netAmount:new Prisma.Decimal('14400'),lines:[]}),update:jest.fn()},
   paymentEvent:{create:jest.fn().mockResolvedValue({paymentEventId:'payment'})},
   packagePurchaseSnapshot:{findUnique:jest.fn().mockResolvedValue({packagePurchaseSnapshotId:'snapshot',personId:'person',packageClass:'QUALIFICATION',packageCode:'STARTER'})},
   qualificationSponsorSelectionEvidence:{findFirst:jest.fn().mockResolvedValue({selectedSponsorQualificationId:'sponsor-q'})},
   qualification:{findUnique:jest.fn().mockResolvedValue({ballNo:'A000001'}),update:jest.fn()},
   sponsorRelationship:{create:jest.fn()},
   qualificationSetup:{create:jest.fn()},
  };
  const idempotency={execute:jest.fn(async(_scope:string,_key:string,_body:any,work:any)=>({value:await work(tx),replayed:false}))};
  const outbox={enqueue:jest.fn()},audit={write:jest.fn()};
  const sponsors={resolveWithin:jest.fn().mockResolvedValue({sponsorQualificationId:'sponsor-q'})};
  const organization={allocateSponsorSequence:jest.fn().mockResolvedValue(7)};
  const service=new OrderService({} as any,idempotency as any,audit as any,outbox as any,undefined,sponsors as any,organization as any);
  const result:any=await service.confirmPayment('order',{amount:'14400',paymentMethod:'BANK_TRANSFER',referenceNo:'PAPER-RECEIPT-1',occurredAt},'payment-key','request','operator');
  expect(result.value.downstreamStatus).toBe('PLACEMENT_PENDING');
  expect(sponsors.resolveWithin).toHaveBeenCalledWith(tx,expect.objectContaining({code:'A000001',effectiveAt:new Date(occurredAt),ruleVersion:'R1.0B'}));
  expect(tx.qualificationSetup.create).toHaveBeenCalledWith({data:expect.objectContaining({qualificationId:'qualification',ownerPersonId:'person',qualifyingOrderId:'order',packagePurchaseSnapshotId:'snapshot',setupStatus:'PLACEMENT_PENDING',finalSponsorQualificationId:'sponsor-q',placementRequestedAt:new Date(occurredAt),placementDueAt:new Date('2026-09-29T08:00:00.000Z'),setupPolicyVersion:'NR-DEC-004-V1'})});
  expect(tx.qualification.update).not.toHaveBeenCalled();
  expect(outbox.enqueue).toHaveBeenCalledWith(tx,expect.objectContaining({eventType:'PACKAGE_PAYMENT_CONFIRMED',payload:expect.objectContaining({qualificationId:'qualification',downstreamStatus:'PLACEMENT_PENDING'})}));
 });
});

