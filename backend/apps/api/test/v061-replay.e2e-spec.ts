import { periodBinary, periodMatching, appendEntitlementDelta, verifyReplayEnvelope } from '@ucell/database';
import { binary, d, recipient, sealed } from './phase2-fixtures';

const volumes=()=>new Map([['left',d(800)],['right',d(1000)]]);
describe('v0.6.1 deterministic replay',()=>{
 it('replay uses original carry-in, not current carry',()=>{const e=binary();expect(periodBinary(e,volumes(),new Map()).carryOut.get('root')!.left.toString()).toBe('800');});
 it('negative GPV reversal is included in historical period subtree GPV',()=>{expect(periodBinary(binary(),volumes(),new Map()).total.toString()).toBe('1800');});
 it('recomputed Pair respects original weekly cap',()=>{expect(periodBinary(binary(),volumes(),new Map()).payables.get('award')!.toString()).toBe('100');});
 it('K1 is recomputed with changed impacted theory and unchanged others',()=>{const e=binary();e.parameters.parameters.find(p=>p.code==='pool.binary.rate')!.value='.01';const r=periodBinary(e,volumes(),new Map());expect(r.k.toString()).toBe('0.18');expect(r.payables.get('award')!.toString()).toBe('18');});
 it('Matching source uses recomputed Binary Paid',()=>{const e=binary();e.recipients=[recipient({awardType:'MATCHING',sourceAwardId:'source',rate:'.1'})];expect(periodMatching(e,new Map([['source',d(80)]]),d(1800)).payables.get('award')!.toString()).toBe('8');});
 it('K2 is recomputed from adjusted matching theory',()=>{const e=binary();e.recipients=[recipient({awardType:'MATCHING',sourceAwardId:'source',rate:'1'})];const r=periodMatching(e,new Map([['source',d(1000)]]),d(100));expect(r.k.toString()).toBe('0.015');expect(r.payables.get('award')!.toString()).toBe('15');});
 it('original settlement, award and carry rows remain unchanged',()=>{const e=binary(),before=JSON.stringify(e);periodBinary(e,volumes(),new Map());expect(JSON.stringify(e)).toBe(before);});
 for(const [name,amount] of [['positive delta creates compensating award',120],['negative delta creates recovery',80]] as const){
  it(name,async()=>{const e=binary(),r=e.recipients[0],before=JSON.stringify(e);const tx={entitlementReplayPosting:{findUnique:jest.fn().mockResolvedValue(null),aggregate:jest.fn().mockResolvedValue({_sum:{delta:null}}),create:jest.fn().mockImplementation(({data})=>data)},bonusAward:{create:jest.fn().mockResolvedValue({bonusAwardId:'new'})},bonusAwardLifecycleEvent:{create:jest.fn()},bonusRecoveryEvent:{create:jest.fn().mockResolvedValue({bonusRecoveryEventId:'recovery'})}};
   const post=await appendEntitlementDelta(tx as never,sealed(e),r,d(amount),'RETURN:one','hash');expect(post.delta.toString()).toBe(String(amount-100));expect(JSON.stringify(e)).toBe(before);
   if(amount>100){expect(tx.bonusAward.create).toHaveBeenCalledTimes(1);expect(tx.bonusRecoveryEvent.create).not.toHaveBeenCalled();}else{expect(tx.bonusRecoveryEvent.create).toHaveBeenCalledWith({data:expect.objectContaining({bonusAwardId:'award',recoveryAmount:d(20),outstandingAmount:d(20)})});expect(tx.bonusAward.create).not.toHaveBeenCalled();}
  });
 }
 it('missing original evidence fails closed',()=>{expect(()=>verifyReplayEnvelope(null)).toThrow();});
});

describe('v0.6.1 subscription cancellation',()=>{
  it.todo('future scheduled rows become CANCELLED');
  it.todo('recognized affected rows enqueue one RPV_REVERSAL_REQUIRED');
  it.todo('worker creates exactly one negative RPV reversal event');
  it.todo('worker creates recovery for previously payable RPV upline awards');
  it.todo('reprocessing event is idempotent');
});

describe('v0.6.1 qualification workflow',()=>{
  it.todo('upgrade creates future plan history and does not alter past awards');
  it.todo('transfer preserves qualificationId and sponsor/binary positions');
  it.todo('exit closes holder interval and status becomes EXITED');
  it.todo('company retransfer opens a new holder interval');
});
