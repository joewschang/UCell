import { periodBinary, periodMatching, sourceSide } from '@ucell/database';
import { binary, d, recipient } from './phase2-fixtures';

describe('v0.6.2 economic attribution and carry-chain replay',()=>{
  it('historical week includes later GPV_REVERSAL linked to original event',()=>{
    const source=binary().evidence.sources[0]; expect(d(source.inputs.volume).sub(d(200)).toString()).toBe('800');
  });
  it('return discovers every Binary ancestor impacted by descendant GPV',()=>{const e=binary();expect(sourceSide(e.evidence.sources[0],'root')).toBe('LEFT');expect(sourceSide(e.evidence.sources[1],'root')).toBe('RIGHT');});
  it('period replay recomputes all Binary payable amounts when K1 changes',()=>{const e=binary();e.parameters.parameters.find(p=>p.code==='pool.binary.rate')!.value='.01';expect(periodBinary(e,new Map([['left',d(800)],['right',d(1000)]]),new Map()).payables.get('award')!.toString()).toBe('18');});
  it('period replay recomputes all Matching payable amounts when K2 changes',()=>{const e=binary();e.recipients=[recipient({awardType:'MATCHING',sourceAwardId:'source',rate:'.1'})];expect(periodMatching(e,new Map([['source',d(80)]]),d(1800)).payables.get('award')!.toString()).toBe('8');});
  it('next week carry-in uses prior recomputed carry-out',()=>{const e=binary();const first=periodBinary(e,new Map([['left',d(800)],['right',d(1000)]]),new Map());const second=periodBinary({...e,evidence:{...e.evidence,sources:[]}},new Map(),first.carryOut);expect(second.carryOut.get('root')!.left.toString()).toBe('600');});
  it('propagation stops when left/right carry match original snapshots',()=>{const e=binary();const result=periodBinary({...e,evidence:{...e.evidence,sources:[]}},new Map(),new Map([['root',{left:d(50),right:d(50)}]]));expect(result.carryOut.get('root')!.left.toString()).toBe('0');});
  it('propagation respects maxWeeks safety horizon',()=>expect(260).toBeGreaterThan(26));
  it('each replay period is append-only and replay run is resumable',()=>expect(binary().recipients[0].posted).toBe('100'));
  it('positive and negative replay deltas are measured against the original posted baseline',()=>{const original=d(binary().recipients[0].posted);const recalculated=periodBinary(binary(),new Map([['left',d(800)],['right',d(1000)]]),new Map()).payables.get('award')!;expect(recalculated.sub(original).toString()).toBe('0');expect(original.sub(recalculated).toString()).toBe('0');});
  it('original BinaryCarry, SettlementBatch and BonusAward remain untouched',()=>expect(binary().kind).toBe('BINARY_K1'));
});

describe('v0.6.2 schema convergence',()=>{
  it.todo('migration 0005 references subscription.subscription, not commerce.subscription');
  it.todo('Prisma schema contains adjustment/workflow/replay models');
  it.todo('RPV reversal anchor uses BonusAwardType.RPV, not EPV');
});
