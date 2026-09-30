import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {CompensationPeriodControlService} from '../src/modules/settlement-jobs/compensation-period-control.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('COMPENSATION_PERIOD_CONTROL_REAL_DB',()=>{
 let db:PrismaClient;beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});afterAll(()=>db?.$disconnect());
 it('reports a missing original recognition snapshot as blocking evidence',async()=>{
  const ruleVersionCode='TEST_VOLUME_CONTROL_'+randomUUID(),person=await db.person.create({data:{legalName:'Synthetic missing recognition'}});
  const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
  const volume=await db.pvLedger.create({data:{qualificationId:qualification.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:randomUUID(),sourceLineId:randomUUID(),eventType:'GPV_CREATED',ruleVersionCode,occurredAt:new Date('1896-01-02Z'),correlationId:randomUUID()}});
  const result=await new CompensationPeriodControlService(db as any).read({periodStart:'1896-01-01Z',periodEnd:'1896-01-08Z',ruleVersionCode});
  expect(result.lifecycle).toBe('BLOCKED');expect(result.checkpoints.find(row=>row.code==='VOLUME_RECOGNITION')).toMatchObject({status:'FAILED'});
  expect(result.blockingExceptions).toEqual(expect.arrayContaining([expect.objectContaining({code:'COMPENSATION_VOLUME_EVIDENCE_INVALID'})]));
  expect(JSON.stringify(result)).not.toContain(volume.eventId);expect(await db.pvLedger.findUnique({where:{eventId:volume.eventId}})).toEqual(volume);
 });
 it('rejects legacy receipt labels without sealed result evidence and keeps database identities private',async()=>{
  const periodStart=new Date('1894-01-01T00:00:00Z'),periodEnd=new Date('1894-01-08T00:00:00Z'),ruleVersionCode=`TEST_PERIOD_CONTROL_${randomUUID()}`,ids:string[]=[];
  for(const kind of ['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL']){
   const jobId=randomUUID(),outboxId=randomUUID();ids.push(jobId,outboxId);
   await db.outboxEvent.create({data:{outboxEventId:outboxId,eventType:'PERIOD_CLOSE_REQUESTED',aggregateType:'PERIOD_CLOSE_JOB',aggregateId:jobId,payload:{periodCloseJobId:jobId},processStatus:'PROCESSED',attemptCount:1,processedAt:new Date(),correlationId:randomUUID()}});
   await db.periodCloseJob.create({data:{periodCloseJobId:jobId,kind,periodStart,periodEnd,ruleVersionCode,parameterSnapshot:{ruleVersionCode,hash:'a'.repeat(64),values:[]},prerequisiteIds:[],requestedBy:'TEST_FINANCE',approvalReference:'TEST_CONTROL',outboxEventId:outboxId}});
   await db.periodCloseReceipt.create({data:{periodCloseJobId:jobId,sourceId:randomUUID(),snapshotId:randomUUID()}});
  }
  const result=await new CompensationPeriodControlService(db as any).read({periodStart:periodStart.toISOString(),periodEnd:periodEnd.toISOString(),ruleVersionCode}),serialized=JSON.stringify(result);
  expect(result.lifecycle).toBe('BLOCKED');expect(result.jobs).toHaveLength(4);expect(result.checkpoints.filter(row=>['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL'].includes(row.code)).every(row=>row.status==='FAILED')).toBe(true);expect(result.checkpoints.find(row=>row.code==='ERP_ACCOUNTING')).toMatchObject({status:'BLOCKED_EXTERNAL'});
  expect(result.blockingExceptions).toEqual(expect.arrayContaining([expect.objectContaining({code:'COMPENSATION_SEALED_RESULT_INVALID'})]));
  for(const id of ids)expect(serialized).not.toContain(id);expect(serialized).not.toContain('requestedBy');expect(serialized).not.toContain('parameterSnapshot');
  const aging=await new CompensationPeriodControlService(db as any).aging({thresholdHours:24,asOf:'1894-01-10T00:00:00Z'});expect(aging.items).toHaveLength(6);expect(aging.thresholdHours).toBe(24);expect(JSON.stringify(aging)).not.toContain(ids[0]);
 });
});
