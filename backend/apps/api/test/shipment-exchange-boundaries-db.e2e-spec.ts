import {PrismaClient} from '@prisma/client';
import {createHash,randomUUID} from 'node:crypto';
import {AuditService} from '../src/common/audit/audit.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {OutboxService} from '../src/common/outbox/outbox.service';
import {FulfillmentExchangeService} from '../src/modules/commerce/fulfillment-exchange.service';
import {FulfillmentPackVerificationService} from '../src/modules/commerce/fulfillment-pack-verification.service';
import {FulfillmentSerialProvenanceService} from '../src/modules/commerce/fulfillment-serial-provenance.service';
import {FulfillmentSerialScanService} from '../src/modules/commerce/fulfillment-serial-scan.service';
import {FulfillmentSourceAllocationService} from '../src/modules/commerce/fulfillment-source-allocation.service';
import {ReturnService} from '../src/modules/return/return.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
const context=()=>({actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()});
const shipmentReference=(id:string)=>createHash('sha256').update(`SHIPMENT:${id}`).digest('hex');

describeDb('shipment exchange financial and replacement boundaries',()=>{
 let db:PrismaClient,exchange:FulfillmentExchangeService,financialReturn:ReturnService;
 let allocator:FulfillmentSourceAllocationService,scanner:FulfillmentSerialScanService;
 let packer:FulfillmentPackVerificationService,provenance:FulfillmentSerialProvenanceService;
 let batchSequence=730;

 beforeAll(()=>{
  db=new PrismaClient({datasources:{db:{url}}});
  const audit=new AuditService();
  allocator=new FulfillmentSourceAllocationService(db as any);
  scanner=new FulfillmentSerialScanService(db as any,audit);
  packer=new FulfillmentPackVerificationService(db as any,audit);
  provenance=new FulfillmentSerialProvenanceService(db as any,audit);
  exchange=new FulfillmentExchangeService(db as any,audit,allocator);
  financialReturn=new ReturnService(db as any,new IdempotencyService(db as any),audit,new OutboxService());
 });
 afterAll(async()=>db?.$disconnect());

 async function dispatch(fulfillmentId:string){
  const pack=await packer.verify({fulfillmentId,...context()});
  const connection=await db.providerConnection.create({data:{
   domain:'LOGISTICS',provider:'OTHER',connectionKey:randomUUID(),status:'ACTIVE',
   versions:{create:{version:1,environment:'TEST',credentialSecretRef:'synthetic',webhookVerificationRef:'synthetic',configHash:'a'.repeat(64),effectiveFrom:new Date(0),createdByActor:'fixture',approvalReference:'synthetic'}},
  },include:{versions:true}});
  const parcel=await db.fulfillmentParcel.create({data:{fulfillmentId,parcelKey:'P1',contentSnapshotRef:pack.evidence.policySnapshotRef,packageSnapshotRef:'synthetic'}});
  const shipment=await db.shipment.create({data:{
   fulfillmentId,fulfillmentParcelId:parcel.fulfillmentParcelId,fulfillmentQcEvidenceId:pack.evidence.fulfillmentQcEvidenceId,
   provider:'OTHER',connectionId:connection.connectionKey,providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,
   carrier:'OTHER',shippingMethod:'HOME_DELIVERY',recipientSnapshotRef:'snapshot://synthetic',providerShipmentRef:randomUUID(),status:'LABEL_CREATED',
  }});
  const now=new Date(),correlationId=randomUUID();
  await db.$transaction(async tx=>{
   const evidence=await tx.shipmentTrackingEventEvidence.create({data:{
    shipmentId:shipment.shipmentId,providerConnectionVersionId:shipment.providerConnectionVersionId,providerEventIdentity:randomUUID(),
    providerShipmentRef:shipment.providerShipmentRef!,rawStatusCode:'TEST_PICKED_UP',normalizedStatus:'PICKED_UP',mappingSnapshotRef:'snapshot://synthetic',
    payloadHash:'b'.repeat(64),safeEvidenceRef:'evidence://synthetic',eventTime:now,verifiedAt:now,correlationId,
   }});
   await tx.shipmentStateTransition.create({data:{
    shipmentId:shipment.shipmentId,shipmentTrackingEventEvidenceId:evidence.shipmentTrackingEventEvidenceId,
    fromStatus:'LABEL_CREATED',toStatus:'PICKED_UP',businessEffectIdentity:randomUUID(),operationHash:'c'.repeat(64),occurredAt:now,correlationId,
   }});
   await tx.shipment.update({where:{shipmentId:shipment.shipmentId},data:{status:'PICKED_UP'}});
  });
  await provenance.bindShipment(fulfillmentId,shipment.shipmentId,context());
  return shipment;
 }

 async function fixture(lineCount=1,unitQuantity=1,sameProduct=false){
  const person=await db.person.create({data:{legalName:'Synthetic exchange boundary member'}});
  const products=[];
  for(let i=0;i<lineCount;i++)products.push(sameProduct&&i>0?products[0]:await db.productReference.create({data:{sku:'EXCHANGE-BOUNDARY-'+randomUUID(),displayName:'Synthetic exchange product',currentPrice:100}}));
  const order=await db.order.create({data:{
   purchaserPersonId:person.personId,purpose:'RETAIL',status:'PAID',paidAt:new Date(),grossAmount:100*lineCount*unitQuantity,netAmount:100*lineCount*unitQuantity,ruleVersionCode:'EXCHANGE_TEST',
   lines:{create:products.map((product,index)=>({productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:unitQuantity,unitPrice:100,lineAmount:100*unitQuantity,gpvRateSnapshot:0.6,gpvAmountSnapshot:60*unitQuantity,ruleProfileSnapshot:{returnSerialSubstitutionAllowed:true},linePurpose:sameProduct?(index===0?'QUALIFICATION_PACKAGE':'REPURCHASE_PLAN'):'ADDITIONAL_PURCHASE',commercialOfferingSnapshot:{version:1,offeringCode:'EXCHANGE_TEST'}}))},
  },include:{lines:true}});
  const fulfillment=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:randomUUID(),allocationSnapshotRef:'synthetic',fulfillmentPolicySnapshotRef:'synthetic'}});
  const rows=[];
  for(const line of order.lines){
   const batch=await db.productSerialBatch.create({data:{productId:line.productId!,serialPrefix:'D',batchSequence:batchSequence++,batchCode:randomUUID()}});
   const source=await db.$transaction(tx=>allocator.allocate(tx,{fulfillmentId:fulfillment.fulfillmentId,orderLineId:line.orderLineId,quantity:String(unitQuantity)}));
   const serialNos:string[]=[];
   for(let serialSequence=1;serialSequence<=unitQuantity;serialSequence++){
    const serialNo=`D${String(batch.batchSequence).padStart(3,'0')}${String(serialSequence).padStart(4,'0')}`;
    await db.serializedUnit.create({data:{productSerialBatchId:batch.productSerialBatchId,serialSequence,serialNo}});
    await scanner.scan({fulfillmentSourceAllocationId:source.fulfillmentSourceAllocationId,serialNo,...context()});
    serialNos.push(serialNo);
   }
   rows.push({line,batch,serialNo:serialNos[0],serialNos});
  }
  const shipment=await dispatch(fulfillment.fulfillmentId);
  return {order,fulfillment,shipment,rows};
 }

 type Fixture=Awaited<ReturnType<typeof fixture>>;
 function createInput(shipmentId:string,serialNos:string[]){
  return {requestKey:randomUUID(),shipmentReference:shipmentReference(shipmentId),serialNos,reason:'Synthetic same-product replacement'};
 }
 function postReturn(f:Fixture,lineIndex=0){
  return financialReturn.post(f.order.orderId,{reasonCode:'SYNTHETIC_RETURN',occurredAt:new Date().toISOString(),lines:[{orderLineId:f.rows[lineIndex].line.orderLineId,quantity:'1'}]},randomUUID(),randomUUID(),randomUUID());
 }
 async function shipReplacement(f:Fixture,originalKey:string,reference:string){
  const view=await exchange.replacement(f.order.orderNo.toString(),originalKey,reference,context());
  const fulfillment=await db.fulfillment.findFirstOrThrow({where:{orderId:f.order.orderId,fulfillmentKey:view.replacementFulfillmentKey!},include:{sourceAllocations:true}});
  const serialNos:string[]=[];
  for(const source of fulfillment.sourceAllocations){
   const row=f.rows.find(candidate=>candidate.line.orderLineId===source.orderLineId)!;
   for(let i=0;i<source.allocatedQuantity.toNumber();i++){
    const last=await db.serializedUnit.findFirstOrThrow({where:{productSerialBatchId:row.batch.productSerialBatchId},orderBy:{serialSequence:'desc'}});
    const serialSequence=last.serialSequence+1,serialNo=`D${String(row.batch.batchSequence).padStart(3,'0')}${String(serialSequence).padStart(4,'0')}`;
    await db.serializedUnit.create({data:{productSerialBatchId:row.batch.productSerialBatchId,serialSequence,serialNo}});
    await scanner.scan({fulfillmentSourceAllocationId:source.fulfillmentSourceAllocationId,serialNo,...context()});
    serialNos.push(serialNo);
   }
  }
  return {fulfillment,shipment:await dispatch(fulfillment.fulfillmentId),serialNos};
 }

 it('never commits a financial return and a new exchange for the same shipped unit concurrently',async()=>{
  const f=await fixture();
  const outcomes=await Promise.allSettled([
   exchange.create(f.order.orderNo.toString(),f.fulfillment.fulfillmentKey,createInput(f.shipment.shipmentId,[f.rows[0].serialNo]),context()),
   postReturn(f),
  ]);
  expect(outcomes.filter(result=>result.status==='fulfilled')).toHaveLength(1);
  const returns=await db.returnCase.count({where:{orderId:f.order.orderId,status:'POSTED'}});
  const exchanges=await db.shipmentExchangeCase.count({where:{originalFulfillmentId:f.fulfillment.fulfillmentId,status:{not:'CANCELLED'}}});
  expect(returns+exchanges).toBe(1);
  expect(await db.serializedUnit.findUniqueOrThrow({where:{serialNo:f.rows[0].serialNo}})).toMatchObject({status:'SHIPPED'});
 });

 it('caps requested and pending exchange units after a different source line physically satisfies a same-SKU financial return',async()=>{
  const f=await fixture(2,2,true),orderNo=f.order.orderNo.toString(),key=f.fulfillment.fulfillmentKey;
  const posted=await postReturn(f,0),returnCaseId=posted.value!.returnCaseId;
  await expect(provenance.receiveReturn(f.fulfillment.fulfillmentId,returnCaseId,[f.rows[1].serialNo],context())).resolves.toMatchObject({substitutedCount:1});
  // The economic line now owns one unit, but both of its original serials remain
  // SHIPPED because the accepted return used the other same-SKU source line.
  expect((await db.serializedUnit.findMany({where:{serialNo:{in:f.rows[0].serialNos}}})).every(unit=>unit.status==='SHIPPED')).toBe(true);
  await expect(exchange.create(orderNo,key,createInput(f.shipment.shipmentId,f.rows[0].serialNos),context())).rejects.toMatchObject({response:{code:'EXCHANGE_QUANTITY_EXCEEDED'}});
  await expect(exchange.create(orderNo,key,createInput(f.shipment.shipmentId,[f.rows[0].serialNos[0]]),context())).resolves.toMatchObject({status:'REQUESTED'});
  await expect(exchange.create(orderNo,key,createInput(f.shipment.shipmentId,[f.rows[0].serialNos[1]]),context())).rejects.toMatchObject({response:{code:'EXCHANGE_QUANTITY_EXCEEDED'}});
  expect(await db.shipmentExchangeCase.count({where:{originalFulfillmentId:f.fulfillment.fulfillmentId}})).toBe(1);
 });

 it('accepts a later financial return of the replacement serial without consuming the old serial again',async()=>{
  const f=await fixture(),orderNo=f.order.orderNo.toString(),key=f.fulfillment.fulfillmentKey;
  const request=await exchange.create(orderNo,key,createInput(f.shipment.shipmentId,[f.rows[0].serialNo]),context());
  await exchange.receive(orderNo,key,request.exchangeReference,[f.rows[0].serialNo],context());
  const replacement=await shipReplacement(f,key,request.exchangeReference);
  expect(await db.returnCase.count({where:{orderId:f.order.orderId}})).toBe(0);
  expect(await db.outboxEvent.count({where:{eventType:'RETURN_CONFIRMED',payload:{path:['orderId'],equals:f.order.orderId}}})).toBe(0);

  const posted=await postReturn(f),returnCaseId=posted.value!.returnCaseId;
  await expect(provenance.receiveReturn(replacement.fulfillment.fulfillmentId,returnCaseId,replacement.serialNos,context())).resolves.toMatchObject({serialCount:1,replayed:false});
  await expect(provenance.receiveReturn(f.fulfillment.fulfillmentId,returnCaseId,[f.rows[0].serialNo],context())).rejects.toBeDefined();
  const receipts=await db.returnSerialReceipt.findMany({where:{returnLine:{returnCaseId}},include:{shipmentBinding:{include:{allocation:{include:{serializedUnit:true}}}}}});
  expect(receipts).toHaveLength(1);
  expect(receipts[0].shipmentBinding.allocation.serializedUnit.serialNo).toBe(replacement.serialNos[0]);
  expect(await db.order.findUniqueOrThrow({where:{orderId:f.order.orderId}})).toMatchObject({status:'RETURNED'});
  expect((await db.returnLine.findFirstOrThrow({where:{returnCaseId}})).returnAmount.toString()).toBe('100');
  expect((await db.returnLine.findFirstOrThrow({where:{returnCaseId}})).gpvReversalAmount.toString()).toBe('60');
 });

 it('allows an unrelated order line to be financially returned while another line is awaiting exchange receipt',async()=>{
  const f=await fixture(2),orderNo=f.order.orderNo.toString(),key=f.fulfillment.fulfillmentKey;
  const request=await exchange.create(orderNo,key,createInput(f.shipment.shipmentId,[f.rows[0].serialNo]),context());
  const posted=await postReturn(f,1);
  expect(posted.value!.lines).toEqual([expect.objectContaining({orderLineId:f.rows[1].line.orderLineId})]);
  await expect(exchange.receive(orderNo,key,request.exchangeReference,[f.rows[0].serialNo],context())).resolves.toMatchObject({status:'RECEIVED'});
  const replacement=await exchange.replacement(orderNo,key,request.exchangeReference,context());
  expect(replacement.status).toBe('REPLACEMENT_CREATED');
  expect(await db.order.findUniqueOrThrow({where:{orderId:f.order.orderId}})).toMatchObject({status:'PARTIAL_RETURN'});
 });

 it('can replace a replacement once again without creating new order value or rewriting the original shipment',async()=>{
  const f=await fixture(),orderNo=f.order.orderNo.toString(),key=f.fulfillment.fulfillmentKey;
  const original=await db.fulfillment.findUniqueOrThrow({where:{fulfillmentId:f.fulfillment.fulfillmentId}});
  const first=await exchange.create(orderNo,key,createInput(f.shipment.shipmentId,[f.rows[0].serialNo]),context());
  await exchange.receive(orderNo,key,first.exchangeReference,[f.rows[0].serialNo],context());
  const replacement=await shipReplacement(f,key,first.exchangeReference);

  const second=await exchange.create(orderNo,replacement.fulfillment.fulfillmentKey,createInput(replacement.shipment.shipmentId,replacement.serialNos),context());
  await exchange.receive(orderNo,replacement.fulfillment.fulfillmentKey,second.exchangeReference,replacement.serialNos,context());
  const secondReplacement=await shipReplacement(f,replacement.fulfillment.fulfillmentKey,second.exchangeReference);
  expect(secondReplacement.serialNos).toHaveLength(1);
  expect(new Set([f.rows[0].serialNo,...replacement.serialNos,...secondReplacement.serialNos]).size).toBe(3);
  expect(await db.fulfillment.findUniqueOrThrow({where:{fulfillmentId:f.fulfillment.fulfillmentId}})).toEqual(original);
  const order=await db.order.findUniqueOrThrow({where:{orderId:f.order.orderId},include:{lines:true}});
  expect(order.status).toBe('PAID');expect(order.netAmount.toString()).toBe('100');
  expect(order.lines).toEqual(f.order.lines);
  expect(await db.returnCase.count({where:{orderId:f.order.orderId}})).toBe(0);
  expect(await db.pvLedger.count({where:{sourceId:f.order.orderId}})).toBe(0);
  expect((await db.serializedUnit.findMany({where:{serialNo:{in:[f.rows[0].serialNo,...replacement.serialNos]}}})).every(unit=>unit.status==='RETURNED')).toBe(true);
  expect(await db.serializedUnit.findUniqueOrThrow({where:{serialNo:secondReplacement.serialNos[0]}})).toMatchObject({status:'SHIPPED'});
 });
});
