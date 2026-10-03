import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {ProviderWebhookWorkerLeaseService,runProviderWebhookBatch,type ProviderWebhookWorkerLease,type ShipmentStatus} from '@ucell/database';
import {createShipmentTrackingHandler,type VerifiedShipmentTrackingAdapter} from '../../worker/src/shipment-tracking-handler';
import {AuditService} from '../src/common/audit/audit.service';
import {FulfillmentSourceAllocationService} from '../src/modules/commerce/fulfillment-source-allocation.service';
import {FulfillmentSerialScanService} from '../src/modules/commerce/fulfillment-serial-scan.service';
import {FulfillmentPackVerificationService} from '../src/modules/commerce/fulfillment-pack-verification.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('verified shipment tracking worker persistence',()=>{
 let db:PrismaClient,sequence=950;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
 afterAll(async()=>db?.$disconnect());
 async function fixture(){
  const product=await db.productReference.create({data:{sku:randomUUID(),displayName:'Synthetic tracking product',currentPrice:100}});
  const person=await db.person.create({data:{legalName:'Synthetic tracking purchaser'}});
  const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',status:'PAID',paidAt:new Date(),grossAmount:100,netAmount:100,ruleVersionCode:'R1',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{},linePurpose:'ADDITIONAL_PURCHASE'}}},include:{lines:true}});
  const f=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:randomUUID(),allocationSnapshotRef:'synthetic',fulfillmentPolicySnapshotRef:'synthetic'}});
  const source=await db.$transaction(tx=>new FulfillmentSourceAllocationService(db as any).allocate(tx,{fulfillmentId:f.fulfillmentId,orderLineId:order.lines[0].orderLineId,quantity:'1'}));
  const batchNo=sequence++,batch=await db.productSerialBatch.create({data:{productId:product.productId,serialPrefix:'A',batchSequence:batchNo,batchCode:randomUUID()}});
  const unit=await db.serializedUnit.create({data:{productSerialBatchId:batch.productSerialBatchId,serialSequence:1,serialNo:`A${batchNo}0001`}});
  const context={actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()};
  await new FulfillmentSerialScanService(db as any,new AuditService()).scan({fulfillmentSourceAllocationId:source.fulfillmentSourceAllocationId,serialNo:unit.serialNo,...context});
  const pack=await new FulfillmentPackVerificationService(db as any,new AuditService()).verify({fulfillmentId:f.fulfillmentId,...context});
  const connection=await db.providerConnection.create({data:{domain:'LOGISTICS',provider:'OTHER',connectionKey:randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'synthetic',webhookVerificationRef:'synthetic',configHash:'a'.repeat(64),effectiveFrom:new Date(0),createdByActor:'fixture',approvalReference:'synthetic'}}},include:{versions:true}});
  const version=connection.versions[0],parcel=await db.fulfillmentParcel.create({data:{fulfillmentId:f.fulfillmentId,parcelKey:'P1',contentSnapshotRef:pack.evidence.policySnapshotRef,packageSnapshotRef:'synthetic'}});
  const shipment=await db.shipment.create({data:{fulfillmentId:f.fulfillmentId,fulfillmentParcelId:parcel.fulfillmentParcelId,fulfillmentQcEvidenceId:pack.evidence.fulfillmentQcEvidenceId,provider:'OTHER',connectionId:connection.connectionKey,providerConnectionVersionId:version.providerConnectionVersionId,carrier:'OTHER',shippingMethod:'HOME_DELIVERY',recipientSnapshotRef:'snapshot://synthetic',providerShipmentRef:randomUUID(),status:'LABEL_CREATED'}});
  const allocation=await db.fulfillmentSerialAllocation.findUniqueOrThrow({where:{serializedUnitId:unit.serializedUnitId}});
  await db.shipmentSerialBinding.create({data:{shipmentId:shipment.shipmentId,fulfillmentSerialAllocationId:allocation.fulfillmentSerialAllocationId,boundByActor:'synthetic'}});
  async function event(status:ShipmentStatus|null='PICKED_UP',time='2026-01-01T01:00:00Z',inboxStatus:'PROCESSING'|'VERIFIED'|'RECEIVED'='PROCESSING'){
   const row=await db.providerWebhookInbox.create({data:{domain:'LOGISTICS',provider:'OTHER',connectionId:connection.connectionKey,ingressKey:randomUUID(),providerEventIdentity:randomUUID(),payloadHash:'b'.repeat(64),verificationEvidenceHash:inboxStatus==='RECEIVED'?null:'c'.repeat(64),safeEvidenceRef:'evidence://synthetic',verificationConfigVersion:'synthetic-v1',status:inboxStatus,attemptCount:inboxStatus==='PROCESSING'?1:0,leaseOwner:inboxStatus==='PROCESSING'?'tracking-test':null,leaseExpiresAt:inboxStatus==='PROCESSING'?new Date(Date.now()+120000):null,verifiedAt:inboxStatus==='RECEIVED'?null:new Date(),correlationId:randomUUID(),providerConnectionVersionId:version.providerConnectionVersionId}});
   const lease=row as unknown as ProviderWebhookWorkerLease;
   const fact={payloadHash:row.payloadHash,providerShipmentRef:shipment.providerShipmentRef!,eventIdentity:row.providerEventIdentity!,rawStatusCode:status??'UNKNOWN',status,mappingSnapshotRef:status?'mapping://synthetic-v1':null,eventTime:time};
   const readVerified=jest.fn().mockResolvedValue(fact),adapter:VerifiedShipmentTrackingAdapter={provider:'OTHER',connectionId:connection.connectionKey,providerConnectionVersionId:version.providerConnectionVersionId,readVerified};
   const handler=createShipmentTrackingHandler(db as any,adapter);
   return {lease,fact,adapter,readVerified,handler,run:()=>handler.process(lease)};
  }
  return {f,unit,shipment,event};
 }
 it('concurrent/repeated verified delivery has one physical effect, claim and Outbox',async()=>{
  const f=await fixture(),e=await f.event();
  expect(await Promise.all([e.run(),e.run()])).toEqual(['SUCCESS','SUCCESS']);expect(await e.run()).toBe('SUCCESS');
  expect(await db.shipmentTrackingEventEvidence.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(1);
  expect(await db.shipmentStateTransition.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(1);
  expect(await db.shipmentOperationClaim.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(1);
  expect(await db.outboxEvent.count({where:{aggregateId:f.f.fulfillmentId,eventType:'SHIPMENT_TRACKING_OBSERVED'}})).toBe(1);
  expect(await db.serializedUnit.findUnique({where:{serializedUnitId:f.unit.serializedUnitId}})).toMatchObject({status:'SHIPPED'});
  expect(await db.fulfillment.findUnique({where:{fulfillmentId:f.f.fulfillmentId}})).toMatchObject({status:'SHIPPED'});
 });
 it('retains stale evidence without regressing delivered projection or returned units',async()=>{
  const f=await fixture();await (await f.event()).run();await (await f.event('IN_TRANSIT','2026-01-01T02:00:00Z')).run();await (await f.event('DELIVERED','2026-01-01T03:00:00Z')).run();
  await db.serializedUnit.update({where:{serializedUnitId:f.unit.serializedUnitId},data:{status:'RETURNED'}});
  expect(await (await f.event('PICKED_UP','2026-01-01T01:30:00Z')).run()).toBe('SUCCESS');
  expect(await db.shipment.findUnique({where:{shipmentId:f.shipment.shipmentId}})).toMatchObject({status:'DELIVERED'});
  expect(await db.fulfillment.findUnique({where:{fulfillmentId:f.f.fulfillmentId}})).toMatchObject({status:'DELIVERED'});
  expect(await db.serializedUnit.findUnique({where:{serializedUnitId:f.unit.serializedUnitId}})).toMatchObject({status:'RETURNED'});
  expect(await db.shipmentTrackingEventEvidence.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(4);
  expect(await db.shipmentStateTransition.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(3);
 });
 it('fails closed for unverified, foreign-connection and adapter digest mismatches',async()=>{
  const f=await fixture(),e=await f.event();
  expect(await e.handler.process({...e.lease,connectionId:'foreign'})).toBe('PERMANENT_FAILURE');expect(e.readVerified).not.toHaveBeenCalled();
  const unverified=await f.event('PICKED_UP','2026-01-01T01:00:00Z','RECEIVED');
  expect(await unverified.run()).toBe('PERMANENT_FAILURE');expect(unverified.readVerified).not.toHaveBeenCalled();
  const bad=await f.event();bad.readVerified.mockResolvedValue({...bad.fact,payloadHash:'d'.repeat(64)});expect(await bad.run()).toBe('PERMANENT_FAILURE');
  expect(await db.shipmentTrackingEventEvidence.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(0);
 });
 it('fences an adapter response after lease expiry without a shipment effect',async()=>{
  const f=await fixture(),e=await f.event();e.readVerified.mockImplementation(async()=>{await db.$transaction(async tx=>{await tx.$executeRawUnsafe("SELECT set_config('ucell.provider_webhook_lease_owner', 'tracking-test', true)");await tx.providerWebhookInbox.update({where:{providerWebhookInboxId:e.lease.providerWebhookInboxId},data:{leaseExpiresAt:new Date(0)}});});return e.fact;});
  expect(await e.run()).toBe('UNKNOWN_FAILURE');expect(await db.shipmentTrackingEventEvidence.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(0);
 });
 it('preserves unmapped/invalid provider facts for manual reconciliation',async()=>{
  const f=await fixture();expect(await (await f.event(null)).run()).toBe('PERMANENT_FAILURE');expect(await (await f.event('DELIVERED')).run()).toBe('PERMANENT_FAILURE');
  expect(await db.shipmentTrackingEventEvidence.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(2);
  expect(await db.shipment.findUnique({where:{shipmentId:f.shipment.shipmentId}})).toMatchObject({status:'LABEL_CREATED'});
  expect(await db.shipmentStateTransition.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(0);
  expect(await db.operationalException.count({where:{sourceId:{endsWith:f.f.fulfillmentKey}}})).toBe(1);
 });
 it('rejects changed normalization for a previously consumed event identity',async()=>{
  const f=await fixture(),e=await f.event();await e.run();e.readVerified.mockResolvedValue({...e.fact,status:'IN_TRANSIT'});
  expect(await e.run()).toBe('PERMANENT_FAILURE');expect(await db.shipmentTrackingEventEvidence.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(1);
  expect(await db.shipment.findUnique({where:{shipmentId:f.shipment.shipmentId}})).toMatchObject({status:'PICKED_UP'});
 });
 it('records carrier truth while preserving recalled-unit controls',async()=>{
  const f=await fixture();await db.serializedUnit.update({where:{serializedUnitId:f.unit.serializedUnitId},data:{status:'RECALLED'}});
  expect(await (await f.event()).run()).toBe('SUCCESS');expect(await db.shipment.findUnique({where:{shipmentId:f.shipment.shipmentId}})).toMatchObject({status:'PICKED_UP'});
  expect(await db.serializedUnit.findUnique({where:{serializedUnitId:f.unit.serializedUnitId}})).toMatchObject({status:'RECALLED'});
  expect(await db.fulfillment.findUnique({where:{fulfillmentId:f.f.fulfillmentId}})).toMatchObject({status:'PACKED'});
  expect(await db.operationalException.count({where:{sourceId:{endsWith:f.f.fulfillmentKey}}})).toBe(1);
 });
 it('rolls back evidence, projection and claims together before a safe retry',async()=>{
  const f=await fixture(),e=await f.event();
  const failing={$transaction:(work:any)=>db.$transaction(tx=>work(new Proxy(tx,{get(target,key){if(key==='outboxEvent')return {create:async()=>{throw new Error('TEST_OUTBOX_FAILURE');}};return (target as any)[key];}}))),providerWebhookInbox:db.providerWebhookInbox};
  await expect(createShipmentTrackingHandler(failing as any,e.adapter).process(e.lease)).rejects.toThrow('TEST_OUTBOX_FAILURE');
  expect(await db.shipmentTrackingEventEvidence.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(0);expect(await db.shipment.findUnique({where:{shipmentId:f.shipment.shipmentId}})).toMatchObject({status:'LABEL_CREATED'});
  expect(await e.run()).toBe('SUCCESS');
 });
 it('uses the existing Inbox claim/finalization runner for a verified logistics event',async()=>{
  const f=await fixture(),e=await f.event('PICKED_UP','2026-01-01T01:00:00Z','VERIFIED');
  const result=await runProviderWebhookBatch(new ProviderWebhookWorkerLeaseService(db as any),lease=>lease.providerWebhookInboxId===e.lease.providerWebhookInboxId?e.handler:null,{leaseOwner:'real-runner',leaseMs:120000,batchSize:100,maxAttempts:3,retryBackoffSeconds:[30,120]});
  expect(result.processed).toBeGreaterThanOrEqual(1);expect(await db.providerWebhookInbox.findUnique({where:{providerWebhookInboxId:e.lease.providerWebhookInboxId}})).toMatchObject({status:'PROCESSED',attemptCount:1});
 });
 it('keeps carrier return observations separate from accepted economic returns and private evidence',async()=>{
  const f=await fixture();
  for(const [index,state] of (['PICKED_UP','IN_TRANSIT','RETURNING','RETURNED'] as const).entries())expect(await (await f.event(state,`2026-01-01T0${index+1}:00:00Z`)).run()).toBe('SUCCESS');
  expect(await db.shipment.findUnique({where:{shipmentId:f.shipment.shipmentId}})).toMatchObject({status:'RETURNED'});
  expect(await db.serializedUnit.findUnique({where:{serializedUnitId:f.unit.serializedUnitId}})).toMatchObject({status:'SHIPPED'});
  expect(await db.returnCase.count({where:{orderId:f.f.orderId}})).toBe(0);
  expect(await db.order.findUnique({where:{orderId:f.f.orderId}})).toMatchObject({status:'PAID',grossAmount:expect.anything()});
  const payloads=JSON.stringify((await db.outboxEvent.findMany({where:{aggregateId:f.f.fulfillmentId,eventType:'SHIPMENT_TRACKING_OBSERVED'}})).map(row=>row.payload));
  for(const value of [f.shipment.shipmentId,f.unit.serializedUnitId,f.shipment.providerConnectionVersionId,'evidence://synthetic','Synthetic tracking purchaser'])expect(payloads).not.toContain(value);
 });
 it('rejects a differently pinned adapter version before reading protected evidence',async()=>{
  const f=await fixture(),e=await f.event();
  expect(await createShipmentTrackingHandler(db as any,{...e.adapter,providerConnectionVersionId:randomUUID()}).process(e.lease)).toBe('PERMANENT_FAILURE');
  expect(e.readVerified).not.toHaveBeenCalled();
 });
});
