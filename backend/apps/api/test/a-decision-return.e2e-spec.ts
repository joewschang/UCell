import { appendQualificationMonthReplayEvidence, Prisma } from '@ucell/database';
import { BonusQueryService } from '../src/modules/bonus/bonus-query.service';
import { ReturnService } from '../src/modules/return/return.service';
import { ReversalService } from '../src/modules/return/reversal.service';

const d=(n:number)=>new Prisma.Decimal(n);
describe('A Decision return safeguards',()=>{
  test.each([
    ['above',2500,true,1],
    ['below',1500,false,0],
  ])('return recomputes Qualification-month Active %s threshold append-only',async(_label,remaining,active,activeWrites)=>{
    const activeCreate=jest.fn(async({data}:any)=>data);
    const accumulatorCreate=jest.fn(async({data}:any)=>({qualificationMonthAccumulatorEvidenceId:'replay-accumulator',...data}));
    const tx:any={
      consumptionRecognitionEvent:{
        findMany:async()=>[{consumptionRecognitionEventId:'original-recognition',eligibleAmount:d(3000)}],findUnique:async()=>null,
        create:async({data}:any)=>({consumptionRecognitionEventId:'reversal-recognition',...data}),
      },
      qualificationMonthAccumulatorEvidence:{findFirst:async()=>({sequenceNo:1,activeThreshold:d(2000)}),findUnique:async()=>null,create:accumulatorCreate},
      activeIntervalEvidence:{findFirst:async()=>({activeIntervalEvidenceId:'original-active'}),findUnique:async()=>null,create:activeCreate},
    };
    const envelope:any={ruleVersionCode:'R1.0B',at:'2026-09-05T00:00:00.000Z',parameters:{hash:'parameters'},inputs:{monthStart:'2026-08-31T16:00:00.000Z',monthEnd:'2026-09-30T16:00:00.000Z',orderId:'order'}};
    const result=await appendQualificationMonthReplayEvidence(tx,{marker:{qualificationId:'q'},envelopes:[envelope],remaining:new Map([['order',d(remaining)]]),actionKey:`RETURN:${_label}`,returnCaseId:'return',stateHash:'state'});
    expect(result.active).toBe(active);
    expect(accumulatorCreate).toHaveBeenCalledWith({data:expect.objectContaining({cumulativeBefore:d(3000),eligibleDelta:d(remaining-3000),cumulativeAfter:d(remaining),epvAfter:d(remaining),thresholdCrossed:false})});
    expect(activeCreate).toHaveBeenCalledTimes(activeWrites);
    if(active) expect(activeCreate).toHaveBeenCalledWith({data:expect.objectContaining({supersedesActiveEvidenceId:'original-active',reasonCode:'HISTORICAL_RETURN_REPLAY'})});
  });
  test('missing historical plan never reads current qualification',async()=>{
    const current=jest.fn();
    const tx={qualificationPlanHistory:{findFirst:async()=>null},qualification:{findUniqueOrThrow:current}};
    await expect(new BonusQueryService({} as any).qualificationPlanAt(tx as any,'q',new Date())).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_MISSING'}});
    expect(current).not.toHaveBeenCalled();
  });
  const fixture=(previous:number,amount:number)=>{
    const update=jest.fn();
    const tx={order:{findUnique:async()=>({orderId:'o',qualificationId:'q',ruleVersionCode:'TEST_ONLY',paidAt:new Date('2020-01-01'),status:'PARTIAL_RETURN',netAmount:d(100),lines:[{orderLineId:'l',quantity:d(10),lineAmount:d(amount),gpvAmountSnapshot:d(10)}]}),update},returnCase:{findUnique:async()=>null,create:async()=>({returnCaseId:'r'}),findUniqueOrThrow:async()=>({returnCaseId:'r'})},returnLine:{aggregate:jest.fn().mockResolvedValueOnce({_sum:{returnAmount:d(previous)}}).mockResolvedValue({_sum:{quantity:d(5)}}),create:async()=>({})},settlementBatch:{findMany:async()=>[]},settlementRecalculationRequest:{createMany:async()=>({count:0})}};
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
