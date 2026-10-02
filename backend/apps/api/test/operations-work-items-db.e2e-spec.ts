import {PrismaClient} from '@prisma/client';
import {claimOutboxLease,erpBusinessReference,requestErpSalesProjection,verifyErpBusinessProjection} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../src/common/audit/audit.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {OperationsWorkItemsService} from '../src/modules/admin-operations/operations-work-items.service';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {OperationsControlService} from '../src/modules/admin-operations/operations-control.service';
import {ErpBusinessProjectionService} from '../src/modules/commerce/erp-business-projection.service';
import {ErpReconciliationBridgeService} from '../src/modules/commerce/erp-reconciliation-bridge.service';
import {processErpBusinessProjection} from '../../worker/src/erp-business-runtime';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('OPERATIONS_WORK_ITEMS_REAL_DB',()=>{
 let db:PrismaClient,service:OperationsWorkItemsService,business:ErpBusinessProjectionService,legacy:AdminOperationsService;
 const ctx=()=>({actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()}),audit=new AuditService();
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});service=new OperationsWorkItemsService(db as any,audit,new IdempotencyService(db as any));business=new ErpBusinessProjectionService(db as any,audit);legacy=new AdminOperationsService(db as any,audit);});
 afterAll(()=>db?.$disconnect());
 async function fixture(){
  const person=await db.person.create({data:{legalName:'Private work item buyer'}}),product=await db.productReference.create({data:{sku:'OPSW-'+randomUUID().slice(0,8),displayName:'Synthetic',currentPrice:100}});
  const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',status:'PAID',paidAt:new Date(),grossAmount:100,discountAmount:0,netAmount:100,ruleVersionCode:'SYNTHETIC',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{private:'hidden-evidence'}}}}});
  const {projection}=await db.$transaction(tx=>requestErpSalesProjection(tx,order.orderNo.toString(),ctx()));
  await db.outboxEvent.update({where:{outboxEventId:projection.outboxEventId},data:{processStatus:'DEAD',lastError:'PRIVATE-ERROR'}});
  const exception=await db.operationalException.create({data:{sourceType:'ERP_BUSINESS_PROJECTION',sourceId:projection.projectionReference,exceptionCode:'ERP_PROJECTION_REQUIRES_RECONCILIATION',severity:'HIGH',summary:'PRIVATE-SUMMARY',traceId:randomUUID()}});
  const health=await new OperationsControlService(business,new ErpReconciliationBridgeService(db as any)).erpHealth({stream:'SALES',take:200}),candidate=health.items.find(row=>row.reference===projection.projectionReference)!.candidate!;
  const input={stream:'SALES',reference:projection.projectionReference,code:candidate.code,evidenceHash:candidate.evidenceHash,assigneeRole:'FINANCE',asOf:health.asOf};
  return {person,order,projection,exception,input};
 }
 it('revalidates evidence and atomically creates one task on concurrent commands and replay',async()=>{
  const f=await fixture(),context=ctx(),key=randomUUID(),results=await Promise.all([service.createTask(f.input,key,context),service.createTask(f.input,key,context)]);
  expect(results.map(row=>row.replayed).sort()).toEqual([false,true]);expect(results[0].value.item.reference).toMatch(/^OPS-TASK-[a-f0-9]{40}$/);
  const again=await service.createTask(f.input,randomUUID(),context);expect(again.value.created).toBe(false);
  const task=await db.operationalTask.findFirstOrThrow({where:{sourceId:f.projection.projectionReference}});expect(await db.auditEvent.count({where:{entityId:task.operationalTaskId,action:'OPERATIONS_CANDIDATE_TASK_CREATED'}})).toBe(1);
  await expect(service.createTask({...f.input,evidenceHash:'0'.repeat(64)},randomUUID(),context)).rejects.toMatchObject({response:{code:'OPERATIONS_CANDIDATE_STALE'}});
  const failing=new OperationsWorkItemsService(db as any,{write:async()=>{throw new Error('AUDIT_FAILED');}} as any,new IdempotencyService(db as any)),other=await fixture(),failedKey=randomUUID();
  await expect(failing.createTask(other.input,failedKey,context)).rejects.toThrow('AUDIT_FAILED');expect(await db.operationalTask.count({where:{sourceId:other.projection.projectionReference}})).toBe(0);expect(await db.idempotencyRecord.count({where:{idempotencyKey:failedKey}})).toBe(0);
 });
 it('resolves only public references, audits reassignment, and leaves domain facts unchanged when a task completes',async()=>{
  const f=await fixture(),context=ctx(),task=(await service.createTask(f.input,randomUUID(),context)).value.item,event=await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.projection.outboxEventId}});
  const key=randomUUID(),assignment={expectedStatus:'OPEN',assigneeRole:'COMPLIANCE_AUDIT',dueAt:'2026-10-02T00:00:00.000Z',noteReference:'CASE-ASSIGN-01'};
  const assigned=await service.assign(task.reference,assignment,key,context);expect(assigned.value).toMatchObject({assigneeRole:'COMPLIANCE_AUDIT',dueAt:assignment.dueAt});expect((await service.assign(task.reference,assignment,key,context)).replayed).toBe(true);
  await expect(service.assign(task.reference,{...assignment,dueAt:null},key,context)).rejects.toMatchObject({response:{code:'IDEMPOTENCY_CONFLICT'}});
  const done=await service.transition('TASK',task.reference,{status:'COMPLETED',expectedStatus:'OPEN',noteReference:'CASE-DONE-01'},randomUUID(),context);expect(done.value.status).toBe('COMPLETED');
  await expect(service.transition('TASK',task.reference,{status:'ACKNOWLEDGED',expectedStatus:'OPEN',noteReference:'CASE-ACK-01'},randomUUID(),context)).rejects.toMatchObject({response:{code:'OPERATIONS_TRANSITION_STALE'}});
  expect(await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.projection.outboxEventId}})).toEqual(event);expect(await db.operationalException.findUniqueOrThrow({where:{operationalExceptionId:f.exception.operationalExceptionId}})).toEqual(f.exception);
  const rows=await service.list('TASK',{status:'COMPLETED',take:100});expect(rows.items.some(row=>row.reference===task.reference)).toBe(true);
  const serialized=JSON.stringify(rows);for(const hidden of [f.person.personId,f.order.orderId,context.actorId,'PRIVATE-SUMMARY','PRIVATE-ERROR','hidden-evidence','completionNote','traceId'])expect(serialized).not.toContain(hidden);
  await expect(service.assign(f.exception.operationalExceptionId,assignment,randomUUID(),context)).rejects.toMatchObject({response:{code:'OPERATIONS_REFERENCE_INVALID'}});
 });
 it('uses bounded keyset pages and excludes items created beyond the saved creation horizon',async()=>{
  const f=await fixture(),context=ctx();await service.createTask(f.input,randomUUID(),context);
  const first=await service.list('TASK',{take:1}),later=await fixture(),task=(await service.createTask(later.input,randomUUID(),context)).value.item;
  const second=await service.list('TASK',{take:1,cursor:first.items[0].reference,asOf:first.asOf});expect(second.items[0].reference).not.toBe(first.items[0].reference);expect(second.items.map(row=>row.reference)).not.toContain(task.reference);expect(second.asOf).toBe(first.asOf);
  await expect(service.list('TASK',{take:101})).rejects.toThrow();
 });
 it('requires actual current ERP reconciliation on both APIs, and explicitly closes an old exception after a matching result',async()=>{
  const f=await fixture(),context=ctx(),reference=erpBusinessReference('OPS-EXCEPTION',f.exception.operationalExceptionId),transition={status:'RESOLVED',expectedStatus:'OPEN',noteReference:'CASE-RESOLVED-01'};
  const oldResolve=()=>legacy.transitionOperationalException(f.exception.operationalExceptionId,'RESOLVED',context.actorId,'CASE-RESOLVED-01',context.requestId,context.correlationId);
  await expect(service.transition('EXCEPTION',reference,transition,randomUUID(),context)).rejects.toMatchObject({response:{code:'OPERATIONS_SOURCE_RECONCILIATION_REQUIRED'}});await expect(oldResolve()).rejects.toMatchObject({response:{code:'OPERATIONS_SOURCE_RECONCILIATION_REQUIRED'}});
  const connection=await db.providerConnection.create({data:{domain:'ERP',provider:'EZTOOL',connectionKey:randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'synthetic',webhookVerificationRef:'synthetic',configHash:'a'.repeat(64),effectiveFrom:new Date(0),approvalReference:'SYNTHETIC',createdByActor:randomUUID()}}},include:{versions:true}});
  const event=await db.outboxEvent.update({where:{outboxEventId:f.projection.outboxEventId},data:{processStatus:'PENDING',availableAt:new Date(0)}}),lease=(await claimOutboxLease(db,event))!,providerReference='ERP-'+f.order.orderNo;
  await processErpBusinessProjection(db as any,lease,{provider:'EZTOOL',providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,environment:'TEST',lookup:async()=>({kind:'ABSENT'}),submit:async()=>({kind:'ACCEPTED',providerReference,requestHash:f.projection.payloadHash})});
  const payload=verifyErpBusinessProjection(f.projection) as any,result={resultKey:randomUUID(),providerReference,occurredAt:new Date().toISOString(),currency:'TWD',amount:'99',lines:payload.lines.map((line:any)=>({lineReference:line.lineReference,amount:line.amount,quantity:line.quantity}))};
  await business.reconcile(f.projection.projectionReference,result,context);await expect(oldResolve()).rejects.toThrow();
  await business.reconcile(f.projection.projectionReference,{...result,resultKey:randomUUID(),amount:'100'},context);expect((await service.list('EXCEPTION',{status:'OPEN',take:100})).items.some(row=>row.reference===reference)).toBe(true);
  const key=randomUUID();expect((await service.transition('EXCEPTION',reference,transition,key,context)).value.status).toBe('RESOLVED');expect((await service.transition('EXCEPTION',reference,transition,key,context)).replayed).toBe(true);await expect(oldResolve()).rejects.toThrow('already resolved');
 });
 it('prevents legacy acknowledgement from resurrecting a concurrently completed task',async()=>{
  const f=await fixture(),context=ctx(),task=(await service.createTask(f.input,randomUUID(),context)).value.item,row=await db.operationalTask.findFirstOrThrow({where:{sourceId:f.projection.projectionReference}});
  let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(resolve=>release=resolve),ready=new Promise<void>(resolve=>entered=resolve);
  const guarded=new OperationsWorkItemsService(db as any,{write:async(tx:any,event:any)=>{entered();await gate;return audit.write(tx,event);}} as any,new IdempotencyService(db as any));
  const completion=guarded.transition('TASK',task.reference,{status:'COMPLETED',expectedStatus:'OPEN',noteReference:'CASE-RACE-01'},randomUUID(),context);await ready;
  const acknowledgement=legacy.transitionOperationalTask(row.operationalTaskId,'ACKNOWLEDGED',context.actorId,undefined,context.requestId,context.correlationId).then(value=>({value}),error=>({error}));release();await completion;expect(await acknowledgement).toHaveProperty('error');expect((await db.operationalTask.findUniqueOrThrow({where:{operationalTaskId:row.operationalTaskId}})).status).toBe('COMPLETED');
 });
});
