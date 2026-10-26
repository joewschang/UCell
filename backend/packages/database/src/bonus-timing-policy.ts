import {ParameterSnapshot} from './parameter-snapshot';

export const BONUS_TIMING_POLICY='WEEK_CLOSE_PAYMENT_SNAPSHOT_20261027';
export function bonusTimingEnabled(snapshot:ParameterSnapshot){
 return snapshot.parameters.some(p=>p.code==='bonus.timing.policy'&&p.scope==='*'&&p.value===BONUS_TIMING_POLICY);
}
/** All period intervals are [start,end); eligibility belongs to the closing period. */
export function closingEligibilityAt(end:Date,snapshot:ParameterSnapshot){
 return bonusTimingEnabled(snapshot)?new Date(end.getTime()-1):end;
}
/** Monday 00:00 Taipei closes the preceding Sunday, including on month boundaries. */
export function globalWeekEnds(start:Date,end:Date,firstClose?:string){
 const offset=8*3600000,day=86400000;
 const local=new Date(start.getTime()+offset);
 if(local.getUTCDate()!==1||local.getUTCHours()!==0||local.getUTCMinutes()!==0||local.getUTCSeconds()!==0||local.getUTCMilliseconds()!==0)throw Error('GLOBAL_MONTH_REQUIRED');
 const next=new Date(Date.UTC(local.getUTCFullYear(),local.getUTCMonth()+1,1)-offset);
 if(next.getTime()!==end.getTime())throw Error('GLOBAL_MONTH_REQUIRED');
 const result:Date[]=[];
 for(let sunday=start.getTime()+((7-local.getUTCDay())%7)*day;sunday<end.getTime();sunday+=7*day)result.push(new Date(sunday+day));
 return firstClose?result.filter(d=>d.getTime()>=new Date(firstClose).getTime()):result;
}

export function firstGlobalWeekClose(snapshot:ParameterSnapshot):string|undefined {
 const value=snapshot.parameters.find(p=>p.code==='global.weekly.firstClose'&&p.scope==='*')?.value;
 if(value===undefined)return undefined;
 if(typeof value!=='string'||!Number.isFinite(new Date(value).getTime()))throw Error('GLOBAL_FIRST_WEEK_INVALID');
 const local=new Date(new Date(value).getTime()+8*3600000);
 if(local.getUTCDay()!==1||local.getUTCHours()||local.getUTCMinutes()||local.getUTCSeconds()||local.getUTCMilliseconds())throw Error('GLOBAL_FIRST_WEEK_INVALID');
 return value;
}
