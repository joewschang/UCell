import {SubscriptionCancellationService} from '../src/modules/subscription/subscription-cancellation.service';

describe('repurchase cancellation recovery boundary',()=>{
  it('cancels future schedules and queues append-only reversals for all already-recognized effects',async()=>{
    const created:any[]=[];
    const tx:any={
      subscription:{findUniqueOrThrow:jest.fn().mockResolvedValue({subscriptionId:'sub',ruleVersionCode:'R1.0B',schedules:[{status:'SCHEDULED',dueAt:new Date('2026-11-01')},{status:'RECOGNIZED',dueAt:new Date('2026-09-01')}]}),update:jest.fn()},
      subscriptionCancellation:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn().mockResolvedValue({subscriptionCancellationId:'cancel'})},
      monthlyRecognitionSchedule:{updateMany:jest.fn(),findMany:jest.fn().mockResolvedValue([{recognitionId:'recognized-before-return'}])},
      outboxEvent:{create:jest.fn(async({data}:any)=>{created.push(data);return data;})},
    };
    const service=new SubscriptionCancellationService({$transaction:async(work:any)=>work(tx)} as any);
    const result=await service.cancel('sub',new Date('2026-10-15'),'FULL_RETURN');
    expect(tx.monthlyRecognitionSchedule.updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({dueAt:{gte:new Date('2026-10-15')},status:'SCHEDULED'}),data:{status:'CANCELLED'}}));
    expect(tx.monthlyRecognitionSchedule.findMany).toHaveBeenCalledWith({where:{subscriptionId:'sub',status:'RECOGNIZED'}});
    expect(created).toEqual([expect.objectContaining({eventType:'RPV_REVERSAL_REQUIRED',aggregateId:'recognized-before-return',payload:expect.objectContaining({subscriptionCancellationId:'cancel',reasonCode:'FULL_RETURN'})})]);
    expect(result).toMatchObject({cancelledFutureCount:1,queuedRpvReversalCount:1});
  });

  it('reuses the immutable cancellation fact and does not enqueue recovery twice',async()=>{
    const existing={subscriptionCancellationId:'existing',subscriptionId:'sub',effectiveAt:new Date('2026-10-15'),reasonCode:'FULL_RETURN'};
    const tx:any={
      subscriptionCancellation:{findFirst:jest.fn().mockResolvedValue(existing),create:jest.fn()},
      subscription:{findUniqueOrThrow:jest.fn(),update:jest.fn()},
      monthlyRecognitionSchedule:{updateMany:jest.fn(),findMany:jest.fn()},
      outboxEvent:{create:jest.fn()},
    };
    const service=new SubscriptionCancellationService({$transaction:async(work:any)=>work(tx)} as any);
    await expect(service.cancel('sub',new Date('2026-10-15'),'FULL_RETURN','0',{idempotencyKey:'cancel-key'})).resolves.toMatchObject({cancellation:existing,replayed:true,queuedRpvReversalCount:0});
    expect(tx.subscriptionCancellation.create).not.toHaveBeenCalled();
    expect(tx.outboxEvent.create).not.toHaveBeenCalled();
  });

  it('reconciles a concurrent unique-key retry without mutating the cancellation fact',async()=>{
    const existing={subscriptionCancellationId:'existing',subscriptionId:'sub',effectiveAt:new Date('2026-10-15'),reasonCode:'FULL_RETURN'};
    const db:any={
      $transaction:jest.fn().mockRejectedValue({code:'P2002'}),
      subscriptionCancellation:{findFirst:jest.fn().mockResolvedValue(existing)},
    };
    const service=new SubscriptionCancellationService(db);
    await expect(service.cancel('sub',new Date('2026-10-15'),'FULL_RETURN','0',{idempotencyKey:'cancel-key'})).resolves.toMatchObject({cancellation:existing,replayed:true,queuedRpvReversalCount:0});
    expect(db.subscriptionCancellation.findFirst).toHaveBeenCalledWith({where:{idempotencyKey:'cancel-key'}});
  });

  it('accepts only a posted ReturnCase belonging to the subscription order',async()=>{
    const tx:any={
      subscriptionCancellation:{findFirst:jest.fn().mockResolvedValue(null),create:jest.fn()},
      subscription:{findUniqueOrThrow:jest.fn().mockResolvedValue({subscriptionId:'sub',orderId:'order-a',schedules:[]})},
      returnCase:{findUnique:jest.fn().mockResolvedValue({returnCaseId:'return-b',status:'POSTED',orderId:'order-b'})},
    };
    const service=new SubscriptionCancellationService({$transaction:async(work:any)=>work(tx)} as any);
    await expect(service.cancel('sub',new Date('2026-10-15'),'PARTIAL_RETURN','50',{sourceReturnCaseId:'return-b',idempotencyKey:'return-b-key'})).rejects.toMatchObject({response:{code:'SUBSCRIPTION_CANCELLATION_RETURN_SOURCE_INVALID'}});
    expect(tx.subscriptionCancellation.create).not.toHaveBeenCalled();
  });
});
