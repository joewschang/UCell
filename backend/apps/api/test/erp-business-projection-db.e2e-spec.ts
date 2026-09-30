import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {requestErpSalesProjection,requestErpReturnProjection,verifyErpBusinessProjection,sealErpBusinessProjection,claimOutboxLease} from '@ucell/database';
import {processErpBusinessProjection,pollErpBusinessProjections,BusinessErpAdapter} from '../../worker/src/erp-business-runtime';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('ERP_BUSINESS_PROJECTION_REAL_DB',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});afterAll(()=>db?.$disconnect());
 const context=()=>({actorId:randomUUID(),correlationId:randomUUID()});
 async function fixture(paid=true){
  const person=await db.person.create({data:{legalName:'Private synthetic projection name'}});
  const product=await db.productReference.create({data:{sku:'P-'+randomUUID().slice(0,8),displayName:'Projection fixture',currentPrice:100}});
  const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',status:paid?'PAID':'DRAFT',paidAt:paid?new Date():null,grossAmount:200,discountAmount:10,netAmount:190,ruleVersionCode:'SYNTHETIC',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:2,unitPrice:100,lineAmount:200,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{privateField:'must-not-export'}}}},include:{lines:true}});
  return {order,person,product};
 }
 async function dispatchFixture(){
  const f=await fixture(),{projection}=await db.$transaction(tx=>requestErpSalesProjection(tx,f.order.orderNo.toString(),context()));
  const connection=await db.providerConnection.create({data:{domain:'ERP',provider:'EZTOOL',connectionKey:randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'synthetic-reference',webhookVerificationRef:'synthetic-reference',configHash:'a'.repeat(64),effectiveFrom:new Date(0),approvalReference:'SYNTHETIC_APPROVAL',createdByActor:randomUUID()}}},include:{versions:true}});
  const lookup=jest.fn().mockResolvedValue({kind:'ABSENT'}),submit=jest.fn().mockResolvedValue({kind:'ACCEPTED',providerReference:'ERP-'+f.order.orderNo,requestHash:projection.payloadHash});
  const adapter:BusinessErpAdapter={provider:'EZTOOL',providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,environment:'TEST',lookup,submit};
  const claim=async()=>{const event=await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:projection.outboxEventId}});return (await claimOutboxLease(db,event))!;};
  const retry=async()=>{await db.outboxEvent.update({where:{outboxEventId:projection.outboxEventId},data:{availableAt:new Date(0)}});return claim();};
  return {...f,projection,adapter,lookup,submit,claim,retry};
 }
 it('recovers an ambiguous submit by lookup with no duplicate external effect',async()=>{
  const f=await dispatchFixture();f.submit.mockRejectedValueOnce(new Error('provider secret-token raw-body'));
  await processErpBusinessProjection(db as any,await f.claim(),f.adapter);
  const first=await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.projection.outboxEventId}});expect(first.lastError).toBe('ERP_PROJECTION_ACCEPTANCE_UNKNOWN');
  f.lookup.mockResolvedValueOnce({kind:'ACCEPTED',providerReference:'ERP-'+f.order.orderNo,requestHash:f.projection.payloadHash});
  await processErpBusinessProjection(db as any,await f.retry(),f.adapter);expect(f.submit).toHaveBeenCalledTimes(1);
  expect(f.lookup.mock.calls[0][0].idempotencyKey).toBe(f.lookup.mock.calls[1][0].idempotencyKey);
  const dispatch=await db.erpProjectionDispatch.findUniqueOrThrow({where:{projectionId:f.projection.projectionId},include:{attempts:{orderBy:{attemptNumber:'asc'}}}});expect(dispatch.attempts.map(row=>row.outcome)).toEqual(['UNKNOWN','ACCEPTED']);expect(JSON.stringify(dispatch)).not.toContain('secret-token');
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.projection.outboxEventId}})).processStatus).toBe('PROCESSED');expect(await f.claim()).toBeNull();
  expect(await db.erpProjectionReconciliation.count({where:{projectionId:f.projection.projectionId}})).toBe(0);
  await expect(db.erpProjectionDispatch.update({where:{dispatchId:dispatch.dispatchId},data:{requestHash:'0'.repeat(64)}})).rejects.toThrow();
 });
 it('does not submit on unknown lookup and fences stale acknowledgement before a fresh retry',async()=>{
  const f=await dispatchFixture();f.lookup.mockResolvedValueOnce({kind:'UNKNOWN'});await processErpBusinessProjection(db as any,await f.claim(),f.adapter);expect(f.submit).not.toHaveBeenCalled();
  f.lookup.mockImplementationOnce(async()=>{await db.outboxEvent.update({where:{outboxEventId:f.projection.outboxEventId},data:{availableAt:new Date(0)}});return {kind:'ACCEPTED',providerReference:'ERP-'+f.order.orderNo,requestHash:f.projection.payloadHash};});
  expect(await processErpBusinessProjection(db as any,await f.retry(),f.adapter)).toEqual({lostLease:true});
  f.lookup.mockResolvedValueOnce({kind:'ACCEPTED',providerReference:'ERP-'+f.order.orderNo,requestHash:f.projection.payloadHash});await processErpBusinessProjection(db as any,await f.claim(),f.adapter);
  expect(f.submit).not.toHaveBeenCalled();expect(await db.erpProjectionDispatchAttempt.count({where:{dispatch:{projectionId:f.projection.projectionId}}})).toBe(2);
 });
 it('rejects wrong-request acceptance with an actionable exception and keeps live adapters disabled',async()=>{
  const f=await dispatchFixture();expect(await pollErpBusinessProjections(db as any,[])).toEqual({configured:false,claimed:0});
  f.lookup.mockResolvedValueOnce({kind:'ACCEPTED',providerReference:'ERP-WRONG',requestHash:'0'.repeat(64)});await processErpBusinessProjection(db as any,await f.claim(),f.adapter);
  expect(f.submit).not.toHaveBeenCalled();expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.projection.outboxEventId}})).processStatus).toBe('DEAD');
  expect(await db.operationalException.findFirst({where:{sourceType:'ERP_BUSINESS_PROJECTION',sourceId:f.projection.projectionReference}})).toMatchObject({exceptionCode:'ERP_PROJECTION_REQUIRES_RECONCILIATION',severity:'CRITICAL'});
 });
 it('prevents another projection from claiming the same external document across connection versions',async()=>{
  const first=await dispatchFixture();await processErpBusinessProjection(db as any,await first.claim(),first.adapter);
  const firstVersion=await db.providerConnectionVersion.findUniqueOrThrow({where:{providerConnectionVersionId:first.adapter.providerConnectionVersionId}});
  const nextVersion=await db.providerConnectionVersion.create({data:{providerConnectionId:firstVersion.providerConnectionId,version:2,environment:'TEST',credentialSecretRef:'synthetic-reference',webhookVerificationRef:'synthetic-reference',configHash:'b'.repeat(64),effectiveFrom:new Date(0),approvalReference:'SYNTHETIC_APPROVAL',createdByActor:randomUUID()}});
  const second=await dispatchFixture(),adapter={...second.adapter,providerConnectionVersionId:nextVersion.providerConnectionVersionId};
  second.lookup.mockResolvedValueOnce({kind:'ACCEPTED',providerReference:'ERP-'+first.order.orderNo,requestHash:second.projection.payloadHash});
  expect(await processErpBusinessProjection(db as any,await second.claim(),adapter)).toEqual({outcome:'REJECTED'});
  expect(await db.erpProjectionExternalReference.count({where:{providerConnectionId:firstVersion.providerConnectionId}})).toBe(1);
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:second.projection.outboxEventId}})).lastError).toBe('ERP_PROJECTION_EXTERNAL_REFERENCE_CONFLICT');
  await expect(db.erpProjectionExternalReference.create({data:{projectionId:second.projection.projectionId,providerConnectionId:firstVersion.providerConnectionId,providerReference:'ERP-'+first.order.orderNo}})).rejects.toThrow();
  await expect(db.erpProjectionExternalReference.delete({where:{projectionId:first.projection.projectionId}})).rejects.toThrow();
 });
 it('allows only one concurrent claim and diagnoses the losing receipt on fresh delivery',async()=>{
  const first=await dispatchFixture(),second=await dispatchFixture(),reference='ERP-CONCURRENT-'+first.order.orderNo;
  for(const f of [first,second])f.lookup.mockResolvedValue({kind:'ACCEPTED',providerReference:reference,requestHash:f.projection.payloadHash});
  const secondAdapter={...second.adapter,providerConnectionVersionId:first.adapter.providerConnectionVersionId};
  const results=await Promise.allSettled([processErpBusinessProjection(db as any,await first.claim(),first.adapter),processErpBusinessProjection(db as any,await second.claim(),secondAdapter)]);
  for(const [index,result] of results.entries())if(result.status==='rejected'){const f=index===0?first:second;expect(await processErpBusinessProjection(db as any,await f.retry(),index===0?first.adapter:secondAdapter)).toEqual({outcome:'REJECTED'});}
  expect(await db.erpProjectionExternalReference.count({where:{providerReference:reference}})).toBe(1);
  const events=await db.outboxEvent.findMany({where:{outboxEventId:{in:[first.projection.outboxEventId,second.projection.outboxEventId]}}});expect(events.map(row=>row.processStatus).sort()).toEqual(['DEAD','PROCESSED']);
  expect(events.find(row=>row.processStatus==='DEAD')!.lastError).toBe('ERP_PROJECTION_EXTERNAL_REFERENCE_CONFLICT');
 });
 it('seals one Sales payload/outbox concurrently and preserves private drillback separately',async()=>{
  const f=await fixture(),ctx=context(),call=()=>db.$transaction(tx=>requestErpSalesProjection(tx,f.order.orderNo.toString(),ctx));
  const results=await Promise.all([call(),call()]);expect(results.map(row=>row.replayed).sort()).toEqual([false,true]);
  const projection=results[0].projection,payload=verifyErpBusinessProjection(projection),body=JSON.stringify(payload);
  expect(payload).toMatchObject({stream:'SALES',orderNo:f.order.orderNo.toString(),grossAmount:'200.00',discountAmount:'10.00',netAmount:'190.00',lines:[{sku:f.product.sku,quantity:'2.0000',amount:'200.00'}]});
  for(const hidden of [f.person.personId,f.person.legalName,f.order.orderId,f.order.lines[0].orderLineId,ctx.actorId,'must-not-export'])expect(body).not.toContain(hidden);
  expect(await call()).toEqual({projection,replayed:true});expect(await db.outboxEvent.count({where:{aggregateId:projection.projectionId}})).toBe(1);
  expect((await db.order.findUniqueOrThrow({where:{orderId:f.order.orderId}})).status).toBe('PAID');
  await expect(db.erpBusinessProjection.update({where:{projectionId:projection.projectionId},data:{payloadHash:'b'.repeat(64)}})).rejects.toThrow();
  await expect(db.erpBusinessProjection.delete({where:{projectionId:projection.projectionId}})).rejects.toThrow();
  expect(()=>verifyErpBusinessProjection({...projection,drillbackSnapshot:{changed:true}})).toThrow('ERP_PROJECTION_INTEGRITY_INVALID');
 });
 it('rejects unpaid Sales and rolls back an Outbox if sealing fails',async()=>{
  const f=await fixture(false);await expect(db.$transaction(tx=>requestErpSalesProjection(tx,f.order.orderNo.toString(),context()))).rejects.toThrow('ERP_SALES_APPROVED_SOURCE_REQUIRED');
  await db.order.update({where:{orderId:f.order.orderId},data:{status:'PAID',paidAt:new Date()}});
  const count=await db.outboxEvent.count();
  await expect(db.$transaction(tx=>requestErpSalesProjection({...tx,erpBusinessProjection:{findUnique:tx.erpBusinessProjection.findUnique,create:async()=>{throw new Error('SYNTHETIC_SEAL_FAILURE');}}} as any,f.order.orderNo.toString(),context()))).rejects.toThrow('SYNTHETIC_SEAL_FAILURE');
  expect(await db.outboxEvent.count()).toBe(count);expect(await db.erpBusinessProjection.count({where:{sourceIdentity:f.order.orderId}})).toBe(0);
 });
 it('links only a posted accepted ReturnCase without changing its economic consequences',async()=>{
  const f=await fixture(),ret=await db.returnCase.create({data:{orderId:f.order.orderId,status:'DRAFT',reasonCode:'SYNTHETIC',occurredAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:f.order.lines[0].orderLineId,quantity:1,returnAmount:95,gpvReversalAmount:0}}},include:{lines:true}});
  const call=()=>db.$transaction(tx=>requestErpReturnProjection(tx,ret.returnCaseId,context()));
  await expect(call()).rejects.toThrow('ERP_RETURN_POSTED_SOURCE_REQUIRED');
  const accepted=await db.returnCase.update({where:{returnCaseId:ret.returnCaseId},data:{status:'POSTED',postedAt:new Date()}});
  const results=await Promise.all([call(),call()]);expect(results.map(row=>row.replayed).sort()).toEqual([false,true]);
  const payload=verifyErpBusinessProjection(results[0].projection);expect(payload).toMatchObject({stream:'RETURN',orderNo:f.order.orderNo.toString(),amount:'95.00',lines:[{sku:f.product.sku,quantity:'1.0000',amount:'95.00',receivedSerialNos:[]}]});
  expect(JSON.stringify(payload)).not.toContain(ret.returnCaseId);expect(await db.returnCase.findUniqueOrThrow({where:{returnCaseId:ret.returnCaseId}})).toEqual(accepted);
  expect(await db.bonusRecoveryEvent.count({where:{returnCaseId:ret.returnCaseId}})).toBe(0);
 });
 it('requires compensation projection approval and blocks dispatch without accounting mapping',async()=>{
  const sourceIdentity='SYNTHETIC-PERIOD-'+randomUUID(),input={stream:'COMPENSATION' as const,sourceIdentity,body:{periodReference:'SYNTHETIC'},drillback:{synthetic:true},context:context()};
  await expect(db.$transaction(tx=>sealErpBusinessProjection(tx,input))).rejects.toThrow('ERP_COMPENSATION_PROJECTION_APPROVAL_REQUIRED');
  const {projection}=await db.$transaction(tx=>sealErpBusinessProjection(tx,{...input,context:{...input.context,approvalReference:'SYNTHETIC_AGGREGATION_APPROVAL'}}));
  const connection=await db.providerConnection.create({data:{domain:'ERP',provider:'EZTOOL',connectionKey:randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'synthetic-reference',webhookVerificationRef:'synthetic-reference',configHash:'a'.repeat(64),effectiveFrom:new Date(0),approvalReference:'SYNTHETIC_APPROVAL',createdByActor:randomUUID()}}},include:{versions:true}});
  await expect(db.erpProjectionDispatch.create({data:{projectionId:projection.projectionId,providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,idempotencyKey:'ucell-erp-projection-'+'a'.repeat(64),requestHash:projection.payloadHash}})).rejects.toThrow('ERP_ACCOUNT_MAPPING_REQUIRED');
  expect(await db.erpProjectionDispatch.count({where:{projectionId:projection.projectionId}})).toBe(0);
 });
});
