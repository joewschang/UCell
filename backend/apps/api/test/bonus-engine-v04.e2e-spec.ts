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
    it.todo('recipient plan and effective-direct count control unlock depth');
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
    it.todo('direct 1 unlocks G1-G2, 2 unlocks G1-G3, 3 unlocks G1-G4, 4+ unlocks G1-G5');
    it.todo('Matching Pool is 15% and K2 <= 1');
  });

  describe('Lifecycle', () => {
    it.todo('award creates CALCULATED then PENDING_45D events');
    it.todo('after pending_until latest status becomes EFFECTIVE');
    it.todo('award row itself remains append-only');
  });
});
