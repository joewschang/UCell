import {PrismaClient,Prisma} from '@prisma/client';
import {enqueuePeriodCloseJob,claimPeriodCloseJob,processPeriodCloseJob,releaseFailedOutboxLease,PeriodCloseKind,sealGpvEvent,verifyReplayEnvelope} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {SettlementCalendarService} from '../src/modules/settlement/settlement-calendar.service';
import {ReferralBonusService} from '../src/modules/bonus/referral-bonus.service';
import {BinaryBonusService} from '../src/modules/bonus/binary-bonus.service';
import {GlobalPoolService} from '../src/modules/global-pool/global-pool.service';
import {GlobalPoolPersistence} from '../src/modules/global-pool/global-pool-persistence';
import {RuntimeRuleService} from '../src/modules/rules/runtime-rule.service';
import {BonusQueryService} from '../src/modules/bonus/bonus-query.service';
import {executePeriodClose} from '@ucell/settlement';
import {SettlementJobsController} from '../src/modules/settlement-jobs/settlement-jobs.controller';
import {AuditService} from '../src/common/audit/audit.service';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {pollPeriodCloseJobs} from '../../worker/src/period-close-runtime';
import {periodCloseOperationalState,periodJobReference} from '@ucell/database';
import {periodCloseCandidates} from '../src/modules/admin-operations/period-close-invariants';
import {compensationPeriodEvidence} from '../src/modules/settlement-jobs/compensation-period-evidence';
import {ErpCompensationProjectionService} from '../src/modules/commerce/erp-compensation-projection.service';
import {ErpBusinessProjectionService} from '../src/modules/commerce/erp-business-projection.service';
import {CompensationPeriodControlService} from '../src/modules/settlement-jobs/compensation-period-control.service';
import {OperationsWorkflowHealthService} from '../src/modules/admin-operations/operations-workflow-health.service';
import {OperationsWorkItemsService} from '../src/modules/admin-operations/operations-work-items.service';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {erpBusinessReference} from '@ucell/database';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('durable period-close admission, dependencies and fenced execution',()=>{
  let db:PrismaClient;
  let control:PrismaClient,created=false;
  const database='ucell_job_worker_'+randomUUID().replaceAll('-','');
  const start=new Date('1893-01-01T00:00:00Z'),end=new Date('1893-01-08T00:00:00Z');
  beforeAll(async()=>{
    // The worker's conservative global-input barrier needs its own disposable DB.
    const target=new URL(url!);
    if(!['localhost','127.0.0.1'].includes(target.hostname)||!/^\/ucell_jest_[a-f0-9]{32}$/.test(target.pathname))throw new Error('ISOLATED_RUNNER_REQUIRED');
    const admin=new URL(target);admin.pathname='/postgres';
    control=new PrismaClient({datasources:{db:{url:admin.href}}});
    await control.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;target.pathname='/'+database;
    const root=join(__dirname,'../../../packages/database');
    execFileSync(process.execPath,[require.resolve('prisma/build/index.js',{paths:[root]}),'migrate','deploy','--schema',join(root,'prisma/schema.prisma')],{env:{...process.env,DATABASE_URL:target.href},stdio:'pipe',timeout:60000});
    db=new PrismaClient({datasources:{db:{url:target.href}}});
  },90000);
  afterAll(async()=>{
    try{
      await db?.$disconnect();
      if(created)await control.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');
    }finally{await control?.$disconnect();}
  },30000);
  async function rule(){
    const code=`TEST_CLOSE_JOB_${randomUUID()}`;
    const values:Array<[string,string,Prisma.InputJsonValue]>=[['award.pending.days','*','45'],['pool.referral.rate','*','0.5'],['pool.binary.rate','*','0.2'],['pool.matching.rate','*','0.2'],['binary.pair.rate','*','0.1'],['pool.global.rate','*','0.05']];
    values.push(['pool.welfare.rate','*','0.02'],['binary.weekly.cap','STARTER','10000'],['referral.g1.rate','STARTER','0.15'],['matching.rate','1','0.1']);
    for(const kind of ['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE','PAYABLE_PREPARATION'])values.push(
      ['settlement.timezone',kind,'UTC'],['settlement.period',kind,{unit:'WEEK',count:1,anchorLocal:'1893-01-01T00:00:00'}],
      ['settlement.cut_off',kind,{localTime:'00:00:00',daysAfterPeriodEnd:0,approvalReference:'TEST_CALENDAR'}]);
    for(const rank of ['NEW_STAR','EXCELLENCE','GLORY','DIAMOND','CROWN'])values.push(['global.rank.weak_threshold',rank,'1000'],['global.rank.pool_rate',rank,'0.01']);
    for(const [parameterCode,scopeKey,valueJson] of values)await db.runtimeRuleParameter.create({data:{ruleVersionCode:code,parameterCode,scopeKey,valueJson,effectiveFrom:new Date('1890-01-01Z'),effectiveTo:new Date('1894-01-01Z')}});
    return code;
  }
  function enqueue(kind:PeriodCloseKind,code:string,prerequisiteIds:string[]=[],approvalReference='TEST_APPROVAL'){
    return enqueuePeriodCloseJob(db,{kind,periodStart:start,periodEnd:end,ruleVersionCode:code,prerequisiteIds,approvalReference,requestedBy:'TEST_FINANCE'},tx=>new SettlementCalendarService(db as any).captureForPeriod(tx,start,end,kind,code));
  }
  const execute=executePeriodClose;
  it('projects due monthly-recognition waits without including another rule or the next period',async()=>{
    const code=await rule(),job=await enqueue('REFERRAL_K0',code);
    const person=await db.person.create({data:{legalName:'Synthetic recognition dependency'}});
    const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
    const plan=await db.subscriptionPlan.create({data:{planCode:randomUUID(),displayName:'Dependency fixture',durationMonths:3,prepaidAmount:300,productBoxQty:2,monthlyRecognizedAmount:100,monthlyRpv:10}});
    const subscription=await db.subscription.create({data:{qualificationId:q.qualificationId,subscriptionPlanId:plan.subscriptionPlanId,status:'ACTIVE',startMonth:start,endMonth:end,ruleVersionCode:code}});
    const schedules=[];
    for(let index=0;index<3;index++)schedules.push(await db.monthlyRecognitionSchedule.create({data:{subscriptionId:subscription.subscriptionId,installmentNo:index+1,recognitionMonth:new Date(start.getTime()+index*31*86400000),recognizedAmount:100,rpvAmount:10,dueAt:index===1?end:start,ruleVersionCode:index===2?'OTHER_RULE':code}}));
    const read=()=>db.$transaction(async tx=>periodCloseOperationalState(tx,await tx.periodCloseJob.findUniqueOrThrow({where:{periodCloseJobId:job.periodCloseJobId},include:{receipt:true,outbox:true}})));
    expect(await read()).toMatchObject({state:'WAITING_RECOGNITION',waiting:{recognitions:1}});
    const monitor=new OperationsWorkflowHealthService(db as any),work=new OperationsWorkItemsService(db as any,new AuditService(),new IdempotencyService(db as any)),reference=periodJobReference(job.periodCloseJobId),context={actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()},health=await monitor.list({scope:'PERIOD_JOB',reference});
    expect(health.items[0].processTiming).toMatchObject({status:'RECORDED',basis:'DURABLE_PROCESS_TRANSITION'});
    expect(health.items[0].processTiming!.elapsedSeconds).toBeGreaterThanOrEqual(0);
    expect(health.items[0]).toMatchObject({state:'WAITING_RECOGNITION',candidates:[{code:'PERIOD_CLOSE_BLOCKED'}],actionLink:'/settlement-jobs?reference='+reference,periodLink:null});
    expect(JSON.stringify(health)).not.toContain(job.periodCloseJobId);expect(JSON.stringify(health)).not.toContain('TEST_FINANCE');
    const candidate=health.items[0].candidates[0],task=(await work.createTask({stream:'PERIOD_JOB',reference,code:candidate.code,evidenceHash:candidate.evidenceHash,assigneeRole:'FINANCE'},randomUUID(),context)).value.item;
    await work.transition('TASK',task.reference,{status:'COMPLETED',expectedStatus:'OPEN',noteReference:'PERIOD-CASE-01'},randomUUID(),context);expect((await monitor.list({scope:'PERIOD_JOB',reference})).items[0].state).toBe('WAITING_RECOGNITION');
    const exception=await db.operationalException.create({data:{sourceType:'PERIOD_CLOSE_JOB',sourceId:job.periodCloseJobId,exceptionCode:'PERIOD_CLOSE_BLOCKED',severity:'HIGH',summary:'PRIVATE PERIOD'}}),exceptionRef=erpBusinessReference('OPS-EXCEPTION',exception.operationalExceptionId),resolve=()=>work.transition('EXCEPTION',exceptionRef,{status:'RESOLVED',expectedStatus:'OPEN',noteReference:'PERIOD-CASE-02'},randomUUID(),context);
    await expect(resolve()).rejects.toMatchObject({response:{code:'OPERATIONS_WORKFLOW_COMPLETION_REQUIRED'}});
    const ops=new AdminOperationsService(db as any,new AuditService());await expect(ops.transitionOperationalException(exception.operationalExceptionId,'RESOLVED',context.actorId,'PERIOD-CASE-02',context.requestId,context.correlationId)).rejects.toThrow();
    const recognitionReference=erpBusinessReference('RECOGNITION',schedules[0].recognitionId),recognition=(await monitor.list({scope:'RECOGNITION',reference:recognitionReference})).items[0];expect(recognition.candidates[0].code).toBe('OVERDUE_RECOGNITION');
    expect((await work.createTask({stream:'RECOGNITION',reference:recognitionReference,code:'OVERDUE_RECOGNITION',evidenceHash:recognition.candidates[0].evidenceHash,assigneeRole:'FINANCE'},randomUUID(),context)).value.created).toBe(true);
    const newest=await monitor.list({scope:'RECOGNITION',take:1});expect(newest.nextCursor).toBeTruthy();const next=await monitor.list({scope:'RECOGNITION',take:1,cursor:newest.nextCursor!,asOf:newest.asOf});expect(next.items[0].reference).not.toBe(newest.items[0].reference);
    expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:job.outboxEventId}})).attemptCount).toBe(0);
    await db.monthlyRecognitionSchedule.update({where:{recognitionId:schedules[0].recognitionId},data:{status:'CANCELLED'}});
    expect(await read()).toMatchObject({state:'READY',waiting:{recognitions:0}});
    await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,execute);
    expect(await read()).toMatchObject({state:'COMPLETED',overdue:false});
    expect((await monitor.list({scope:'PERIOD_JOB',reference})).items[0]).toMatchObject({state:'COMPLETED',candidates:[]});expect((await resolve()).value.status).toBe('RESOLVED');
    const controller=new SettlementJobsController(db as any,new SettlementCalendarService(db as any),new AuditService());expect((await controller.get(reference)).data.id).toBe(job.periodCloseJobId);expect((await controller.get(reference,'24')).data.operational.thresholdHours).toBe(24);await expect(controller.get(reference,'0')).rejects.toThrow('PERIOD_CLOSE_THRESHOLD_INVALID');
  });
  it('reads dependency/source waits, safe failure evidence and exact operator overdue boundaries',async()=>{
    const code=await rule(),binary=await enqueue('BINARY_K1',code),matching=await enqueue('MATCHING_K2',code,[binary.periodCloseJobId]);
    const read=(id:string,now=new Date(),thresholdHours?:number)=>db.$transaction(async tx=>periodCloseOperationalState(tx,await tx.periodCloseJob.findUniqueOrThrow({where:{periodCloseJobId:id},include:{receipt:true,outbox:true}}),{now,thresholdHours}),{isolationLevel:'RepeatableRead'});
    expect(await read(matching.periodCloseJobId)).toMatchObject({state:'WAITING_PREREQUISITE',overdue:null,waiting:{prerequisites:1},dependencies:[{reference:periodJobReference(binary.periodCloseJobId),kind:'BINARY_K1',complete:false}]});
    expect((await read(binary.periodCloseJobId,new Date(end.getTime()+3600000-1),1)).overdue).toBe(false);
    expect((await read(binary.periodCloseJobId,new Date(end.getTime()+3600000),1)).overdue).toBe(true);
    const event=await db.outboxEvent.create({data:{eventType:'SALE_CONFIRMED',aggregateType:'TEST',aggregateId:randomUUID(),payload:{},correlationId:randomUUID()}});
    expect(await read(binary.periodCloseJobId)).toMatchObject({state:'WAITING_SOURCE_INPUTS',waiting:{sourceEvents:1}});
    await db.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{processStatus:'PROCESSED'}});
    await db.outboxEvent.update({where:{outboxEventId:binary.outboxEventId},data:{processStatus:'DEAD',lastError:'private-token=secret@example.test'}});
    const controller=new SettlementJobsController(db as any,new SettlementCalendarService(db as any),new AuditService());
    const response=await controller.get(binary.periodCloseJobId);
    expect(response.data.operational.state).toBe('FAILED');expect(JSON.stringify(response)).not.toContain('secret@example.test');
    const candidates=await db.$transaction(tx=>periodCloseCandidates(tx,200,24));
    expect(candidates).toEqual(expect.arrayContaining([expect.objectContaining({code:'PERIOD_CLOSE_DEAD',reference:periodJobReference(binary.periodCloseJobId)}),expect.objectContaining({code:'PERIOD_CLOSE_OVERDUE',reference:periodJobReference(matching.periodCloseJobId)})]));
    expect(JSON.stringify(candidates)).not.toContain(binary.periodCloseJobId);expect(JSON.stringify(candidates)).not.toContain('private-token');
    await db.outboxEvent.update({where:{outboxEventId:binary.outboxEventId},data:{processStatus:'PROCESSED'}});
    expect((await read(binary.periodCloseJobId)).state).toBe('EVIDENCE_INCONSISTENT');
  });
  it('dispatches real Binary and dependent Matching jobs through the Worker poller',async()=>{
    const code=await rule(),binary=await enqueue('BINARY_K1',code),matching=await enqueue('MATCHING_K2',code,[binary.periodCloseJobId]);
    expect((await pollPeriodCloseJobs(db as any,{PERIOD_CLOSE_WORKER_ENABLED:'true'})).completed).toBe(1);
    expect(await db.periodCloseReceipt.findUnique({where:{periodCloseJobId:matching.periodCloseJobId}})).toBeNull();
    expect((await pollPeriodCloseJobs(db as any,{PERIOD_CLOSE_WORKER_ENABLED:'true'})).completed).toBe(1);
    expect(await db.periodCloseReceipt.count({where:{periodCloseJobId:{in:[binary.periodCloseJobId,matching.periodCloseJobId]}}})).toBe(2);
    expect((await pollPeriodCloseJobs(db as any,{PERIOD_CLOSE_WORKER_ENABLED:'true'})).completed).toBe(0);
  });
  it('records authenticated admission and audit atomically, with one audit on replay',async()=>{
    const code=await rule(),actor=randomUUID(),controller=new SettlementJobsController(db as any,new SettlementCalendarService(db as any),new AuditService());
    const body={kind:'REFERRAL_K0' as const,periodStart:start.toISOString(),periodEnd:end.toISOString(),ruleVersionCode:code,prerequisiteIds:[],approvalReference:'TEST_FINANCE_APPROVAL'};
    const req={user:{personId:actor,role:'FINANCE'}};
    const first=await controller.create(body,req),again=await controller.create(body,req);
    expect(again.data.id).toBe(first.data.id);expect(first.data.requestedBy).toBe(actor);
    expect(first.data).not.toHaveProperty('parameterSnapshot');
    const audits=await db.auditEvent.findMany({where:{entityId:first.data.id,action:'PERIOD_CLOSE_REQUESTED'}});
    expect(audits).toHaveLength(1);expect(audits[0]).toMatchObject({actorId:actor,actorRoleSnapshot:'FINANCE'});
    await expect(controller.create(body,{user:{role:'SUPER_ADMIN'}})).rejects.toThrow('AUTHENTICATED_ACTOR_REQUIRED');
  });
  it('does not leave a job or Outbox request if admission audit fails',async()=>{
    const code=await rule(),controller=new SettlementJobsController(db as any,new SettlementCalendarService(db as any),{write:async()=>{throw new Error('AUDIT_FAILED');}} as any);
    await expect(controller.create({kind:'REFERRAL_K0',periodStart:start.toISOString(),periodEnd:end.toISOString(),ruleVersionCode:code,prerequisiteIds:[],approvalReference:'TEST'}, {user:{personId:randomUUID(),role:'FINANCE'}})).rejects.toThrow('AUDIT_FAILED');
    expect(await db.periodCloseJob.count({where:{ruleVersionCode:code}})).toBe(0);
  });
  it('deduplicates simultaneous admission and rejects changed approval/dependencies',async()=>{
    const code=await rule();
    const jobs=await Promise.all(Array.from({length:4},()=>enqueue('REFERRAL_K0',code)));
    expect(jobs.every(job=>job.periodCloseJobId===jobs[0].periodCloseJobId)).toBe(true);
    expect(await db.outboxEvent.count({where:{aggregateId:jobs[0].periodCloseJobId}})).toBe(1);
    await expect(enqueue('REFERRAL_K0',code,[],'CHANGED')).rejects.toThrow('PERIOD_CLOSE_REQUEST_CONFLICT');
    await expect(enqueue('REFERRAL_K0',code,[randomUUID()])).rejects.toThrow('PERIOD_CLOSE_REQUEST_CONFLICT');
  });
  it('rejects missing, cross-rule and missing Binary prerequisites before writing Outbox',async()=>{
    const code=await rule(),other=await enqueue('BINARY_K1',await rule());
    await expect(enqueue('MATCHING_K2',code)).rejects.toThrow('PERIOD_CLOSE_BINARY_REQUIRED');
    await expect(enqueue('MATCHING_K2',code,[randomUUID()])).rejects.toThrow('PERIOD_CLOSE_PREREQUISITE_INVALID');
    await expect(enqueue('MATCHING_K2',code,[other.periodCloseJobId])).rejects.toThrow('PERIOD_CLOSE_PREREQUISITE_INVALID');
    expect(await db.periodCloseJob.count({where:{ruleVersionCode:code}})).toBe(0);
  });
  it('keeps blocked jobs unclaimed, then executes Binary before Matching with one lease owner',async()=>{
    const code=await rule(),binary=await enqueue('BINARY_K1',code),matching=await enqueue('MATCHING_K2',code,[binary.periodCloseJobId]);
    for(let i=0;i<12;i++)expect(await claimPeriodCloseJob(db,matching.periodCloseJobId)).toBeNull();
    expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:matching.outboxEventId}})).attemptCount).toBe(0);
    const claims=await Promise.all([claimPeriodCloseJob(db,binary.periodCloseJobId),claimPeriodCloseJob(db,binary.periodCloseJobId)]);
    expect(claims.filter(Boolean)).toHaveLength(1);
    await processPeriodCloseJob(db,claims.find(Boolean)!,execute);
    await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,matching.periodCloseJobId))!,execute);
    expect(await db.periodCloseReceipt.count({where:{periodCloseJobId:{in:[binary.periodCloseJobId,matching.periodCloseJobId]}}})).toBe(2);
    expect(await claimPeriodCloseJob(db,matching.periodCloseJobId)).toBeNull();
  });
  it.each(['REFERRAL_K0','GLOBAL'] as const)('atomically records %s sealed result and rejects delivery replay',async kind=>{
    const job=await enqueue(kind,await rule()),lease=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    const receipt=await processPeriodCloseJob(db,lease,execute);
    expect(receipt).toHaveProperty('snapshotId');
    expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:job.outboxEventId}})).processStatus).toBe('PROCESSED');
    const callback=jest.fn(execute);
    expect(await processPeriodCloseJob(db,lease,callback)).toEqual({lostLease:true});expect(callback).not.toHaveBeenCalled();
  });
  it('rolls back settlement and receipt on failure, then recovers with a new lease',async()=>{
    const job=await enqueue('REFERRAL_K0',await rule()),lease=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    await expect(processPeriodCloseJob(db,lease,async(tx,row)=>{await execute(tx,row);throw new Error('AFTER_SETTLEMENT');})).rejects.toThrow('AFTER_SETTLEMENT');
    expect(await db.settlementBatch.count({where:{ruleVersionCode:job.ruleVersionCode}})).toBe(0);
    expect(await db.periodCloseReceipt.count({where:{periodCloseJobId:job.periodCloseJobId}})).toBe(0);
    await releaseFailedOutboxLease(db,lease,new Error('AFTER_SETTLEMENT'),new Date(Date.now()-31000));
    await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,execute);
    expect(await db.periodCloseReceipt.count({where:{periodCloseJobId:job.periodCloseJobId}})).toBe(1);
  });
  it('allows Finance to requeue an incomplete dead job with immutable audit evidence',async()=>{
    const job=await enqueue('REFERRAL_K0',await rule()),actor=randomUUID();
    await db.outboxEvent.update({where:{outboxEventId:job.outboxEventId},data:{processStatus:'DEAD',attemptCount:10,lastError:'SYNTHETIC_FAILURE'}});
    const controller=new SettlementJobsController(db as any,new SettlementCalendarService(db as any),new AuditService());
    const result=await controller.retry(job.periodCloseJobId,{reason:'Synthetic source repaired'},{user:{personId:actor,role:'FINANCE'}});
    expect(result.data).toMatchObject({status:'PENDING',attemptCount:10,lastError:null});
    expect(await db.auditEvent.count({where:{entityId:job.periodCloseJobId,action:'PERIOD_CLOSE_RETRY_REQUESTED',actorId:actor}})).toBe(1);
    await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,execute);
    await expect(controller.retry(job.periodCloseJobId,{reason:'Must not duplicate'},{user:{personId:actor,role:'FINANCE'}})).rejects.toThrow('PERIOD_CLOSE_ALREADY_COMPLETED');
  });
  it('fences expired owners and prevents their failure handler from overwriting recovery',async()=>{
    const job=await enqueue('BINARY_K1',await rule()),first=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    await db.outboxEvent.update({where:{outboxEventId:job.outboxEventId},data:{availableAt:new Date(Date.now()-1000)}});
    const second=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    const callback=jest.fn(execute);
    expect(await processPeriodCloseJob(db,first,callback)).toEqual({lostLease:true});expect(callback).not.toHaveBeenCalled();
    await processPeriodCloseJob(db,second,execute);
    expect((await releaseFailedOutboxLease(db,first,new Error('STALE'))).count).toBe(0);
  });
  it('fails closed on parameter drift and preserves immutable job/receipt evidence',async()=>{
    const job=await enqueue('REFERRAL_K0',await rule());
    await expect(db.periodCloseJob.update({where:{periodCloseJobId:job.periodCloseJobId},data:{approvalReference:'MUTATED'}})).rejects.toThrow();
    await db.runtimeRuleParameter.updateMany({where:{ruleVersionCode:job.ruleVersionCode,parameterCode:'pool.referral.rate'},data:{valueJson:'0.4'}});
    await expect(processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,execute)).rejects.toThrow('PERIOD_CLOSE_PARAMETER_DRIFT');
    expect(await db.settlementBatch.count({where:{ruleVersionCode:job.ruleVersionCode}})).toBe(0);
    const clean=await enqueue('REFERRAL_K0',await rule());
    await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,clean.periodCloseJobId))!,execute);
    await expect(db.periodCloseReceipt.delete({where:{periodCloseJobId:clean.periodCloseJobId}})).rejects.toThrow();
  });
  it('requires same-period Global, waits without consuming retries, and seals Welfare exactly once',async()=>{
    const code=await rule();
    await expect(enqueue('WELFARE',code)).rejects.toThrow('PERIOD_CLOSE_GLOBAL_REQUIRED');
    const global=await enqueue('GLOBAL',code),welfare=await enqueue('WELFARE',code,[global.periodCloseJobId]);
    expect(await claimPeriodCloseJob(db,welfare.periodCloseJobId)).toBeNull();
    expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:welfare.outboxEventId}})).attemptCount).toBe(0);
    await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,global.periodCloseJobId))!,execute);
    const lease=(await claimPeriodCloseJob(db,welfare.periodCloseJobId))!;
    await processPeriodCloseJob(db,lease,execute);
    const accrual=await db.welfarePoolAccrual.findFirstOrThrow({where:{ruleVersionCode:code}});
    const snapshot=await db.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'WELFARE',sourceId:accrual.welfarePoolAccrualId}}});
    expect(verifyReplayEnvelope(snapshot)).toMatchObject({kind:'WELFARE',inputs:{totalGpv:'0.0000',accruedAmount:'0.0000'},recipients:[]});
    expect(await db.welfarePoolEffect.count({where:{welfarePoolAccrualId:accrual.welfarePoolAccrualId}})).toBe(1);
    expect(await processPeriodCloseJob(db,lease,execute)).toEqual({lostLease:true});
    expect(await enqueue('WELFARE',code,[global.periodCloseJobId])).toEqual(welfare);
  });
  it('rolls back funded Welfare and its sealed evidence together, excludes other rules, then recovers once',async()=>{
    const code=await rule(),foreign=await rule();
    await db.$transaction(async tx=>{
      const person=await tx.person.create({data:{legalName:'Synthetic Welfare source'}});
      const q=await tx.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:start}});
      await tx.qualificationPlanHistory.create({data:{qualificationId:q.qualificationId,planCode:'STARTER',effectiveFrom:start,sourceType:'TEST_WELFARE'}});
      await tx.qualificationStatusHistory.create({data:{qualificationId:q.qualificationId,status:'EFFECTIVE',effectiveFrom:start,sourceType:'TEST_WELFARE'}});
      const product=await tx.productReference.create({data:{sku:randomUUID(),displayName:'Synthetic Welfare',currentPrice:100}});
      for(const ruleVersionCode of [code,foreign]){
        const order=await tx.order.create({data:{qualificationId:q.qualificationId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode}});
        const line=await tx.orderLine.create({data:{orderId:order.orderId,productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:'Synthetic Welfare',quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:1,gpvAmountSnapshot:100,ruleProfileSnapshot:{}}});
        const event=await tx.pvLedger.create({data:{qualificationId:q.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:order.orderId,sourceLineId:line.orderLineId,eventType:'GPV_CREATED',ruleVersionCode,occurredAt:start,correlationId:randomUUID()}});
        await sealGpvEvent(tx,event);
      }
    });
    const global=await enqueue('GLOBAL',code),job=await enqueue('WELFARE',code,[global.periodCloseJobId]);
    await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,global.periodCloseJobId))!,execute);
    const first=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    await expect(processPeriodCloseJob(db,first,async(tx,row)=>{await execute(tx,row);throw new Error('WELFARE_AFTER_SEAL');})).rejects.toThrow('WELFARE_AFTER_SEAL');
    expect(await db.welfarePoolAccrual.count({where:{ruleVersionCode:code}})).toBe(0);
    expect(await db.welfarePoolEffect.count({where:{ruleVersionCode:code}})).toBe(0);
    expect(await db.historicalReplaySnapshot.count({where:{kind:'WELFARE',ruleVersionCode:code}})).toBe(0);
    expect(await db.periodCloseReceipt.count({where:{periodCloseJobId:job.periodCloseJobId}})).toBe(0);
    await releaseFailedOutboxLease(db,first,new Error('WELFARE_AFTER_SEAL'),new Date(Date.now()-31000));
    await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,execute);
    const accrual=await db.welfarePoolAccrual.findFirstOrThrow({where:{ruleVersionCode:code}});
    expect(accrual.totalGpv.toString()).toBe('100');expect(accrual.accruedAmount.toString()).toBe('2');
    const snapshot=await db.historicalReplaySnapshot.findUniqueOrThrow({where:{kind_sourceId:{kind:'WELFARE',sourceId:accrual.welfarePoolAccrualId}}});
    expect(verifyReplayEnvelope(snapshot).evidence.sources).toHaveLength(1);
    expect(await db.welfarePoolEffect.count({where:{ruleVersionCode:code}})).toBe(1);
    expect(await db.payableEntry.count({where:{ruleVersionCode:code}})).toBe(0);
  });
  async function preparation(code:string){
    const ids:string[]=[];
    for(const kind of ['REFERRAL_K0','BINARY_K1','MATCHING_K2','GLOBAL','WELFARE'] as const){
      const prerequisites=kind==='MATCHING_K2'?[ids[1]]:kind==='WELFARE'?[ids[3]]:[];
      const job=await enqueue(kind,code,prerequisites);
      await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,execute);
      ids.push(job.periodCloseJobId);
    }
    return enqueue('PAYABLE_PREPARATION',code,ids);
  }
  async function directAward(code:string,at:Date,pendingUntil:Date){
    const person=await db.person.create({data:{legalName:'Synthetic preparation'}});
    const q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
    const award=await db.bonusAward.create({data:{awardType:'EPV',recipientQualificationId:q.qualificationId,theoryAmount:10,payableAmount:10,activeSnapshot:true,ruleVersionCode:code,occurredAt:at,pendingUntil,calculationDetail:{synthetic:true}}});
    await db.bonusAwardLifecycleEvent.create({data:{bonusAwardId:award.bonusAwardId,status:'PENDING_45D',occurredAt:at}});
    return award;
  }
  it('rejects incomplete preparation manifests and seals an empty preparation exactly once',async()=>{
    const code=await rule();
    await expect(enqueue('PAYABLE_PREPARATION',code)).rejects.toThrow('PERIOD_CLOSE_PAYABLE_COVERAGE_REQUIRED');
    const job=await preparation(code),lease=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    await processPeriodCloseJob(db,lease,execute);
    const receipt=await db.periodCloseReceipt.findUniqueOrThrow({where:{periodCloseJobId:job.periodCloseJobId}});
    expect(verifyReplayEnvelope(await db.historicalReplaySnapshot.findUniqueOrThrow({where:{snapshotId:receipt.snapshotId}}))).toMatchObject({kind:'PAYABLE_PREPARATION',evidence:{payables:[],created:0}});
    expect(await processPeriodCloseJob(db,lease,execute)).toEqual({lostLease:true});
    const cohort=await db.$transaction(tx=>compensationPeriodEvidence(tx,{periodStart:start,periodEnd:end,ruleVersionCode:code}));
    expect(cohort.allComplete).toBe(true);expect(cohort.required).toHaveLength(6);expect(cohort.sealed.size).toBe(6);expect(cohort.inputSealedAt).toBeInstanceOf(Date);
  });
  it('waits for award maturity without a lease or retry attempt',async()=>{
    const code=await rule(),job=await preparation(code);
    const maturesAt=new Date(Date.now()+86400000);
    await directAward(code,start,maturesAt);
    for(let i=0;i<3;i++)expect(await claimPeriodCloseJob(db,job.periodCloseJobId)).toBeNull();
    expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:job.outboxEventId}})).attemptCount).toBe(0);
    expect(await db.payableEntry.count({where:{ruleVersionCode:code}})).toBe(0);
    const state=await db.$transaction(async tx=>periodCloseOperationalState(tx,await tx.periodCloseJob.findUniqueOrThrow({where:{periodCloseJobId:job.periodCloseJobId},include:{receipt:true,outbox:true}}),{thresholdHours:1}));
    expect(state).toMatchObject({state:'WAITING_MATURITY',overdue:false,maturesAt:maturesAt.toISOString(),eligibleAt:maturesAt.toISOString()});
  });
  it('atomically matures and materializes only this period/rule, with rollback and replay protection',async()=>{
    const code=await rule(),job=await preparation(code);
    const inside=await directAward(code,start,end),outside=await directAward(code,new Date(start.getTime()-86400000),start),foreign=await directAward(await rule(),start,end);
    const lease=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    await expect(processPeriodCloseJob(db,lease,async(tx,row)=>{await execute(tx,row);throw new Error('PREPARATION_AFTER_SEAL');})).rejects.toThrow('PREPARATION_AFTER_SEAL');
    expect(await db.payableEntry.count({where:{ruleVersionCode:code}})).toBe(0);
    expect(await db.bonusAwardLifecycleEvent.count({where:{bonusAwardId:inside.bonusAwardId,status:'EFFECTIVE'}})).toBe(0);
    expect(await db.historicalReplaySnapshot.count({where:{kind:'PAYABLE_PREPARATION',sourceId:job.periodCloseJobId}})).toBe(0);
    await releaseFailedOutboxLease(db,lease,new Error('PREPARATION_AFTER_SEAL'),new Date(Date.now()-31000));
    const next=(await claimPeriodCloseJob(db,job.periodCloseJobId))!;
    await processPeriodCloseJob(db,next,execute);
    const entries=await db.payableEntry.findMany({where:{ruleVersionCode:code}});
    expect(entries).toHaveLength(1);expect(entries[0].sourceId).toBe(inside.bonusAwardId);
    expect(await db.payableEntry.count({where:{sourceId:{in:[outside.bonusAwardId,foreign.bonusAwardId]}}})).toBe(0);
    expect(await db.bonusAwardLifecycleEvent.count({where:{bonusAwardId:inside.bonusAwardId,status:'EFFECTIVE'}})).toBe(1);
    expect(await processPeriodCloseJob(db,next,execute)).toEqual({lostLease:true});
    expect(await db.payableEntry.findMany({where:{ruleVersionCode:code}})).toEqual(entries);
  });
  it('approves a deterministic aggregate after real six-kind settlement and preserves immutable replay',async()=>{
    const code=await rule(),award=await directAward(code,start,end),job=await preparation(code);await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,execute);
    const service=new ErpCompensationProjectionService(db as any,new AuditService()),input={periodStart:start.toISOString(),periodEnd:end.toISOString(),ruleVersionCode:code,accountingDate:'1893-01-09',currency:'TWD',currencyBasisReference:'TEST-LEDGER-TWD',groupByPayoutBatch:true},context={actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()};
    const first=await service.preview(input);expect(await service.preview(input)).toEqual(first);expect(first.expected.aggregates).toEqual([expect.objectContaining({metric:'MEMBER_PAYABLE_GROSS',economicCategory:'EPV',amount:'10.0000',sourceCount:1,payoutReference:'UNBATCHED'})]);
    expect(JSON.stringify(first)).not.toContain(award.bonusAwardId);expect(JSON.stringify(first)).not.toContain(award.recipientQualificationId);
    const request={...input,reviewHash:first.reviewHash,approvalReference:'TEST-FINANCE-APPROVAL'},results=await Promise.all([service.approve(request,context),service.approve(request,context)]);expect(results.map(row=>row.replayed).sort()).toEqual([false,true]);
    const stored=await db.erpBusinessProjection.findUniqueOrThrow({where:{projectionReference:first.projectionReference}});expect(stored.mappingReference).toBeNull();expect(stored.drillbackHash).toBe(first.drillbackHash);expect(await db.erpProjectionDispatch.count({where:{projectionId:stored.projectionId}})).toBe(0);expect(await db.auditEvent.count({where:{entityId:stored.projectionId,action:'ERP_COMPENSATION_PROJECTION_APPROVED'}})).toBe(1);
    const reader=new ErpBusinessProjectionService(db as any,new AuditService()),detail=await reader.detail(first.projectionReference);expect(detail.blockedReason).toBe('ERP_ACCOUNT_MAPPING_REQUIRED');expect((detail.expected as any).totals.memberPayableGross).toBe('10.0000');expect(JSON.stringify(detail)).not.toContain(award.bonusAwardId);expect(JSON.stringify(detail)).not.toContain(context.actorId);
    const sourcePage=await reader.sources(first.projectionReference,{kind:'PAYABLE',take:1});expect(sourcePage).toMatchObject({verified:true,total:1,nextCursor:null,drillbackHash:stored.drillbackHash,items:[{economicCategory:'EPV',amount:'10.0000'}]});expect(JSON.stringify(sourcePage)).not.toContain(award.bonusAwardId);await expect(reader.sources(first.projectionReference,{kind:'PAYABLE',cursor:'PAYABLE-'+'0'.repeat(40)})).rejects.toMatchObject({response:{code:'ERP_PROJECTION_SOURCE_CURSOR_INVALID'}});
    const control=new CompensationPeriodControlService(db as any);expect((await control.read(input)).erpAccounting).toMatchObject({state:'SEALED_MAPPING_REQUIRED',status:'BLOCKED_EXTERNAL',memberPayableGross:'10.0000',sourceChanged:false});
    await expect(service.approve({...request,accountingDate:'1893-01-10'},context)).rejects.toMatchObject({response:{code:'ERP_COMPENSATION_APPROVAL_CONFLICT'}});
    await db.bonusRecoveryEvent.create({data:{bonusAwardId:award.bonusAwardId,recoveryAmount:5,outstandingAmount:5,reasonCode:'TEST_AFTER_APPROVAL',occurredAt:new Date()}});
    expect((await control.read(input)).erpAccounting).toMatchObject({state:'SUPPLEMENT_REQUIRED',status:'ATTENTION',sourceChanged:true});
    const supplemental=await service.previewSupplement({...input,previousProjectionReference:first.projectionReference});await service.approveSupplement({...input,previousProjectionReference:first.projectionReference,reviewHash:supplemental.reviewHash,approvalReference:'TEST-SUPPLEMENT-FINANCE',reasonReference:'TEST-RETURN-RECOVERY'},context);expect((await control.read(input)).erpAccounting).toMatchObject({projectionReference:supplemental.projectionReference,state:'SEALED_MAPPING_REQUIRED',sourceChanged:false});
    expect((await service.approve(request,context)).replayed).toBe(true);expect(await db.erpBusinessProjection.findUniqueOrThrow({where:{projectionReference:first.projectionReference}})).toEqual(stored);
  });
  it('invalidates an aggregate preview on a new recovery and rolls back failed approval audit',async()=>{
    const code=await rule(),award=await directAward(code,start,end),job=await preparation(code);await processPeriodCloseJob(db,(await claimPeriodCloseJob(db,job.periodCloseJobId))!,execute);
    const service=new ErpCompensationProjectionService(db as any,new AuditService()),input={periodStart:start.toISOString(),periodEnd:end.toISOString(),ruleVersionCode:code,accountingDate:'1893-01-09',currency:'TWD',currencyBasisReference:'TEST-LEDGER-TWD',groupByPayoutBatch:false},context={actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()},first=await service.preview(input);
    await db.bonusRecoveryEvent.create({data:{bonusAwardId:award.bonusAwardId,recoveryAmount:4,outstandingAmount:4,reasonCode:'TEST_BEFORE_APPROVAL',occurredAt:new Date()}});
    await expect(service.approve({...input,reviewHash:first.reviewHash,approvalReference:'TEST-FINANCE-APPROVAL'},context)).rejects.toMatchObject({response:{code:'ERP_COMPENSATION_PREVIEW_STALE'}});
    const fresh=await service.preview(input);expect(fresh.reviewHash).not.toBe(first.reviewHash);expect(fresh.expected.totals).toMatchObject({memberPayableGross:'10.0000',recoveryRequired:'4.0000',recoveryApplied:'0.0000',recoveryOutstanding:'4.0000'});expect(fresh.expected.paymentScope).toBe('NO_BANK_OR_NET_PAYMENT_ALLOCATION');
    const broken=new ErpCompensationProjectionService(db as any,{write:async()=>{throw new Error('SYNTHETIC_COMPENSATION_AUDIT_FAILURE');}} as any),count=await db.outboxEvent.count();
    await expect(broken.approve({...input,reviewHash:fresh.reviewHash,approvalReference:'TEST-FINANCE-APPROVAL'},context)).rejects.toThrow('SYNTHETIC_COMPENSATION_AUDIT_FAILURE');expect(await db.erpBusinessProjection.count({where:{projectionReference:fresh.projectionReference}})).toBe(0);expect(await db.outboxEvent.count()).toBe(count);
  });
  it('does not project an unsealed compensation period or invent invalid date and currency configuration',async()=>{
    const code=await rule(),service=new ErpCompensationProjectionService(db as any,new AuditService()),input={periodStart:start.toISOString(),periodEnd:end.toISOString(),ruleVersionCode:code,accountingDate:'1893-01-09',currency:'TWD',currencyBasisReference:'TEST-LEDGER-TWD',groupByPayoutBatch:false};
    await expect(service.preview(input)).rejects.toMatchObject({response:{code:'ERP_COMPENSATION_SEALED_PERIOD_REQUIRED'}});
    await expect(service.preview({...input,accountingDate:'1893-02-30'})).rejects.toMatchObject({response:{code:'ERP_COMPENSATION_CONFIGURATION_INVALID'}});
    await expect(service.preview({...input,currencyBasisReference:''})).rejects.toMatchObject({response:{code:'ERP_COMPENSATION_CONFIGURATION_INVALID'}});
  });
});
