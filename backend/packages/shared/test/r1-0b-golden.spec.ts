import {R10B,k} from '../src/r1-0b-golden';
describe('R1.0B frozen golden invariants',()=>{
  it('locks Leader G5 at 10%',()=>expect(R10B.equalization.LEADER[5]).toBe(0.10));
  it('locks referral G1 rates',()=>expect(R10B.referral).toEqual({STARTER:0.15,ELITE:0.20,LEADER:0.25}));
  it('keeps K factors <= 1',()=>{expect(k(42,100)).toBeCloseTo(.42);expect(k(100,42)).toBe(1)});
  it('locks RPV depths 5/8/12',()=>{expect(R10B.rpvDepth(0)).toBe(5);expect(R10B.rpvDepth(1)).toBe(8);expect(R10B.rpvDepth(2)).toBe(12)});
  it('locks EPV 4800 example at 1680',()=>expect(R10B.epv(4800)).toBe(1680));
  it('pool allocation totals 100%',()=>expect(Object.values(R10B.pools).reduce((a,b)=>a+b,0)).toBeCloseTo(1));
});
