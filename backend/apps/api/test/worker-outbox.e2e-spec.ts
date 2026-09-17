import { pollOutbox } from '../../worker/src/main';

const EVENT_ID='10000000-0000-4000-8000-000000000001';
const availableAt=new Date('2026-09-17T00:00:00.000Z');

function event(overrides:Record<string,unknown>={}){
  return {
    outboxEventId:EVENT_ID,eventType:'MEMBER_ORDER_CREATED',processStatus:'PENDING',
    attemptCount:0,availableAt,createdAt:availableAt,...overrides
  } as any;
}

function harness(events:any[]){
  const db={outboxEvent:{findMany:jest.fn().mockResolvedValue(events)}} as any;
  const lease={outboxEventId:EVENT_ID,attemptCount:1,availableAt:new Date('2099-01-01T00:00:00.000Z')};
  const deps={
    claimOutboxLease:jest.fn().mockResolvedValue(lease),
    processSaleConfirmed:jest.fn(),
    processMemberOrderNotification:jest.fn().mockResolvedValue({notificationId:'notice-1'}),
    processPaymentInventoryReservation:jest.fn(),
    processLeasedReplay:jest.fn(),
    releaseFailedOutboxLease:jest.fn()
  };
  return {db,lease,deps};
}

describe('worker outbox poll entry',()=>{
  it('claims and dispatches MEMBER_ORDER_CREATED instead of leaving it permanently pending',async()=>{
    const h=harness([event()]);
    await pollOutbox(h.db,h.deps as any);

    const query=h.db.outboxEvent.findMany.mock.calls[0][0];
    expect(query.where.eventType.in).toContain('MEMBER_ORDER_CREATED');
    expect(h.deps.claimOutboxLease).toHaveBeenCalledWith(h.db,expect.objectContaining({outboxEventId:EVENT_ID}));
    expect(h.deps.processMemberOrderNotification).toHaveBeenCalledWith(h.db,h.lease);
    expect(h.deps.processLeasedReplay).not.toHaveBeenCalled();
  });

  it('dispatches verified payment transitions to the configured inventory bridge',async()=>{
    const h=harness([event({eventType:'PAYMENT_STATE_TRANSITIONED'})]);
    process.env.UCELL_INVENTORY_WAREHOUSE_ID='20000000-0000-4000-8000-000000000001';
    process.env.UCELL_INVENTORY_POLICY_VERSION='TEST_ONLY_V1';
    await pollOutbox(h.db,h.deps as any);
    expect(h.db.outboxEvent.findMany.mock.calls[0][0].where.eventType.in).toContain('PAYMENT_STATE_TRANSITIONED');
    expect(h.deps.processPaymentInventoryReservation).toHaveBeenCalledWith(h.db,h.lease,{
      warehouseId:'20000000-0000-4000-8000-000000000001',policyVersion:'TEST_ONLY_V1'
    });
  });

  it('does not redeliver when a duplicate poll loses the compare-and-swap lease claim',async()=>{
    const h=harness([event()]);
    h.deps.claimOutboxLease.mockResolvedValueOnce(h.lease).mockResolvedValueOnce(null);

    await pollOutbox(h.db,h.deps as any);
    await pollOutbox(h.db,h.deps as any);

    expect(h.deps.claimOutboxLease).toHaveBeenCalledTimes(2);
    expect(h.deps.processMemberOrderNotification).toHaveBeenCalledTimes(1);
  });

  it('releases a failed lease and processes the same source event once after retry claim',async()=>{
    const h=harness([event({processStatus:'PROCESSING',attemptCount:1})]);
    const retryLease={...h.lease,attemptCount:2};
    h.deps.claimOutboxLease.mockResolvedValueOnce(h.lease).mockResolvedValueOnce(retryLease);
    h.deps.processMemberOrderNotification.mockRejectedValueOnce(new Error('TEST_ONLY_ACK_FAILURE')).mockResolvedValueOnce({notificationId:'notice-1'});

    await pollOutbox(h.db,h.deps as any);
    await pollOutbox(h.db,h.deps as any);

    expect(h.deps.releaseFailedOutboxLease).toHaveBeenCalledWith(h.db,h.lease,expect.objectContaining({message:'TEST_ONLY_ACK_FAILURE'}));
    expect(h.deps.processMemberOrderNotification).toHaveBeenNthCalledWith(2,h.db,retryLease);
  });
});
