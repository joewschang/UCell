import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,erpBusinessReference,periodCloseOperationalState,periodJobReference,replayHash,verifySnapshot,verifyReplayEnvelope} from '@ucell/database';
type Scope='PERIOD_JOB'|'RECOGNITION';
export const WORKFLOW_CODES=['PERIOD_CLOSE_EVIDENCE_INCONSISTENT','PERIOD_CLOSE_DEAD','PERIOD_CLOSE_LEASE_EXPIRED','PERIOD_CLOSE_OVERDUE','PERIOD_CLOSE_BLOCKED','OVERDUE_RECOGNITION'];
export const WORKFLOW_SOURCES={PERIOD_CLOSE_JOB:'PERIOD_JOB',MONTHLY_RECOGNITION:'RECOGNITION'} as const;
export function workflowReference(sourceType:string,id:string){
 const scope=WORKFLOW_SOURCES[sourceType as keyof typeof WORKFLOW_SOURCES];if(!scope)return null;
 if(/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(id))return {scope,reference:scope==='PERIOD_JOB'?periodJobReference(id):erpBusinessReference('RECOGNITION',id)};
 if(scope==='PERIOD_JOB'&&/^PERIOD-JOB-(?:[a-f0-9]{16}|[a-f0-9]{20})$/.test(id)||scope==='RECOGNITION'&&/^RECOGNITION-[a-f0-9]{40}$/.test(id))return {scope,reference:id};return null;
}
@Injectable()
export class OperationsWorkflowHealthService{
 constructor(private readonly db:PrismaService){}
 async resolve(tx:Prisma.TransactionClient,scope:Scope,reference:string){
  const resolved=workflowReference(scope==='PERIOD_JOB'?'PERIOD_CLOSE_JOB':'MONTHLY_RECOGNITION',reference);
  if(!resolved||resolved.reference!==reference)throw new UnprocessableEntityException({code:'OPERATIONS_WORKFLOW_REFERENCE_INVALID'});
  const column=Prisma.raw(scope==='PERIOD_JOB'?'period_close_job_id':'recognition_id'),table=Prisma.raw(scope==='PERIOD_JOB'?'integration.period_close_job':'subscription.monthly_recognition_schedule');
  const hash=scope==='PERIOD_JOB'?reference.length===31?Prisma.sql`'PERIOD-JOB-' || substr(encode(sha256(convert_to('PERIOD-JOB:' || ${column}::text,'UTF8')),'hex'),1,20)`:Prisma.sql`'PERIOD-JOB-' || substr(encode(sha256(convert_to(${column}::text,'UTF8')),'hex'),1,16)`:Prisma.sql`'RECOGNITION-' || substr(encode(sha256(convert_to('{"id":"' || ${column}::text || '","kind":"RECOGNITION"}','UTF8')),'hex'),1,40)`;
  const rows=await tx.$queryRaw<{id:string;createdAt:Date}[]>`SELECT ${column} AS id,created_at AS "createdAt" FROM ${table} WHERE ${hash}=${reference} LIMIT 2`;
  if(rows.length!==1)throw new ConflictException({code:'OPERATIONS_WORKFLOW_SOURCE_NOT_FOUND'});return rows[0];
 }
 async list(input:{scope:string;take?:number;cursor?:string;asOf?:string;reference?:string;thresholdHours?:number}){
  if(!['PERIOD_JOB','RECOGNITION'].includes(input.scope))throw new UnprocessableEntityException({code:'OPERATIONS_WORKFLOW_SCOPE_INVALID'});
  const scope=input.scope as Scope,take=input.take??25,asOf=input.asOf?new Date(input.asOf):new Date();
  if(!Number.isInteger(take)||take<1||take>100||!Number.isFinite(asOf.getTime())||input.cursor&&input.reference||input.thresholdHours!==undefined&&(!Number.isInteger(input.thresholdHours)||input.thresholdHours<1||input.thresholdHours>8760))throw new UnprocessableEntityException({code:'OPERATIONS_WORKFLOW_QUERY_INVALID'});
  return this.db.$transaction(async tx=>{
   const now=new Date(),cursor=input.cursor?await this.resolve(tx,scope,input.cursor):null,selected=input.reference?await this.resolve(tx,scope,input.reference):null,idField=scope==='PERIOD_JOB'?'periodCloseJobId':'recognitionId',where={createdAt:{lte:asOf},...(selected?{[idField]:selected.id}:{}),...(cursor?{OR:[{createdAt:{lt:cursor.createdAt}},{createdAt:cursor.createdAt,[idField]:{lt:cursor.id}}]}:{})};
   const rows:any[]=scope==='PERIOD_JOB'?await tx.periodCloseJob.findMany({where,include:{receipt:true,outbox:true},orderBy:[{createdAt:'desc'},{periodCloseJobId:'desc'}],take:take+1}):await tx.monthlyRecognitionSchedule.findMany({where,include:{subscription:{select:{qualification:{select:{qualificationNo:true}}}}},orderBy:[{createdAt:'desc'},{recognitionId:'desc'}],take:take+1});
   const items=await Promise.all(rows.slice(0,take).map(async row=>{
    const reference=scope==='PERIOD_JOB'?periodJobReference(row.periodCloseJobId):erpBusinessReference('RECOGNITION',row.recognitionId),link=`/operations-control?workflow=${scope}&reference=${reference}`;
    let evidence:Record<string,any>,state:string,code:string|null=null;
    if(scope==='PERIOD_JOB'){
     const operational=await periodCloseOperationalState(tx,row,{now,thresholdHours:input.thresholdHours});state=operational.state;
     if(state==='COMPLETED')try{const snapshot=await tx.historicalReplaySnapshot.findUnique({where:{snapshotId:row.receipt.snapshotId}}),envelope=verifyReplayEnvelope(snapshot),parameters=verifySnapshot(row.parameterSnapshot);if(envelope.kind!==row.kind||envelope.sourceId!==row.receipt.sourceId||envelope.ruleVersionCode!==row.ruleVersionCode||envelope.parameters.hash!==parameters.hash||envelope.inputs.periodStart!==row.periodStart.toISOString()||envelope.inputs.periodEnd!==row.periodEnd.toISOString())throw new Error('IDENTITY');}catch{state='EVIDENCE_INCONSISTENT';}
     code=state==='EVIDENCE_INCONSISTENT'?'PERIOD_CLOSE_EVIDENCE_INCONSISTENT':state==='FAILED'?'PERIOD_CLOSE_DEAD':state==='LEASE_EXPIRED'?'PERIOD_CLOSE_LEASE_EXPIRED':operational.overdue?'PERIOD_CLOSE_OVERDUE':['WAITING_PREREQUISITE','WAITING_SOURCE_INPUTS','WAITING_RECOGNITION'].includes(state)?'PERIOD_CLOSE_BLOCKED':null;
     evidence={kind:row.kind,periodStart:row.periodStart.toISOString(),periodEnd:row.periodEnd.toISOString(),ruleVersionCode:row.ruleVersionCode,status:row.outbox.processStatus,attemptCount:row.outbox.attemptCount,eligibleAt:operational.eligibleAt,maturesAt:operational.maturesAt,thresholdHours:input.thresholdHours??null,waiting:operational.waiting,dependencies:[...operational.dependencies].sort((a,b)=>a.reference.localeCompare(b.reference)),completedAt:row.receipt?.completedAt.toISOString()??null};
    }else{
     state=row.status;code=['SCHEDULED','DUE'].includes(state)&&row.dueAt<now?'OVERDUE_RECOGNITION':null;
     evidence={qualificationNo:row.subscription.qualification.qualificationNo.toString(),installmentNo:row.installmentNo,recognitionMonth:row.recognitionMonth.toISOString().slice(0,10),dueAt:row.dueAt.toISOString(),recognizedAt:row.recognizedAt?.toISOString()??null,recognizedAmount:row.recognizedAmount.toFixed(2),rpvAmount:row.rpvAmount.toFixed(4),ruleVersionCode:row.ruleVersionCode};
    }
    const ageFrom=scope==='PERIOD_JOB'?evidence.eligibleAt:evidence.dueAt;
    return {reference,scope,state,createdAt:row.createdAt.toISOString(),evidence,elapsedSinceEligibleHours:ageFrom?Math.max(0,Math.floor((now.getTime()-new Date(ageFrom).getTime())/3600000)):null,link,actionLink:scope==='PERIOD_JOB'?'/settlement-jobs?reference='+reference:null,periodLink:scope==='PERIOD_JOB'&&row.kind==='PAYABLE_PREPARATION'?'/compensation-period-control?'+new URLSearchParams({periodStart:evidence.periodStart,periodEnd:evidence.periodEnd,ruleVersionCode:evidence.ruleVersionCode}).toString():null,candidates:code?[{code,reference,severity:code==='PERIOD_CLOSE_EVIDENCE_INCONSISTENT'?'CRITICAL':'HIGH',evidenceHash:replayHash({reference,code,state,evidence}),link}]:[]};
   }));
   return {items,scope,observed:items.length,attention:items.filter(row=>row.candidates.length).length,coverage:'CURRENT_PAGE_ONLY',thresholdHours:input.thresholdHours??null,asOf:asOf.toISOString(),dataThrough:now.toISOString(),nextCursor:rows.length>take?items.at(-1)!.reference:null};
  },{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
 }
}
