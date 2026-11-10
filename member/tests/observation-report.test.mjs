import assert from 'node:assert/strict';
import { test } from 'node:test';
import { observationReport } from '../public/health/results.js';

test('all skipped has no reassuring result',()=>{
 const r=observationReport([3,2,2,2],null,null);
 assert.match(r.heading,/尚無足夠資料/);
 assert.match(r.advice.join(''),/家人陪同/);
});
test('time and OSTAi use independent boundaries and do not cancel other findings',()=>{
 const baseline=observationReport([0,0,0,0],-1,'11.9');
 assert.equal(baseline.findings.length,0);
 assert.equal(observationReport([0,0,0,0],-1,'12.0').findings.length,1);
 const r=observationReport([2,1,1,1],-2,'21.0');
 assert.equal(r.findings.length,5);
 assert.match(r.advice.join(''),/骨密度/);
 assert.match(r.advice.join(''),/日期與身高/);
 assert.doesNotMatch(r.findings.join(''),/自行完成/);
});
test('every combination of supported observations yields a next step',()=>{
 for(let calf=0;calf<=3;calf++)for(let chair=0;chair<=2;chair++)for(let wall=0;wall<=2;wall++)for(let height=0;height<=2;height++)for(const index of [null,-2,-1]){
  const r=observationReport([calf,chair,wall,height],index,null);
  assert.ok(r.advice.length>0);
 }
});
