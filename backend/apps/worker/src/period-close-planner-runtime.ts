import {PrismaService} from '@ucell/database';
import {planDuePeriodJobs} from '@ucell/settlement';

export async function pollPeriodClosePlanner(db:PrismaService,environment:NodeJS.ProcessEnv=process.env){
  const enabled=environment.PERIOD_CLOSE_PLANNER_ENABLED;
  if(enabled===undefined||enabled==='false')return {enabled:false};
  if(enabled!=='true'||environment.PERIOD_CLOSE_WORKER_ENABLED!=='true')throw new Error('PERIOD_CLOSE_PLANNER_ENABLEMENT_INVALID');
  const result=await planDuePeriodJobs(db,{
    ruleVersionCode:environment.PERIOD_CLOSE_PLANNER_RULE_VERSION??'',from:new Date(environment.PERIOD_CLOSE_PLANNER_FROM??''),
    approvalReference:environment.PERIOD_CLOSE_PLANNER_APPROVAL_REFERENCE??'',
    maxPeriodsPerKind:environment.PERIOD_CLOSE_PLANNER_MAX_PERIODS_PER_KIND?Number(environment.PERIOD_CLOSE_PLANNER_MAX_PERIODS_PER_KIND):4,
  });
  return {enabled:true,...result};
}
