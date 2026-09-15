import assert from 'node:assert/strict';
const clamp=k=>Math.max(0,Math.min(1,k));
const k=(pool,theory)=>theory<=0?1:clamp(pool/theory);
const rpvDepth=n=>n<=0?5:n===1?8:12;
const g1=plan=>({STARTER:.15,ELITE:.20,LEADER:.25}[plan]);
const leaderEq={G2:.20,G3:.15,G4:.10,G5:.10,G6:.10,G7:.05};
const epv=(amount)=>amount*.70;
assert.equal(g1('STARTER'),.15); assert.equal(g1('ELITE'),.20); assert.equal(g1('LEADER'),.25);
assert.equal(leaderEq.G5,.10);
assert.equal(rpvDepth(0),5); assert.equal(rpvDepth(1),8); assert.equal(rpvDepth(2),12); assert.equal(rpvDepth(9),12);
assert.equal(epv(2400),1680);
for(const [pool,theory] of [[0,0],[100,200],[300,200],[10,1000]]){const x=k(pool,theory);assert.ok(x>=0&&x<=1)}
assert.equal(.42+.36+.12+.05+.05,1);
console.log('GOLDEN_DOMAIN_PASS');
