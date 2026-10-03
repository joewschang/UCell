import assert from 'node:assert/strict';
import {evaluateQualificationInactivity} from '../apps/api/src/modules/qualification/qualification-inactivity.ts';
let passed=0;
function test(name,run){run();passed++;console.log('PASS',name);}
const months=Array.from({length:12},(_,i)=>({qualificationId:'q1',month:`2026-${String(i+1).padStart(2,'0')}`,active:false,finalized:true,revision:'rev1'}));
const evaluate=(rows, through='2026-12')=>evaluateQualificationInactivity('q1','2026-01',through,rows,'APPROVED_OVERLAY_A');
test('Twelve independent closed inactive months trigger recovery evaluation',()=>{const r=evaluate(months);assert.equal(r.recoveryEligible,true);assert.equal(r.recoveryMonth,'2026-12');});
test('Eleven months produce warning only',()=>{const r=evaluate(months,'2026-11');assert.equal(r.streak,11);assert.equal(r.recoveryEligible,false);assert.equal(r.snapshots.at(-1).notificationCode,'INACTIVE_FINAL_WARNING');});
test('Other qualification Active cannot reset this streak',()=>assert.equal(evaluate([...months,{...months[0],qualificationId:'q2',active:true}]).streak,12));
test('One Active month resets only selected Qualification',()=>{const r=evaluate(months.map(x=>x.month==='2026-06'?{...x,active:true}:x));assert.equal(r.streak,6);assert.equal(r.recoveryEligible,false);});
test('Missing unclosed and unknown evidence blocks recovery',()=>{for(const rows of [months.slice(1),months.map(x=>x.month==='2026-12'?{...x,finalized:false}:x),months.map(x=>x.month==='2026-12'?{...x,active:null}:x)]){assert.equal(evaluate(rows).status,'PENDING');assert.equal(evaluate(rows).recoveryEligible,false);}});
test('Replay revised Active evidence removes prior eligibility',()=>assert.equal(evaluate(months.map(x=>x.month==='2026-02'?{...x,active:true,revision:'return-replay-2'}:x)).recoveryEligible,false));
test('Duplicate months rejected',()=>assert.throws(()=>evaluate([...months,months[0]]),/AMBIGUOUS/));
test('Recovery boundary remains recorded when later Active appears',()=>{const later={...months[0],month:'2027-01',active:true};assert.equal(evaluate([...months,later],'2027-01').recoveryMonth,'2026-12');});
console.log(`R11_INACTIVITY_PASS ${passed} cases`);
