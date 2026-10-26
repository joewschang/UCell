const {test}=require('node:test'),assert=require('node:assert/strict');
const parameters=require('../packages/database/dist/parameter-snapshot'),history=require('../packages/database/dist/historical-replay');
const {capturePaymentReferral,paymentReferralForGpv}=require('../packages/database/dist/payment-referral-snapshot');
const {BONUS_TIMING_POLICY}=require('../packages/database/dist/bonus-timing-policy');
const paid=new Date('2026-10-27T01:00:00Z');
function setup(enabled=true){
 const calls=[],saved=new Map();
 const tx={runtimeRuleParameter:{findMany:async()=>enabled?[{runtimeRuleParameterId:'policy',parameterCode:'bonus.timing.policy',scopeKey:'*',valueJson:BONUS_TIMING_POLICY,effectiveFrom:new Date('2026-10-27'),effectiveTo:null}]:[]},historicalReplaySnapshot:{findUnique:async({where})=>saved.get(where.kind_sourceId.sourceId)??null,create:async({data})=>{saved.set(data.sourceId,data);return data}},packagePurchaseSnapshot:{findUnique:async()=>({packageClass:'QUALIFICATION'})},order:{findUniqueOrThrow:async()=>({paidAt:paid})}};
 return {tx,calls,saved};
}
test('payment snapshot uses payment time and later GPV reads the original frozen state',async()=>{
 const f=setup(),original=history.captureHistoricalGraph;let active=true;
 history.captureHistoricalGraph=async(_tx,qid,at)=>{f.calls.push(at.toISOString());return {sponsor:[{childQualificationId:qid,sponsorQualificationId:'s'}],at:at.toISOString(),active}};
 try{
  await capturePaymentReferral(f.tx,'order','q',paid,'R1.0B');active=false;
  const snapshot=await paymentReferralForGpv(f.tx,{sourceType:'ORDER',sourceId:'order',qualificationId:'q',occurredAt:new Date('2026-11-01'),ruleVersionCode:'R1.0B'});
  assert.equal(snapshot.evidence.active,true);assert.deepEqual(f.calls,[paid.toISOString()]);assert.equal(snapshot.at,paid.toISOString());
 }finally{history.captureHistoricalGraph=original}
});
test('missing payment snapshot fails instead of reconstructing from later qualifications',async()=>{
 const f=setup();await assert.rejects(paymentReferralForGpv(f.tx,{sourceType:'ORDER',sourceId:'missing',qualificationId:'q',occurredAt:paid,ruleVersionCode:'R1.0B'}));
});
test('pre-policy transactions retain their original recognition policy',async()=>{
 const f=setup(false);await capturePaymentReferral(f.tx,'old','q',paid,'R1.0B');assert.equal(f.saved.size,0);assert.equal(await paymentReferralForGpv(f.tx,{sourceType:'ORDER',sourceId:'old',occurredAt:paid,ruleVersionCode:'R1.0B'}),null);
});
test('qualification payment without a verified sponsor fails atomically',async()=>{
 const f=setup(),original=history.captureHistoricalGraph;history.captureHistoricalGraph=async()=>({sponsor:[]});
 try{await assert.rejects(capturePaymentReferral(f.tx,'order','q',paid,'R1.0B'));assert.equal(f.saved.size,0)}finally{history.captureHistoricalGraph=original}
});
