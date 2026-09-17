/** Management policy, independent of the frozen compensation rules. Change by new version. */
export const ANALYTICS_POLICY = {
  version: 'UCELL-MGMT-2026-09-v1', projectionVersion: 'analytics-v1', timezone: 'Asia/Taipei',
  activeDays: 30, lostDays: 90, generations: 12, freshnessSeconds: 900,
  smallSample: 5, elevatedRisk: .5, materialDecline: .10, growingImprovement: .05,
  growthTarget: .10,
  weights: { active: 25, repurchase: 20, growth: 15, risk: 15, balance: 10, depth: 10, engagement: 5 },
  qualifyingEvents: ['ORDER_PAID', 'REPURCHASE_RECOGNIZED'],
  denominatorZero: 'UNAVAILABLE',
  registrationBasis: 'Person.createdAt (record creation proxy; not legal enrollment date)',
  suspendNeverActivated: 'S / NEVER_ACTIVATED between >30 and <=90 days since record creation',
  repurchaseBasis: 'REPURCHASE order paid or subscription installment recognized in rolling 30 days',
  refundSemantics: 'A historical payment is engagement evidence even after a return; no net-sales inference',
} as const;

export const DAY = 86_400_000;
export type NaslState = 'N'|'A'|'S'|'L';
export type PersonFact = { id:string; joinedAt:string; closed:boolean; registered:boolean };
export type QualificationFact = { id:string; personId:string; createdAt:string; system:boolean; active:boolean };
export type ActivityFact = { id:string; personId:string; qualificationId:string; at:string; repurchase:boolean };
export type EdgeFact = { parent:string; child:string; side?:'LEFT'|'RIGHT' };
export type Facts = { persons:PersonFact[]; qualifications:QualificationFact[]; activities:ActivityFact[]; sponsor:EdgeFact[]; binary:EdgeFact[]; issues:string[] };
export type PersonState = { state:NaslState; reason:string; joinedMonth:string };
export const ratio = (n:number,d:number):number|null => d===0?null:n/d;
export const emptyCounts = ():Record<NaslState,number> => ({N:0,A:0,S:0,L:0});
export function monthKey(date:string):string {
  const parts = new Intl.DateTimeFormat('en', {timeZone:ANALYTICS_POLICY.timezone,year:'numeric',month:'2-digit'}).formatToParts(new Date(date));
  return `${parts.find(x=>x.type==='year')!.value}-${parts.find(x=>x.type==='month')!.value}`;
}
export function classifyNasl(person:PersonFact,lastActivity:string|undefined,asOf:string):PersonState {
  const age = (Date.parse(asOf)-Date.parse(person.joinedAt))/DAY;
  const idle = lastActivity===undefined?age:(Date.parse(asOf)-Date.parse(lastActivity))/DAY;
  if(!Number.isFinite(age)||age<0||!Number.isFinite(idle)||idle<0)throw new Error('INVALID_ANALYTICS_TIME');
  const result=(state:NaslState,reason:string):PersonState=>({state,reason,joinedMonth:monthKey(person.joinedAt)});
  if(person.closed)return result('L','RELATIONSHIP_CLOSED');
  if(lastActivity!==undefined&&idle<=30)return result('A','QUALIFYING_ACTIVITY_30D');
  if(age<=30)return result('N','NEW_NOT_YET_ACTIVE');
  if(idle<=90)return result('S',lastActivity?'PREVIOUSLY_ACTIVE':'NEVER_ACTIVATED');
  return result('L',lastActivity?'INACTIVE_OVER_90D':'NEVER_ACTIVATED_OVER_90D');
}

export function heat(active:number|null,repurchase:number|null,risk:number|null,n:number,delta:number|null=null) {
  if(n<ANALYTICS_POLICY.smallSample)return {label:'INSUFFICIENT_SAMPLE',reason:'FEWER_THAN_5_QUALIFICATIONS'};
  if(active===null||repurchase===null||risk===null)return {label:'UNAVAILABLE',reason:'MISSING_METRIC'};
  if(active<.30&&risk>=.5)return {label:'CRITICAL',reason:'ACTIVE_LT_30_AND_RISK_GE_50'};
  if(active<.40)return {label:'COLD',reason:'ACTIVE_LT_40'};
  if(active<.55||(delta!==null&&delta<=-.10))return {label:'COOLING',reason:'ACTIVE_LT_55_OR_DECLINE_10PP'};
  // HOT requires comparison evidence. High current values alone do not prove no negative trend.
  if(active>=.75&&repurchase>=.65&&delta!==null&&delta>-.10)return {label:'HOT',reason:'ACTIVE_GE_75_REPURCHASE_GE_65_NO_DECLINE'};
  return {label:'WATCH',reason:delta===null?'TREND_BASELINE_REQUIRED':'HOT_CRITERIA_NOT_MET'};
}

export function health(components:Record<keyof typeof ANALYTICS_POLICY.weights,number|null>) {
  const rows=Object.entries(ANALYTICS_POLICY.weights).map(([key,weight])=>({key,weight,value:components[key as keyof typeof components]}));
  const coverage=rows.filter(x=>x.value!==null).reduce((sum,x)=>sum+x.weight,0);
  return {components:rows,coverage,score:coverage===100?rows.reduce((sum,x)=>sum+x.value!*x.weight,0):null,
    reason:coverage===100?null:'INCOMPLETE_COMPONENTS_NO_REWEIGHTING'};
}

export type Generation = ReturnType<typeof generationMetrics>;
function generationMetrics(generation:number,qualifications:QualificationFact[],states:Record<string,PersonState>,recent:Set<string>,asOf:string) {
  const human=qualifications.filter(q=>!q.system), persons=[...new Set(human.map(q=>q.personId))];
  const known=persons.filter(p=>states[p]), counts=emptyCounts();for(const p of known)counts[states[p].state]++;
  const active=human.filter(q=>q.active).length, repurchase=human.filter(q=>recent.has(q.id)).length;
  const fresh=human.filter(q=>Date.parse(q.createdAt)>Date.parse(asOf)-30*DAY).length;
  const activeRate=ratio(active,human.length), repurchaseRate=ratio(repurchase,human.length);
  const riskRate=known.length===persons.length?ratio(counts.S+counts.L,persons.length):null;
  return {generation,qualificationCount:human.length,systemCount:qualifications.length-human.length,personCount:persons.length,
    classifiedPersonCount:known.length,nasl:counts,activeCount:active,activeRate,repurchaseCount:repurchase,repurchaseRate,
    newCount:fresh,newRate:ratio(fresh,human.length),riskRate,heat:heat(activeRate,repurchaseRate,riskRate,human.length),
    qualificationIds:human.map(q=>q.id).sort()};
}

export type Sonar = ReturnType<typeof buildSonar>;
export function buildSonar(root:string,tree:'sponsor'|'binary',facts:Facts,states:Record<string,PersonState>,asOf:string,previous?:{activeRate:number|null;newRate:number|null;repurchaseRate:number|null}) {
  const byId=new Map(facts.qualifications.map(q=>[q.id,q]));
  if(!byId.has(root))throw new Error('ROOT_NOT_FOUND');
  const children=new Map<string,EdgeFact[]>();
  for(const edge of facts[tree]){const list=children.get(edge.parent)??[];list.push(edge);children.set(edge.parent,list);}
  const recent=new Set(facts.activities.filter(a=>a.repurchase&&Date.parse(a.at)>=Date.parse(asOf)-30*DAY&&Date.parse(a.at)<=Date.parse(asOf)).map(a=>a.qualificationId));
  let frontier:Array<{id:string;side?:'LEFT'|'RIGHT'}>=[{id:root}];
  const visited=new Set([root]),all:QualificationFact[]=[],left:QualificationFact[]=[],right:QualificationFact[]=[],generations:Generation[]=[];
  for(let generation=1;generation<=12;generation++){
    const next:typeof frontier=[], rows:QualificationFact[]=[];
    for(const node of frontier)for(const edge of children.get(node.id)??[]){
      if(visited.has(edge.child))throw new Error('ORGANIZATION_CYCLE_OR_DUPLICATE');
      visited.add(edge.child);const q=byId.get(edge.child);if(!q)throw new Error('ORGANIZATION_DANGLING_EDGE');
      const side=node.side??edge.side;next.push({id:q.id,side});rows.push(q);all.push(q);
      if(side==='LEFT')left.push(q);if(side==='RIGHT')right.push(q);
    }
    generations.push(generationMetrics(generation,rows,states,recent,asOf));frontier=next;
  }
  const total=generationMetrics(0,all,states,recent,asOf), l=generationMetrics(0,left,states,recent,asOf),r=generationMetrics(0,right,states,recent,asOf);
  const balance=tree==='binary'?ratio(2*Math.min(l.qualificationCount,r.qualificationCount),l.qualificationCount+r.qualificationCount):null;
  const delta=previous?.activeRate!=null&&total.activeRate!==null?total.activeRate-previous.activeRate:null;
  const populated=generations.filter(g=>g.qualificationCount>0);
  const components={active:total.activeRate,repurchase:total.repurchaseRate,
    growth:total.newRate===null?null:Math.min(1,total.newRate/ANALYTICS_POLICY.growthTarget),
    risk:total.riskRate===null?null:1-total.riskRate,balance,
    depth:ratio(populated.filter(g=>g.activeRate!==null&&g.activeRate>=.55).length,populated.length),engagement:null};
  return {root,tree,generations,total,left:tree==='binary'?l:null,right:tree==='binary'?r:null,balance,
    activeRateDelta:delta,heat:heat(total.activeRate,total.repurchaseRate,total.riskRate,total.qualificationCount,delta),
    growing:previous?.newRate!=null&&previous?.repurchaseRate!=null&&total.newRate!==null&&total.repurchaseRate!==null
      ?total.newRate-previous.newRate>=.05&&total.repurchaseRate-previous.repurchaseRate>=.05:null,
    health:health(components),volume:{pv:null,rpv:null,epv:null,carry:null,reason:'AUTHORITATIVE_VOLUME_ADAPTER_NOT_CONNECTED'},
    sampleWarning:total.qualificationCount<5?'SMALL_SAMPLE':null};
}

export function buildNasl(facts:Facts,asOf:string,previous?:Record<string,PersonState>) {
  const last=new Map<string,string>();
  for(const activity of facts.activities){if(Date.parse(activity.at)>Date.parse(asOf))continue;const prev=last.get(activity.personId);if(!prev||activity.at>prev)last.set(activity.personId,activity.at);}
  const humanOwners=new Set(facts.qualifications.filter(q=>!q.system).map(q=>q.personId));
  const systemOwners=new Set(facts.qualifications.filter(q=>q.system).map(q=>q.personId));
  const included=facts.persons.filter(p=>(p.registered||humanOwners.has(p.id))&&(!systemOwners.has(p.id)||humanOwners.has(p.id)));
  const states:Record<string,PersonState>={},counts=emptyCounts(),cohorts:Record<string,{total:number;counts:Record<NaslState,number>}>= {};
  let neverActivated=0;
  for(const p of included){const state=classifyNasl(p,last.get(p.id),asOf);states[p.id]=state;counts[state.state]++;
    if(state.reason==='NEVER_ACTIVATED')neverActivated++;
    const cohort=cohorts[state.joinedMonth]??={total:0,counts:emptyCounts()};cohort.total++;cohort.counts[state.state]++;}
  const transitions:Record<string,number>={};let newEntrants=0,reactivated=0,becameLost=0,comparable=0,previousActive=0,retainedActive=0;
  const removed=previous?Object.keys(previous).filter(id=>!states[id]).length:0;
  if(previous)for(const [id,state] of Object.entries(states)){
    const old=previous[id];if(!old){newEntrants++;continue;}comparable++;
    transitions[`${old.state}->${state.state}`]=(transitions[`${old.state}->${state.state}`]??0)+1;
    if((old.state==='S'||old.state==='L')&&state.state==='A')reactivated++;
    if(old.state!=='L'&&state.state==='L')becameLost++;
    if(old.state==='A'){previousActive++;if(state.state==='A')retainedActive++;}
  }
  return {states,summary:{counts,total:included.length,excludedPersonRecords:facts.persons.length-included.length,neverActivated,
    rates:{N:ratio(counts.N,included.length),A:ratio(counts.A,included.length),S:ratio(counts.S,included.length),L:ratio(counts.L,included.length)},
    cohorts:Object.entries(cohorts).sort(([a],[b])=>a.localeCompare(b)).map(([month,c])=>({month,...c,activeRate:ratio(c.counts.A,c.total)})),
    transitions:previous?{matrix:transitions,comparable,newEntrants,removed,reactivated,becameLost,activeRetention:ratio(retainedActive,previousActive)}:null}};
}
