import {PrismaClient} from '@prisma/client';
import {claimOutboxLease} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {pollErpHandoffs,processErpHandoff,type PhysicalErpAdapter} from '../../worker/src/erp-handoff-runtime';
const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('physical ERP dispatch durability',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
 afterAll(async()=>db?.$disconnect());
 async function fixture(){
  const person=await db.person.create({data:{legalName:'Synthetic ERP dispatch'}});
  const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:'R1'}});
  const f=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:randomUUID(),allocationSnapshotRef:'fixture',fulfillmentPolicySnapshotRef:'fixture',status:'PACKED'}});
  const payload={schemaVersion:1,format:'UCELL_FULFILLMENT_ERP_V1',orderNo:order.orderNo.toString(),fulfillmentKey:f.fulfillmentKey,lines:[{sku:'TIP-363',quantity:'1',serialNos:['A6030001']}]};
  const payloadHash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const event=await db.outboxEvent.create({data:{eventType:'FULFILLMENT_ERP_HANDOFF_REQUESTED',aggregateType:'FULFILLMENT',aggregateId:f.fulfillmentId,payload,correlationId:randomUUID()}});
  const handoff=await db.fulfillmentErpHandoff.create({data:{fulfillmentId:f.fulfillmentId,outboxEventId:event.outboxEventId,providerCode:'ERP_PENDING',formatVersion:payload.format,payloadHash,payloadSnapshot:payload,requestedByActor:person.personId}});
  const connection=await db.providerConnection.create({data:{domain:'ERP',provider:'EZTOOL',connectionKey:randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'synthetic-secret-reference',webhookVerificationRef:'synthetic-verification-reference',configHash:'a'.repeat(64),effectiveFrom:new Date(0),approvalReference:'SYNTHETIC-TEST-APPROVAL',createdByActor:person.personId}}},include:{versions:true}});
  const lookup=jest.fn().mockResolvedValue({kind:'ABSENT'}),submit=jest.fn().mockResolvedValue({kind:'ACCEPTED',providerReference:'ERP-603',requestHash:payloadHash});
  const adapter:PhysicalErpAdapter={provider:'EZTOOL',providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,environment:'TEST',lookup,submit};
  const claim=async()=>{const current=await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:event.outboxEventId}});return (await claimOutboxLease(db,current))!;};
  const retry=async()=>{await db.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{availableAt:new Date(0)}});return claim();};
  return {f,event,handoff,payloadHash,connection,adapter,lookup,submit,claim,retry};
 }
 it('claims once concurrently and stores one immutable acceptance without shipping',async()=>{
  const f=await fixture();const leases=await Promise.all([f.claim(),f.claim()]);expect(leases.filter(Boolean)).toHaveLength(1);
  await processErpHandoff(db as any,leases.find(Boolean)!,f.adapter);
  expect(f.submit).toHaveBeenCalledTimes(1);
  const dispatch=await db.fulfillmentErpDispatch.findUniqueOrThrow({where:{fulfillmentErpHandoffId:f.handoff.fulfillmentErpHandoffId},include:{attempts:true}});
  expect(dispatch.attempts).toHaveLength(1);expect(dispatch.attempts[0].outcome).toBe('ACCEPTED');
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.event.outboxEventId}})).processStatus).toBe('PROCESSED');
  expect((await db.fulfillment.findUniqueOrThrow({where:{fulfillmentId:f.f.fulfillmentId}})).status).toBe('PACKED');
  await expect(db.fulfillmentErpDispatch.update({where:{dispatchId:dispatch.dispatchId},data:{idempotencyKey:'rewrite'}})).rejects.toThrow();
  await expect(db.fulfillmentErpDispatchAttempt.delete({where:{attemptId:dispatch.attempts[0].attemptId}})).rejects.toThrow();
 });
 it('reconciles an ambiguous submission after restart with the same key and no duplicate send',async()=>{
  const f=await fixture();f.submit.mockRejectedValueOnce(new Error('PRIVATE_PROVIDER_BODY secret-token'));
  await processErpHandoff(db as any,await f.claim(),f.adapter);
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.event.outboxEventId}})).lastError).toBe('ERP_ACCEPTANCE_UNKNOWN');
  f.lookup.mockResolvedValueOnce({kind:'ACCEPTED',providerReference:'ERP-603',requestHash:f.payloadHash});
  await processErpHandoff(db as any,await f.retry(),f.adapter);
  expect(f.submit).toHaveBeenCalledTimes(1);
  expect(f.lookup.mock.calls[0][0].idempotencyKey).toBe(f.lookup.mock.calls[1][0].idempotencyKey);
  const dispatch=await db.fulfillmentErpDispatch.findUniqueOrThrow({where:{fulfillmentErpHandoffId:f.handoff.fulfillmentErpHandoffId},include:{attempts:{orderBy:{attemptNumber:'asc'}}}});
  expect(dispatch.attempts.map(a=>a.outcome)).toEqual(['UNKNOWN','ACCEPTED']);expect(JSON.stringify(dispatch)).not.toContain('secret-token');
 });
 it('does not submit after unknown lookup, and only resubmits after authoritative absence',async()=>{
  const f=await fixture();f.lookup.mockResolvedValueOnce({kind:'UNKNOWN'});
  await processErpHandoff(db as any,await f.claim(),f.adapter);expect(f.submit).not.toHaveBeenCalled();
  await processErpHandoff(db as any,await f.retry(),f.adapter);expect(f.submit).toHaveBeenCalledTimes(1);
  expect(f.lookup.mock.calls[0][0].idempotencyKey).toBe(f.submit.mock.calls[0][0].idempotencyKey);
 });
 it('rejects a receipt for a different request and creates one controlled exception',async()=>{
  const f=await fixture();f.lookup.mockResolvedValueOnce({kind:'ACCEPTED',providerReference:'ERP-WRONG',requestHash:'0'.repeat(64)});
  await processErpHandoff(db as any,await f.claim(),f.adapter);expect(f.submit).not.toHaveBeenCalled();
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.event.outboxEventId}})).processStatus).toBe('DEAD');
  expect(await db.operationalException.count({where:{sourceType:'ERP_HANDOFF',sourceId:{endsWith:f.f.fulfillmentKey}}})).toBe(1);
 });
 it('fences stale completion and recovers provider acceptance after worker lease loss',async()=>{
  const f=await fixture(),lease=await f.claim();
  f.submit.mockImplementationOnce(async()=>{await db.outboxEvent.update({where:{outboxEventId:f.event.outboxEventId},data:{availableAt:new Date(0)}});return {kind:'ACCEPTED',providerReference:'ERP-603',requestHash:f.payloadHash};});
  expect(await processErpHandoff(db as any,lease,f.adapter)).toEqual({lostLease:true});
  f.lookup.mockResolvedValueOnce({kind:'ACCEPTED',providerReference:'ERP-603',requestHash:f.payloadHash});
  await processErpHandoff(db as any,await f.claim(),f.adapter);
  expect(f.submit).toHaveBeenCalledTimes(1);
  expect(await db.fulfillmentErpDispatchAttempt.count({where:{dispatch:{fulfillmentErpHandoffId:f.handoff.fulfillmentErpHandoffId}}})).toBe(1);
 });
 it('pins the original connection and refuses unapproved connections before network IO',async()=>{
  const f=await fixture();await db.providerConnection.update({where:{providerConnectionId:f.connection.providerConnectionId},data:{status:'SUSPENDED'}});
  await expect(processErpHandoff(db as any,await f.claim(),f.adapter)).rejects.toThrow('ERP_CONNECTION_NOT_APPROVED');
  expect(f.lookup).not.toHaveBeenCalled();expect(f.submit).not.toHaveBeenCalled();
  expect(await db.fulfillmentErpDispatch.count({where:{fulfillmentErpHandoffId:f.handoff.fulfillmentErpHandoffId}})).toBe(0);
  await expect(db.fulfillmentErpDispatch.create({data:{fulfillmentErpHandoffId:f.handoff.fulfillmentErpHandoffId,providerConnectionVersionId:f.adapter.providerConnectionVersionId,idempotencyKey:'ucell-erp-'+'0'.repeat(64)}})).rejects.toThrow('ERP_DISPATCH_CONNECTION_NOT_APPROVED');
 });
 it('leaves unconfigured handoffs untouched instead of acknowledging them',async()=>{
  const f=await fixture();expect(await pollErpHandoffs(db as any,[])).toEqual({configured:false,claimed:0});
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.event.outboxEventId}})).attemptCount).toBe(0);
 });
 it('never switches a previously dispatched request to another ERP connection',async()=>{
  const f=await fixture(),other=await fixture();f.lookup.mockResolvedValueOnce({kind:'UNKNOWN'});
  await processErpHandoff(db as any,await f.claim(),f.adapter);
  await expect(processErpHandoff(db as any,await f.retry(),other.adapter)).rejects.toThrow('ERP_DISPATCH_CONNECTION_MISMATCH');
  expect(other.lookup).not.toHaveBeenCalled();expect(other.submit).not.toHaveBeenCalled();
 });
 it('requires official provider enablement before the polling loop claims work',async()=>{
  const f=await fixture();await expect(pollErpHandoffs(db as any,[f.adapter],{})).rejects.toThrow('PROVIDER_ENABLEMENT_MANIFEST_REQUIRED');
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.event.outboxEventId}})).attemptCount).toBe(0);
  expect(f.lookup).not.toHaveBeenCalled();
 });
 it('stops automatic retries after ten unknown outcomes with a safe exception',async()=>{
  const f=await fixture();await db.outboxEvent.update({where:{outboxEventId:f.event.outboxEventId},data:{attemptCount:9}});f.lookup.mockResolvedValueOnce({kind:'UNKNOWN'});
  await processErpHandoff(db as any,await f.claim(),f.adapter);
  expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.event.outboxEventId}})).processStatus).toBe('DEAD');expect(f.submit).not.toHaveBeenCalled();
  expect(await db.operationalException.count({where:{sourceType:'ERP_HANDOFF',sourceId:{endsWith:f.f.fulfillmentKey}}})).toBe(1);
 });
});
