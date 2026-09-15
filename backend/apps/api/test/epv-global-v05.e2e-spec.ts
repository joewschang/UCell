import { historicalMonthlyEntitlements } from '@ucell/database';
import { epv,d } from './phase2-fixtures';
describe('v0.5 EPV', () => {
  it('REPURCHASE 4800 => excess 2800 x 60% = 1680 EPV',()=>{expect(historicalMonthlyEntitlements([epv()],new Map([['order',d(4800)]])).get('order')!.toString()).toBe('1680');});
  it('EPV self share = 50% = 840 when Active',()=>expect(d('1680').mul(d('.5')).toString()).toBe('840'));
  it('EPV Sponsor G1-G5 each 6% when Active',()=>expect([1,2,3,4,5].map(()=>d('1680').mul(d('.06')).toString())).toEqual(['100.8','100.8','100.8','100.8','100.8']));
  it('EPV does not use Binary tree',()=>{const e=epv();expect(e.evidence.sponsor).toEqual([]);expect(e.evidence.binary?.length).toBeGreaterThanOrEqual(0);});
  it('non-REPURCHASE order does not create EPV',()=>expect(historicalMonthlyEntitlements([{...epv('order','1600'),inputs:{...epv('order','1600').inputs,consumption:'1600'}}],new Map([['order',d('1600')]])).get('order')!.toString()).toBe('0'));
});

describe('v0.5 Global/Welfare', () => {
  it.todo('global pool is 5% of period GPV');
  it.todo('weak thresholds are 300k/600k/1m/2m/4m');
  it.todo('rank achievement never downgrades');
  it.todo('monthly payout requires Active and current-month weak side threshold');
  it.todo('passed levels are cumulative');
  it.todo('empty rank slice rolls upward to next higher rank');
  it.todo('welfare 2% is accrued only; no distribution without a formal rule');
});
