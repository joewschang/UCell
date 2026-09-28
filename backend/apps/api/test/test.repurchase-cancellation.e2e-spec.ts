import {SubscriptionCancellationService} from '../src/modules/subscription/subscription-cancellation.service';

describe('repurchase cancellation recovery boundary',()=>{
  it('cancels future schedules and queues append-only reversals for all already-recognized effects',async()=>{
    const created:any[]=[];
    const tx:any={
      subscription:{findUniqueOrThrow:jest.fn().mockResolvedValue({subscriptionId:'sub',ruleVersionCode:'R1.0B',schedules:[{status:'SCHEDULED',dueAt:new Date('2026-10-01')},{status:'RECOGNIZED',dueAt:new Date('2026-09-01')}]}),update:jest.fn()},
      subscriptionCancellation:{create:jest.fn().mockResolvedValue({subscriptionCancellationId:'cancel'})},
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
});
