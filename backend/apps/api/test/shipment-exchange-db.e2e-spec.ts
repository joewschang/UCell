import {PrismaClient} from '@prisma/client';
import {createHash,randomUUID} from 'node:crypto';
import {plainToInstance} from 'class-transformer';
import {validate} from 'class-validator';
import {AuditService} from '../src/common/audit/audit.service';
import {CreateShipmentExchangeDto,ExchangeReceiptDto,FulfillmentExchangeController} from '../src/modules/commerce/fulfillment-exchange.controller';
import {FulfillmentExchangeService} from '../src/modules/commerce/fulfillment-exchange.service';
import {FulfillmentPackVerificationService} from '../src/modules/commerce/fulfillment-pack-verification.service';
import {FulfillmentSerialProvenanceService} from '../src/modules/commerce/fulfillment-serial-provenance.service';
import {FulfillmentSerialScanService} from '../src/modules/commerce/fulfillment-serial-scan.service';
import {FulfillmentSourceAllocationService} from '../src/modules/commerce/fulfillment-source-allocation.service';
import {FulfillmentOperationsService} from '../src/modules/commerce/fulfillment-operations.service';

const json=(value:unknown)=>JSON.stringify(value,(_key,entry)=>typeof entry==='bigint'?entry.toString():entry);
const context=()=>({actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()});
const shipmentRef=(id:string)=>createHash('sha256').update(`SHIPMENT:${id}`).digest('hex');
const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;

describe('shipment exchange input and authorization',()=>{
 it('requires warehouse roles and a real authenticated actor',async()=>{
  expect(Reflect.getMetadata('roles',FulfillmentExchangeController)).toEqual(['SUPER_ADMIN','ORDER_OPS']);
  const controller=new FulfillmentExchangeController({create:jest.fn()} as any);
  expect(()=>controller.create('1','F1',{} as any,{user:{}})).toThrow();
 });
 it('rejects empty/duplicate/oversized receipt sets and invalid reason/request identity',async()=>{
  for(const serialNos of [[],['A0010001','A0010001'],Array.from({length:101},(_,i)=>`A001${String(i+1).padStart(4,'0')}`),['wrong']]){
   expect((await validate(plainToInstance(ExchangeReceiptDto,{serialNos}))).length).toBeGreaterThan(0);
  }
  for(const patch of [{reason:' '},{reason:'x'.repeat(501)},{requestKey:'not-uuid'},{shipmentReference:'wrong'}]){
   expect((await validate(plainToInstance(CreateShipmentExchangeDto,{serialNos:['A0010001'],reason:'破損換貨',requestKey:randomUUID(),shipmentReference:'a'.repeat(64),...patch}))).length).toBeGreaterThan(0);
  }
  expect(await validate(plainToInstance(CreateShipmentExchangeDto,{serialNos:['A0010001'],reason:'破損換貨',requestKey:randomUUID(),shipmentReference:'a'.repeat(64)}))).toHaveLength(0);
 });
});

describeDb('shipment exchange lifecycle preserves physical and economic evidence',()=>{
 let db:PrismaClient,exchange:FulfillmentExchangeService,allocator:FulfillmentSourceAllocationService,scanner:FulfillmentSerialScanService,packer:FulfillmentPackVerificationService,provenance:FulfillmentSerialProvenanceService;
 let sequence=660;
 beforeAll(()=>{
  db=new PrismaClient({datasources:{db:{url}}});const audit=new AuditService();
  allocator=new FulfillmentSourceAllocationService(db as any);scanner=new FulfillmentSerialScanService(db as any,audit);packer=new FulfillmentPackVerificationService(db as any,audit);provenance=new FulfillmentSerialProvenanceService(db as any,audit);exchange=new FulfillmentExchangeService(db as any,audit,allocator);
 });
 afterAll(async()=>db?.$disconnect());
 async function fixture(dispatched=true){
  const person=await db.person.create({data:{legalName:'Synthetic exchange lifecycle'}});
  const product=await db.productReference.create({data:{sku:'EXCHANGE-LIFECYCLE-'+randomUUID(),displayName:'Synthetic product',currentPrice:100}});
  const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',status:'PAID',paidAt:new Date(),grossAmount:200,netAmount:200,ruleVersionCode:'EXCHANGE_TEST',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:2,unitPrice:100,lineAmount:200,gpvRateSnapshot:0.6,gpvAmountSnapshot:120,ruleProfileSnapshot:{},linePurpose:'ADDITIONAL_PURCHASE',commercialOfferingSnapshot:{version:1,offeringCode:'LIFECYCLE_TEST'}}}},include:{lines:true}});
  const f=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:randomUUID(),allocationSnapshotRef:'test',fulfillmentPolicySnapshotRef:'test'}});
  const source=await db.$transaction(tx=>allocator.allocate(tx,{fulfillmentId:f.fulfillmentId,orderLineId:order.lines[0].orderLineId,quantity:'2'}));
  const batchNo=sequence++,batch=await db.productSerialBatch.create({data:{productId:product.productId,serialPrefix:'B',batchSequence:batchNo,batchCode:randomUUID()}});
  const serialNos=Array.from({length:4},(_,index)=>`B${batchNo}${String(index+1).padStart(4,'0')}`);
  for(let index=0;index<serialNos.length;index++){
   await db.serializedUnit.create({data:{productSerialBatchId:batch.productSerialBatchId,serialSequence:index+1,serialNo:serialNos[index]}});
   if(index<2)await scanner.scan({fulfillmentSourceAllocationId:source.fulfillmentSourceAllocationId,serialNo:serialNos[index],...context()});
  }
  const pack=await packer.verify({fulfillmentId:f.fulfillmentId,...context()});
  const connection=await db.providerConnection.create({data:{domain:'LOGISTICS',provider:'OTHER',connectionKey:randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'synthetic',webhookVerificationRef:'synthetic',configHash:'a'.repeat(64),effectiveFrom:new Date(0),createdByActor:'fixture'}}},include:{versions:true}});
  const parcel=await db.fulfillmentParcel.create({data:{fulfillmentId:f.fulfillmentId,parcelKey:'P1',contentSnapshotRef:pack.evidence.policySnapshotRef,packageSnapshotRef:'synthetic'}});
  const shipment=await db.shipment.create({data:{fulfillmentId:f.fulfillmentId,fulfillmentParcelId:parcel.fulfillmentParcelId,fulfillmentQcEvidenceId:pack.evidence.fulfillmentQcEvidenceId,provider:'OTHER',connectionId:connection.connectionKey,providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,carrier:'OTHER',shippingMethod:'HOME_DELIVERY',recipientSnapshotRef:'synthetic',providerShipmentRef:randomUUID(),status:'LABEL_CREATED'}});
  if(dispatched){
   const now=new Date(),correlationId=randomUUID();
   const evidence=await db.shipmentTrackingEventEvidence.create({data:{shipmentId:shipment.shipmentId,providerConnectionVersionId:shipment.providerConnectionVersionId,providerEventIdentity:randomUUID(),providerShipmentRef:shipment.providerShipmentRef!,rawStatusCode:'TEST_PICKED_UP',normalizedStatus:'PICKED_UP',mappingSnapshotRef:'synthetic',payloadHash:'b'.repeat(64),safeEvidenceRef:'synthetic',eventTime:now,verifiedAt:now,correlationId}});
   await db.shipmentStateTransition.create({data:{shipmentId:shipment.shipmentId,shipmentTrackingEventEvidenceId:evidence.shipmentTrackingEventEvidenceId,fromStatus:'LABEL_CREATED',toStatus:'PICKED_UP',businessEffectIdentity:randomUUID(),operationHash:'c'.repeat(64),occurredAt:now,correlationId}});
   await db.shipment.update({where:{shipmentId:shipment.shipmentId},data:{status:'PICKED_UP'}});
  }
  await provenance.bindShipment(f.fulfillmentId,shipment.shipmentId,context());
  const input={shipmentReference:shipmentRef(shipment.shipmentId),serialNos:serialNos.slice(0,2),reason:'收到商品外盒破損',requestKey:randomUUID()};
  return {f,order,source,shipment,serialNos,input};
 }
 it('deduplicates concurrent requests and validates original scope and request content',async()=>{
  const f=await fixture(),args=[f.order.orderNo.toString(),f.f.fulfillmentKey,f.input] as const;
  const results=await Promise.all([exchange.create(...args,context()),exchange.create(...args,context())]);
  expect(results.map(row=>row.replayed).sort()).toEqual([false,true]);
  expect(results[0].exchangeReference).toBe(results[1].exchangeReference);
  expect(await db.shipmentExchangeCase.count({where:{originalFulfillmentId:f.f.fulfillmentId}})).toBe(1);
  await expect(exchange.create(args[0],args[1],{...f.input,reason:'changed'},context())).rejects.toMatchObject({response:{code:'EXCHANGE_IDEMPOTENCY_CONFLICT'}});
  await expect(exchange.create(args[0],args[1],{...f.input,requestKey:randomUUID()},context())).rejects.toMatchObject({response:{code:'EXCHANGE_SERIAL_ALREADY_CLAIMED'}});
  const other=await fixture();
  await expect(exchange.create(other.order.orderNo.toString(),other.f.fulfillmentKey,{...other.input,serialNos:[f.serialNos[0]]},context())).rejects.toMatchObject({response:{code:'EXCHANGE_SERIAL_SOURCE_MISMATCH'}});
  await expect(exchange.create(args[0],args[1],{...f.input,requestKey:randomUUID(),serialNos:[f.serialNos[0],f.serialNos[0]]},context())).rejects.toMatchObject({response:{code:'EXCHANGE_SERIAL_INPUT_INVALID'}});
 });
 it('supports partial receipt, one replacement, and preserves money, original units and source evidence',async()=>{
  const f=await fixture(),orderNo=f.order.orderNo.toString(),key=f.f.fulfillmentKey;
  const before=json(await db.order.findUnique({where:{orderId:f.order.orderId},include:{lines:true,paymentEvents:true}}));
  const originalSources=json(await db.fulfillmentSourceAllocation.findMany({where:{fulfillmentId:f.f.fulfillmentId}}));
  const created=await exchange.create(orderNo,key,f.input,context()),reference=created.exchangeReference;
  await expect(exchange.replacement(orderNo,key,reference,context())).rejects.toMatchObject({response:{code:'EXCHANGE_RECEIPT_REQUIRED'}});
  const partial=await exchange.receive(orderNo,key,reference,[f.serialNos[0]],context());expect(partial.status).toBe('REQUESTED');expect(partial.items.filter(row=>row.receivedAt)).toHaveLength(1);
  expect((await exchange.receive(orderNo,key,reference,[f.serialNos[0]],context())).replayed).toBe(true);
  await expect(exchange.cancel(orderNo,key,reference,context())).rejects.toMatchObject({response:{code:'EXCHANGE_CANCELLATION_NOT_ALLOWED'}});
  await expect(exchange.replacement(orderNo,key,reference,context())).rejects.toMatchObject({response:{code:'EXCHANGE_RECEIPT_REQUIRED'}});
  const receipt=await exchange.receive(orderNo,key,reference,[f.serialNos[1]],context());expect(receipt.status).toBe('RECEIVED');
  const replaced=await Promise.all([exchange.replacement(orderNo,key,reference,context()),exchange.replacement(orderNo,key,reference,context())]);
  expect(replaced.map(row=>row.replayed).sort()).toEqual([false,true]);expect(replaced[0].replacementFulfillmentKey).toBe(replaced[1].replacementFulfillmentKey);
  const replacement=await db.fulfillment.findFirstOrThrow({where:{orderId:f.order.orderId,fulfillmentKey:replaced[0].replacementFulfillmentKey!},include:{sourceAllocations:true}});
  expect(replacement.status).toBe('READY');expect(replacement.sourceAllocations).toHaveLength(1);
  expect(replacement.sourceAllocations[0]).toMatchObject({orderLineId:f.order.lines[0].orderLineId,skuSnapshot:f.source.skuSnapshot,linePurpose:f.source.linePurpose,commercialOfferingSnapshot:f.source.commercialOfferingSnapshot});
  expect(replacement.sourceAllocations[0].allocatedQuantity.toString()).toBe('2');
  for(const serialNo of f.serialNos.slice(2))await scanner.scan({fulfillmentSourceAllocationId:replacement.sourceAllocations[0].fulfillmentSourceAllocationId,serialNo,...context()});
  expect((await packer.verify({fulfillmentId:replacement.fulfillmentId,...context()})).evidence.result).toBe('PASS');
  expect((await db.serializedUnit.findMany({where:{serialNo:{in:f.serialNos.slice(0,2)}}})).map(row=>row.status)).toEqual(['RETURNED','RETURNED']);
  expect(json(await db.order.findUnique({where:{orderId:f.order.orderId},include:{lines:true,paymentEvents:true}}))).toBe(before);
  expect(json(await db.fulfillmentSourceAllocation.findMany({where:{fulfillmentId:f.f.fulfillmentId}}))).toBe(originalSources);
  expect(await db.returnCase.count({where:{orderId:f.order.orderId}})).toBe(0);expect(await db.pvLedger.count({where:{sourceId:f.order.orderId}})).toBe(0);
  const unrelated=await db.fulfillment.create({data:{orderId:f.order.orderId,fulfillmentKey:randomUUID(),allocationSnapshotRef:'attempt',fulfillmentPolicySnapshotRef:'normal'}});
  await expect(db.$transaction(tx=>allocator.allocate(tx,{fulfillmentId:unrelated.fulfillmentId,orderLineId:f.order.lines[0].orderLineId,quantity:'1'}))).rejects.toMatchObject({response:{code:'FULFILLMENT_ALLOCATION_EXCEEDS_ORDER_LINE'}});
  await expect(db.fulfillmentSourceAllocation.create({data:{fulfillmentId:unrelated.fulfillmentId,orderLineId:f.order.lines[0].orderLineId,allocatedQuantity:1,skuSnapshot:f.source.skuSnapshot}})).rejects.toThrow(/FULFILLMENT_ALLOCATION_EXCEEDS_ORDER_LINE/);
  const read=await new FulfillmentOperationsService(db as any,scanner,packer,undefined as any,allocator,new AuditService(),undefined as any,provenance,undefined as any,undefined as any).order(orderNo);
  expect(read.fulfillments.find(row=>row.fulfillmentKey===key)?.exchanges[0]).toMatchObject({exchangeNo:created.exchangeNo,status:'REPLACEMENT_CREATED',replacementFulfillmentKey:replacement.fulfillmentKey});
  for(const internal of [f.order.orderId,f.order.purchaserPersonId!,f.f.fulfillmentId,f.shipment.shipmentId])expect(json(read)).not.toContain(internal);
 });
 it('cancels only unreceived requests and permits a new claim while retaining history',async()=>{
  const f=await fixture(),orderNo=f.order.orderNo.toString(),key=f.f.fulfillmentKey;
  const first=await exchange.create(orderNo,key,f.input,context());
  expect((await exchange.cancel(orderNo,key,first.exchangeReference,context())).status).toBe('CANCELLED');
  expect((await exchange.cancel(orderNo,key,first.exchangeReference,context())).replayed).toBe(true);
  const next=await exchange.create(orderNo,key,{...f.input,requestKey:randomUUID()},context());expect(next.exchangeReference).not.toBe(first.exchangeReference);
  await expect(exchange.receive(orderNo,key,first.exchangeReference,[f.serialNos[0]],context())).rejects.toMatchObject({response:{code:'EXCHANGE_CANCELLED'}});
  expect(await db.shipmentExchangeCase.count({where:{originalFulfillmentId:f.f.fulfillmentId}})).toBe(2);
  const cancelled=await db.shipmentExchangeCase.findFirstOrThrow({where:{originalFulfillmentId:f.f.fulfillmentId,status:'CANCELLED'}});
  await expect(db.shipmentExchangeCase.delete({where:{shipmentExchangeCaseId:cancelled.shipmentExchangeCaseId}})).rejects.toThrow();
 });
 it('requires real dispatch and blocks pending financial returns or refunded orders',async()=>{
  const unshipped=await fixture(false);
  await expect(exchange.create(unshipped.order.orderNo.toString(),unshipped.f.fulfillmentKey,unshipped.input,context())).rejects.toMatchObject({response:{code:'EXCHANGE_SHIPMENT_NOT_SHIPPED'}});
  const f=await fixture();
  await db.returnCase.create({data:{orderId:f.order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),postedAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:f.order.lines[0].orderLineId,quantity:1,returnAmount:100,gpvReversalAmount:60}}}});
  await expect(exchange.create(f.order.orderNo.toString(),f.f.fulfillmentKey,f.input,context())).rejects.toMatchObject({response:{code:'EXCHANGE_PENDING_RETURN'}});
  await db.order.update({where:{orderId:f.order.orderId},data:{status:'RETURNED'}});
  await expect(exchange.create(f.order.orderNo.toString(),f.f.fulfillmentKey,f.input,context())).rejects.toMatchObject({response:{code:'EXCHANGE_ORDER_NOT_ELIGIBLE'}});
 });
});
