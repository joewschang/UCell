import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../src/common/audit/audit.service';
import {FulfillmentSourceAllocationService} from '../src/modules/commerce/fulfillment-source-allocation.service';
import {FulfillmentSerialScanService} from '../src/modules/commerce/fulfillment-serial-scan.service';
import {FulfillmentPackVerificationService} from '../src/modules/commerce/fulfillment-pack-verification.service';
import {FulfillmentSerialProvenanceService} from '../src/modules/commerce/fulfillment-serial-provenance.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('shipment and return physical serial provenance',()=>{
 let db:PrismaClient,service:FulfillmentSerialProvenanceService,sequence=810;
 const context=()=>({actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()});
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});service=new FulfillmentSerialProvenanceService(db as any,new AuditService());});
 afterAll(async()=>db?.$disconnect());
 async function fixture(wrongContents=false){
  const person=await db.person.create({data:{legalName:'Synthetic serial provenance'}});
  const product=await db.productReference.create({data:{sku:'PROVENANCE-'+randomUUID(),displayName:'Synthetic product',currentPrice:100}});
  const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',status:'PAID',paidAt:new Date(),grossAmount:200,netAmount:200,ruleVersionCode:'R1',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:2,unitPrice:100,lineAmount:200,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{},linePurpose:'ADDITIONAL_PURCHASE',commercialOfferingSnapshot:{version:1,offeringCode:'TEST'}}}},include:{lines:true}});
  const f=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:randomUUID(),allocationSnapshotRef:'test',fulfillmentPolicySnapshotRef:'test'}});
  const source=await db.$transaction(tx=>new FulfillmentSourceAllocationService(db as any).allocate(tx,{fulfillmentId:f.fulfillmentId,orderLineId:order.lines[0].orderLineId,quantity:'2'}));
  const batchNo=sequence++,batch=await db.productSerialBatch.create({data:{productId:product.productId,serialPrefix:'E',batchSequence:batchNo,batchCode:randomUUID()}});
  const serialNos=[`E${batchNo}0001`,`E${batchNo}0002`];
  for(let index=0;index<2;index++){
   await db.serializedUnit.create({data:{productSerialBatchId:batch.productSerialBatchId,serialSequence:index+1,serialNo:serialNos[index]}});
   await new FulfillmentSerialScanService(db as any,new AuditService()).scan({fulfillmentSourceAllocationId:source.fulfillmentSourceAllocationId,serialNo:serialNos[index],...context()});
  }
  const pack=await new FulfillmentPackVerificationService(db as any,new AuditService()).verify({fulfillmentId:f.fulfillmentId,...context()});
  const connection=await db.providerConnection.create({data:{domain:'LOGISTICS',provider:'OTHER',connectionKey:randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'synthetic',webhookVerificationRef:'synthetic',configHash:'a'.repeat(64),effectiveFrom:new Date(0),createdByActor:'fixture',approvalReference:'synthetic'}}},include:{versions:true}});
  const parcel=await db.fulfillmentParcel.create({data:{fulfillmentId:f.fulfillmentId,parcelKey:'P1',contentSnapshotRef:wrongContents?'wrong':pack.evidence.policySnapshotRef,packageSnapshotRef:'synthetic'}});
  const shipment=await db.shipment.create({data:{fulfillmentId:f.fulfillmentId,fulfillmentParcelId:parcel.fulfillmentParcelId,fulfillmentQcEvidenceId:pack.evidence.fulfillmentQcEvidenceId,provider:'OTHER',connectionId:connection.connectionKey,providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,carrier:'OTHER',shippingMethod:'HOME_DELIVERY',recipientSnapshotRef:'snapshot://synthetic',providerShipmentRef:randomUUID(),status:'LABEL_CREATED'}});
  const bind=()=>service.bindShipment(f.fulfillmentId,shipment.shipmentId,context());
  const dispatch=async()=>db.$transaction(async tx=>{
   const now=new Date(),correlationId=randomUUID();
   const evidence=await tx.shipmentTrackingEventEvidence.create({data:{shipmentId:shipment.shipmentId,providerConnectionVersionId:shipment.providerConnectionVersionId,providerEventIdentity:randomUUID(),providerShipmentRef:shipment.providerShipmentRef!,rawStatusCode:'TEST_PICKED_UP',normalizedStatus:'PICKED_UP',mappingSnapshotRef:'snapshot://synthetic-mapping',payloadHash:'b'.repeat(64),safeEvidenceRef:'evidence://synthetic',eventTime:now,verifiedAt:now,correlationId}});
   await tx.shipmentStateTransition.create({data:{shipmentId:shipment.shipmentId,shipmentTrackingEventEvidenceId:evidence.shipmentTrackingEventEvidenceId,fromStatus:'LABEL_CREATED',toStatus:'PICKED_UP',businessEffectIdentity:randomUUID(),operationHash:'c'.repeat(64),occurredAt:now,correlationId}});
   await tx.shipment.update({where:{shipmentId:shipment.shipmentId},data:{status:'PICKED_UP'}});
  });
  const acceptedReturn=async(quantity=1)=>db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),postedAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:order.lines[0].orderLineId,quantity,returnAmount:100*quantity,gpvReversalAmount:0}}},include:{lines:true}});
  return {f,order,source,serialNos,shipment,bind,dispatch,acceptedReturn};
 }
 it('binds once concurrently, preserving all source purposes without claiming dispatch',async()=>{
  const f=await fixture(),results=await Promise.all([f.bind(),f.bind()]);
  expect(results.map(r=>r.replayed).sort()).toEqual([false,true]);
  const bindings=await db.shipmentSerialBinding.findMany({where:{shipmentId:f.shipment.shipmentId},include:{allocation:{include:{sourceAllocation:true}}}});
  expect(bindings).toHaveLength(2);expect(bindings[0].allocation.sourceAllocation).toMatchObject({orderLineId:f.order.lines[0].orderLineId,linePurpose:'ADDITIONAL_PURCHASE',commercialOfferingSnapshot:{version:1,offeringCode:'TEST'}});
  expect((await db.serializedUnit.findMany({where:{serialNo:{in:f.serialNos}}})).map(u=>u.status)).toEqual(['ALLOCATED','ALLOCATED']);
  expect(await db.auditEvent.count({where:{entityId:f.f.fulfillmentId,action:'SHIPMENT_SERIALS_BOUND'}})).toBe(1);
 });
 it('rejects wrong fulfillment and parcel content before any binding is written',async()=>{
  const f=await fixture(true),other=await fixture();
  await expect(f.bind()).rejects.toMatchObject({response:{code:'SHIPMENT_PACK_EVIDENCE_MISMATCH'}});
  await expect(service.bindShipment(f.f.fulfillmentId,other.shipment.shipmentId,context())).rejects.toMatchObject({response:{code:'SHIPMENT_NOT_BINDABLE'}});
  expect(await db.shipmentSerialBinding.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(0);
 });
 it('requires tracking evidence rather than trusting shipment status alone',async()=>{
  const f=await fixture();await db.shipment.update({where:{shipmentId:f.shipment.shipmentId},data:{status:'PICKED_UP'}});
  await expect(f.bind()).rejects.toMatchObject({response:{code:'SHIPMENT_DISPATCH_EVIDENCE_REQUIRED'}});
  expect(await db.shipmentSerialBinding.count({where:{shipmentId:f.shipment.shipmentId}})).toBe(0);
 });
 it('applies verified dispatch once and preserves physical provenance through partial return',async()=>{
  const f=await fixture();await f.bind();await f.dispatch();await f.bind();await f.bind();
  expect((await db.serializedUnit.findMany({where:{serialNo:{in:f.serialNos}}})).map(u=>u.status)).toEqual(['SHIPPED','SHIPPED']);
  expect(await db.auditEvent.count({where:{entityId:f.f.fulfillmentId,action:'SHIPMENT_SERIAL_DISPATCH_CONFIRMED'}})).toBe(1);
  const ret=await f.acceptedReturn(),before=JSON.stringify(ret);
  const receive=()=>service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,[f.serialNos[0]],context());
  const results=await Promise.all([receive(),receive()]);expect(results.map(r=>r.replayed).sort()).toEqual([false,true]);
  await expect(service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,[f.serialNos[1]],context())).rejects.toMatchObject({response:{code:'RETURN_SERIAL_QUANTITY_EXCEEDED'}});
  const receipt=await db.returnSerialReceipt.findFirstOrThrow({where:{returnLineId:ret.lines[0].returnLineId},include:{shipmentBinding:{include:{allocation:{include:{sourceAllocation:true}}}}}});
  expect(receipt.shipmentBinding.shipmentId).toBe(f.shipment.shipmentId);expect(receipt.shipmentBinding.allocation.sourceAllocation.orderLineId).toBe(ret.lines[0].orderLineId);
  expect(JSON.stringify(await db.returnCase.findUnique({where:{returnCaseId:ret.returnCaseId},include:{lines:true}}))).toBe(before);
  expect(await db.serializedUnit.findUnique({where:{serialNo:f.serialNos[0]}})).toMatchObject({status:'RETURNED'});
  expect(await db.serializedUnit.findUnique({where:{serialNo:f.serialNos[1]}})).toMatchObject({status:'SHIPPED'});
  await expect(db.returnSerialReceipt.delete({where:{returnSerialReceiptId:receipt.returnSerialReceiptId}})).rejects.toThrow();
  await expect(db.returnLine.update({where:{returnLineId:ret.lines[0].returnLineId},data:{quantity:2}})).rejects.toThrow();
  await expect(db.returnCase.update({where:{returnCaseId:ret.returnCaseId},data:{status:'VOIDED'}})).rejects.toThrow();
  await expect(db.orderLine.update({where:{orderLineId:f.order.lines[0].orderLineId},data:{linePurpose:'REPURCHASE_PLAN'}})).rejects.toThrow();
  await expect(db.shipment.update({where:{shipmentId:f.shipment.shipmentId},data:{recipientSnapshotRef:'replacement'}})).rejects.toThrow();
  const otherReturn=await f.acceptedReturn();await expect(service.receiveReturn(f.f.fulfillmentId,otherReturn.returnCaseId,[f.serialNos[0]],context())).rejects.toMatchObject({response:{code:'SERIAL_ALREADY_RETURNED'}});
 });
 it('rejects unshipped, duplicate and foreign-order return serials',async()=>{
  const f=await fixture(),other=await fixture(),ret=await f.acceptedReturn();await f.bind();
  await expect(service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,[f.serialNos[0]],context())).rejects.toMatchObject({response:{code:'RETURN_SERIAL_NOT_SHIPPED'}});
  await expect(service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,[f.serialNos[0],f.serialNos[0]],context())).rejects.toMatchObject({response:{code:'RETURN_SERIAL_INPUT_INVALID'}});
  await expect(service.receiveReturn(other.f.fulfillmentId,ret.returnCaseId,[other.serialNos[0]],context())).rejects.toMatchObject({response:{code:'POSTED_RETURN_REQUIRED'}});
  expect(await db.returnSerialReceipt.count({where:{returnLineId:ret.lines[0].returnLineId}})).toBe(0);
 });
 it('allows only the accepted quantity when different physical units arrive concurrently',async()=>{
  const f=await fixture();await f.dispatch();await f.bind();const ret=await f.acceptedReturn();
  const results=await Promise.allSettled(f.serialNos.map(serial=>service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,[serial],context())));
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason).toMatchObject({response:{code:'RETURN_SERIAL_QUANTITY_EXCEEDED'}});
  expect(await db.returnSerialReceipt.count({where:{returnLineId:ret.lines[0].returnLineId}})).toBe(1);
 });
});
