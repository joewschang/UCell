import {processBonusOpportunity} from '../../worker/src/bonus-opportunity-notification';

function harness(){
 const lease={outboxEventId:'event',attemptCount:1,availableAt:new Date(Date.now()+120000)};
 const event:any={...lease,eventType:'BONUS_OPPORTUNITY_CREATED',aggregateId:'opportunity',processStatus:'PROCESSING'};
 const delivery:any={notificationDeliveryId:'delivery',status:'PENDING',attemptCount:0,expiresAt:null};
 const db:any={
  $queryRaw:jest.fn(async()=>[]),
  outboxEvent:{findUnique:async()=>event,findUniqueOrThrow:async()=>event,update:jest.fn(async({data}:any)=>Object.assign(event,data))},
  bonusOpportunity:{findUniqueOrThrow:async()=>({bonusOpportunityId:'opportunity',outboxEventId:'event',personId:'person',opportunityKey:'key',message:'immutable message'})},
  notificationDelivery:{findUniqueOrThrow:async()=>delivery,update:jest.fn(async({data}:any)=>{const count=delivery.attemptCount;Object.assign(delivery,data);if(data.attemptCount?.increment)delivery.attemptCount=count+data.attemptCount.increment;return delivery;})},
  identityLink:{findMany:jest.fn(async()=>[{identityLinkId:'binding',providerSubject:'Ubound'}])}
 };
 db.$transaction=async(work:any)=>work(db);
 const sender={configured:true,send:jest.fn(async(_:any)=>({kind:'SENT' as const,providerCorrelation:'accepted'}))};
 return {db,lease,event,delivery,sender};
}
describe('bonus opportunity durable delivery',()=>{
 it('sends only the historical person binding and acknowledges acceptance',async()=>{
  const x=harness();await processBonusOpportunity(x.db,x.lease,x.sender);
  expect(x.sender.send).toHaveBeenCalledWith({recipient:'Ubound',notificationType:'BONUS_OPPORTUNITY',correlationId:'delivery',text:'immutable message'});
  expect(x.delivery.status).toBe('SENT');expect(x.event.processStatus).toBe('PROCESSED');
  await processBonusOpportunity(x.db,x.lease,x.sender);expect(x.sender.send).toHaveBeenCalledTimes(1);
 });
 it('retains retry identity, immutable text and a bounded retry window',async()=>{
  const x=harness();const sender={configured:true,send:jest.fn(async()=>({kind:'RETRY' as const,code:'LINE_HTTP_429'}))};
  await processBonusOpportunity(x.db,x.lease,sender);
  expect(x.delivery.destinationBindingId).toBe('binding');expect(x.delivery.status).toBe('PENDING');expect(x.event.processStatus).toBe('PENDING');expect(x.event.availableAt.getTime()).toBeGreaterThan(Date.now());expect(x.delivery.expiresAt.getTime()).toBeLessThan(Date.now()+24*3600000);
 });
 it('does not send without configuration or an unambiguous active binding',async()=>{
  const x=harness();x.sender.configured=false;await processBonusOpportunity(x.db,x.lease,x.sender);
  expect(x.delivery.status).toBe('CONFIGURATION_PENDING');expect(x.sender.send).not.toHaveBeenCalled();
  const y=harness();y.db.identityLink.findMany.mockResolvedValue([]);await processBonusOpportunity(y.db,y.lease,y.sender);
  expect(y.delivery.failureCode).toBe('LINE_BINDING_MISSING_OR_AMBIGUOUS');expect(y.sender.send).not.toHaveBeenCalled();
 });
 it('never retargets a retry after the original binding is revoked',async()=>{
  const x=harness();x.delivery.destinationBindingId='old-binding';x.db.identityLink.findMany.mockResolvedValue([]);
  await processBonusOpportunity(x.db,x.lease,x.sender);expect(x.delivery.failureCode).toBe('LINE_BINDING_REVOKED');expect(x.sender.send).not.toHaveBeenCalled();
  expect(x.db.identityLink.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({identityLinkId:'old-binding',personId:'person',status:'ACTIVE'})}));
 });
 it('never retries outside the LINE deduplication window or a lost lease',async()=>{
  const x=harness();x.delivery.expiresAt=new Date(Date.now()-1);await processBonusOpportunity(x.db,x.lease,x.sender);expect(x.delivery.status).toBe('EXPIRED');expect(x.sender.send).not.toHaveBeenCalled();
  const y=harness();y.event.attemptCount=2;await processBonusOpportunity(y.db,y.lease,y.sender);expect(y.sender.send).not.toHaveBeenCalled();
 });
 it('suppresses unsent estimates that a refund invalidated',async()=>{
  const x=harness();x.db.bonusOpportunity.findUniqueOrThrow=async()=>({bonusOpportunityId:'opportunity',outboxEventId:'event',personId:'person',opportunityKey:'key',reviewRequired:true,message:'old'});
  await processBonusOpportunity(x.db,x.lease,x.sender);expect(x.sender.send).not.toHaveBeenCalled();expect(x.delivery.failureCode).toBe('BONUS_OPPORTUNITY_SUPERSEDED');
 });
 it('sends the immutable correction message instead of the withdrawn amount',async()=>{
  const x=harness();x.event.eventType='BONUS_OPPORTUNITY_CORRECTED';x.event.payload={opportunityId:'opportunity',evidenceHash:'correction-key',message:'原機會金額已失效'};
  await processBonusOpportunity(x.db,x.lease,x.sender);expect(x.sender.send).toHaveBeenCalledWith(expect.objectContaining({text:'原機會金額已失效'}));expect(x.delivery.status).toBe('SENT');
 });
});
