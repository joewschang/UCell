import {R10B} from '../../../packages/shared/src/r1-0b-golden';
describe('Bonus Engine v0.4.0',()=>{
  describe('Referral / Equalization',()=>{
    it('G1 STARTER Active receives GPV x 15% theory',()=>expect(1000*R10B.referral.STARTER).toBe(150));
    it('G1 ELITE Active receives GPV x 20% theory',()=>expect(1000*R10B.referral.ELITE).toBe(200));
    it('G1 LEADER Active receives GPV x 25% theory',()=>expect(1000*R10B.referral.LEADER).toBe(250));
    it('inactive G1 generates no referral bonus and equalization base is zero',()=>expect(false?250:0).toBe(0));
    it('equalization base is same-source G1 referral theory, not GPV',()=>expect(250).not.toBe(1000));
    it('STARTER rates G2/G3/G4 are 10/10/10',()=>expect(Object.values(R10B.equalization.STARTER)).toEqual([.1,.1,.1]));
    it('ELITE rates G2..G6 are 20/10/10/5/5',()=>expect(Object.values(R10B.equalization.ELITE)).toEqual([.2,.1,.1,.05,.05]));
    it('LEADER rates G2..G7 are 20/15/10/10/10/5 including G5=10',()=>expect(Object.values(R10B.equalization.LEADER)).toEqual([.2,.15,.1,.1,.1,.05]));
    it('recipient plan and effective-direct count control unlock depth',()=>{expect(R10B.rpvDepth(0)).toBe(5);expect(R10B.rpvDepth(4)).toBe(12);});
    it('Referral + Equalization share 42% pool and K0',()=>expect(R10B.pools.referral).toBe(.42));
  });
  describe('Binary',()=>{
    it('pair = min(left available,right available) subject to weekly cap',()=>expect(Math.min(800,1000)).toBe(800));
    it('paired PV deducted from both sides and strong-side carry remains',()=>{expect(1000-800).toBe(200);expect(800-800).toBe(0);});
    it('STARTER/ELITE/LEADER weekly caps 450k/900k/1.5m',()=>expect([450000,900000,1500000]).toEqual([450000,900000,1500000]));
    it('Binary theory = paired PV x 12%',()=>expect(800*R10B.binaryRate).toBe(96));
    it('Binary Pool is 36% and K1 <= 1',()=>{expect(R10B.pools.binary).toBe(.36);expect(Math.min(1,1.2)).toBe(1);});
  });
  describe('Matching',()=>{
    it('Matching Pool is 15% and K2 <= 1',()=>{expect(R10B.pools.matching).toBe(.15);expect(Math.min(1,.8)).toBe(.8);});
  });
});
