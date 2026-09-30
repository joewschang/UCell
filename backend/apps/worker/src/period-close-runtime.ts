import {Prisma,PrismaService,claimPeriodCloseJob,processPeriodCloseJob,releaseFailedOutboxLease,periodCloseInputState} from '@ucell/database';
import {executePeriodClose} from '@ucell/settlement';

async function inputsReady(db:Pick<Prisma.TransactionClient,'outboxEvent'|'monthlyRecognitionSchedule'>,job:{periodEnd:Date;ruleVersionCode:string}){
  // Conservative barrier: unresolved economic source events block all closes.
  return (await periodCloseInputState(db,job)).ready;
}

export async function pollPeriodCloseJobs(db:PrismaService,environment:NodeJS.ProcessEnv=process.env,execute=executePeriodClose){
  const enabled=environment.PERIOD_CLOSE_WORKER_ENABLED;
  if(enabled===undefined||enabled==='false')return {enabled:false,completed:0,blocked:0,failed:0};
  if(enabled!=='true')throw new Error('PERIOD_CLOSE_ENABLEMENT_INVALID');
  const candidates=await db.$queryRaw<Array<{period_close_job_id:string}>>`
    SELECT j.period_close_job_id FROM integration.period_close_job j
    JOIN integration.outbox_event o ON o.outbox_event_id=j.outbox_event_id
    WHERE o.event_type='PERIOD_CLOSE_REQUESTED' AND o.process_status::text IN ('PENDING','PROCESSING') AND o.available_at<=now()
      AND NOT EXISTS (SELECT 1 FROM subscription.monthly_recognition_schedule s
        WHERE s.rule_version_code=j.rule_version_code AND s.due_at<j.period_end AND s.status::text IN ('SCHEDULED','DUE'))
      AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements_text(j.prerequisite_ids) p(id)
        WHERE NOT EXISTS (SELECT 1 FROM integration.period_close_receipt r WHERE r.period_close_job_id=p.id::uuid))
      AND (j.kind<>'PAYABLE_PREPARATION' OR NOT EXISTS (
        SELECT 1 FROM ledger.bonus_award a LEFT JOIN ledger.settlement_batch b ON b.settlement_batch_id=a.settlement_batch_id
        WHERE a.rule_version_code=j.rule_version_code AND a.payable_amount>0 AND a.pending_until>now()
          AND NOT EXISTS (SELECT 1 FROM ledger.award_economic_destination d WHERE d.source_bonus_award_id=a.bonus_award_id)
          AND ((b.settlement_batch_id IN (SELECT r.source_id FROM integration.period_close_receipt r
              WHERE r.period_close_job_id IN (SELECT p.id::uuid FROM jsonb_array_elements_text(j.prerequisite_ids) p(id))))
            OR (a.settlement_batch_id IS NULL AND a.occurred_at>=j.period_start AND a.occurred_at<j.period_end))))
    ORDER BY o.available_at,j.period_close_job_id LIMIT 20`;
  const result={enabled:true,completed:0,blocked:0,failed:0};
  for(const candidate of candidates){
    const job=await db.periodCloseJob.findUniqueOrThrow({where:{periodCloseJobId:candidate.period_close_job_id}});
    if(!await inputsReady(db,job)){result.blocked++;continue;}
    const lease=await claimPeriodCloseJob(db,job.periodCloseJobId);
    if(!lease)continue;
    try{
      const outcome=await processPeriodCloseJob(db,lease,async(tx,row)=>{
        if(!await inputsReady(tx,row))throw new Error('PERIOD_CLOSE_INPUTS_PENDING');
        return execute(tx,row);
      });
      if('snapshotId' in outcome)result.completed++;
      else if('blocked' in outcome)result.blocked++;
    }catch(error){
      // Keep arbitrary engine details out of operational error strings.
      await releaseFailedOutboxLease(db,lease,new Error('PERIOD_CLOSE_EXECUTION_FAILED'));
      result.failed++;
    }
  }
  return result;
}
