import { Prisma } from '@ucell/database';
import { BonusQueryService } from '../src/modules/bonus/bonus-query.service';
import { ReturnService } from '../src/modules/return/return.service';
import { ReversalService } from '../src/modules/return/reversal.service';

const d=(n:number)=>new Prisma.Decimal(n);
describe('A Decision return safeguards',()=>{
  test('missing historical plan never reads current qualification',async()=>{
    const current=jest.fn();
    const tx={qualificationPlanHistory:{findFirst:async()=>null},qualification:{findUniqueOrThrow:current}};
    await expect(new BonusQueryService({} as any).qualificationPlanAt(tx as any,'q',new Date())).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_MISSING'}});
    expect(current).not.toHaveBeenCalled();
  });
  const fixture=(previous:number,amount:number)=>{
    const update=jest.fn();
    const tx={order:{findUnique:async()=>({orderId:'o',status:'PARTIAL_RETURN',netAmount:d(100),lines:[{orderLineId:'l',quantity:d(10),lineAmount:d(amount),gpvAmountSnapshot:d(10)}]}),update},returnCase:{findUnique:async()=>null,create:async()=>({returnCaseId:'r'}),findUniqueOrThrow:async()=>({returnCaseId:'r'})},returnLine:{aggregate:jest.fn().mockResolvedValueOnce({_sum:{returnAmount:d(previous)}}).mockResolvedValue({_sum:{quantity:d(5)}}),create:async()=>({})}};
    const service=new ReturnService({} as any,{execute:async(_:unknown,__:unknown,___:unknown,work:any)=>work(tx)} as any,{write:async()=>{}} as any,{enqueue:async()=>{}} as any);
    return {service,update};
  };
  test('successive partial return reaches cumulative full-return status',async()=>{
    const {service,update}=fixture(50,100);
    await service.post('o',{occurredAt:new Date().toISOString(),lines:[{orderLineId:'l',quantity:5}]} as any,'key','request');
    expect(update).toHaveBeenCalledWith({where:{orderId:'o'},data:{status:'RETURNED'}});
  });
  test('money cap rejects over-return even when quantity remains reversible',async()=>{
    const {service,update}=fixture(60,100);
    await expect(service.post('o',{occurredAt:new Date().toISOString(),lines:[{orderLineId:'l',quantity:5}]} as any,'key','request')).rejects.toMatchObject({response:{code:'RETURN_AMOUNT_EXCEEDED'}});
    expect(update).not.toHaveBeenCalled();
  });
  test('missing EPV recognition snapshot fails closed before processed marker',async()=>{
    const audit=jest.fn();const outbox=jest.fn();
    const tx={replayAction:{findUnique:async()=>null},returnCase:{findUnique:async()=>({status:'POSTED',orderId:'o',lines:[],order:{purpose:'REPURCHASE'}})},auditEvent:{findFirst:async()=>null,create:audit},pvLedger:{findFirst:async()=>null,findMany:async()=>[]},outboxEvent:{create:outbox}};
    const service=new ReversalService({$transaction:async(work:any)=>work(tx)} as any,{} as any,{} as any);
    await expect(service.processReturn('r')).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_MISSING'}});
    expect(audit).not.toHaveBeenCalled();expect(outbox).not.toHaveBeenCalled();
  });
});
