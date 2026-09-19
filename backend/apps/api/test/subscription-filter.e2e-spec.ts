import { SubscriptionService } from '../src/modules/subscription/subscription.service';
import { ListSubscriptionsQueryDto } from '../src/modules/subscription/dto/list-subscriptions-query.dto';
import { validate } from 'class-validator';

const qualificationId = '550e8400-e29b-41d4-a716-446655440000';

function harness(){
  const findMany=jest.fn(async()=>[]);
  const findUniqueOrThrow=jest.fn(async()=>({subscriptionId:'subscription-1'}));
  const service=new SubscriptionService({
    subscription:{findMany,findUniqueOrThrow},
  } as any,{} as any,{} as any);
  return {service,findMany,findUniqueOrThrow};
}

describe('Subscription list business-identifier filter',()=>{
  it('filters an Admin subscription list by exact public Ball Number',async()=>{
    const {service,findMany}=harness();
    await service.list({status:'ACTIVE',ballNo:'TREE-A000001',take:17});
    expect(findMany).toHaveBeenCalledWith({
      where:{status:'ACTIVE',qualification:{ballNo:'TREE-A000001'}},
      include:{plan:true,qualification:{select:{ballNo:true,currentHolder:{select:{memberNo:true}}}}},
      orderBy:[{createdAt:'desc'},{subscriptionId:'desc'}],
      take:17,
    });
  });

  it('accepts the complete Ball Number envelope produced by ballNoFor',async()=>{
    const {service,findMany}=harness();
    const maxTreeCode=`T${'A'.repeat(39)}`;
    await service.list({ballNo:`${maxTreeCode}X000001`});
    await service.list({ballNo:`${maxTreeCode}9223372036854775804`});
    expect(findMany).toHaveBeenCalledTimes(2);
    await expect(service.list({ballNo:`${maxTreeCode}92233720368547758040`})).rejects.toMatchObject({response:{code:'INVALID_BALL_NO'}});
  });

  it('declares the same 59-character Ball Number ceiling to the HTTP validation pipe',async()=>{
    const maxTreeCode=`T${'A'.repeat(39)}`;
    const valid=Object.assign(new ListSubscriptionsQueryDto(),{ballNo:`${maxTreeCode}9223372036854775804`});
    const tooLong=Object.assign(new ListSubscriptionsQueryDto(),{ballNo:`${maxTreeCode}92233720368547758040`});
    expect(await validate(valid)).toEqual([]);
    expect((await validate(tooLong))[0]?.constraints).toHaveProperty('maxLength');
  });

  it('keeps the legacy UUID filter working for existing integrations',async()=>{
    const {service,findMany}=harness();
    await service.list({qualificationId});
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({where:{qualificationId},take:100}));
  });

  it('fails closed for invalid or ambiguous business-identifier filters',async()=>{
    const {service,findMany}=harness();
    await expect(service.list({ballNo:'FORGED'})).rejects.toMatchObject({response:{code:'INVALID_BALL_NO'}});
    await expect(service.list({ballNo:'TREE-A000001',qualificationId})).rejects.toMatchObject({response:{code:'SUBSCRIPTION_FILTER_AMBIGUOUS'}});
    await expect(service.list({qualificationId:'not-a-uuid'})).rejects.toMatchObject({response:{code:'INVALID_QUALIFICATION_ID'}});
    expect(findMany).not.toHaveBeenCalled();
  });

  it('returns Ball and Member context for a selected subscription without exposing its qualification ID as a required display field',async()=>{
    const {service,findUniqueOrThrow}=harness();
    await service.get('subscription-1');
    expect(findUniqueOrThrow).toHaveBeenCalledWith({
      where:{subscriptionId:'subscription-1'},
      include:{plan:true,qualification:{select:{ballNo:true,currentHolder:{select:{memberNo:true}}}},schedules:{orderBy:{installmentNo:'asc'}}},
    });
  });
});
