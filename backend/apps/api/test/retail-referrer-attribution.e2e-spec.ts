import { ConflictException } from '@nestjs/common';
import { RetailReferrerAttributionService } from '../src/modules/order/retail-referrer-attribution.service';

describe('R1.0B retail referrer attribution boundary',()=>{
 const at=new Date('2026-09-25T00:00:00.000Z');
 const sponsor:any={
  resolve:jest.fn().mockResolvedValue({sponsorQualificationId:'q-ref',sponsorBallNo:'A000004',planLevelCode:'LEADER',effectiveAt:at,ruleVersion:'R1.0B'}),
  resolveWithin:jest.fn().mockResolvedValue({sponsorQualificationId:'q-ref',sponsorBallNo:'A000004',sponsorOwnerPersonId:'person-ref',ruleVersion:'R1.0B'}),
 };
 it('validates a candidate without exposing the holder or binding attribution',async()=>{
  const service=new RetailReferrerAttributionService({} as any,sponsor);
  await expect(service.candidate('A000004',at)).resolves.toEqual({ballNo:'A000004',planLevelCode:'LEADER',effectiveAt:at,ruleVersion:'R1.0B'});
 });
 it('creates attribution only at the first attributed order and records append-only evidence',async()=>{
  const create=jest.fn().mockResolvedValue({retailReferrerAttributionId:'attr-1',referrerQualificationId:'q-ref',referrerBallNoSnapshot:'A000004',source:'RETAIL_CHECKOUT_CANDIDATE_REVALIDATED'});
  const eventCreate=jest.fn().mockResolvedValue({});
  const tx:any={retailReferrerAttribution:{findFirst:jest.fn().mockResolvedValue(null),create},retailReferrerAttributionEvent:{create:eventCreate}};
  const service=new RetailReferrerAttributionService({} as any,sponsor);
  await expect(service.resolveForRetailOrder(tx,{personId:'buyer',candidateCode:'A000004',orderId:'order-1',at,correlationId:'00000000-0000-0000-0000-000000000001'})).resolves.toMatchObject({retailReferrerAttributionId:'attr-1'});
  expect(create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({personId:'buyer',createdByOrderId:'order-1',referrerBallNoSnapshot:'A000004'})}));
  expect(eventCreate).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({action:'CREATED_AT_FIRST_ATTRIBUTED_ORDER'})}));
 });
 it('rejects a replacement candidate after attribution is locked',async()=>{
  sponsor.resolveWithin.mockResolvedValueOnce({sponsorQualificationId:'q-other',sponsorBallNo:'A000005',sponsorOwnerPersonId:'other',ruleVersion:'R1.0B'});
  const tx:any={retailReferrerAttribution:{findFirst:jest.fn().mockResolvedValue({retailReferrerAttributionId:'attr-1',referrerQualificationId:'q-ref',referrerBallNoSnapshot:'A000004'})}};
  const service=new RetailReferrerAttributionService({} as any,sponsor);
  await expect(service.resolveForRetailOrder(tx,{personId:'buyer',candidateCode:'A000005',orderId:'order-2',at,correlationId:'00000000-0000-0000-0000-000000000002'})).rejects.toBeInstanceOf(ConflictException);
 });
 it('makes an admin correction forward-only and preserves the historical attribution evidence',async()=>{
  const effectiveFrom=new Date('2040-01-01T00:00:00.000Z'),current:any={retailReferrerAttributionId:'old',referrerQualificationId:'q-ref',referrerBallNoSnapshot:'A000004'};
  sponsor.resolveWithin.mockResolvedValueOnce({sponsorQualificationId:'q-next',sponsorBallNo:'A000005',ruleVersion:'R1.0B'});
  const tx:any={retailReferrerAttribution:{findFirst:jest.fn().mockResolvedValue(current),update:jest.fn(),create:jest.fn().mockResolvedValue({retailReferrerAttributionId:'new',referrerBallNoSnapshot:'A000005',effectiveFrom})},retailReferrerAttributionEvent:{createMany:jest.fn()}};
  const idempotency:any={execute:jest.fn(async(_scope:string,_key:string,_body:any,work:any)=>({value:await work(tx),replayed:false}))},audit:any={write:jest.fn()},outbox:any={enqueue:jest.fn()};
  const service=new RetailReferrerAttributionService({} as any,sponsor,idempotency,audit,outbox);
  await expect(service.correct({personId:'buyer',ballNo:'A000005',reason:'VERIFIED_CORRECTION',effectiveFrom,actorPersonId:'operator',key:'key',requestId:'request'})).resolves.toMatchObject({value:{ballNo:'A000005'}});
  expect(tx.retailReferrerAttribution.update).toHaveBeenCalledWith({where:{retailReferrerAttributionId:'old'},data:{effectiveTo:effectiveFrom}});
  expect(tx.retailReferrerAttribution.create).toHaveBeenCalledWith({data:expect.objectContaining({source:'ADMIN_FORWARD_CORRECTION',effectiveFrom,correctionReason:'VERIFIED_CORRECTION'})});
  expect(tx.retailReferrerAttributionEvent.createMany).toHaveBeenCalledWith({data:expect.arrayContaining([expect.objectContaining({action:'CLOSED_BY_ADMIN_FORWARD_CORRECTION'}),expect.objectContaining({action:'CREATED_BY_ADMIN_FORWARD_CORRECTION'})])});
 });
});
