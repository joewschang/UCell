import { Prisma } from '@ucell/database';
import { captureParameters, verifySnapshot, snapshotDecimal } from '../src/modules/rules/parameter-snapshot';
import { monthlyEpv, monthlyReturnDelta } from '../src/modules/epv/monthly-epv';
import { SettlementCalendarService } from '../src/modules/settlement/settlement-calendar.service';
import { SettlementReplayService } from '../src/modules/adjustment/settlement-replay.service';
import { EpvMonthService } from '../src/modules/epv/epv-month.service';
import { CarryChainReplayService } from '../src/modules/adjustment/carry-chain-replay.service';

const d=(value:string|number)=>new Prisma.Decimal(value);
const at=new Date('2026-09-01T00:00:00Z');
const rows=(values:Record<string,unknown>)=>Object.entries(values).map(([parameterCode,valueJson],i)=>({runtimeRuleParameterId:String(i),parameterCode,scopeKey:'*',valueJson,effectiveFrom:at,effectiveTo:null}));
const capture=(values:Record<string,unknown>)=>captureParameters({runtimeRuleParameter:{findMany:async()=>rows(values)}} as any,at,'R1.0B');

describe('SA-20260915-02 monthly EPV regression',()=>{
  test.each([[0,'0'],[1999,'0'],[2000,'0'],[2001,'0.6'],[4800,'1680']])('%s monthly consumption => %s', (consumption,expected)=>{
    expect(monthlyEpv(d(consumption),d(2000),d('.6')).toString()).toBe(expected);
  });
  test('split purchases share one monthly threshold',()=>{
    const first=monthlyEpv(d(1600),d(2000),d('.6'));
    const second=monthlyEpv(d(3200),d(2000),d('.6')).sub(first);
    const third=monthlyEpv(d(4800),d(2000),d('.6')).sub(first.add(second));
    expect([first,second,third].map(String)).toEqual(['0','720','960']);
    expect(first.add(second).add(third).toString()).toBe('1680');
  });
  test('return crossing threshold is not return amount multiplied by 60%',()=>{
    const r=monthlyReturnDelta(d(4800),d(3000),d(2000),d('.6'));
    expect(r.after.toString()).toBe('1800');
    expect(r.delta.toString()).toBe('-1680');
    expect(r.delta.toString()).not.toBe('-1800');
  });
  test('successive partial returns recompute the remaining cumulative threshold',()=>{
    const first=monthlyReturnDelta(d(4800),d(1600),d(2000),d('.6'));
    const second=monthlyReturnDelta(first.after,d(1600),d(2000),d('.6'));
    expect([first.delta,second.delta].map(String)).toEqual(['-960','-720']);
    expect(second.recomputed.toString()).toBe('0');
  });
  test('invalid over-return is rejected',()=>expect(()=>monthlyReturnDelta(d(100),d(101),d(2000),d('.6'))).toThrow());
  test('independent qualifications do not combine their threshold',()=>{
    expect(monthlyEpv(d(1600),d(2000),d('.6')).add(monthlyEpv(d(1600),d(2000),d('.6'))).toString()).toBe('0');
  });
  test('recognition rejects missing earlier order instead of allocating its EPV to later recipients',async()=>{
    const snapshot=await capture({'epv.calendar.timezone':'Asia/Taipei','epv.base_amount':2000,'epv.rate':'.6'});
    const service=new EpvMonthService();
    const tx={$queryRaw:async()=>[{start:at,end:new Date('2026-10-01')}],order:{findMany:async()=>[{orderId:'earlier',netAmount:d(1600),ruleVersionCode:'R1.0B'},{orderId:'current',netAmount:d(1600),ruleVersionCode:'R1.0B'}]},pvLedger:{findFirst:async()=>null}};
    await expect(service.recognition(tx as any,{orderId:'current',qualificationId:'q',paidAt:at,netAmount:d(1600)},snapshot)).rejects.toMatchObject({response:{code:'EPV_PREVIOUS_ORDER_PENDING'}});
  });
});

describe('SA-20260915-03 parameter snapshot and calendar',()=>{
  test('historical values are independent of later runtime edits',async()=>{
    const s=await capture({'binary.pair.rate':'.1'});
    const newer=await capture({'binary.pair.rate':'.2'});
    expect(snapshotDecimal(verifySnapshot(s),'binary.pair.rate').toString()).toBe('0.1');
    expect(newer.hash).not.toBe(s.hash);
  });
  test('snapshot tampering is rejected',async()=>{
    const s=await capture({'binary.pair.rate':'.1'});
    s.parameters[0].value='.2';
    expect(()=>verifySnapshot(s)).toThrow();
  });
  test('missing historical snapshot does not use current parameters',()=>expect(()=>verifySnapshot(null)).toThrow());
  test('overlapping effective parameter rows are rejected',async()=>{
    const values=rows({'binary.pair.rate':'.1'});
    await expect(captureParameters({runtimeRuleParameter:{findMany:async()=>[...values,...values]}} as any,at,'R1.0B')).rejects.toMatchObject({response:{code:'PARAMETER_OVERLAP'}});
  });
  test('no weekday/timezone fallback when operational calendar is pending',async()=>{
    const service=new SettlementCalendarService({} as any);
    const snapshot=await capture({});
    expect(()=>service.validate(snapshot,'BINARY_K1')).toThrow();
  });
});

describe('SA-20260915-01 period-wide replay',()=>{
  test('inactive zero-award qualification retains re-derived nonzero carry without activation',async()=>{
    const snapshot=await capture({'binary.pair.rate':'.1','pool.binary.rate':'.36'});
    const tx={settlementBatch:{findFirst:async({where}:any)=>where.settlementType==='BINARY_K1'?{settlementBatchId:'b',parameterSnapshot:snapshot,kFactor:d(1)}:null},bonusAward:{findMany:async()=>[]},binaryCarry:{findFirst:async()=>({weeklyCapSnapshot:d(500),leftCarryOut:d(4000),rightCarryOut:d(700)})},$queryRaw:async()=>[{amount:'4000'}]};
    const replay=new SettlementReplayService({} as any);
    jest.spyOn(replay,'subtreeEconomicGpv').mockImplementation(async(_tx,_qid,side)=>d(side==='LEFT'?3000:1000));
    const result=await replay.replayPeriod(tx as any,{periodStart:at,periodEnd:new Date('2026-09-08'),ruleVersionCode:'R1.0B',carryOverrides:new Map([['q',{left:d(100),right:d(200)}]])});
    expect(result.binary[0].recomputedCarryOutLeft?.toString()).toBe('2600');
    expect(result.binary[0].recomputedCarryOutRight?.toString()).toBe('700');
    expect(result.binary[0].recomputedTheory.toString()).toBe('0');
  });
  test('unimplemented K0 dependency blocks the atomic run before posting partial K1/K2',async()=>{
    const snapshot=await capture({'binary.pair.rate':'.1'});
    const create=jest.fn();
    const tx={returnCase:{findUnique:async()=>({status:'POSTED',orderId:'o',order:{ruleVersionCode:'R1.0B',purpose:'ENTRY'}})},subscription:{findFirst:async()=>null},pvLedger:{findMany:async()=>[{occurredAt:at}]},settlementBatch:{findFirst:async({where}:any)=>where.settlementType==='BINARY_K1'?{periodStart:at,periodEnd:new Date('2026-09-08'),parameterSnapshot:snapshot}:{settlementBatchId:'k0'}},settlementReplayRun:{create}};
    const service=new CarryChainReplayService({$transaction:async(fn:any)=>fn(tx)} as any,{} as any);
    await expect(service.runForReturn('r')).rejects.toMatchObject({response:{code:'K0_REPLAY_IMPLEMENTATION_PENDING'}});
    expect(create).not.toHaveBeenCalled();
  });
  test('return shrinks pool for all recipients and recomputes K1 then K2 from exact Binary sources',async()=>{
    const snapshot=await capture({'binary.pair.rate':'.1','pool.binary.rate':'.36','pool.matching.rate':'.15'});
    const awards=[{bonusAwardId:'b1',recipientQualificationId:'q1',theoryAmount:d(400),payableAmount:d(360),activeSnapshot:true},{bonusAwardId:'b2',recipientQualificationId:'q2',theoryAmount:d(400),payableAmount:d(360),activeSnapshot:true}];
    const matching=[{bonusAwardId:'m1',recipientQualificationId:'m',sourceAwardId:'b1',theoryAmount:d(180),payableAmount:d(150),calculationDetail:{rate:'.5'}}];
    const tx={settlementBatch:{findFirst:async({where}:any)=>({settlementBatchId:where.settlementType==='BINARY_K1'?'binary':'matching',parameterSnapshot:snapshot,kFactor:d('.9'),poolAvailable:d(999999)})},bonusAward:{findMany:async({where}:any)=>where.awardType==='BINARY'?awards:matching},$queryRaw:async()=>[{amount:'1000'}]};
    const result=await new SettlementReplayService({} as any).replayPeriod(tx as any,{periodStart:at,periodEnd:new Date('2026-09-08'),ruleVersionCode:'R1.0B',carryOverrides:new Map()});
    expect(result.recomputedK1.toString()).toBe('0.45');
    expect(result.binary.map(b=>b.recomputedPayable.toString())).toEqual(['180','180']);
    expect(result.matching[0].recomputedPayable.toString()).toBe('90');
    expect(result.recomputedK2?.toString()).toBe('1');
    expect(awards.map(a=>a.payableAmount.toString())).toEqual(['360','360']);
  });
  test('missing historical snapshot fails before economic replay',async()=>{
    const raw=jest.fn();
    const tx={settlementBatch:{findFirst:async()=>({settlementBatchId:'b',parameterSnapshot:null})},bonusAward:{findMany:async()=>[]},$queryRaw:raw};
    await expect(new SettlementReplayService({} as any).replayPeriod(tx as any,{periodStart:at,periodEnd:new Date('2026-09-08'),ruleVersionCode:'R1.0B',carryOverrides:new Map()})).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_MISSING'}});
    expect(raw).not.toHaveBeenCalled();
  });
});
