import {BadRequestException,Injectable} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {createHash} from 'node:crypto';

type Input={periodStart:string;periodEnd:string;ruleVersionCode:string};
const safe=(kind:string,id:string)=>`${kind}-${createHash('sha256').update(`${kind}:${id}`).digest('hex').slice(0,20)}`;
const amount=(value:Prisma.Decimal|null|undefined)=>value?.toFixed(4)??'0.0000';
const failureCode=(value:string|null|undefined)=>value&&/^[A-Z][A-Z0-9_]{2,63}$/.test(value)?value:'PERIOD_CLOSE_FAILED';
function parse(input:Input){
 const periodStart=new Date(input.periodStart),periodEnd=new Date(input.periodEnd),ruleVersionCode=input.ruleVersionCode?.trim();
 if(!Number.isFinite(periodStart.getTime())||!Number.isFinite(periodEnd.getTime())||periodStart>=periodEnd)throw new BadRequestException({code:'COMPENSATION_PERIOD_INVALID'});
 if(!ruleVersionCode||ruleVersionCode.length>100)throw new BadRequestException({code:'COMPENSATION_RULE_VERSION_INVALID'});
 return {periodStart,periodEnd,ruleVersionCode};
}

@Injectable()
export class CompensationPeriodControlService{
 constructor(private readonly db:PrismaService){}
 async read(input:Input){
  const period=parse(input),now=new Date();
  return this.db.$transaction(async tx=>{
   const [jobs,batches,awards,pendingAwards,recoveries,reservoir,payouts,payables,erp]=await Promise.all([
    tx.periodCloseJob.findMany({where:period,include:{outbox:true,receipt:true},orderBy:{kind:'asc'}}),
    tx.settlementBatch.findMany({where:period,select:{settlementBatchId:true,settlementType:true,status:true,totalTheory:true,poolAvailable:true,kFactor:true,finalizedAt:true},orderBy:{settlementType:'asc'}}),
    tx.bonusAward.aggregate({where:{settlementBatch:{is:period}},_count:true,_sum:{theoryAmount:true,payableAmount:true}}),
    tx.bonusAward.count({where:{settlementBatch:{is:period},pendingUntil:{gt:now}}}),
    tx.bonusRecoveryEvent.aggregate({where:{bonusAward:{settlementBatch:{is:period}}},_count:true,_sum:{recoveryAmount:true,recoveredAmount:true,outstandingAmount:true}}),
    tx.reservoirLedgerEffect.aggregate({where:{sourcePeriodStart:period.periodStart,sourcePeriodEnd:period.periodEnd,ruleVersionCode:period.ruleVersionCode,reservoirCode:'B'},_count:true,_sum:{amount:true}}),
    tx.payoutBatch.findMany({where:{periodStart:period.periodStart,periodEnd:period.periodEnd},include:{approvals:{select:{stage:true,decision:true}},exportArtifacts:{select:{exportReference:true,revision:true,generatedAt:true},orderBy:{revision:'asc'}},paymentResults:{select:{resultStatus:true,paidAmount:true,occurredAt:true}}},orderBy:{createdAt:'asc'}}),
    tx.$queryRaw<Array<{total:bigint;open:bigint;gross:Prisma.Decimal|null}>>`SELECT count(*) AS total,count(*) FILTER (WHERE p.status='OPEN') AS open,coalesce(sum(p.gross_amount),0) AS gross FROM ledger.payable_entry p JOIN ledger.bonus_award a ON a.bonus_award_id=p.source_id JOIN ledger.settlement_batch b ON b.settlement_batch_id=a.settlement_batch_id WHERE p.source_type='BONUS_AWARD' AND b.period_start=${period.periodStart} AND b.period_end=${period.periodEnd} AND b.rule_version_code=${period.ruleVersionCode}`,
    tx.fulfillmentErpHandoff.count({where:{requestedAt:{gte:period.periodStart,lt:period.periodEnd},OR:[{outboxEvent:{processStatus:{in:['PENDING','PROCESSING','DEAD']}}},{reconciliations:{some:{outcome:{in:['PARTIAL','MISMATCH']}}}}]}}),
   ]);
   const kinds=['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'];
   const byKind=new Map(jobs.map(row=>[row.kind,row])),dead=jobs.filter(row=>row.outbox.processStatus==='DEAD'),complete=jobs.filter(row=>!!row.receipt),payable=payables[0]??{total:0n,open:0n,gross:new Prisma.Decimal(0)};
   const payoutTotals=payouts.reduce((sum,row)=>({gross:sum.gross.add(row.totalGross),recovery:sum.recovery.add(row.totalRecovery),net:sum.net.add(row.totalNet),paid:sum.paid.add(row.paymentResults.filter(result=>result.resultStatus==='PAID').reduce((a,result)=>a.add(result.paidAmount),new Prisma.Decimal(0)))}),{gross:new Prisma.Decimal(0),recovery:new Prisma.Decimal(0),net:new Prisma.Decimal(0),paid:new Prisma.Decimal(0)});
   let lifecycle='OPEN';
   if(jobs.length)lifecycle=jobs.length<kinds.length?'PRECHECK':'READY_TO_CLOSE';
   if(dead.length)lifecycle='BLOCKED';else if(jobs.some(row=>!row.receipt))lifecycle='SETTLING';else if(complete.length===kinds.length)lifecycle=pendingAwards?'MATURING':'AWARD_FINALIZED';
   if(complete.length===kinds.length&&!pendingAwards&&Number(payable.open)>0)lifecycle='PAYABLE_READY';
   if(payouts.some(row=>['DRAFT','READY','REVIEWED','APPROVED'].includes(row.status)))lifecycle='PAYMENT_REVIEW';
   if(payouts.some(row=>['EXPORTED','PROCESSING','PARTIALLY_PAID','FAILED'].includes(row.status)))lifecycle='BANK_RECONCILING';
   if(payouts.length&&payouts.every(row=>row.status==='PAID')&&Number(recoveries._sum.outstandingAmount??0)===0)lifecycle='FINANCIALLY_RECONCILED';
   const checkpoint=(code:string,label:string,status:string,evidence:string)=>({code,label,status,evidence});
   return {period:{periodStart:period.periodStart.toISOString(),periodEnd:period.periodEnd.toISOString(),ruleVersionCode:period.ruleVersionCode},lifecycle,dataThrough:now.toISOString(),checkpoints:[
    checkpoint('INPUT_COMPLETENESS','交易與輸入完整性',jobs.length?'RECORDED':'PENDING',jobs.length?'Period-close requests preserve approved input and parameter snapshots.':'No approved close request is recorded.'),
    checkpoint('VOLUME_RECOGNITION','GPV／RPV／EPV 完整性','NOT_AVAILABLE','No single sealed cross-volume completeness receipt exists; the control view does not infer one.'),
    checkpoint('SNAPSHOT_READINESS','Active／組織／規則快照',jobs.length===kinds.length?'RECORDED':'PENDING',`${jobs.length}/${kinds.length} governed requests recorded.`),
    ...kinds.map(kind=>{const job=byKind.get(kind);return checkpoint(kind,kind,job?.receipt?'PASS':job?.outbox.processStatus==='DEAD'?'FAILED':job?'RUNNING':'PENDING',job?`${job.outbox.processStatus}; attempts ${job.outbox.attemptCount}`:'Not requested.');}),
    checkpoint('COMPANY_RESERVOIR_B','Company／Reservoir B reconciliation',Number(reservoir._count)>0?'RECORDED':'NO_EFFECT_RECORDED',`${reservoir._count} append-only effects; amount ${amount(reservoir._sum.amount)}.`),
    checkpoint('RETURN_RECOVERY','Return／Recovery reconciliation',Number(recoveries._sum.outstandingAmount??0)>0?'ATTENTION':Number(recoveries._count)>0?'PASS':'NO_EFFECT_RECORDED',`${recoveries._count} recovery events; outstanding ${amount(recoveries._sum.outstandingAmount)}.`),
    checkpoint('AWARD_MATURITY','Award maturity',pendingAwards?'PENDING':'PASS',`${pendingAwards} awards remain before pendingUntil.`),
    checkpoint('PAYABLE','Payable materialization',Number(payable.open)>0?'READY':Number(payable.total)>0?'PASS':'PENDING',`${payable.total} entries; ${payable.open} open.`),
    checkpoint('PAYOUT','Payout review／export／bank result',payouts.some(row=>row.status==='FAILED'||row.status==='PARTIALLY_PAID')?'ATTENTION':payouts.length?'RECORDED':'PENDING',`${payouts.length} payout batches.`),
    checkpoint('ERP_ACCOUNTING','ERP accounting projection','BLOCKED_EXTERNAL',`ERP_ACCOUNT_MAPPING_REQUIRED; ${erp} fulfillment bridge items currently require attention in this period.`),
   ],
   jobs:jobs.map(row=>({
    jobReference:safe('PERIOD-JOB',row.periodCloseJobId),kind:row.kind,status:row.outbox.processStatus,
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
   blockingExceptions:dead.map(row=>({reference:safe('PERIOD-JOB',row.periodCloseJobId),code:failureCode(row.outbox.lastError),status:'OPEN'})),
   freshness:{status:'CURRENT',projectedAt:now.toISOString(),dataThrough:now.toISOString()},
   authority:{ucell:'Member compensation/economic control only',erp:'Corporate accounting projection remains independent',hardClose:'Not persisted by this read model'},
  };
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
 }
}
