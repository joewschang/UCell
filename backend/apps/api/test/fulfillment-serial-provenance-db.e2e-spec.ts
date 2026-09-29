import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../src/common/audit/audit.service';
import {FulfillmentSourceAllocationService} from '../src/modules/commerce/fulfillment-source-allocation.service';
import {FulfillmentSerialScanService} from '../src/modules/commerce/fulfillment-serial-scan.service';
import {FulfillmentPackVerificationService} from '../src/modules/commerce/fulfillment-pack-verification.service';
import {FulfillmentSerialProvenanceService} from '../src/modules/commerce/fulfillment-serial-provenance.service';
import {FulfillmentOperationsService} from '../src/modules/commerce/fulfillment-operations.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('shipment and return physical serial provenance',()=>{
 let db:PrismaClient,service:FulfillmentSerialProvenanceService,sequence=810;
 const context=()=>({actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()});
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});service=new FulfillmentSerialProvenanceService(db as any,new AuditService());});
 afterAll(async()=>db?.$disconnect());
 async function fixture(wrongContents=false,splitSameSku=false,allowSubstitution=true){
  const person=await db.person.create({data:{legalName:'Synthetic serial provenance'}});
  const product=await db.productReference.create({data:{sku:'PROVENANCE-'+randomUUID(),displayName:'Synthetic product',currentPrice:100}});
  const lineInput=(purpose:string,quantity:number)=>({productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity,unitPrice:100,lineAmount:100*quantity,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{returnSerialSubstitutionAllowed:allowSubstitution},linePurpose:purpose,commercialOfferingSnapshot:{version:1,offeringCode:'TEST',returnSerialSubstitutionAllowed:allowSubstitution}});
  const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',status:'PAID',paidAt:new Date(),grossAmount:splitSameSku?400:200,netAmount:splitSameSku?400:200,ruleVersionCode:'R1',lines:{create:splitSameSku?[lineInput('QUALIFICATION_PACKAGE',2),lineInput('REPURCHASE_PLAN',2)]:lineInput('ADDITIONAL_PURCHASE',2)}},include:{lines:true}});
  const f=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:randomUUID(),allocationSnapshotRef:'test',fulfillmentPolicySnapshotRef:'test'}});
  const sources=[];
  for(const line of order.lines)sources.push(await db.$transaction(tx=>new FulfillmentSourceAllocationService(db as any).allocate(tx,{fulfillmentId:f.fulfillmentId,orderLineId:line.orderLineId,quantity:'2'})));
  const source=sources[0];
  const batchNo=sequence++,batch=await db.productSerialBatch.create({data:{productId:product.productId,serialPrefix:'E',batchSequence:batchNo,batchCode:randomUUID()}});
  const serialNos=Array.from({length:splitSameSku?4:2},(_,index)=>`E${batchNo}${String(index+1).padStart(4,'0')}`);
  for(let index=0;index<serialNos.length;index++){
   await db.serializedUnit.create({data:{productSerialBatchId:batch.productSerialBatchId,serialSequence:index+1,serialNo:serialNos[index]}});
   await new FulfillmentSerialScanService(db as any,new AuditService()).scan({fulfillmentSourceAllocationId:sources[Math.floor(index/2)].fulfillmentSourceAllocationId,serialNo:serialNos[index],...context()});
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
  const acceptedReturn=async(quantity=1,lineIndex=0)=>db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),postedAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:order.lines[lineIndex].orderLineId,quantity,returnAmount:100*quantity,gpvReversalAmount:0}}},include:{lines:true}});
  return {f,order,source,sources,serialNos,shipment,bind,dispatch,acceptedReturn};
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
  const binding=await db.shipmentSerialBinding.findFirstOrThrow({where:{allocation:{serializedUnit:{serialNo:f.serialNos[0]}}}});
  await expect(db.returnSerialReceipt.create({data:{returnLineId:ret.lines[0].returnLineId,shipmentSerialBindingId:binding.shipmentSerialBindingId,receivedByActor:'fixture',eligibilityEvidence:{},evidenceHash:'a'.repeat(64)}})).rejects.toThrow();
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
 it('accepts governed same-order same-shipment same-SKU substitution without rewriting physical or economic provenance',async()=>{
  const f=await fixture(false,true);await f.dispatch();await f.bind();const ret=await f.acceptedReturn(2,1);
  const before=JSON.stringify(await db.returnCase.findUniqueOrThrow({where:{returnCaseId:ret.returnCaseId},include:{lines:true}}));
  const result=await service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,f.serialNos.slice(0,2),context());
  expect(result).toMatchObject({serialCount:2,substitutedCount:2,replayed:false});
  expect(result.results).toEqual(expect.arrayContaining(f.serialNos.slice(0,2).map(serialNo=>expect.objectContaining({serialNo,receiptType:'SAME_ORDER_SAME_SKU',economicPurpose:'REPURCHASE_PLAN',replayed:false}))));
  const receipts=await db.returnSerialReceipt.findMany({where:{returnLineId:ret.lines[0].returnLineId},include:{shipmentBinding:{include:{allocation:{include:{sourceAllocation:true}}}}}});
  expect(receipts).toHaveLength(2);
  for(const receipt of receipts){
   expect(receipt).toMatchObject({receiptType:'SAME_ORDER_SAME_SKU',substitutionRuleVersion:'R1.0B_SAME_ORDER_SAME_SKU_V1'});
   expect(receipt.evidenceHash).toMatch(/^[0-9a-f]{64}$/);
   expect(receipt.eligibilityEvidence).toMatchObject({format:'UCELL_RETURN_SERIAL_ELIGIBILITY_V1',result:'ELIGIBLE',economicPurpose:'REPURCHASE_PLAN',originalPurpose:'QUALIFICATION_PACKAGE'});
   expect(receipt.shipmentBinding.allocation.sourceAllocation.orderLineId).toBe(f.order.lines[0].orderLineId);
  }
  expect(JSON.stringify(await db.returnCase.findUniqueOrThrow({where:{returnCaseId:ret.returnCaseId},include:{lines:true}}))).toBe(before);
  const read=await new FulfillmentOperationsService(db as any,undefined as any,undefined as any,undefined as any,undefined as any,new AuditService(),undefined as any,service,undefined as any,undefined as any).order(f.order.orderNo.toString());
  expect(read.returns[0].lines[0]).toMatchObject({sku:f.order.lines[1].skuSnapshot,purpose:'REPURCHASE_PLAN',received:2});
  expect(read.returns[0].lines[0].receipts).toEqual(expect.arrayContaining([expect.objectContaining({receiptType:'SAME_ORDER_SAME_SKU',originalPurpose:'QUALIFICATION_PACKAGE',substitutionRuleVersion:'R1.0B_SAME_ORDER_SAME_SKU_V1'})]));
  expect(JSON.stringify(read)).not.toContain(ret.returnCaseId);expect(JSON.stringify(read)).not.toContain(ret.lines[0].returnLineId);expect(JSON.stringify(read)).not.toContain(f.order.lines[0].orderLineId);
  const replay=await service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,f.serialNos.slice(0,2),context());
  expect(replay).toMatchObject({serialCount:2,substitutedCount:0,replayed:true});
  expect(await db.returnSerialReceipt.count({where:{returnLineId:ret.lines[0].returnLineId}})).toBe(2);
 });
 it.each(['RECALLED','QUARANTINED'] as const)('rejects %s physical units without allocating a return receipt',async status=>{
  const f=await fixture(false,true);await f.dispatch();await f.bind();const ret=await f.acceptedReturn(1,1);
  await db.serializedUnit.update({where:{serialNo:f.serialNos[0]},data:{status}});
  await expect(service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,[f.serialNos[0]],context())).rejects.toMatchObject({response:{code:'RETURN_SERIAL_NOT_SHIPPED'}});
  expect(await db.returnSerialReceipt.count({where:{returnLineId:ret.lines[0].returnLineId}})).toBe(0);
 });
 it('fails closed when stored SKU/Offering authority disallows substitution',async()=>{
  const f=await fixture(false,true,false);await f.dispatch();await f.bind();const ret=await f.acceptedReturn(1,1);
  await expect(service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,[f.serialNos[0]],context())).rejects.toMatchObject({response:{code:'RETURN_SERIAL_SOURCE_MISMATCH'}});
  const binding=await db.shipmentSerialBinding.findFirstOrThrow({where:{allocation:{serializedUnit:{serialNo:f.serialNos[0]}}}});
  await expect(db.returnSerialReceipt.create({data:{returnLineId:ret.lines[0].returnLineId,shipmentSerialBindingId:binding.shipmentSerialBindingId,receivedByActor:'fixture',receiptType:'SAME_ORDER_SAME_SKU',substitutionRuleVersion:'R1.0B_SAME_ORDER_SAME_SKU_V1',eligibilityEvidence:{format:'UCELL_RETURN_SERIAL_ELIGIBILITY_V1'},evidenceHash:'a'.repeat(64)}})).rejects.toThrow(/RETURN_SERIAL_SUBSTITUTION_INELIGIBLE/);
  expect(await db.returnSerialReceipt.count({where:{returnLineId:ret.lines[0].returnLineId}})).toBe(0);
  expect(await db.serializedUnit.findUniqueOrThrow({where:{serialNo:f.serialNos[0]}})).toMatchObject({status:'SHIPPED'});
 });
 it('serializes concurrent substituted receipts against the accepted economic quantity',async()=>{
  const f=await fixture(false,true);await f.dispatch();await f.bind();const ret=await f.acceptedReturn(1,1);
  const results=await Promise.allSettled(f.serialNos.slice(0,2).map(serial=>service.receiveReturn(f.f.fulfillmentId,ret.returnCaseId,[serial],context())));
  expect(results.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  expect((results.find(result=>result.status==='rejected') as PromiseRejectedResult).reason).toMatchObject({response:{code:'RETURN_SERIAL_QUANTITY_EXCEEDED'}});
  expect(await db.returnSerialReceipt.count({where:{returnLineId:ret.lines[0].returnLineId,receiptType:'SAME_ORDER_SAME_SKU'}})).toBe(1);
 });
});
