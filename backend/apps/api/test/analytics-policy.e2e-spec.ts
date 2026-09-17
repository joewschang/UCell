import { ANALYTICS_POLICY, DAY, Facts, PersonFact, buildNasl, buildSonar, classifyNasl, health, heat, monthKey, ratio } from '../src/modules/analytics/analytics.policy';
import { freshness, requireUuid } from '../src/modules/analytics/analytics.service';

const at='2026-09-18T00:00:00.000Z';
const ago=(days:number)=>new Date(Date.parse(at)-days*DAY).toISOString();
const person=(days=120):PersonFact=>({id:'p',joinedAt:ago(days),closed:false,registered:true});
const facts=():Facts=>({persons:[person()],qualifications:[{id:'root',personId:'p',createdAt:ago(120),system:false,active:true}],activities:[],sponsor:[],binary:[],issues:[]});

describe('Versioned management analytics',()=>{
  test.each([[0,undefined,'N'],[30,undefined,'N'],[30+1/DAY,undefined,'S'],[90,undefined,'S'],[90+1/DAY,undefined,'L'],[120,30,'A'],[120,30+1/DAY,'S'],[120,90,'S'],[120,90+1/DAY,'L']])('NASL registration %s / activity %s => %s',(joined,idle,state)=>{
    expect(classifyNasl(person(joined),idle===undefined?undefined:ago(idle),at).state).toBe(state);
  });
  test('closure wins; registration is not activity; never-activated reason is explicit',()=>{
    expect(classifyNasl({...person(),closed:true},ago(0),at).state).toBe('L');
    expect(classifyNasl(person(45),undefined,at).reason).toBe('NEVER_ACTIVATED');
    expect(()=>classifyNasl(person(-1),undefined,at)).toThrow('INVALID_ANALYTICS_TIME');
  });
  test('Taipei cohort boundary and zero denominators',()=>{
    expect(monthKey('2026-08-31T16:00:00.000Z')).toBe('2026-09');
    expect(ratio(0,0)).toBeNull();expect(ratio(0,2)).toBe(0);
  });
  test.each([[.29,.5,'CRITICAL'],[.30,.5,'COLD'],[.399,.4,'COLD'],[.4,.4,'COOLING'],[.55,.4,'WATCH'],[.75,.1,'HOT']])('heat threshold %s/%s',(active,risk,label)=>{
    expect(heat(active,.65,risk,5,0).label).toBe(label);
  });
  test('small samples and missing comparison never imply a healthy organization',()=>{
    expect(heat(.9,.9,.1,4,0).label).toBe('INSUFFICIENT_SAMPLE');
    expect(heat(.9,.9,.1,5).label).toBe('WATCH');
    expect(heat(.9,.9,.1,5,-.1).label).toBe('COOLING');
    expect(heat(.9,null,.1,5,0).label).toBe('UNAVAILABLE');
  });
  test('missing health components stay missing; original weights are never reallocated',()=>{
    const full={active:1,repurchase:1,growth:1,risk:1,balance:1,depth:1,engagement:1};
    expect(health(full).score).toBe(100);
    expect(health({...full,engagement:null})).toMatchObject({coverage:95,score:null});
    expect(Object.values(ANALYTICS_POLICY.weights).reduce((a,b)=>a+b,0)).toBe(100);
  });
  test('same Person owning multiple balls is counted once; system-only person excluded',()=>{
    const f=facts();f.persons.push({...person(),id:'system'});f.qualifications.push({...f.qualifications[0],id:'second'},{...f.qualifications[0],id:'sys',personId:'system',system:true});
    f.activities.push({id:'paid',personId:'p',qualificationId:'root',at:ago(5),repurchase:false});
    const result=buildNasl(f,at);expect(result.summary).toMatchObject({total:1,counts:{N:0,A:1,S:0,L:0},excludedPersonRecords:1});
    expect(result.summary.transitions).toBeNull();
  });
  test('idempotent duplicate and out-of-order activity does not change results; future excluded',()=>{
    const f=facts();const a={id:'a',personId:'p',qualificationId:'root',at:ago(10),repurchase:false};
    f.activities=[a,{...a,id:'b',at:ago(40)}];const result=buildNasl(f,at);
    f.activities=[...f.activities.reverse(),a,{...a,id:'future',at:ago(-1)}];expect(buildNasl(f,at)).toEqual(result);
  });
  test('transition counts use common people and do not label new entrants as reactivations',()=>{
    const f=facts();const previous=buildNasl(f,at).states;
    f.activities=[{id:'a',personId:'p',qualificationId:'root',at:ago(1),repurchase:false}];
    f.persons.push({...person(1),id:'new'});
    expect(buildNasl(f,at,previous).summary.transitions).toMatchObject({matrix:{'L->A':1},newEntrants:1,reactivated:1,comparable:1});
  });
  test('exactly 12 generations; root excluded; binary and Sponsor trees independent',()=>{
    const f=facts();for(let i=1;i<=13;i++){f.qualifications.push({...f.qualifications[0],id:`q${i}`});f.sponsor.push({parent:i===1?'root':`q${i-1}`,child:`q${i}`});}
    f.binary=[{parent:'root',child:'q13',side:'RIGHT'}];const states=buildNasl(f,at).states;
    const s=buildSonar('root','sponsor',f,states,at);expect(s.generations).toHaveLength(12);expect(s.total.qualificationCount).toBe(12);expect(s.total.personCount).toBe(1);expect(s.total.qualificationIds).not.toContain('q13');
    const b=buildSonar('root','binary',f,states,at);expect(b.total.qualificationCount).toBe(1);expect(b.left?.qualificationCount).toBe(0);expect(b.balance).toBe(0);expect(b.generations[1].activeRate).toBeNull();
  });
  test('cycles fail closed, not hidden by truncation; system balls do not inflate human rates',()=>{
    const f=facts();f.qualifications.push({...f.qualifications[0],id:'sys',system:true});f.sponsor=[{parent:'root',child:'sys'}];
    let report=buildSonar('root','sponsor',f,buildNasl(f,at).states,at);expect(report.total).toMatchObject({qualificationCount:0,systemCount:1,activeRate:null});
    f.sponsor.push({parent:'sys',child:'root'});expect(()=>buildSonar('root','sponsor',f,{},at)).toThrow('CYCLE');
  });
  test('repurchase cutoff is inclusive at 30 days, and person Active is not qualification Active',()=>{
    const f=facts();f.qualifications.push({...f.qualifications[0],id:'q',active:false});f.sponsor=[{parent:'root',child:'q'}];
    f.activities=[{id:'r',personId:'p',qualificationId:'q',at:ago(30),repurchase:true}];
    const states=buildNasl(f,at).states,report=buildSonar('root','sponsor',f,states,at);expect(states.p.state).toBe('A');expect(report.total.activeRate).toBe(0);expect(report.total.repurchaseRate).toBe(1);
  });
  test('freshness boundary and UUID input rejection',()=>{
    expect(freshness(new Date(Date.parse(at)-900000),new Date(at)).status).toBe('AVAILABLE');
    expect(freshness(new Date(Date.parse(at)-901000),new Date(at)).status).toBe('STALE');
    expect(()=>requireUuid("' OR true --")).toThrow();expect(()=>requireUuid(undefined as any)).toThrow();
  });
});
