import {Prisma} from '@prisma/client';
import {createHash} from 'node:crypto';
import {verifySnapshot} from './parameter-snapshot';
import {preparationSourcePeriod,periodBonusAwardWhere} from './payable-materialization';

export const periodCloseSourceEvents=['SALE_CONFIRMED','WEB_MEMBER_RETAIL_PAYMENT_CONFIRMED','RETURN_CONFIRMED','RETURN_DEPENDENCY_REPLAY_REQUIRED','EPV_MONTH_RECALCULATION_REQUIRED','RPV_REVERSAL_REQUIRED'];
export async function periodCloseInputState(db:Pick<Prisma.TransactionClient,'outboxEvent'|'monthlyRecognitionSchedule'>,job:{periodEnd:Date;ruleVersionCode:string}){
 const sourceEvents=await db.outboxEvent.count({where:{eventType:{in:periodCloseSourceEvents},processStatus:{not:'PROCESSED'}}});
 const recognitions=await db.monthlyRecognitionSchedule.count({where:{ruleVersionCode:job.ruleVersionCode,dueAt:{lt:job.periodEnd},status:{in:['SCHEDULED','DUE']}}});
 return {sourceEvents,recognitions,ready:sourceEvents===0&&recognitions===0};
}
export function periodJobReference(id:string){return 'PERIOD-JOB-'+createHash('sha256').update(id).digest('hex').slice(0,16);}
type Job=Prisma.PeriodCloseJobGetPayload<{include:{outbox:true;receipt:true}}>;
export async function periodCloseOperationalState(db:Prisma.TransactionClient,job:Job,options:{now?:Date;thresholdHours?:number}={}){
 const now=options.now??new Date(),threshold=options.thresholdHours;
 if(threshold!==undefined&&(!Number.isInteger(threshold)||threshold<1||threshold>8760))throw new Error('PERIOD_CLOSE_THRESHOLD_INVALID');
 const result={jobReference:periodJobReference(job.periodCloseJobId),state:'READY',reasonCode:null as string|null,asOf:now.toISOString(),thresholdHours:threshold??null,overdue:null as boolean|null,eligibleAt:null as string|null,waiting:{sourceEvents:0,recognitions:0,prerequisites:0},dependencies:[] as Array<{reference:string;kind:string;complete:boolean}>,maturesAt:null as string|null};
 if(Boolean(job.receipt)!==(job.outbox.processStatus==='PROCESSED'))return {...result,state:'EVIDENCE_INCONSISTENT',reasonCode:'PERIOD_CLOSE_RECEIPT_STATUS_MISMATCH'};
 if(job.receipt)return {...result,state:'COMPLETED',overdue:false};
 let cutoff:Date;
 try{cutoff=new Date(verifySnapshot(job.parameterSnapshot).effectiveAt);if(!Number.isFinite(cutoff.getTime()))throw new Error();}
 catch{return {...result,state:'EVIDENCE_INCONSISTENT',reasonCode:'PERIOD_CLOSE_PARAMETER_EVIDENCE_INVALID'};}
 const ids=job.prerequisiteIds as string[];
 const parents=await db.periodCloseJob.findMany({where:{periodCloseJobId:{in:ids}},include:{receipt:true}});
 result.dependencies=parents.map(row=>({reference:periodJobReference(row.periodCloseJobId),kind:row.kind,complete:Boolean(row.receipt)}));
 result.waiting.prerequisites=ids.length-parents.filter(row=>row.receipt).length;
 const input=await periodCloseInputState(db,job);result.waiting.sourceEvents=input.sourceEvents;result.waiting.recognitions=input.recognitions;
 let maturity:Date|null=null;
 if(job.kind==='PAYABLE_PREPARATION'){
  const period=await preparationSourcePeriod(db,job);
  const latest=await db.bonusAward.aggregate({where:{ruleVersionCode:job.ruleVersionCode,payableAmount:{gt:0},economicDestination:{is:null},...periodBonusAwardWhere(period)},_max:{pendingUntil:true}});
  maturity=latest._max.pendingUntil;
  result.maturesAt=maturity?.toISOString()??null;
 }
 const eligibleAt=new Date(Math.max(cutoff.getTime(),maturity?.getTime()??cutoff.getTime()));result.eligibleAt=eligibleAt.toISOString();
 result.overdue=threshold===undefined?null:now.getTime()>=eligibleAt.getTime()+threshold*3600000;
 if(job.outbox.processStatus==='DEAD'){result.state='FAILED';result.reasonCode='PERIOD_CLOSE_EXECUTION_FAILED';}
 else if(job.outbox.processStatus==='PROCESSING'&&job.outbox.availableAt>now)result.state='RUNNING';
 else if(result.waiting.prerequisites)result.state='WAITING_PREREQUISITE';
 else if(input.sourceEvents)result.state='WAITING_SOURCE_INPUTS';
 else if(input.recognitions)result.state='WAITING_RECOGNITION';
 else if(maturity&&maturity>now)result.state='WAITING_MATURITY';
 else if(job.outbox.processStatus==='PROCESSING')result.state='LEASE_EXPIRED';
 else if(job.outbox.availableAt>now)result.state='RETRY_SCHEDULED';
 return result;
}
