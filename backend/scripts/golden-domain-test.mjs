import assert from 'node:assert/strict';
import { R10B, k } from '../packages/shared/src/r1-0b-golden.ts';
// Source manifest: governance/local-ssot-review/source-manifest.json.
// R1.0 manual v1.3: section 5 / P0035, P0226-P0233 (pool rates);
// section 12.2 / P0422 (4,800 purchase -> 1,680 EPV).
// Core Logic v4.1 file: section 7 / P0026 confirms excess x 60%.
// Node 24's built-in TypeScript stripping keeps this gate dependency-free.
assert.deepEqual(R10B.referral,{STARTER:.15,ELITE:.20,LEADER:.25});
assert.equal(R10B.equalization.LEADER[5],.10);
assert.equal(R10B.rpvDepth(0),5); assert.equal(R10B.rpvDepth(1),8);
assert.equal(R10B.rpvDepth(2),12); assert.equal(R10B.rpvDepth(9),12);
assert.equal(R10B.epv(4800),1680);
assert.equal(R10B.epv(2000),0); assert.equal(R10B.epv(0),0);
for(const [pool,theory] of [[0,0],[100,200],[300,200],[10,1000]]){const x=k(pool,theory);assert.ok(x>=0&&x<=1)}
assert.deepEqual(R10B.pools,{referral:.42,binary:.36,matching:.15,global:.05,welfare:.02});
assert.equal(Object.values(R10B.pools).reduce((total,rate)=>total+rate,0),1);
console.log('GOLDEN_DOMAIN_PASS');
