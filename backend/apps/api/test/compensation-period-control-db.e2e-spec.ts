import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {CompensationPeriodControlService} from '../src/modules/settlement-jobs/compensation-period-control.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('COMPENSATION_PERIOD_CONTROL_REAL_DB',()=>{
 let db:PrismaClient;beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});afterAll(()=>db?.$disconnect());
 it('reads completed governed jobs in one repeatable-read snapshot without exposing database identities',async()=>{
  const periodStart=new Date('1894-01-01T00:00:00Z'),periodEnd=new Date('1894-01-08T00:00:00Z'),ruleVersionCode=`TEST_PERIOD_CONTROL_${randomUUID()}`,ids:string[]=[];
  for(const kind of ['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL']){
   const jobId=randomUUID(),outboxId=randomUUID();ids.push(jobId,outboxId);
   await db.outboxEvent.create({data:{outboxEventId:outboxId,eventType:'PERIOD_CLOSE_REQUESTED',aggregateType:'PERIOD_CLOSE_JOB',aggregateId:jobId,payload:{periodCloseJobId:jobId},processStatus:'PROCESSED',attemptCount:1,processedAt:new Date(),correlationId:randomUUID()}});
   await db.periodCloseJob.create({data:{periodCloseJobId:jobId,kind,periodStart,periodEnd,ruleVersionCode,parameterSnapshot:{ruleVersionCode,hash:'a'.repeat(64),values:[]},prerequisiteIds:[],requestedBy:'TEST_FINANCE',approvalReference:'TEST_CONTROL',outboxEventId:outboxId}});
   await db.periodCloseReceipt.create({data:{periodCloseJobId:jobId,sourceId:randomUUID(),snapshotId:randomUUID()}});
  }
  const result=await new CompensationPeriodControlService(db as any).read({periodStart:periodStart.toISOString(),periodEnd:periodEnd.toISOString(),ruleVersionCode}),serialized=JSON.stringify(result);
  expect(result.lifecycle).toBe('AWARD_FINALIZED');expect(result.jobs).toHaveLength(4);expect(result.checkpoints.filter(row=>['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'].includes(row.code)).every(row=>row.status==='PASS')).toBe(true);expect(result.checkpoints.find(row=>row.code==='ERP_ACCOUNTING')).toMatchObject({status:'BLOCKED_EXTERNAL'});
  for(const id of ids)expect(serialized).not.toContain(id);expect(serialized).not.toContain('requestedBy');expect(serialized).not.toContain('parameterSnapshot');
 });
});
