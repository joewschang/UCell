const assert=require('node:assert/strict');
const {PrismaClient}=require('/app/packages/database/node_modules/@prisma/client');
const {periodCloseSourceEvents,verifyReplayEnvelope,captureParameters,BONUS_TIMING_POLICY}=require('/app/packages/database/dist');
const {SettlementCalendarService}=require('/app/packages/settlement/dist/settlement/settlement-calendar.service');
const db=new PrismaClient();
(async()=>{try{
 const parameters=await captureParameters(db,new Date(),'R1.0B');
 assert(parameters.parameters.some(p=>p.code==='bonus.timing.policy'&&p.value===BONUS_TIMING_POLICY));
 const calendar=new SettlementCalendarService(db);
 const week=await calendar.weeklyPeriodFor(new Date(),'R1.0B');
 assert.equal(new Date(week.end.getTime()+8*3600000).getUTCDay(),1);
 const jobs=await db.periodCloseJob.findMany({where:{kind:{in:['BINARY_K1','MATCHING_K2']},periodStart:new Date('2026-10-18T16:00:00Z'),periodEnd:new Date('2026-10-25T16:00:00Z')},include:{receipt:true,outbox:true}});
 const checks=[];
 for(const job of jobs){
  if(job.receipt){const snapshot=verifyReplayEnvelope(await db.historicalReplaySnapshot.findUnique({where:{snapshotId:job.receipt.snapshotId}}));assert.equal(snapshot.kind,job.kind);}
  checks.push({kind:job.kind,status:job.outbox.processStatus,receipt:!!job.receipt,error:job.outbox.lastError});
 }
 const sources=await db.outboxEvent.groupBy({by:['eventType','processStatus'],where:{eventType:{in:periodCloseSourceEvents},processStatus:{not:'PROCESSED'}},_count:true});
 const q=await db.qualification.findUniqueOrThrow({where:{ballNo:'A000001'},select:{qualificationId:true,effectiveAt:true}});
 const histories={plans:await db.qualificationPlanHistory.count({where:{qualificationId:q.qualificationId,effectiveFrom:{lte:q.effectiveAt},OR:[{effectiveTo:null},{effectiveTo:{gt:q.effectiveAt}}]}}),statuses:await db.qualificationStatusHistory.count({where:{qualificationId:q.qualificationId,effectiveFrom:{lte:q.effectiveAt},OR:[{effectiveTo:null},{effectiveTo:{gt:q.effectiveAt}}]}})};
 assert.equal(histories.plans,1);assert.equal(histories.statuses,1);
 const audit=await db.auditEvent.findFirst({where:{action:'BONUS_TIMING_BEFORE',requestId:'USER_APPROVED_BONUS_TIMING_20261027'},orderBy:{occurredAt:'desc'},select:{occurredAt:true}});
 console.log(JSON.stringify({policy:BONUS_TIMING_POLICY,activatedAt:audit?.occurredAt,week:{start:week.start,end:week.end},jobs:checks,unresolvedSources:sources,histories,allComplete:checks.length===2&&checks.every(j=>j.receipt&&j.status==='PROCESSED')},null,2));
}finally{await db.$disconnect()}})().catch(e=>{console.error(e);process.exitCode=1});
