import assert from 'node:assert/strict';
const D=n=>Number(n.toFixed(6));
const K=(available,theory)=>theory<=0?1:Math.min(1,available/theory);

const g1={STARTER:.15,ELITE:.20,LEADER:.25};
assert.equal(4800*g1.STARTER,720);
assert.equal(4800*g1.ELITE,960);
assert.equal(4800*g1.LEADER,1200);

const leader={G2:.20,G3:.15,G4:.10,G5:.10,G6:.10,G7:.05};
assert.equal(leader.G5,.10);
assert.equal(D(Object.values(leader).reduce((a,b)=>a+b,0)),.70);

assert.equal(K(36000,72000),.5);
assert.equal(K(72000,36000),1);

const left=180000,right=120000,pair=Math.min(left,right);
assert.equal(pair,120000); assert.equal(left-pair,60000); assert.equal(right-pair,0);

const binaryTheory=14400,k1=.5,binaryPaid=binaryTheory*k1;
assert.equal(binaryPaid*.10,720);
assert.notEqual(binaryTheory*.10,720);

const depth=n=>n===0?5:n===1?8:12;
assert.equal(depth(0),5);assert.equal(depth(1),8);assert.equal(depth(2),12);

const epv=(4800-2000)*.60;
assert.equal(epv,1680);assert.equal(epv*.50,840);assert.equal(D(epv*.06),100.8);

let outstanding=10000,recovered=0;
for(const gross of [3000,4000,5000]){const applied=Math.min(gross,outstanding);recovered+=applied;outstanding-=applied;}
assert.equal(recovered,10000);assert.equal(outstanding,0);
assert.equal(3000-Math.min(3000,10000),0);

assert.equal(D([.42,.36,.15,.05,.02].reduce((a,b)=>a+b,0)),1);
console.log('GOLDEN_ECONOMIC_CASES_PASS');
