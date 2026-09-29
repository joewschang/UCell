import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('controlled payout result recovery',()=>{
 let db:PrismaClient,service:AdminOperationsService;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});service=new AdminOperationsService(db as any,new AuditService());});
 afterAll(async()=>db?.$disconnect());
 async function fixture(){
  const person=await db.person.create({data:{legalName:'Synthetic payment recovery'}}),actor=randomUUID();
  const qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER',status:'EFFECTIVE',effectiveAt:new Date()}});
  const batch=await db.payoutBatch.create({data:{periodStart:new Date('2026-01-01Z'),periodEnd:new Date('2026-02-01Z'),status:'READY',totalGross:100,totalRecovery:0,totalNet:100}});
  const line=await db.payoutLine.create({data:{payoutBatchId:batch.payoutBatchId,recipientQualificationId:qualification.qualificationId,grossAmount:100,netAmount:100,detailJson:{source:'synthetic'}}});
  const payable=await db.payableEntry.create({data:{qualificationId:qualification.qualificationId,sourceType:'MANUAL_TEST',sourceId:line.payoutLineId,awardType:'REFERRAL',grossAmount:100,availableAt:new Date(),status:'ALLOCATED',payoutLineId:line.payoutLineId,ruleVersionCode:'SYNTHETIC'}});
  await service.approvePayout(batch.payoutBatchId,'FINANCE_REVIEW',actor,'FINANCE',undefined,randomUUID(),randomUUID());
  await service.approvePayout(batch.payoutBatchId,'COMPLIANCE_REVIEW',randomUUID(),'COMPLIANCE_AUDIT',undefined,randomUUID(),randomUUID());
  await service.exportPayout(batch.payoutBatchId,randomUUID(),actor,'FINANCE',randomUUID(),randomUUID());
  const result=(paidAmount:string,status:'PAID'|'FAILED'='PAID')=>({payoutLineId:line.payoutLineId,status,paidAmount,paymentReference:`SYNTHETIC-${status}-${paidAmount}`,reasonCode:status==='FAILED'?'BANK_REJECTED':undefined});
  const post=(rows:ReturnType<typeof result>[])=>service.recordPayoutResults(batch.payoutBatchId,{results:rows},actor,'FINANCE',randomUUID(),randomUUID());
  return {batch,line,payable,result,post};
 }
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
