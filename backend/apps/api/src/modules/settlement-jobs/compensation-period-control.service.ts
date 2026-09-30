import {BadRequestException,Injectable} from '@nestjs/common';
import {Prisma,PrismaService,periodBonusAwardWhere,periodCloseInputState} from '@ucell/database';
import {createHash} from 'node:crypto';
import {compensationPeriodEvidence} from './compensation-period-evidence';
import {compensationVolumeEvidence} from './compensation-volume-evidence';

type Input={periodStart:string;periodEnd:string;ruleVersionCode:string};
type AgingInput={thresholdHours:number;asOf?:string};
const safe=(kind:string,id:string)=>`${kind}-${createHash('sha256').update(`${kind}:${id}`).digest('hex').slice(0,20)}`;
const amount=(value:Prisma.Decimal|null|undefined)=>value?.toFixed(4)??'0.0000';
const failureCode=(value:string|null|undefined)=>value&&/^[A-Z][A-Z0-9_]{2,63}$/.test(value)?value:'PERIOD_CLOSE_FAILED';
function confirmedPaid(results:Array<{payoutLineId:string;resultStatus:string;paidAmount:Prisma.Decimal}>){
 const byLine=new Map<string,Prisma.Decimal>();
 for(const result of results)if(result.resultStatus==='PAID'&&result.payoutLineId)byLine.set(result.payoutLineId,Prisma.Decimal.max(byLine.get(result.payoutLineId)??0,result.paidAmount));
 return [...byLine.values()].reduce((sum,value)=>sum.add(value),new Prisma.Decimal(0));
}
function parse(input:Input){
 const periodStart=new Date(input.periodStart),periodEnd=new Date(input.periodEnd),ruleVersionCode=input.ruleVersionCode?.trim();
 if(!Number.isFinite(periodStart.getTime())||!Number.isFinite(periodEnd.getTime())||periodStart>=periodEnd)throw new BadRequestException({code:'COMPENSATION_PERIOD_INVALID'});
 if(!ruleVersionCode||ruleVersionCode.length>100)throw new BadRequestException({code:'COMPENSATION_RULE_VERSION_INVALID'});
 return {periodStart,periodEnd,ruleVersionCode};
}

@Injectable()
export class CompensationPeriodControlService{
 constructor(private readonly db:PrismaService){}
 async aging(input:AgingInput){
  if(!Number.isInteger(input.thresholdHours)||input.thresholdHours<1||input.thresholdHours>8760)throw new BadRequestException({code:'COMPENSATION_AGING_THRESHOLD_INVALID'});
  const asOf=input.asOf?new Date(input.asOf):new Date();
  if(!Number.isFinite(asOf.getTime()))throw new BadRequestException({code:'COMPENSATION_AGING_AS_OF_INVALID'});
  const cutoff=new Date(asOf.getTime()-input.thresholdHours*3600000);
  const rows=await this.db.$queryRaw<Array<{category:string;item_count:bigint;amount:Prisma.Decimal|null;oldest_at:Date|null}>>`
   WITH aging_items AS (
    SELECT 'MATURED_AWARD_NOT_PAYABLE'::text category,a.pending_until anchor_at,a.payable_amount amount
    FROM ledger.bonus_award a WHERE a.pending_until<=${cutoff} AND a.payable_amount>0
      AND EXISTS (SELECT 1 FROM ledger.bonus_award_lifecycle_event l WHERE l.bonus_award_id=a.bonus_award_id AND l.status='EFFECTIVE')
      AND NOT EXISTS (SELECT 1 FROM ledger.award_economic_destination d WHERE d.source_bonus_award_id=a.bonus_award_id)
      AND NOT EXISTS (SELECT 1 FROM ledger.payable_entry p WHERE p.source_type='BONUS_AWARD' AND p.source_id=a.bonus_award_id)
    UNION ALL
    SELECT 'MATURED_AWARD_NOT_PAYABLE',a.occurred_at,a.payable_amount FROM ledger.rpv_upline_award_event a
      WHERE a.occurred_at<=${cutoff} AND a.payable_amount>0
      AND NOT EXISTS (SELECT 1 FROM ledger.award_economic_destination d WHERE d.source_rpv_award_id=a.rpv_award_event_id)
      AND NOT EXISTS (SELECT 1 FROM ledger.payable_entry p WHERE p.source_type='RPV_UPLINE_AWARD' AND p.source_id=a.rpv_award_event_id)
    UNION ALL
    SELECT 'MATURED_AWARD_NOT_PAYABLE',s.period_end,a.payable_amount FROM ledger.global_pool_award a
      JOIN ledger.global_pool_settlement s ON s.global_pool_settlement_id=a.global_pool_settlement_id
      WHERE s.period_end<=${cutoff} AND a.payable_amount>0
      AND NOT EXISTS (SELECT 1 FROM ledger.award_economic_destination d WHERE d.source_global_award_id=a.global_pool_award_id)
      AND NOT EXISTS (SELECT 1 FROM ledger.payable_entry p WHERE p.source_type='GLOBAL_POOL_AWARD' AND p.source_id=a.global_pool_award_id)
    UNION ALL
    SELECT 'PAYABLE_NOT_BATCHED',p.available_at,p.gross_amount FROM ledger.payable_entry p
      WHERE p.status='OPEN' AND p.payout_line_id IS NULL AND p.available_at<=${cutoff}
    UNION ALL
    SELECT 'PAYOUT_EXPORTED_UNRESOLVED',b.exported_at,b.total_net FROM ledger.payout_batch b
      WHERE b.exported_at IS NOT NULL AND b.exported_at<=${cutoff} AND b.status IN ('EXPORTED','PROCESSING','PARTIALLY_PAID','FAILED')
    UNION ALL
    SELECT 'BANK_TRANSFER_FAILED',r.occurred_at,r.paid_amount FROM ledger.payout_payment_result r
      WHERE r.result_status='FAILED' AND r.occurred_at<=${cutoff}
    UNION ALL
    SELECT 'RECOVERY_OUTSTANDING',r.occurred_at,r.outstanding_amount FROM ledger.bonus_recovery_event r
      WHERE r.outstanding_amount>0 AND r.occurred_at<=${cutoff}
    UNION ALL
    SELECT 'ERP_BRIDGE_ATTENTION',h.requested_at,NULL::numeric FROM commerce.fulfillment_erp_handoff h
      JOIN integration.outbox_event o ON o.outbox_event_id=h.outbox_event_id
      LEFT JOIN LATERAL (SELECT outcome FROM commerce.fulfillment_erp_reconciliation x WHERE x.fulfillment_erp_handoff_id=h.fulfillment_erp_handoff_id ORDER BY x.occurred_at DESC,x.recorded_at DESC LIMIT 1) latest ON true
      WHERE h.requested_at<=${cutoff} AND (o.process_status IN ('PENDING','PROCESSING','DEAD') OR latest.outcome IN ('PARTIAL','MISMATCH'))
   ) SELECT category,count(*) item_count,sum(amount) amount,min(anchor_at) oldest_at FROM aging_items GROUP BY category ORDER BY category`;
  const all=['MATURED_AWARD_NOT_PAYABLE','PAYABLE_NOT_BATCHED','PAYOUT_EXPORTED_UNRESOLVED','BANK_TRANSFER_FAILED','RECOVERY_OUTSTANDING','ERP_BRIDGE_ATTENTION'];
  const byCategory=new Map(rows.map(row=>[row.category,row]));
  return {asOf:asOf.toISOString(),thresholdHours:input.thresholdHours,cutoff:cutoff.toISOString(),items:all.map(category=>{const row=byCategory.get(category);return {category,count:Number(row?.item_count??0),amount:row?.amount?.toFixed(4)??null,oldestAt:row?.oldest_at?.toISOString()??null,status:row?'ATTENTION':'CLEAR'};}),authority:{threshold:'Operator-supplied operational parameter',facts:'Authoritative stored UCell and ERP bridge evidence',action:'Read-only; resolution requires the owning domain workflow'}};
 }
 async read(input:Input){
  const period=parse(input),now=new Date();
  return this.db.$transaction(async tx=>{
   const cohort=await compensationPeriodEvidence(tx,period),awardScope={ruleVersionCode:period.ruleVersionCode,...periodBonusAwardWhere(cohort.sourcePeriod)};
   const inputs=await periodCloseInputState(tx,period);
   const volume=await compensationVolumeEvidence(tx,period,cohort);
   const [jobs,batches,awards,pendingAwards,recoveries,reservoir,payouts,payables,erp]=await Promise.all([
    Promise.resolve(cohort.jobs),
    tx.settlementBatch.findMany({where:{settlementBatchId:{in:cohort.sourcePeriod.settlementSourceIds}},select:{settlementBatchId:true,settlementType:true,status:true,totalTheory:true,poolAvailable:true,kFactor:true,finalizedAt:true},orderBy:[{settlementType:'asc'},{periodStart:'asc'}]}),
    tx.bonusAward.aggregate({where:awardScope,_count:true,_sum:{theoryAmount:true,payableAmount:true}}),
    tx.bonusAward.count({where:{...awardScope,payableAmount:{gt:0},economicDestination:{is:null},pendingUntil:{gt:now}}}),
    tx.bonusRecoveryEvent.aggregate({where:{bonusAward:awardScope},_count:true,_sum:{recoveryAmount:true,recoveredAmount:true,outstandingAmount:true}}),
    tx.reservoirLedgerEffect.aggregate({where:{OR:cohort.required.map(row=>({sourcePeriodStart:row.periodStart,sourcePeriodEnd:row.periodEnd})),ruleVersionCode:period.ruleVersionCode,reservoirCode:'B'},_count:true,_sum:{amount:true}}),
    tx.payoutBatch.findMany({where:{periodStart:period.periodStart,periodEnd:period.periodEnd},include:{approvals:{select:{stage:true,decision:true}},exportArtifacts:{select:{exportReference:true,revision:true,generatedAt:true},orderBy:{revision:'asc'}},paymentResults:{select:{payoutLineId:true,resultStatus:true,paidAmount:true,occurredAt:true}}},orderBy:{createdAt:'asc'}}),
    tx.$queryRaw<Array<{total:bigint;open:bigint;gross:Prisma.Decimal|null}>>`
     SELECT count(*) AS total,count(*) FILTER (WHERE p.status='OPEN') AS open,coalesce(sum(p.gross_amount),0) AS gross FROM ledger.payable_entry p
     WHERE p.rule_version_code=${period.ruleVersionCode} AND (
      (p.source_type='BONUS_AWARD' AND EXISTS (SELECT 1 FROM ledger.bonus_award a WHERE a.bonus_award_id=p.source_id AND a.rule_version_code=${period.ruleVersionCode}
       AND (a.settlement_batch_id IN (SELECT value::uuid FROM jsonb_array_elements_text(${JSON.stringify(cohort.sourcePeriod.settlementSourceIds)}::jsonb)) OR (a.settlement_batch_id IS NULL AND a.occurred_at>=${period.periodStart} AND a.occurred_at<${period.periodEnd}))))
      OR (p.source_type='RPV_UPLINE_AWARD' AND EXISTS (SELECT 1 FROM ledger.rpv_upline_award_event a WHERE a.rpv_award_event_id=p.source_id AND a.rule_version_code=${period.ruleVersionCode} AND a.occurred_at>=${period.periodStart} AND a.occurred_at<${period.periodEnd}))
      OR (p.source_type='GLOBAL_POOL_AWARD' AND EXISTS (SELECT 1 FROM ledger.global_pool_award a WHERE a.global_pool_award_id=p.source_id AND a.global_pool_settlement_id IN (SELECT value::uuid FROM jsonb_array_elements_text(${JSON.stringify(cohort.sourcePeriod.globalSourceIds)}::jsonb)))))`,
    tx.fulfillmentErpHandoff.count({where:{requestedAt:{gte:period.periodStart,lt:period.periodEnd},OR:[{outboxEvent:{processStatus:{in:['PENDING','PROCESSING','DEAD']}}},{reconciliations:{some:{outcome:{in:['PARTIAL','MISMATCH']}}}}]}}),
   ]);
   const kinds=['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE','PAYABLE_PREPARATION'];
   const allKinds=cohort.configured&&cohort.missing.length===0,dead=jobs.filter(row=>row.outbox.processStatus==='DEAD'),complete=jobs.filter(row=>cohort.sealed.has(row.periodCloseJobId)),payable=payables[0]??{total:0n,open:0n,gross:new Prisma.Decimal(0)};
   const payoutTotals=payouts.reduce((sum,row)=>({gross:sum.gross.add(row.totalGross),recovery:sum.recovery.add(row.totalRecovery),net:sum.net.add(row.totalNet),paid:sum.paid.add(confirmedPaid(row.paymentResults))}),{gross:new Prisma.Decimal(0),recovery:new Prisma.Decimal(0),net:new Prisma.Decimal(0),paid:new Prisma.Decimal(0)});
   let lifecycle='OPEN';
   if(jobs.length||!cohort.configured)lifecycle=!allKinds||!inputs.ready?'PRECHECK':'READY_TO_CLOSE';
   if(cohort.inputSealedAt)lifecycle='SOFT_CLOSED';
   if(jobs.some(row=>!row.receipt)&&jobs.some(row=>row.outbox.attemptCount>0||row.outbox.processStatus!=='PENDING'))lifecycle='SETTLING';
   if(cohort.allComplete)lifecycle=pendingAwards?'MATURING':'AWARD_FINALIZED';
   if(cohort.allComplete&&!pendingAwards&&Number(payable.open)>0)lifecycle='PAYABLE_READY';
   const settlementReady=cohort.allComplete&&inputs.ready&&volume.ready&&!pendingAwards;
   if(settlementReady&&!dead.length){
    if(payouts.some(row=>['DRAFT','READY','REVIEWED','APPROVED'].includes(row.status)))lifecycle='PAYMENT_REVIEW';
    if(payouts.some(row=>['EXPORTED','PROCESSING','PARTIALLY_PAID','FAILED'].includes(row.status)))lifecycle='BANK_RECONCILING';
    if(payouts.length&&payouts.every(row=>row.status==='PAID')){
     lifecycle=Number(payable.open)>0?'PAYABLE_READY':'BANK_RECONCILING';
     if(Number(payable.open)===0&&payoutTotals.paid.equals(payoutTotals.net)&&Number(recoveries._sum.outstandingAmount??0)===0)lifecycle='FINANCIALLY_RECONCILED';
    }
   }
   if(dead.length||!volume.ready||cohort.problems.some(problem=>problem.code!=='COMPENSATION_APPROVED_CALENDAR_UNAVAILABLE'))lifecycle='BLOCKED';
   const checkpoint=(code:string,label:string,status:string,evidence:string)=>({code,label,status,evidence});
   return {period:{periodStart:period.periodStart.toISOString(),periodEnd:period.periodEnd.toISOString(),ruleVersionCode:period.ruleVersionCode},lifecycle,dataThrough:now.toISOString(),elapsedSeconds:Math.max(0,Math.floor((now.getTime()-period.periodEnd.getTime())/1000)),checkpoints:[
    checkpoint('INPUT_COMPLETENESS','交易與輸入完整性',inputs.ready?'PASS':'PENDING',`${inputs.sourceEvents} unresolved source events; ${inputs.recognitions} due recognitions.`),
    checkpoint('VOLUME_RECOGNITION','GPV／RPV／EPV 完整性',volume.ready&&inputs.ready?'PASS':volume.ready?'PENDING':'FAILED',`Verified original snapshots GPV ${volume.counts.GPV-volume.invalid.GPV}/${volume.counts.GPV}, RPV ${volume.counts.RPV-volume.invalid.RPV}/${volume.counts.RPV}, EPV ${volume.counts.EPV-volume.invalid.EPV}/${volume.counts.EPV}; ${volume.lateOriginals} originals recorded after the input seal.`),
    checkpoint('SNAPSHOT_READINESS','Active／組織／規則快照',cohort.allComplete?'PASS':cohort.problems.length?'ATTENTION':'PENDING',`${complete.length}/${cohort.required.length} verified sealed results; ${cohort.missing.length} missing requests.`),
    checkpoint('SOFT_CLOSE','Soft Close／輸入封存',cohort.inputSealedAt?(volume.ready?'PASS':'FAILED'):'PENDING',cohort.inputSealedAt?'Verified full-window Referral receipt protects original volume admission; recognition evidence must also pass. Linked corrections remain append-only.':'Requests alone do not prove that inputs were sealed.'),
    ...kinds.map(kind=>{const required=cohort.required.filter(row=>row.kind===kind),found=jobs.filter(row=>row.kind===kind),sealed=found.filter(row=>cohort.sealed.has(row.periodCloseJobId));return checkpoint(kind,kind,!required.length?'NOT_APPLICABLE':sealed.length===required.length?'PASS':found.some(row=>row.outbox.processStatus==='DEAD'||cohort.problems.some(problem=>problem.jobId===row.periodCloseJobId))?'FAILED':found.length?'RUNNING':'PENDING',`${sealed.length}/${required.length} approved source periods have verified receipts.`);}),
    checkpoint('COMPANY_RESERVOIR_B','Company／Reservoir B reconciliation',Number(reservoir._count)>0?'RECORDED':'NO_EFFECT_RECORDED',`${reservoir._count} append-only effects; amount ${amount(reservoir._sum.amount)}.`),
    checkpoint('RETURN_RECOVERY','Return／Recovery reconciliation',Number(recoveries._sum.outstandingAmount??0)>0?'ATTENTION':Number(recoveries._count)>0?'PASS':'NO_EFFECT_RECORDED',`${recoveries._count} recovery events; outstanding ${amount(recoveries._sum.outstandingAmount)}.`),
    checkpoint('HISTORICAL_CORRECTION','Historical correction boundary','PASS','Later returns and replay remain append-only current effects linked to historical awards; this read never reopens or rewrites historical facts.'),
    checkpoint('AWARD_MATURITY','Award maturity',pendingAwards?'PENDING':'PASS',`${pendingAwards} awards remain before pendingUntil.`),
    checkpoint('PAYABLE','Payable materialization',Number(payable.open)>0?'READY':Number(payable.total)>0?'PASS':'PENDING',`${payable.total} entries; ${payable.open} open.`),
    checkpoint('PAYOUT','Payout review／export／bank result',payouts.some(row=>row.status==='FAILED'||row.status==='PARTIALLY_PAID')?'ATTENTION':payouts.length?'RECORDED':'PENDING',`${payouts.length} payout batches.`),
    checkpoint('ERP_ACCOUNTING','ERP accounting projection','BLOCKED_EXTERNAL',`ERP_ACCOUNT_MAPPING_REQUIRED; ${erp} fulfillment bridge items currently require attention in this period.`),
   ],
   jobs:jobs.map(row=>({
    jobReference:safe('PERIOD-JOB',row.periodCloseJobId),kind:row.kind,status:row.outbox.processStatus,periodStart:row.periodStart.toISOString(),periodEnd:row.periodEnd.toISOString(),
    attemptCount:row.outbox.attemptCount,completedAt:row.receipt?.completedAt.toISOString()??null,blockingCode:row.outbox.processStatus==='DEAD'?failureCode(row.outbox.lastError):null,
   })),
   settlements:batches.map(row=>({kind:row.settlementType,status:row.status,totalTheory:amount(row.totalTheory),poolAvailable:amount(row.poolAvailable),kFactor:row.kFactor.toString(),finalizedAt:row.finalizedAt?.toISOString()??null})),
   amountBridge:{
    grossTheory:amount(awards._sum.theoryAmount),awardAfterEligibilityAndK:amount(awards._sum.payableAmount),companyReservoirB:amount(reservoir._sum.amount),
    recoveryRequired:amount(recoveries._sum.recoveryAmount),recoveryOutstanding:amount(recoveries._sum.outstandingAmount),payableMaterialized:amount(payable.gross),
    payoutGross:amount(payoutTotals.gross),payoutRecoveryOffset:amount(payoutTotals.recovery),payoutNet:amount(payoutTotals.net),bankPaid:amount(payoutTotals.paid),erpAccountingProjection:null,
   },
   payouts:payouts.map(row=>({
    payoutReference:safe('PAYOUT',row.payoutBatchId),status:row.status,totalGross:amount(row.totalGross),totalRecovery:amount(row.totalRecovery),totalNet:amount(row.totalNet),
    approvals:row.approvals,latestExport:row.exportArtifacts.at(-1)??null,paymentResults:{paid:row.paymentResults.filter(result=>result.resultStatus==='PAID').length,failed:row.paymentResults.filter(result=>result.resultStatus==='FAILED').length},
   })),
   blockingExceptions:[...dead.map(row=>({reference:safe('PERIOD-JOB',row.periodCloseJobId),code:failureCode(row.outbox.lastError),status:'OPEN'})),...cohort.problems.map(problem=>({reference:problem.jobId?safe('PERIOD-JOB',problem.jobId):'PERIOD-CONFIGURATION',code:problem.code,status:'OPEN'})),...(!volume.ready?[{reference:'PERIOD-RECOGNITION',code:'COMPENSATION_VOLUME_EVIDENCE_INVALID',status:'OPEN'}]:[])],
   freshness:{status:'CURRENT',projectedAt:now.toISOString(),dataThrough:now.toISOString()},
   authority:{ucell:'Member compensation/economic control only',erp:'Corporate accounting projection remains independent',hardClose:'Not persisted by this read model'},
  };
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
 }
}
