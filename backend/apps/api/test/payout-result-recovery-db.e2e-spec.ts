import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {ConfigService} from '@nestjs/config';
import {PrismaService} from '@ucell/database';
import {MemberPayoutController} from '../src/modules/member/member-payout.controller';
import {MemberReadService} from '../src/modules/member/member-read.service';
import {MemberService} from '../src/modules/member/member.service';
import {QualificationAccessService} from '../src/modules/auth/qualification-access.service';
import {MemberAuthenticationGuard} from '../src/modules/auth/member-authentication.guard';
import {MemberContextGuard} from '../src/modules/member/member-context.guard';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {LineIdentityService} from '../src/modules/auth/line-identity.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
import {MemberMessagesService} from '../src/modules/member/member-messages.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';
import {CompensationPeriodControlService} from '../src/modules/settlement-jobs/compensation-period-control.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('controlled payout result recovery',()=>{
 let db:PrismaClient,service:AdminOperationsService;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});service=new AdminOperationsService(db as any,new AuditService());});
 afterAll(async()=>db?.$disconnect());
 async function fixture(extraLine=false,periodStart=new Date('2026-01-01Z'),periodEnd=new Date('2026-02-01Z')){
  const person=await db.person.create({data:{legalName:'Synthetic payment recovery',status:'EFFECTIVE'}}),actor=randomUUID();
  const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
  await db.qualificationHolderHistory.create({data:{qualificationId:qualification.qualificationId,holderPersonId:person.personId,effectiveFrom:new Date(0),sourceType:'TEST'}});
  const batch=await db.payoutBatch.create({data:{periodStart,periodEnd,status:'READY',totalGross:extraLine?200:100,totalRecovery:0,totalNet:extraLine?200:100}});
  const line=await db.payoutLine.create({data:{payoutBatchId:batch.payoutBatchId,recipientQualificationId:qualification.qualificationId,grossAmount:100,netAmount:100,detailJson:{source:'synthetic'}}});
  const payable=await db.payableEntry.create({data:{qualificationId:qualification.qualificationId,sourceType:'MANUAL_TEST',sourceId:line.payoutLineId,awardType:'REFERRAL',grossAmount:100,availableAt:new Date(),status:'ALLOCATED',payoutLineId:line.payoutLineId,ruleVersionCode:'SYNTHETIC'}});
  if(extraLine){const recipient=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});await db.payoutLine.create({data:{payoutBatchId:batch.payoutBatchId,recipientQualificationId:recipient.qualificationId,grossAmount:100,netAmount:100,detailJson:{source:'synthetic-second'}}});}
  await service.approvePayout(batch.payoutBatchId,'FINANCE_REVIEW',actor,'FINANCE',undefined,randomUUID(),randomUUID());
  await service.approvePayout(batch.payoutBatchId,'COMPLIANCE_REVIEW',randomUUID(),'COMPLIANCE_AUDIT',undefined,randomUUID(),randomUUID());
  await service.exportPayout(batch.payoutBatchId,randomUUID(),actor,'FINANCE',randomUUID(),randomUUID());
  const result=(paidAmount:string,status:'PAID'|'FAILED'='PAID')=>({payoutLineId:line.payoutLineId,status,paidAmount,paymentReference:`SYNTHETIC-${status}-${paidAmount}`,reasonCode:status==='FAILED'?'BANK_REJECTED':undefined});
  const post=(rows:ReturnType<typeof result>[])=>service.recordPayoutResults(batch.payoutBatchId,{results:rows},actor,'FINANCE',randomUUID(),randomUUID());
  return {batch,line,payable,result,post,actor,person,qualification};
 }
 it('serves the actual protected payout endpoint with stable pagination and no private bank references',async()=>{
  const f=await fixture();await f.post([f.result('40')]);const access=new QualificationAccessService(db as any),identity=new MemberService(db as any,{} as any,access,new AuditService()),tokens=new IdentityTokenService(db as any);
  async function token(personId:string){const subject=randomUUID();await db.identityLink.create({data:{provider:'LINE',providerSubject:subject,personId}});return (await tokens.issue({provider:'LINE',subject,personId})).accessToken;}
  const own=await token(f.person.personId),foreignPerson=await db.person.create({data:{legalName:'Foreign payout HTTP',status:'EFFECTIVE'}}),foreign=await token(foreignPerson.personId);
  await db.payoutPaymentResult.createMany({data:Array.from({length:51},()=>({payoutBatchId:f.batch.payoutBatchId,payoutLineId:f.line.payoutLineId,resultStatus:'PAID' as const,paidAmount:'40',paymentReference:'SENSITIVE_BANK_REFERENCE',occurredAt:new Date(),recordedByActor:f.actor,idempotencyKey:randomUUID()}))});
  const module=await Test.createTestingModule({controllers:[MemberPayoutController],providers:[MemberReadService,MemberAuthenticationGuard,MemberContextGuard,LineIdentityService,AuditService,QualificationAccessService,{provide:PrismaService,useValue:db},{provide:MemberService,useValue:identity},{provide:IdentityTokenService,useValue:tokens},{provide:ConfigService,useValue:{get:()=>undefined}}]}).compile();const app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalInterceptors(new EnvelopeInterceptor());await app.init();await app.getHttpAdapter().getInstance().ready();
  try{
   const path='/api/v1/member/payouts?qualificationId='+f.qualification.qualificationId,headers={authorization:'Bearer '+own};
   expect((await app.inject({url:path})).statusCode).toBe(401);expect((await app.inject({url:path,headers:{authorization:'Bearer '+foreign}})).statusCode).toBe(403);expect((await app.inject({url:path+'&personId='+f.person.personId,headers})).statusCode).toBe(400);expect((await app.inject({url:path+'&offset=-1',headers})).statusCode).toBe(400);
   const first=await app.inject({url:path,headers});expect(first.statusCode).toBe(200);const a=first.json().data;expect(a).toMatchObject({total:52,offset:0,nextOffset:50,qualificationNo:f.qualification.qualificationNo.toString()});expect(a.items).toHaveLength(50);expect(a.items[0]).toMatchObject({paidAmount:'40',netAmount:'100'});
   await db.payoutPaymentResult.create({data:{payoutBatchId:f.batch.payoutBatchId,payoutLineId:f.line.payoutLineId,resultStatus:'PAID',paidAmount:'40',paymentReference:'SENSITIVE_BANK_REFERENCE',occurredAt:new Date(),createdAt:new Date(Date.parse(a.asOf)+1000),recordedByActor:f.actor,idempotencyKey:randomUUID()}});
   const second=await app.inject({url:path+'&offset=50&asOf='+encodeURIComponent(a.asOf),headers});expect(second.statusCode).toBe(200);const b=second.json().data;expect(b).toMatchObject({total:52,nextOffset:null});expect(b.items).toHaveLength(2);expect(new Set([...a.items,...b.items].map(row=>row.reference)).size).toBe(52);
   for(const hidden of [f.person.personId,f.qualification.qualificationId,f.line.payoutLineId,f.batch.payoutBatchId,'SENSITIVE_BANK_REFERENCE'])expect(first.body+second.body).not.toContain(hidden);
   await db.qualification.update({where:{qualificationId:f.qualification.qualificationId},data:{currentHolderPersonId:foreignPerson.personId}});expect((await app.inject({url:path,headers})).statusCode).toBe(403);
  }finally{await app.close();}
 });
 it('routes immutable once-only partial/full results through authorized qualification messages',async()=>{
  const f=await fixture();await f.post([f.result('40')]);await f.post([f.result('40')]);await f.post([f.result('100')]);await f.post([f.result('100')]);
  const messages=new MemberMessagesService(db as any,new AuditService(),new IdempotencyService(db as any));expect((await messages.list(f.person.personId,{})).items).toEqual([]);
  const view=await messages.list(f.person.personId,{qualificationId:f.qualification.qualificationId});expect(view.items).toHaveLength(2);expect(view.items.map(row=>row.title).sort()).toEqual(['付款完成紀錄已登錄','付款結果已更新'].sort());expect(view.items.every(row=>row.category==='PAYOUT'&&row.deepLink==='/payouts')).toBe(true);
  for(const hidden of [f.person.personId,f.qualification.qualificationId,f.batch.payoutBatchId,f.line.payoutLineId,'SYNTHETIC-PAID-40','SYNTHETIC-PAID-100'])expect(JSON.stringify(view)).not.toContain(hidden);
  const foreign=await db.person.create({data:{legalName:'Foreign payout context'}});await expect(messages.list(foreign.personId,{qualificationId:f.qualification.qualificationId})).rejects.toThrow();expect(await db.notificationDelivery.count()).toBe(0);
 });
 it('keeps a failed-result notice factual when a later confirmation completes payment',async()=>{
  const f=await fixture();await f.post([f.result('0','FAILED')]);await f.post([f.result('100')]);
  const messages=new MemberMessagesService(db as any,new AuditService(),new IdempotencyService(db as any)),view=await messages.list(f.person.personId,{qualificationId:f.qualification.qualificationId});
  expect(view.items).toHaveLength(2);expect(view.items.find(row=>row.title==='付款失敗紀錄已登錄')?.content).toContain('此通知不代表付款完成');expect(view.items.some(row=>row.title==='付款完成紀錄已登錄')).toBe(true);expect((await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:f.batch.payoutBatchId}})).status).toBe('PAID');
 });
 it('rolls back payment result, payable state and message together on confirmation audit failure',async()=>{
  const f=await fixture(),audit=new AuditService();jest.spyOn(audit,'write').mockRejectedValue(new Error('SYNTHETIC_AUDIT_FAILURE'));
  const failing=new AdminOperationsService(db as any,audit);await expect(failing.recordPayoutResults(f.batch.payoutBatchId,{results:[f.result('100')]},f.actor,'FINANCE',randomUUID(),randomUUID())).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE');
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:f.batch.payoutBatchId}})).toBe(0);expect(await db.memberNotification.count({where:{personId:f.person.personId}})).toBe(0);expect((await db.payableEntry.findUniqueOrThrow({where:{payableEntryId:f.payable.payableEntryId}})).status).toBe('ALLOCATED');expect((await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:f.batch.payoutBatchId}})).status).toBe('EXPORTED');
 });
 it('projects cumulative bank results once and keeps missing or failed period jobs open',async()=>{
  const start=new Date('1895-01-01Z'),end=new Date('1895-02-01Z'),f=await fixture(false,start,end);
  await f.post([f.result('40')]);await f.post([f.result('100')]);
  const control=new CompensationPeriodControlService(db as any),input={periodStart:start.toISOString(),periodEnd:end.toISOString(),ruleVersionCode:'SYNTHETIC'};
  const first=await control.read(input);expect(first.amountBridge.bankPaid).toBe('100.0000');expect(first.lifecycle).not.toBe('FINANCIALLY_RECONCILED');
  const id=randomUUID(),outbox=await db.outboxEvent.create({data:{eventType:'PERIOD_CLOSE_REQUESTED',aggregateType:'PERIOD_CLOSE_JOB',aggregateId:id,payload:{periodCloseJobId:id},correlationId:randomUUID(),processStatus:'DEAD',lastError:'PERIOD_CLOSE_EXECUTION_FAILED'}});
  await db.periodCloseJob.create({data:{periodCloseJobId:id,kind:'REFERRAL_K0',periodStart:start,periodEnd:end,ruleVersionCode:'SYNTHETIC',parameterSnapshot:{syntheticFault:true},prerequisiteIds:[],requestedBy:'TEST',approvalReference:'TEST',outboxEventId:outbox.outboxEventId}});
  expect((await control.read(input)).lifecycle).toBe('BLOCKED');
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:f.batch.payoutBatchId}})).toBe(2);
  expect((await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:f.batch.payoutBatchId}})).status).toBe('PAID');
 });
 it('records and replays concurrent legacy whole-batch confirmation through line evidence',async()=>{
  const f=await fixture(true),input={paymentReference:'SYNTHETIC-LEGACY',paymentMethod:'BANK',paidAt:new Date('2026-01-20Z')};
  const mark=()=>service.markPaid(f.batch.payoutBatchId,input,f.actor,'FINANCE',randomUUID(),randomUUID());
  expect((await Promise.all([mark(),mark()])).map(row=>row.status)).toEqual(['PAID','PAID']);await mark();
  const results=await db.payoutPaymentResult.findMany({where:{payoutBatchId:f.batch.payoutBatchId}});
  expect(results).toHaveLength(2);expect(results.find(row=>row.payoutLineId===f.line.payoutLineId)).toMatchObject({resultStatus:'PAID',reasonCode:'LEGACY_BATCH_CONFIRMATION',paymentReference:input.paymentReference,occurredAt:input.paidAt});expect(results.map(row=>row.paidAmount.toString())).toEqual(['100','100']);
  expect((await db.payableEntry.findUniqueOrThrow({where:{payableEntryId:f.payable.payableEntryId}})).status).toBe('PAID');
  for(const action of ['PAYOUT_PAID','PAYOUT_RESULT_RECORDED'])expect(await db.auditEvent.count({where:{entityId:f.batch.payoutBatchId,action}})).toBe(1);
  for(const change of [{paymentReference:'OTHER'},{paymentMethod:'OTHER'},{paidAt:new Date('2026-01-21Z')}])await expect(service.markPaid(f.batch.payoutBatchId,{...input,...change},f.actor,'FINANCE',randomUUID(),randomUUID())).rejects.toMatchObject({status:409});
 });
 it('rejects invalid whole-batch confirmation without payment evidence',async()=>{
  const f=await fixture();
  for(const input of [{paymentReference:' ',paymentMethod:'BANK'},{paymentReference:'SYNTHETIC',paymentMethod:''},{paymentReference:'SYNTHETIC',paymentMethod:'BANK',paidAt:new Date('invalid')}])await expect(service.markPaid(f.batch.payoutBatchId,input,f.actor,'FINANCE',randomUUID(),randomUUID())).rejects.toMatchObject({status:422});
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:f.batch.payoutBatchId}})).toBe(0);
  expect((await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:f.batch.payoutBatchId}})).status).toBe('EXPORTED');
 });
 it('rolls back line payment evidence when legacy confirmation audit fails',async()=>{
  const f=await fixture(),audit=new AuditService(),failing=new AdminOperationsService(db as any,{write:async(tx:any,event:any)=>{if(event.action==='PAYOUT_PAID')throw new Error('SYNTHETIC_AUDIT_FAILURE');return audit.write(tx,event);}} as any);
  await expect(failing.markPaid(f.batch.payoutBatchId,{paymentReference:'SYNTHETIC',paymentMethod:'BANK'},f.actor,'FINANCE',randomUUID(),randomUUID())).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE');
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:f.batch.payoutBatchId}})).toBe(0);
  expect((await db.payableEntry.findUniqueOrThrow({where:{payableEntryId:f.payable.payableEntryId}})).status).toBe('ALLOCATED');
  expect((await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:f.batch.payoutBatchId}})).status).toBe('EXPORTED');
 });
 it('preserves historical already-paid batches without fabricating line results',async()=>{
  const f=await fixture(),input={paymentReference:'HISTORICAL',paymentMethod:'BANK',paidAt:new Date('2026-01-20Z')};
  await db.payoutBatch.update({where:{payoutBatchId:f.batch.payoutBatchId},data:{status:'PAID',...input}});
  expect((await service.markPaid(f.batch.payoutBatchId,input,f.actor,'FINANCE',randomUUID(),randomUUID())).status).toBe('PAID');
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:f.batch.payoutBatchId}})).toBe(0);
  expect(await db.auditEvent.count({where:{entityId:f.batch.payoutBatchId,action:'PAYOUT_PAID'}})).toBe(0);
 });
 it.each([['0','FAILED'],['40','PARTIALLY_PAID'],['100','PAID']] as const)('EXPORT_IDEMPOTENT preserves %s paid value and %s state after result reconciliation',async(paidAmount,status)=>{
  const f=await fixture();await f.post([f.result(paidAmount,status==='FAILED'?'FAILED':'PAID')]);
  const before=await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:f.batch.payoutBatchId}});
  const artifact=await db.payoutExportArtifact.findFirstOrThrow({where:{payoutBatchId:f.batch.payoutBatchId}});
  const replay=()=>service.exportPayout(f.batch.payoutBatchId,artifact.exportReference,f.actor,'FINANCE',randomUUID(),randomUUID());
  const results=await Promise.all([replay(),replay()]);
  expect(results.every(row=>row.replayed)).toBe(true);
  expect(results.every(row=>row.artifact.contentHash===artifact.contentHash)).toBe(true);
  expect(await db.payoutBatch.findUniqueOrThrow({where:{payoutBatchId:f.batch.payoutBatchId}})).toEqual(before);
  expect(before.status).toBe(status);
  expect(await db.payoutExportArtifact.count({where:{payoutBatchId:f.batch.payoutBatchId}})).toBe(1);
  expect(await db.auditEvent.count({where:{entityId:f.batch.payoutBatchId,action:'PAYOUT_EXPORTED'}})).toBe(1);
  await expect(service.exportPayout(f.batch.payoutBatchId,'CHANGED-'+randomUUID(),f.actor,'FINANCE',randomUUID(),randomUUID())).rejects.toMatchObject({status:409});
 });
 it('reconciles a failed transfer followed by actual successful retry without another payable',async()=>{
  const f=await fixture();expect((await f.post([f.result('0','FAILED')])).batch.status).toBe('FAILED');
  expect((await f.post([f.result('100')])).batch.status).toBe('PAID');
  expect(await db.payableEntry.count({where:{payoutLineId:f.line.payoutLineId}})).toBe(1);
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:f.batch.payoutBatchId}})).toBe(2);
 });
 it.each([['30','PAID'],['0','FAILED']] as const)('rejects cumulative paid-value regression to %s / %s',async(amount,status)=>{
  const f=await fixture();await f.post([f.result('40')]);
  await expect(f.post([f.result(amount,status)])).rejects.toMatchObject({status:409});
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:f.batch.payoutBatchId}})).toBe(1);
  expect(await db.payoutBatch.findUnique({where:{payoutBatchId:f.batch.payoutBatchId}})).toMatchObject({status:'PARTIALLY_PAID'});
 });
 it('replays concurrent and repeated partial reports without duplicate audit or history',async()=>{
  const f=await fixture(),input=[f.result('40')];
  const results=await Promise.all([f.post(input),f.post(input)]);expect(results.map(r=>r.replayed).sort()).toEqual([false,true]);
  expect((await f.post(input)).replayed).toBe(true);
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:f.batch.payoutBatchId}})).toBe(1);
  expect(await db.auditEvent.count({where:{entityId:f.batch.payoutBatchId,action:'PAYOUT_RESULT_RECORDED'}})).toBe(1);
 });
 it('rejects duplicate-line and overprecision reports before storing payment evidence',async()=>{
  const f=await fixture();await expect(f.post([f.result('40'),f.result('100')])).rejects.toMatchObject({status:422});
  await expect(f.post([f.result('40.00001')])).rejects.toMatchObject({status:422});
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:f.batch.payoutBatchId}})).toBe(0);
 });
 it('rejects changes to replay evidence and protects approved financial snapshots',async()=>{
  const f=await fixture(),report={...f.result('40'),occurredAt:new Date('2026-01-20Z')};await f.post([report]);
  await expect(f.post([{...report,reasonCode:'CHANGED'}])).rejects.toMatchObject({status:409});
  const result=await db.payoutPaymentResult.findFirstOrThrow({where:{payoutBatchId:f.batch.payoutBatchId}});
  await expect(db.payoutPaymentResult.update({where:{payoutPaymentResultId:result.payoutPaymentResultId},data:{paidAmount:30}})).rejects.toThrow();
  await expect(db.payoutPaymentResult.delete({where:{payoutPaymentResultId:result.payoutPaymentResultId}})).rejects.toThrow();
  await expect(db.payoutLine.update({where:{payoutLineId:f.line.payoutLineId},data:{netAmount:101}})).rejects.toThrow('PAYOUT_APPROVED_LINES_IMMUTABLE');
  await expect(db.payoutBatch.update({where:{payoutBatchId:f.batch.payoutBatchId},data:{totalNet:101}})).rejects.toThrow('PAYOUT_APPROVED_TOTALS_IMMUTABLE');
  const other=await fixture();
  await expect(db.payoutPaymentResult.create({data:{payoutBatchId:other.batch.payoutBatchId,payoutLineId:f.line.payoutLineId,resultStatus:'PAID',paidAmount:100,occurredAt:new Date(),recordedByActor:randomUUID(),idempotencyKey:randomUUID()}})).rejects.toThrow('PAYOUT_RESULT_SOURCE_OR_AMOUNT_INVALID');
 });
 it('does not let a waiting line edit bypass a concurrently committed approval',async()=>{
  const f=await fixture();
  const batch=await db.payoutBatch.create({data:{periodStart:new Date('2026-03-01Z'),periodEnd:new Date('2026-04-01Z'),status:'READY',totalGross:100,totalRecovery:0,totalNet:100}});
  const line=await db.payoutLine.create({data:{payoutBatchId:batch.payoutBatchId,recipientQualificationId:f.line.recipientQualificationId,grossAmount:100,netAmount:100,detailJson:{source:'concurrency'}}});
  let ready!:()=>void,release!:()=>void;const locked=new Promise<void>(resolve=>{ready=resolve;}),hold=new Promise<void>(resolve=>{release=resolve;});
  const approval=db.$transaction(async tx=>{await tx.$queryRaw`SELECT payout_batch_id FROM ledger.payout_batch WHERE payout_batch_id=${batch.payoutBatchId}::uuid FOR UPDATE`;ready();await hold;await tx.payoutApproval.create({data:{payoutBatchId:batch.payoutBatchId,stage:'FINANCE_REVIEW',decision:'APPROVED',actorId:randomUUID()}});await tx.payoutBatch.update({where:{payoutBatchId:batch.payoutBatchId},data:{status:'REVIEWED'}});});
  await locked;
  let identify!:(pid:number)=>void;const identified=new Promise<number>(resolve=>{identify=resolve;});
  const edit=db.$transaction(async tx=>{const [session]=await tx.$queryRaw<Array<{pid:number}>>`SELECT pg_backend_pid() AS pid`;identify(session.pid);return tx.payoutLine.update({where:{payoutLineId:line.payoutLineId},data:{netAmount:90}});}).then(()=>null,error=>error);
  const pid=await identified;let waiting=false;
  try{for(let attempt=0;attempt<50&&!waiting;attempt++){const [session]=await db.$queryRaw<Array<{waiting:boolean}>>`SELECT wait_event_type='Lock' AND cardinality(pg_blocking_pids(pid))>0 AS waiting FROM pg_stat_activity WHERE pid=${pid}`;waiting=!!session?.waiting;if(!waiting)await new Promise(resolve=>setTimeout(resolve,20));}expect(waiting).toBe(true);}finally{release();}
  await approval;
  expect(String(await edit)).toContain('PAYOUT_APPROVED_LINES_IMMUTABLE');
  expect((await db.payoutLine.findUniqueOrThrow({where:{payoutLineId:line.payoutLineId}})).netAmount.toString()).toBe('100');
 });
});
