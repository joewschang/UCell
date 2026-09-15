import { ReferralBonusService } from '../src/modules/bonus/referral-bonus.service';
import { BinaryBonusService } from '../src/modules/bonus/binary-bonus.service';
import { BonusLifecycleService } from '../src/modules/bonus/bonus-lifecycle.service';
function lifecycleHarness() {
  const pendingUntil=new Date('2020-02-01'),award={bonusAwardId:'award-A',pendingUntil,payableAmount:'100'};
  const events:any[]=[{bonusAwardId:'award-A',status:'PENDING_45D',occurredAt:new Date('2020-01-01')}];
  const tx={
    $queryRaw:jest.fn(async()=>[{bonus_award_id:'award-A'}]),
    bonusAwardLifecycleEvent:{findFirst:jest.fn(async()=>events[events.length-1]),create:jest.fn(async({data}:any)=>{events.push(data);return data;})},
    bonusAward:{update:jest.fn(),delete:jest.fn()},
  };
  const prisma={bonusAward:{findMany:jest.fn(async({where}:any)=>pendingUntil<=where.pendingUntil.lte?[award]:[])},$transaction:jest.fn(async(work:any)=>work(tx))};
  return {service:new BonusLifecycleService(prisma as any),prisma,tx,events,award,pendingUntil};
}
describe('Bonus Engine v0.4.0', () => {
  describe('Referral / Equalization', () => {
    it.todo('G1 STARTER Active receives GPV x 15% theory');
    it.todo('G1 ELITE Active receives GPV x 20% theory');
    it.todo('G1 LEADER Active receives GPV x 25% theory');
    it.todo('inactive G1 generates no referral bonus and equalization base is zero');
    it.todo('equalization base is same-source G1 referral theory, not GPV');
    it.todo('STARTER rates G2/G3/G4 are 10/10/10');
    it.todo('ELITE rates G2..G6 are 20/10/10/5/5');
    it.todo('LEADER rates G2..G7 are 20/15/10/10/10/5 including G5=10');
    it.todo('intermediate ineligible generation does not block higher generation');
    it('recipient plan and effective-direct count control unlock depth',()=>{
      const service=new ReferralBonusService({} as any,{} as any,{} as any,{} as any);
      expect([0,1,2,3,4].map(d=>service.equalizationUnlockDepth('STARTER',d))).toEqual([0,3,4,4,4]);
      expect([0,1,2,3,4].map(d=>service.equalizationUnlockDepth('ELITE',d))).toEqual([0,3,4,5,6]);
      expect([0,1,2,3,4].map(d=>service.equalizationUnlockDepth('LEADER',d))).toEqual([0,3,4,5,7]);
    });
    it.todo('Referral + Equalization share 42% pool and K0');
  });

  describe('Binary', () => {
    it.todo('uses Binary subtree GPV, not Sponsor tree');
    it.todo('pair = min(left available,right available) subject to weekly cap');
    it.todo('paired PV deducted from both sides and strong-side carry remains');
    it.todo('STARTER/ELITE/LEADER weekly caps 450k/900k/1.5m');
    it.todo('Binary theory = paired PV x 12%');
    it.todo('Binary Pool is 36% and K1 <= 1');
    it.todo('inactive recipient produces no Binary award');
  });

  describe('Matching', () => {
    it.todo('source is actual Binary payable after K1, never Binary theory');
    it.todo('Sponsor Tree is used to trace matching uplines');
    it.todo('rates are G1=15,G2=10,G3-G5=5');
    it('direct 1 unlocks G1-G2, 2 unlocks G1-G3, 3 unlocks G1-G4, 4+ unlocks G1-G5',()=>{
      const service=new BinaryBonusService({} as any,{} as any,{} as any,{} as any);
      expect([0,1,2,3,4,8].map(d=>service.matchingUnlockDepth(d))).toEqual([0,2,3,4,5,5]);
    });
    it.todo('Matching Pool is 15% and K2 <= 1');
  });

  describe('Lifecycle', () => {
    it.todo('award creates CALCULATED then PENDING_45D events');
    it('after pending_until latest status becomes EFFECTIVE',async()=>{
      const {service,prisma,tx,events,pendingUntil}=lifecycleHarness();
      expect(await service.matureDueAwards(new Date(pendingUntil.getTime()-1))).toEqual({matured:0});
      expect(tx.bonusAwardLifecycleEvent.create).not.toHaveBeenCalled();
      expect(await service.matureDueAwards(pendingUntil)).toEqual({matured:1});
      expect(events.map(event=>event.status)).toEqual(['PENDING_45D','EFFECTIVE']);
      expect(prisma.bonusAward.findMany).toHaveBeenCalledWith({where:{pendingUntil:{lte:pendingUntil}},take:500});
      expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
      expect(await service.matureDueAwards(pendingUntil)).toEqual({matured:0});
      expect(tx.bonusAwardLifecycleEvent.create).toHaveBeenCalledTimes(1);
    });
    it('award row itself remains append-only',async()=>{
      const {service,tx,award,pendingUntil,events}=lifecycleHarness(),original=JSON.stringify(award);
      await service.matureDueAwards(pendingUntil);
      expect(JSON.stringify(award)).toBe(original);
      expect(tx.bonusAward.update).not.toHaveBeenCalled();
      expect(tx.bonusAward.delete).not.toHaveBeenCalled();
      events.push({status:'PAID',occurredAt:new Date('2020-02-02')});
      expect(await service.matureDueAwards(new Date('2020-02-03'))).toEqual({matured:0});
      expect(tx.bonusAwardLifecycleEvent.create).toHaveBeenCalledTimes(1);
    });
  });
});
