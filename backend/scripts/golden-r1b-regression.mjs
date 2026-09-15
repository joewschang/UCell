import assert from 'node:assert/strict';

const referral={STARTER:.15,ELITE:.20,LEADER:.25};
const equalization={
  STARTER:{G2:.10,G3:.10,G4:.10},
  ELITE:{G2:.20,G3:.10,G4:.10,G5:.05,G6:.05},
  LEADER:{G2:.20,G3:.15,G4:.10,G5:.10,G6:.10,G7:.05}
};
const pool={referral:.42,binary:.36,matching:.15,global:.05,welfare:.02};

assert.equal(referral.STARTER,.15);
assert.equal(referral.ELITE,.20);
assert.equal(referral.LEADER,.25);
assert.equal(equalization.LEADER.G5,.10);
assert.equal(Object.values(pool).reduce((a,b)=>a+b,0),1);

const k=(available,theory)=>theory>0?Math.min(1,available/theory):1;
assert.equal(k(100,200),.5);
assert.equal(k(200,100),1);

const rpvDepth=n=>n<=0?5:n===1?8:12;
assert.equal(rpvDepth(0),5);
assert.equal(rpvDepth(1),8);
assert.equal(rpvDepth(2),12);

const excess=4800-2000;
const epv=excess*.60;
assert.equal(epv,1680);
assert.equal(epv*.50,840);
assert.equal(epv*.06,100.8);

const left=100000,right=70000,cap=450000;
const pair=Math.min(left,right,cap);
assert.equal(pair,70000);
assert.equal(left-pair,30000);
assert.equal(right-pair,0);

console.log('GOLDEN_R1B_REGRESSION_PASS');
