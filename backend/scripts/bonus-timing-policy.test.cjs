const {test}=require('node:test'),assert=require('node:assert/strict');
const {Prisma,globalWeekEnds,weeklyGlobalBasis,closingEligibilityAt,BONUS_TIMING_POLICY,periodGlobal}=require('../packages/database/dist');
const d=x=>new Prisma.Decimal(x),start=new Date('2026-09-30T16:00:00Z'),end=new Date('2026-10-31T16:00:00Z');
const parameters={parameters:[{code:'binary.pair.rate',scope:'*',value:'0.12'},{code:'pool.binary.rate',scope:'*',value:'0.0001'},{code:'bonus.timing.policy',scope:'*',value:BONUS_TIMING_POLICY}]};
function fixture(){
 const effective=new Map(),weeks=[];
 for(const [i,close] of globalWeekEnds(start,end).entries()){
  const sources=['LEFT','RIGHT'].map(side=>{const id=i+side,amount=i===0?(side==='LEFT'?1000:100):i===1?(side==='LEFT'?0:1000):0;effective.set(id,d(amount));return {sourceId:id,inputs:{qualificationId:id,volume:String(amount)},evidence:{binary:[{childQualificationId:id,parentQualificationId:'q',side}]}}});
  weeks.push({kind:'BINARY_K1',parameters,recipients:[{key:'award'+i,qualificationId:'q'}],inputs:{periodStart:new Date(close-7*86400000).toISOString(),periodEnd:close.toISOString()},evidence:{sources,carryRecipients:[{qualificationId:'q',qualification:{plan:{},status:{}},active:true,leftCarryIn:'0',rightCarryIn:'0',weeklyCapSnapshot:'300'}]}});
 }
 return {weeks,effective};
}
test('October has four Sunday closes and November has five',()=>{assert.equal(globalWeekEnds(start,end).length,4);assert.equal(globalWeekEnds(end,new Date('2026-11-30T16:00:00Z')).length,5)});
test('month-ending Sunday belongs to preceding month, not execution month',()=>{const ends=globalWeekEnds(new Date('2026-04-30T16:00:00Z'),new Date('2026-05-31T16:00:00Z'));assert.equal(ends.at(-1).toISOString(),'2026-05-31T16:00:00.000Z')});
test('weekly pairing carries forward, respects cap, ignores pool shrink coefficient',()=>{const f=fixture(),b=weeklyGlobalBasis(f.weeks,f.effective,start,end);assert.equal(b.paired.get('q').toString(),'1000');assert.equal(b.total.toString(),'2100')});
test('company source pool does not sum ancestor pairs',()=>{const f=fixture();for(const w of f.weeks){w.evidence.carryRecipients.push({...w.evidence.carryRecipients[0],qualificationId:'parent'});w.recipients.push({key:'p',qualificationId:'parent'});for(const s of w.evidence.sources)s.evidence.binary.push({childQualificationId:'q',parentQualificationId:'parent',side:'LEFT'})}assert.equal(weeklyGlobalBasis(f.weeks,f.effective,start,end).total.toString(),'2100')});
test('return recomputes carry and subsequent week pair volumes',()=>{const f=fixture();f.effective.set('0LEFT',d(400));assert.equal(weeklyGlobalBasis(f.weeks,f.effective,start,end).paired.get('q').toString(),'400')});
test('missing final week blocks Global instead of publishing partial totals',()=>{const f=fixture();assert.throws(()=>weeklyGlobalBasis(f.weeks.slice(0,-1),f.effective,start,end))});
test('duplicate week blocks Global',()=>{const f=fixture();assert.throws(()=>weeklyGlobalBasis([f.weeks[0],...f.weeks],f.effective,start,end))});
test('broken carry chain blocks Global',()=>{const f=fixture();f.weeks[1].inputs.periodStart='2026-10-05T00:00:00.000Z';assert.throws(()=>weeklyGlobalBasis(f.weeks,f.effective,start,end))});
test('period eligibility uses Sunday/month closing state, historical policy stays unchanged',()=>{assert.equal(closingEligibilityAt(end,parameters).toISOString(),'2026-10-31T15:59:59.999Z');assert.equal(closingEligibilityAt(end,{parameters:[]}).getTime(),end.getTime())});
test('invalid monthly boundary is rejected',()=>assert.throws(()=>globalWeekEnds(new Date('2026-10-02'),end)));
test('Global replay reduces monthly rights after a return using original weekly snapshots',()=>{
 const f=fixture();const levels=['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN'];const p={parameters:[{code:'pool.global.rate',scope:'*',value:'0.05'},...levels.flatMap((level,i)=>[{code:'global.rank.pool_rate',scope:level,value:'0.01'},{code:'global.rank.weak_threshold',scope:level,value:i?'2000':'500'}])]};
 const envelope={parameters:p,inputs:{periodStart:start.toISOString(),periodEnd:end.toISOString()},evidence:{binary:[],weeks:f.weeks,sources:f.weeks.flatMap(w=>w.evidence.sources)},recipients:[{key:'global',qualificationId:'q',active:true,eligible:true,detail:{rank:'NEW_STAR'}}]};
 assert.equal(periodGlobal(envelope,f.effective).payables.get('global').toString(),'21');f.effective.set('0LEFT',d(400));assert.equal(periodGlobal(envelope,f.effective).payables.get('global').toString(),'0');
});

test('prelaunch empty weeks can be excluded only by an explicit first-close parameter',()=>{
 const f=fixture(),last=f.weeks.at(-1);assert.equal(weeklyGlobalBasis([last],f.effective,start,end,last.inputs.periodEnd).total.toString(),'0');
});
