import {Prisma,PrismaClient,PeriodCloseJob} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {ParameterSnapshot,verifySnapshot} from './parameter-snapshot';
import {verifyReplayEnvelope} from './historical-replay';
import {OutboxLease,claimOutboxLease,withOutboxLease} from './outbox-lease';

export type PeriodCloseKind='REFERRAL_K0'|'BINARY_K1'|'MATCHING_K2'|'GLOBAL'|'WELFARE';
export type PeriodCloseRequest={kind:PeriodCloseKind;periodStart:Date;periodEnd:Date;ruleVersionCode:string;prerequisiteIds:string[];requestedBy:string;approvalReference:string};
const eventType='PERIOD_CLOSE_REQUESTED';
const uuid=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

/** Internal admission boundary. prepare must enforce the approved calendar/cutoff. */
export async function enqueuePeriodCloseJob(db:PrismaClient,input:PeriodCloseRequest,prepare:(tx:Prisma.TransactionClient)=>Promise<ParameterSnapshot>,onCreated?:(tx:Prisma.TransactionClient,job:PeriodCloseJob)=>Promise<unknown>){
  if(!['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE'].includes(input.kind)||!Number.isFinite(input.periodStart.getTime())||!Number.isFinite(input.periodEnd.getTime())||input.periodStart>=input.periodEnd||!input.ruleVersionCode.trim()||!input.requestedBy.trim()||!input.approvalReference.trim()||input.prerequisiteIds.length>100||input.prerequisiteIds.some(id=>!uuid.test(id)))throw new Error('PERIOD_CLOSE_REQUEST_INVALID');
  const prerequisiteIds=[...new Set(input.prerequisiteIds)].sort();
  const identity={kind:input.kind,periodStart:input.periodStart,periodEnd:input.periodEnd,ruleVersionCode:input.ruleVersionCode};
  function existing(job:PeriodCloseJob){
    if(JSON.stringify(job.prerequisiteIds)!==JSON.stringify(prerequisiteIds)||job.approvalReference!==input.approvalReference)throw new Error('PERIOD_CLOSE_REQUEST_CONFLICT');
    return job;
  }
  // A serialization loser can abort before the winner is visible to a fresh read.
  // Retry admission in a fresh transaction instead of leaking a transient conflict.
  for(let attempt=0;attempt<4;attempt++)try{return await db.$transaction(async tx=>{
    const prior=await tx.periodCloseJob.findUnique({where:{kind_periodStart_periodEnd_ruleVersionCode:identity}});
    if(prior)return existing(prior);
    const parameters=verifySnapshot(await prepare(tx));
    if(parameters.ruleVersionCode!==input.ruleVersionCode)throw new Error('PERIOD_CLOSE_RULE_MISMATCH');
    const dependencies=await tx.periodCloseJob.findMany({where:{periodCloseJobId:{in:prerequisiteIds}}});
    if(dependencies.length!==prerequisiteIds.length||dependencies.some(row=>row.ruleVersionCode!==input.ruleVersionCode||row.periodStart<input.periodStart||row.periodEnd>input.periodEnd))throw new Error('PERIOD_CLOSE_PREREQUISITE_INVALID');
    if(input.kind==='MATCHING_K2'&&!dependencies.some(row=>row.kind==='BINARY_K1'&&row.periodStart.getTime()===input.periodStart.getTime()&&row.periodEnd.getTime()===input.periodEnd.getTime()))throw new Error('PERIOD_CLOSE_BINARY_REQUIRED');
    if(input.kind==='WELFARE'&&!dependencies.some(row=>row.kind==='GLOBAL'&&row.periodStart.getTime()===input.periodStart.getTime()&&row.periodEnd.getTime()===input.periodEnd.getTime()))throw new Error('PERIOD_CLOSE_GLOBAL_REQUIRED');
    // Prerequisites must already exist; immutable manifests make cycles impossible.
    const periodCloseJobId=randomUUID();
    const outbox=await tx.outboxEvent.create({data:{eventType,aggregateType:'PERIOD_CLOSE_JOB',aggregateId:periodCloseJobId,payload:{periodCloseJobId},correlationId:randomUUID()}});
    const job=await tx.periodCloseJob.create({data:{...identity,periodCloseJobId,prerequisiteIds,requestedBy:input.requestedBy,approvalReference:input.approvalReference,parameterSnapshot:parameters as unknown as Prisma.InputJsonValue,outboxEventId:outbox.outboxEventId}});
    if(onCreated)await onCreated(tx,job);
    return job;
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
  catch(error){
    if(!['P2002','P2034'].includes((error as any).code))throw error;
    const prior=await db.periodCloseJob.findUnique({where:{kind_periodStart_periodEnd_ruleVersionCode:identity}});
    if(prior)return existing(prior);
    if(attempt===3)throw error;
  }
  throw new Error('PERIOD_CLOSE_ADMISSION_RETRY_EXHAUSTED');
}

/** Dependency waits do not acquire a lease or consume the Outbox retry budget. */
export async function claimPeriodCloseJob(db:PrismaClient,jobId:string,now=new Date(),leaseMs=120000){
  if(!Number.isSafeInteger(leaseMs)||leaseMs<1000||leaseMs>600000)throw new Error('PERIOD_CLOSE_LEASE_INVALID');
  const job=await db.periodCloseJob.findUnique({where:{periodCloseJobId:jobId},include:{outbox:true}});
  if(!job)return null;
  const ids=job.prerequisiteIds as string[];
  if(await db.periodCloseReceipt.count({where:{periodCloseJobId:{in:ids}}})!==ids.length)return null;
  return claimOutboxLease(db,job.outbox,now,leaseMs);
}

/** Handler MUST use the supplied transaction; monetary work and receipt commit together. */
export async function processPeriodCloseJob(db:PrismaClient,lease:OutboxLease,execute:(tx:Prisma.TransactionClient,job:PeriodCloseJob)=>Promise<string>){
  return withOutboxLease(db,lease,async tx=>{
    const event=await tx.outboxEvent.findUniqueOrThrow({where:{outboxEventId:lease.outboxEventId}});
    const job=await tx.periodCloseJob.findUnique({where:{outboxEventId:lease.outboxEventId}});
    if(!job||event.eventType!==eventType||event.aggregateType!=='PERIOD_CLOSE_JOB'||event.aggregateId!==job.periodCloseJobId||(event.payload as any)?.periodCloseJobId!==job.periodCloseJobId)throw new Error('PERIOD_CLOSE_EVENT_MISMATCH');
    const prerequisites=job.prerequisiteIds as string[];
    const complete=await tx.periodCloseReceipt.count({where:{periodCloseJobId:{in:prerequisites}}});
    if(complete!==prerequisites.length){
      // Defense in depth for callers that bypass the dependency-aware claim.
      await tx.outboxEvent.update({where:{outboxEventId:lease.outboxEventId},data:{processStatus:'PENDING',availableAt:new Date(Date.now()+30000),lastError:'PERIOD_CLOSE_PREREQUISITE_PENDING'}});
      return {blocked:true};
    }
    const parameters=verifySnapshot(job.parameterSnapshot);
    const sourceId=await execute(tx,job);
    const snapshot=await tx.historicalReplaySnapshot.findUnique({where:{kind_sourceId:{kind:job.kind,sourceId}}});
    const envelope=verifyReplayEnvelope(snapshot);
    if(envelope.kind!==job.kind||envelope.sourceId!==sourceId||envelope.ruleVersionCode!==job.ruleVersionCode||envelope.parameters.hash!==parameters.hash||envelope.inputs.periodStart!==job.periodStart.toISOString()||envelope.inputs.periodEnd!==job.periodEnd.toISOString())throw new Error('PERIOD_CLOSE_RESULT_MISMATCH');
    const receipt=await tx.periodCloseReceipt.create({data:{periodCloseJobId:job.periodCloseJobId,sourceId,snapshotId:snapshot!.snapshotId}});
    await tx.outboxEvent.update({where:{outboxEventId:lease.outboxEventId},data:{processStatus:'PROCESSED',processedAt:new Date(),lastError:null}});
    return receipt;
  });
}
