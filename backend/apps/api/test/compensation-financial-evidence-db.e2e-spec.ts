import {PrismaClient,Prisma} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {compensationFinancialEvidence,compensationPeriodReference} from '../src/modules/settlement-jobs/compensation-financial-evidence';
import {UnifiedPayableService} from '../src/modules/payout/unified-payable.service';
import {RecoveryBalanceService} from '../src/modules/payout/recovery-balance.service';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';
import {erpBusinessReference} from '@ucell/database';
import {ErpPaymentProjectionService} from '../src/modules/commerce/erp-payment-projection.service';
import {ErpBusinessProjectionService} from '../src/modules/commerce/erp-business-projection.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('COMPENSATION_FINANCIAL_EVIDENCE_REAL_DB',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});afterAll(()=>db?.$disconnect());
 async function fixture(shared=false){
  const ruleVersionCode='FINANCE_'+randomUUID(),period={periodStart:new Date('1891-01-01Z'),periodEnd:new Date('1891-02-01Z'),ruleVersionCode};
  const person=await db.person.create({data:{legalName:'Synthetic financial control'}}),q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
  const award=async(at:Date,value:number)=>{const a=await db.bonusAward.create({data:{recipientQualificationId:q.qualificationId,awardType:'REFERRAL',sourceEventId:randomUUID(),theoryAmount:value,payableAmount:value,activeSnapshot:true,planLevelSnapshot:'STARTER',ruleVersionCode,parameterSnapshotHash:'a'.repeat(64),occurredAt:at,pendingUntil:at,calculationDetail:{}}});await db.bonusAwardLifecycleEvent.create({data:{bonusAwardId:a.bonusAwardId,status:'EFFECTIVE',occurredAt:at}});return a;};
  const original=await award(new Date('1891-01-10Z'),100);if(shared)await award(new Date('1890-12-10Z'),50);
  const payable=new UnifiedPayableService(db as any,new RecoveryBalanceService(db as any)),ops=new AdminOperationsService(db as any,new AuditService());
  const cohort={jobs:[],sourcePeriod:{...period,settlementSourceIds:[],globalSourceIds:[]}} as any;
  const read=()=>db.$transaction(tx=>compensationFinancialEvidence(tx,period,cohort,new Date()),{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead});
  const pay=async()=>{
   await payable.materialize(period.periodEnd,ruleVersionCode);
   // Payment period deliberately differs from the award period: linkage, not dates, controls attribution.
   const batch=await payable.createPayoutBatch(new Date('1891-02-01Z'),new Date('1891-03-01Z'),ruleVersionCode);
   await ops.approvePayout(batch.payoutBatchId,'FINANCE_REVIEW',randomUUID(),'FINANCE',undefined,randomUUID(),randomUUID());
   await ops.approvePayout(batch.payoutBatchId,'COMPLIANCE_REVIEW',randomUUID(),'COMPLIANCE_AUDIT',undefined,randomUUID(),randomUUID());
   await ops.exportPayout(batch.payoutBatchId,randomUUID(),randomUUID(),'FINANCE',randomUUID(),randomUUID());
   const line=await db.payoutLine.findFirstOrThrow({where:{payoutBatchId:batch.payoutBatchId}});
   const post=(amount:string)=>ops.recordPayoutResults(batch.payoutBatchId,{results:[{payoutLineId:line.payoutLineId,status:'PAID',paidAmount:amount,paymentReference:'SYNTHETIC-'+amount}]},randomUUID(),'FINANCE',randomUUID(),randomUUID());
   return {batch,line,post};
  };
  return {period,cohort,read,pay,original,payable};
 }
 it('requires a payable for every mature positive member source',async()=>{
  const f=await fixture(),before=await f.read();expect(before.missingPayables).toBe(1);expect(before.ready).toBe(false);
  await f.payable.materialize(f.period.periodEnd,f.period.ruleVersionCode);const after=await f.read();expect(after.missingPayables).toBe(0);expect(after.open).toBe(1);expect(after.ready).toBe(false);
 });
 it('uses actual cross-period source links, approvals, immutable export and cumulative bank confirmations',async()=>{
  const f=await fixture(),p=await f.pay();await p.post('40');expect((await f.read()).ready).toBe(false);await p.post('100');
  const first=await f.read(),again=await f.read();expect(first).toEqual(again);expect(first.issues).toEqual([]);expect(first.ready).toBe(true);expect(first.totals.bankPaid.toString()).toBe('100');expect(first.payouts[0].payoutBatchId).toBe(p.batch.payoutBatchId);
  expect(await db.payoutPaymentResult.count({where:{payoutBatchId:p.batch.payoutBatchId}})).toBe(2);
 });
 it('reports whole shared-line amounts without allocating bank money or recovery between award periods',async()=>{
  const f=await fixture(true),p=await f.pay();await p.post('150');const result=await f.read();expect(result.ready).toBe(true);expect(result.sharedLineCount).toBe(1);expect(result.totals.payable.toString()).toBe('100');expect(result.totals.payoutGross.toString()).toBe('150');expect(result.totals.bankPaid.toString()).toBe('150');
 });
 it('seals a whole-batch payment aggregate with cumulative bank evidence and immutable source drillback',async()=>{
  const f=await fixture(true);await db.bonusRecoveryEvent.create({data:{bonusAwardId:f.original.bonusAwardId,recoveryAmount:20,outstandingAmount:20,reasonCode:'TEST_PAYMENT_PROJECTION',occurredAt:new Date()}});
  const p=await f.pay();await p.post('40');
  const service=new ErpPaymentProjectionService(db as any,new AuditService()),input={payoutReference:erpBusinessReference('PAYOUT',p.batch.payoutBatchId),periodStart:p.batch.periodStart.toISOString(),periodEnd:p.batch.periodEnd.toISOString(),accountingDate:'1891-03-02',currency:'TWD',currencyBasisReference:'TEST-LEDGER-TWD',groupByEconomicCategory:true},context={actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()};
  expect((await service.batches(input)).items).toEqual(expect.arrayContaining([expect.objectContaining({payoutReference:input.payoutReference,gross:'150.0000',net:'130.0000'})]));
  const partial=await service.preview(input);expect(partial.expected.totals).toEqual({memberPayableGross:'150.0000',payoutRecoveryOffset:'20.0000',payoutNet:'130.0000',bankPaid:'40.0000'});
  await p.post('130');await expect(service.approve({...input,reviewHash:partial.reviewHash,approvalReference:'TEST-PAYMENT-APPROVAL'},context)).rejects.toMatchObject({response:{code:'ERP_PAYMENT_PREVIEW_STALE'}});
  const preview=await service.preview(input);expect(await service.preview(input)).toEqual(preview);expect(preview.expected.totals.bankPaid).toBe('130.0000');expect(preview.expected.paymentScope).toBe('WHOLE_PAYOUT_BATCH_NO_AWARD_PERIOD_ALLOCATION');expect((await f.read()).totals.payable.toString()).toBe('100');
  for(const hidden of [p.batch.payoutBatchId,p.line.payoutLineId,f.original.bonusAwardId,f.original.recipientQualificationId])expect(JSON.stringify(preview)).not.toContain(hidden);
  const request={...input,reviewHash:preview.reviewHash,approvalReference:'TEST-PAYMENT-APPROVAL'},approved=await Promise.all([service.approve(request,context),service.approve(request,context)]);expect(approved.map(row=>row.replayed).sort()).toEqual([false,true]);
  const projection=await db.erpBusinessProjection.findUniqueOrThrow({where:{projectionReference:preview.projectionReference}});expect(projection.mappingReference).toBeNull();expect(projection.drillbackHash).toBe(preview.drillbackHash);expect(await db.auditEvent.count({where:{entityId:projection.projectionId,action:'ERP_PAYMENT_PROJECTION_APPROVED'}})).toBe(1);
  const read=new ErpBusinessProjectionService(db as any,new AuditService()),detail=await read.detail(preview.projectionReference);expect((detail.expected as any).totals.bankPaid).toBe('130.0000');const page=await read.sources(preview.projectionReference,{take:1});expect(page.total).toBe(2);expect(page.nextCursor).not.toBeNull();const second=await read.sources(preview.projectionReference,{take:1,cursor:page.nextCursor!});expect(second.items[0].reference).not.toBe(page.items[0].reference);expect(second.nextCursor).toBeNull();
  expect((await read.sources(preview.projectionReference,{kind:'PAYMENT'})).items).toEqual([expect.objectContaining({amount:'150.0000',recovery:'20.0000',net:'130.0000',bankPaid:'130.0000',bankResultCount:2})]);
  await expect(service.approve({...request,accountingDate:'1891-03-03'},context)).rejects.toMatchObject({response:{code:'ERP_PAYMENT_APPROVAL_CONFLICT'}});
 });
 it('rolls back a payment projection when audit fails and rejects an unapproved payout',async()=>{
  const f=await fixture(),p=await f.pay(),service=new ErpPaymentProjectionService(db as any,new AuditService()),input={payoutReference:erpBusinessReference('PAYOUT',p.batch.payoutBatchId),periodStart:p.batch.periodStart.toISOString(),periodEnd:p.batch.periodEnd.toISOString(),accountingDate:'1891-03-02',currency:'TWD',currencyBasisReference:'TEST-LEDGER-TWD',groupByEconomicCategory:false},preview=await service.preview(input),count=await db.outboxEvent.count();
  const broken=new ErpPaymentProjectionService(db as any,{write:async()=>{throw new Error('SYNTHETIC_PAYMENT_AUDIT_FAILURE');}} as any);
  await expect(broken.approve({...input,reviewHash:preview.reviewHash,approvalReference:'TEST-PAYMENT-APPROVAL'},{actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()})).rejects.toThrow('SYNTHETIC_PAYMENT_AUDIT_FAILURE');expect(await db.outboxEvent.count()).toBe(count);expect(await db.erpBusinessProjection.count({where:{projectionReference:preview.projectionReference}})).toBe(0);
  const unapproved=await db.payoutBatch.create({data:{periodStart:p.batch.periodStart,periodEnd:p.batch.periodEnd}});await expect(service.preview({...input,payoutReference:erpBusinessReference('PAYOUT',unapproved.payoutBatchId)})).rejects.toMatchObject({response:{code:'ERP_PAYOUT_APPROVAL_REQUIRED'}});
 });
 it('distinguishes absent bank results from a confirmed zero-net payment and honors blocking payout exceptions',async()=>{
  const f=await fixture();await db.bonusRecoveryEvent.create({data:{bonusAwardId:f.original.bonusAwardId,recoveryAmount:100,outstandingAmount:100,reasonCode:'TEST_ZERO_PAYMENT_PROJECTION',occurredAt:new Date()}});const p=await f.pay(),service=new ErpPaymentProjectionService(db as any,new AuditService()),input={payoutReference:erpBusinessReference('PAYOUT',p.batch.payoutBatchId),periodStart:p.batch.periodStart.toISOString(),periodEnd:p.batch.periodEnd.toISOString(),accountingDate:'1891-03-02',currency:'TWD',currencyBasisReference:'TEST-LEDGER-TWD',groupByEconomicCategory:true};
  const pending=await service.preview(input);expect(pending.expected.totals.bankPaid).toBe('0.0000');expect(pending.expected.paymentEvidence).toMatchObject({confirmedLines:0,pendingLines:1});await p.post('0');const paid=await service.preview(input);expect(paid.expected.paymentEvidence).toMatchObject({confirmedLines:1,pendingLines:0});expect(paid.reviewHash).not.toBe(pending.reviewHash);
  await db.operationalException.create({data:{sourceType:'PAYOUT_BATCH',sourceId:p.batch.payoutBatchId,exceptionCode:'TEST_PAYMENT_BLOCK',severity:'HIGH',summary:'Synthetic blocking payout'}});await expect(service.preview(input)).rejects.toMatchObject({response:{code:'ERP_PAYOUT_BLOCKING_EXCEPTION'}});
  const listed=await service.batches({...input,take:1});expect(listed.items).toHaveLength(1);expect(listed.nextCursor).not.toBeNull();const next=await service.batches({...input,take:1,cursor:listed.nextCursor!});expect(next.items[0].payoutReference).not.toBe(listed.items[0].payoutReference);
 });
 it('reconciles actual complete recovery and still requires confirmation for a zero-net line',async()=>{
  const f=await fixture();await db.bonusRecoveryEvent.create({data:{bonusAwardId:f.original.bonusAwardId,recoveryAmount:100,outstandingAmount:100,reasonCode:'SYNTHETIC_RECOVERY',occurredAt:new Date()}});
  const p=await f.pay();expect(p.line.netAmount.toString()).toBe('0');await p.post('0');const result=await f.read();expect(result.ready).toBe(true);expect(result.totals.recoveryApplied.toString()).toBe('100');expect(result.totals.recoveryOutstanding.toString()).toBe('0');
  const missing=await db.$transaction(tx=>compensationFinancialEvidence({...tx,payoutBatch:{findMany:async()=>result.payouts.map(batch=>({...batch,paymentResults:[]}))}} as any,f.period,f.cohort,new Date()));
  expect(missing.ready).toBe(false);expect(missing.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'COMPENSATION_BANK_EVIDENCE_MISMATCH'})]));
 });
 it('rejects a legacy PAID payable with no payout line and an award lacking effective lifecycle evidence',async()=>{
  const f=await fixture(),p=await f.pay();await p.post('100');const good=await f.read();
  const result=await db.$transaction(async tx=>{
   const sources=await tx.bonusAward.findMany({where:{bonusAwardId:f.original.bonusAwardId},include:{economicDestination:{include:{effects:true}},lifecycleEvents:true}});
   return compensationFinancialEvidence({...tx,bonusAward:{findMany:async()=>sources.map(row=>({...row,lifecycleEvents:[]}))},payableEntry:{findMany:async()=>good.payables.map(row=>({...row,payoutLineId:null}))},payoutBatch:{findMany:async()=>[]}} as any,f.period,f.cohort,new Date());
  });
  expect(result.ready).toBe(false);expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'COMPENSATION_BANK_EVIDENCE_MISMATCH'}),expect.objectContaining({code:'COMPENSATION_PAYABLE_SOURCE_MISMATCH'})]));
 });
 it('blocks unresolved high-severity exceptions and accepts only their governed resolution',async()=>{
  const f=await fixture(),p=await f.pay();await p.post('100');const issue=await db.operationalException.create({data:{sourceType:'COMPENSATION_PERIOD',sourceId:compensationPeriodReference(f.period),exceptionCode:'SYNTHETIC_MISMATCH',severity:'HIGH',summary:'Sensitive text must never become public control evidence'}});
  expect((await f.read()).ready).toBe(false);await db.operationalException.update({where:{operationalExceptionId:issue.operationalExceptionId},data:{status:'ACKNOWLEDGED'}});expect((await f.read()).ready).toBe(false);
  await db.operationalException.update({where:{operationalExceptionId:issue.operationalExceptionId},data:{status:'RESOLVED',resolvedAt:new Date(),resolutionNote:'Synthetic resolution'}});expect((await f.read()).ready).toBe(true);
 });
 it.each(['approval','export','source','recovery'] as const)('detects legacy %s evidence gaps at the read boundary without bypassing write protections',async fault=>{
  const f=await fixture(),p=await f.pay();await p.post('100');
  const result=await db.$transaction(async tx=>{
   const base=await compensationFinancialEvidence(tx,f.period,f.cohort,new Date());
   const payouts=base.payouts.map(batch=>({...batch,approvals:fault==='approval'?[]:batch.approvals,exportArtifacts:fault==='export'?[]:batch.exportArtifacts}));
   const readTx={...tx,payoutBatch:{findMany:async()=>payouts},...(fault==='source'?{payableEntry:{findMany:async()=>[]}}:{}),...(fault==='recovery'?{bonusRecoveryEvent:{findMany:async()=>[{bonusRecoveryEventId:randomUUID(),recoveryAmount:new Prisma.Decimal(10),recoveredAmount:new Prisma.Decimal(10),outstandingAmount:new Prisma.Decimal(0),applications:[]}]}}:{})} as any;
   return compensationFinancialEvidence(readTx,f.period,f.cohort,new Date());
  });
  const codes={approval:'COMPENSATION_PAYOUT_APPROVAL_EVIDENCE_MISSING',export:'COMPENSATION_PAYOUT_EXPORT_EVIDENCE_INVALID',source:'COMPENSATION_PAYOUT_SOURCE_UNATTRIBUTED',recovery:'COMPENSATION_RECOVERY_BALANCE_MISMATCH'};
  expect(result.ready).toBe(false);expect(result.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:codes[fault]})]));
 });
});
