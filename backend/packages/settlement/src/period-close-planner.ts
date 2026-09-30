import {PeriodCloseKind,captureParameters,enqueuePeriodCloseJob} from '@ucell/database';
import {SettlementCalendarService} from './settlement/settlement-calendar.service';

export type PeriodPlannerInput={ruleVersionCode:string;from:Date;approvalReference:string;maxPeriodsPerKind?:number;through?:Date};
const kinds:PeriodCloseKind[]=['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE','PAYABLE_PREPARATION'];
const errorCode=(error:any)=>{
  const value=error?.getResponse?.()?.code??error?.code??error?.message;
  return typeof value==='string'&&/^[A-Z][A-Z0-9_]{2,79}$/.test(value)?value:'PERIOD_CLOSE_PLANNER_FAILED';
};

/** Bounded discovery inside the existing Worker; durable jobs remain the authority. */
export async function planDuePeriodJobs(db:Parameters<typeof enqueuePeriodCloseJob>[0],input:PeriodPlannerInput){
  const through=input.through??new Date(),limit=input.maxPeriodsPerKind??4;
  if(!input.ruleVersionCode?.trim()||!input.approvalReference?.trim()||!Number.isFinite(input.from.getTime())||!Number.isFinite(through.getTime())||through>new Date()||!Number.isInteger(limit)||limit<1||limit>52)throw new Error('PERIOD_CLOSE_PLANNER_CONFIGURATION_INVALID');
  const result={admitted:0,replayed:0,waiting:0,failures:[] as Array<{kind:string;code:string}>};
  const calendar=new SettlementCalendarService(db as any);
  for(const kind of kinds)try{
    const key={ruleVersionCode:input.ruleVersionCode,kind};
    let cursor=await db.periodClosePlannerCursor.findUnique({where:{ruleVersionCode_kind:key}});
    if(!cursor){
      const snapshot=await captureParameters(db,input.from,input.ruleVersionCode);
      const canonical=calendar.validate(snapshot,'PAYABLE_PREPARATION').period.unit==='SETTLEMENT_10_25';
      const first=await calendar.periodFor(db,canonical&&!['REFERRAL_K0','PAYABLE_PREPARATION'].includes(kind)?new Date(input.from.getTime()-1):input.from,snapshot,kind);
      cursor=await db.periodClosePlannerCursor.upsert({where:{ruleVersionCode_kind:key},update:{},create:{...key,configuredFrom:input.from,approvalReference:input.approvalReference,nextPeriodStart:first.start}});
    }
    if(cursor.configuredFrom.getTime()!==input.from.getTime()||cursor.approvalReference!==input.approvalReference)throw new Error('PERIOD_CLOSE_PLANNER_CONFIGURATION_CONFLICT');
    for(let count=0;count<limit;count++){
      const snapshot=await captureParameters(db,cursor.nextPeriodStart,input.ruleVersionCode);
      const period=await calendar.periodFor(db,cursor.nextPeriodStart,snapshot,kind);
      if(period.start.getTime()!==cursor.nextPeriodStart.getTime())throw new Error('PERIOD_CLOSE_PLANNER_CALENDAR_CHANGED');
      if(period.end>through){result.waiting++;break;}
      const identity={kind,periodStart:period.start,periodEnd:period.end,ruleVersionCode:input.ruleVersionCode};
      const prior=await db.periodCloseJob.findUnique({where:{kind_periodStart_periodEnd_ruleVersionCode:identity}});
      if(prior)result.replayed++;
      else{
        // Validate the real approved cutoff even when a caller supplies an older discovery horizon.
        const parameters=await calendar.captureForPeriod(db,period.start,period.end,kind,input.ruleVersionCode);
        if(new Date(parameters.effectiveAt)>through){result.waiting++;break;}
        const required=kind==='MATCHING_K2'?['BINARY_K1']:kind==='WELFARE'?['GLOBAL']:kind==='PAYABLE_PREPARATION'?kinds.filter(row=>row!=='PAYABLE_PREPARATION'):[];
        const windows=kind==='PAYABLE_PREPARATION'?await calendar.preparationWindows(db,period.start,period.end,parameters):null;
        const dependencies=required.length?await db.periodCloseJob.findMany({where:{ruleVersionCode:input.ruleVersionCode,...(windows?{OR:windows}:{kind:{in:required},periodStart:{gte:period.start},periodEnd:{lte:period.end}})},orderBy:[{kind:'asc'},{periodStart:'asc'}]}):[];
        await enqueuePeriodCloseJob(db,{...identity,prerequisiteIds:dependencies.map(row=>row.periodCloseJobId),requestedBy:'WORKER_PERIOD_PLANNER',approvalReference:input.approvalReference},tx=>calendar.captureForPeriod(tx,period.start,period.end,kind,input.ruleVersionCode),undefined,(tx,request,pinned,parents)=>calendar.validatePreparationDependencies(tx,request,pinned,parents));
        result.admitted++;
      }
      // A crash before this checkpoint only revisits an already-durable manifest.
      const advanced=await db.periodClosePlannerCursor.updateMany({where:{...key,nextPeriodStart:period.start},data:{nextPeriodStart:period.end}});
      if(!advanced.count)break;
      cursor={...cursor,nextPeriodStart:period.end};
    }
  }catch(error){
    const code=errorCode(error);
    if(['SETTLEMENT_CUTOFF_NOT_REACHED','PERIOD_CLOSE_BINARY_REQUIRED','PERIOD_CLOSE_GLOBAL_REQUIRED','PERIOD_CLOSE_PAYABLE_COVERAGE_REQUIRED'].includes(code))result.waiting++;
    else result.failures.push({kind,code});
  }
  return result;
}
