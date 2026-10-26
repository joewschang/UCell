const {test}=require('node:test'),assert=require('node:assert/strict');
const {SettlementCalendarService}=require('../packages/settlement/dist/settlement/settlement-calendar.service');
const {BONUS_TIMING_POLICY}=require('../packages/database/dist');
const {resolveSettlementWindow}=require('../packages/shared/dist');
function calendar(){
 const service=new SettlementCalendarService({});
 service.validate=(_p,kind)=>({period:{unit:['REFERRAL_K0','PAYABLE_PREPARATION'].includes(kind)?'SETTLEMENT_10_25':['GLOBAL','WELFARE'].includes(kind)?'MONTH':'WEEK'}});
 service.periodFor=async(_tx,at,_p,kind)=>{
  if(['REFERRAL_K0','PAYABLE_PREPARATION'].includes(kind))return resolveSettlementWindow(at);
  if(['BINARY_K1','MATCHING_K2'].includes(kind)){const anchor=Date.parse('2026-10-18T16:00:00Z'),start=anchor+Math.floor((at-anchor)/(7*86400000))*7*86400000;return {start:new Date(start),end:new Date(start+7*86400000)}}
  const t=new Date(+at+8*3600000);return {start:new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),1)-8*3600000),end:new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth()+1,1)-8*3600000)};
 };return service;
}
const first={code:'global.weekly.firstClose',scope:'*',value:'2026-10-25T16:00:00.000Z'};
test('first payable window does not require nonexistent prelaunch weekly settlements',async()=>{
 const rows=await calendar().preparationWindows({},new Date('2026-10-09T16:00:00Z'),new Date('2026-10-24T16:00:00Z'),{parameters:[first]});
 assert.deepEqual(rows.map(r=>r.kind),['REFERRAL_K0']);
});
test('next payable window includes intact Monday closes and the completed Global month',async()=>{
 const rows=await calendar().preparationWindows({},new Date('2026-10-24T16:00:00Z'),new Date('2026-11-09T16:00:00Z'),{parameters:[first,{code:'bonus.timing.policy',scope:'*',value:BONUS_TIMING_POLICY}]});
 assert.equal(rows.length,9);assert.deepEqual(rows.filter(r=>r.kind==='BINARY_K1').map(r=>r.periodEnd.toISOString()),['2026-10-25T16:00:00.000Z','2026-11-01T16:00:00.000Z','2026-11-08T16:00:00.000Z']);
 assert.equal(rows.find(r=>r.kind==='GLOBAL').periodEnd.toISOString(),'2026-10-31T16:00:00.000Z');
});
