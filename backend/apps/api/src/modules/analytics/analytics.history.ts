import { BadRequestException } from '@nestjs/common';
import { ANALYTICS_POLICY, DAY, PersonState } from './analytics.policy';

export type HistoryInput={from?:string;to?:string;policyVersion?:string};
export const localDate=(at:Date)=>new Date(at.getTime()+8*60*60_000).toISOString().slice(0,10);
function parseDate(value:string):Date {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number(value.slice(0,4))<1970)throw new BadRequestException('DATE_YYYY_MM_DD_REQUIRED_FROM_1970');
  const at=new Date(`${value}T00:00:00+08:00`);
  if(!Number.isFinite(at.getTime())||localDate(at)!==value)throw new BadRequestException('INVALID_CALENDAR_DATE');
  return at;
}
export function historyRange(input:HistoryInput={},now=new Date()) {
  if(!!input.from!==!!input.to)throw new BadRequestException('FROM_AND_TO_REQUIRED_TOGETHER');
  const tomorrow=new Date(parseDate(localDate(now)).getTime()+DAY);
  const to=input.to?parseDate(input.to):tomorrow;
  const from=input.from?parseDate(input.from):new Date(to.getTime()-90*DAY);
  if(from>=to||to.getTime()-from.getTime()>366*DAY)throw new BadRequestException('DATE_RANGE_MUST_BE_1_TO_366_DAYS');
  if(to>tomorrow)throw new BadRequestException('FUTURE_OBSERVATION_RANGE_NOT_ALLOWED');
  const policyVersion=input.policyVersion??ANALYTICS_POLICY.version;
  if(!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(policyVersion))throw new BadRequestException('INVALID_POLICY_VERSION');
  return {from,to,policyVersion,timezone:'Asia/Taipei',fromDate:localDate(from),toDateExclusive:localDate(to)};
}
export const addMonths=(month:string,offset:number)=>{const [year,m]=month.split('-').map(Number);return new Date(Date.UTC(year,m-1+offset,1)).toISOString().slice(0,7);};
export const monthEndDate=(month:string)=>new Date(Date.parse(`${addMonths(month,1)}-01T00:00:00Z`)-DAY).toISOString().slice(0,10);
export type CohortObservation={asOf:string;policyVersion:string;states:Record<string,PersonState>};

/** Fixed cohort population captured on the final Taipei calendar day of its join month. */
export function cohortRetention(observations:CohortObservation[],range:ReturnType<typeof historyRange>,now=new Date()) {
  const monthly=new Map<string,CohortObservation>();
  for(const row of observations){
    const time=new Date(row.asOf),date=localDate(time),month=date.slice(0,7);
    if(row.policyVersion!==range.policyVersion||time<range.from||time>=range.to||time>now||date!==monthEndDate(month))continue;
    if(!monthly.has(month)||Date.parse(monthly.get(month)!.asOf)<time.getTime())monthly.set(month,row);
  }
  const currentMonth=localDate(now).slice(0,7),lastMonth=localDate(new Date(range.to.getTime()-1)).slice(0,7);
  const rows=[];
  for(let month=range.fromDate.slice(0,7);month<=lastMonth;month=addMonths(month,1)){
    const baseline=month<currentMonth?monthly.get(month):undefined;
    const ids=baseline?Object.keys(baseline.states).filter(id=>baseline.states[id].joinedMonth===month):[];
    const activeIds=ids.filter(id=>baseline!.states[id].state==='A');
    const cells=Array.from({length:13},(_,age)=>{
      const observationMonth=addMonths(month,age),observation=monthly.get(observationMonth);
      const blank=(status:string)=>({age,observationMonth,status,asOf:null as string|null,observed:0,missing:ids.length,activeCount:null as number|null,activeShare:null as number|null,activeRetention:null as number|null});
      if(observationMonth>=currentMonth)return blank('MONTH_NOT_CLOSED');
      if(observationMonth>lastMonth)return blank('OUTSIDE_QUERY_RANGE');
      if(!baseline)return blank('BASELINE_NOT_OBSERVED');
      if(!ids.length)return blank('EMPTY_COHORT');
      if(!observation)return blank('MONTH_END_NOT_OBSERVED');
      const tracked=ids.filter(id=>observation.states[id]);
      const activeCount=tracked.filter(id=>observation.states[id].state==='A').length;
      const missing=ids.length-tracked.length;
      // Missing people are neither deleted from the denominator nor declared lost/retained.
      return {age,observationMonth,status:missing?'PARTIAL':'AVAILABLE',asOf:observation.asOf,observed:tracked.length,missing,activeCount,
        activeShare:missing?null:activeCount/ids.length,
        activeRetention:missing||!activeIds.length?null:activeIds.filter(id=>observation.states[id]?.state==='A').length/activeIds.length};
    });
    rows.push({cohortMonth:month,baselineAsOf:baseline?.asOf??null,baselineSize:baseline?ids.length:null,baselineActive:baseline?activeIds.length:null,cells});
  }
  return {metricVersion:'COHORT_FIXED_MONTH_END_V1',policyVersion:range.policyVersion,timezone:range.timezone,from:range.fromDate,toExclusive:range.toDateExclusive,
    basis:'LAST_CAPTURE_ON_FINAL_LOCAL_DAY_NO_BACKFILL',rows};
}
