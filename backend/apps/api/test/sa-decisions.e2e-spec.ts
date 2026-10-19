import { periodBinary,periodMatching } from '@ucell/database';
import { binary,recipient } from './phase2-fixtures';
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
    const tx={packagePurchaseSnapshot:{findMany:async()=>[]},$queryRaw:async()=>[{start:at,end:new Date('2026-10-01')}],order:{findMany:async()=>[{orderId:'earlier',netAmount:d(1600),ruleVersionCode:'R1.0B'},{orderId:'current',netAmount:d(1600),ruleVersionCode:'R1.0B'}]},pvLedger:{findFirst:async()=>null}};
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
  test('inactive zero-award qualification retains re-derived nonzero carry without activation',()=>{
    const e=binary();e.recipients[0].active=false;e.recipients[0].eligible=false;e.evidence.carryRecipients[0].active=false;
    const result=periodBinary(e,new Map([['left',d(3000)],['right',d(1000)]]),new Map([['root',{left:d(100),right:d(200)}]]));
    expect(result.carryOut.get('root')!.left.toString()).toBe('2900');expect(result.carryOut.get('root')!.right.toString()).toBe('1000');expect(result.payables.get('award')!.toString()).toBe('0');
  });
  test('missing K0 evidence blocks atomic run before posting partial K1/K2',async()=>{
    const create=jest.fn();const tx={replayAction:{findUnique:async()=>null,create},returnCase:{findUnique:async()=>({status:'POSTED',orderId:'o',order:{ruleVersionCode:'R1.0B'}})},pvLedger:{findMany:async()=>[{eventId:'source',occurredAt:at}]},historicalReplaySnapshot:{findUnique:async()=>null}};
    const service=new CarryChainReplayService({$transaction:async(fn:any)=>fn(tx)} as any,{} as any);
    await expect(service.runForReturn('r')).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_MISSING'}});expect(create).not.toHaveBeenCalled();
  });
  test('return shrinks pool for all recipients and recomputes K1 then K2 from exact Binary sources',()=>{
    const e=binary();e.evidence.carryRecipients[0].weeklyCapSnapshot='10000';e.evidence.carryRecipients[0].leftCarryIn='0';e.recipients=[recipient({key:'b1'}),recipient({key:'b2',qualificationId:'root2'})];
    e.evidence.carryRecipients.push({...e.evidence.carryRecipients[0],qualificationId:'root2'});
    for(const source of e.evidence.sources)source.evidence.binary.push({childQualificationId:'root',parentQualificationId:'root2',side:'LEFT'});
    // Distinct recipient ancestry: source routing through the first branch keeps root2 on its historical side.
    e.evidence.carryRecipients[1].leftCarryIn='500';e.evidence.carryRecipients[1].rightCarryIn='500';
    const result=periodBinary(e,new Map([['left',d(500)],['right',d(500)]]),new Map());
    expect(result.k.toString()).toBe('0.72');expect([...result.payables.values()].map(String)).toEqual(['180','180']);
    const m=binary();m.recipients=[recipient({awardType:'MATCHING',sourceAwardId:'b1',rate:'.5'})];const matching=periodMatching(m,result.payables,result.total);expect(matching.payables.get('award')!.toString()).toBe('90');
  });
  test('missing historical snapshot fails before economic replay',async()=>{
    const raw=jest.fn();const tx={settlementBatch:{findFirst:async()=>({settlementBatchId:'b'})},historicalReplaySnapshot:{findUnique:async()=>null},$queryRaw:raw};
    await expect(new SettlementReplayService({} as any).replayPeriod(tx as any,{periodStart:at,periodEnd:new Date('2026-09-08'),ruleVersionCode:'R1.0B',carryOverrides:new Map()})).rejects.toMatchObject({response:{code:'HISTORICAL_SNAPSHOT_MISSING'}});expect(raw).not.toHaveBeenCalled();
  });
});
