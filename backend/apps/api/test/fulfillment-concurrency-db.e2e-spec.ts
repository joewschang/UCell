import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../src/common/audit/audit.service';
import {FulfillmentSerialScanService} from '../src/modules/commerce/fulfillment-serial-scan.service';
import {FulfillmentSourceAllocationService} from '../src/modules/commerce/fulfillment-source-allocation.service';
import {FulfillmentErpHandoffService} from '../src/modules/commerce/fulfillment-erp-handoff.service';
import {FulfillmentPackVerificationService,SERIAL_PACK_POLICY} from '../src/modules/commerce/fulfillment-pack-verification.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('FULFILLMENT_CONCURRENCY_REAL_DB',()=>{
 let db:PrismaClient,sequence=700;
 beforeAll(()=>db=new PrismaClient({datasources:{db:{url}}}));
 afterAll(()=>db.$disconnect());
 const context=()=>({actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()});
 async function fixture(){
  const person=await db.person.create({data:{legalName:'Warehouse concurrency fixture'}});
  const product=await db.productReference.create({data:{sku:`SER-${randomUUID()}`,displayName:'Test unit',currentPrice:100}});
  const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:'R1',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{}}}},include:{lines:true}});
  const fulfillment=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:randomUUID(),allocationSnapshotRef:'test',fulfillmentPolicySnapshotRef:'test'}});
  const allocator=new FulfillmentSourceAllocationService(db as any);
  const allocate=(fulfillmentId:string)=>db.$transaction(tx=>allocator.allocate(tx,{fulfillmentId,orderLineId:order.lines[0].orderLineId,quantity:'1'}));
  const batch=await db.productSerialBatch.create({data:{productId:product.productId,serialPrefix:'D',batchSequence:sequence++,batchCode:randomUUID()}});
  const unit=async(serialSequence:number)=>db.serializedUnit.create({data:{productSerialBatchId:batch.productSerialBatchId,serialSequence,serialNo:`D${batch.batchSequence}${String(serialSequence).padStart(4,'0')}`}});
  const scan=(sourceId:string,serialNo:string)=>new FulfillmentSerialScanService(db as any,new AuditService()).scan({fulfillmentSourceAllocationId:sourceId,serialNo,...context()});
  return {order,fulfillment,batch,allocate,unit,scan};
 }
 it('concurrent identical scans replay one allocation and one audit',async()=>{
  const f=await fixture(),source=await f.allocate(f.fulfillment.fulfillmentId),unit=await f.unit(1);
  const results=await Promise.all([f.scan(source.fulfillmentSourceAllocationId,unit.serialNo),f.scan(source.fulfillmentSourceAllocationId,unit.serialNo)]);
  expect(results.map(r=>r.replayed).sort()).toEqual([false,true]);
  expect(await db.auditEvent.count({where:{entityId:f.fulfillment.fulfillmentId,action:'FULFILLMENT_SERIAL_SCANNED'}})).toBe(1);
 });
 it('concurrent different serials cannot exceed one expected unit',async()=>{
  const f=await fixture(),source=await f.allocate(f.fulfillment.fulfillmentId),a=await f.unit(1),b=await f.unit(2);
  const results=await Promise.allSettled([f.scan(source.fulfillmentSourceAllocationId,a.serialNo),f.scan(source.fulfillmentSourceAllocationId,b.serialNo)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason).toMatchObject({response:{code:'FULFILLMENT_SOURCE_QUANTITY_EXCEEDED'}});
  expect(await db.serializedUnit.count({where:{productSerialBatchId:f.batch.productSerialBatchId,status:'AVAILABLE'}})).toBe(1);
 });
 it('serializes source allocation across different fulfillments of one order line',async()=>{
  const f=await fixture();
  const other=await db.fulfillment.create({data:{orderId:f.order.orderId,fulfillmentKey:randomUUID(),allocationSnapshotRef:'test',fulfillmentPolicySnapshotRef:'test'}});
  const results=await Promise.allSettled([f.allocate(f.fulfillment.fulfillmentId),f.allocate(other.fulfillmentId)]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect((results.find(r=>r.status==='rejected') as PromiseRejectedResult).reason).toMatchObject({response:{code:'FULFILLMENT_ALLOCATION_EXCEEDS_ORDER_LINE'}});
 });
 it.each(['SHIPPED','RETURNED','QUARANTINED','RECALLED'] as const)('rejects %s units without changing state',async status=>{
  const f=await fixture(),source=await f.allocate(f.fulfillment.fulfillmentId),unit=await f.unit(1);
  await db.serializedUnit.update({where:{serializedUnitId:unit.serializedUnitId},data:{status}});
  await expect(f.scan(source.fulfillmentSourceAllocationId,unit.serialNo)).rejects.toMatchObject({response:{code:status==='SHIPPED'?'SERIAL_ALREADY_SHIPPED':'SERIAL_NOT_AVAILABLE'}});
  expect(await db.fulfillmentSerialAllocation.count({where:{serializedUnitId:unit.serializedUnitId}})).toBe(0);
 });
 it.each(['expired','suspended'])('rejects %s batches',async state=>{
  const f=await fixture(),source=await f.allocate(f.fulfillment.fulfillmentId),unit=await f.unit(1);
  await db.productSerialBatch.update({where:{productSerialBatchId:f.batch.productSerialBatchId},data:state==='expired'?{expiresAt:new Date(0)}:{status:'SUSPENDED'}});
  await expect(f.scan(source.fulfillmentSourceAllocationId,unit.serialNo)).rejects.toMatchObject({response:{code:'SERIAL_BATCH_INELIGIBLE'}});
 });
 it('concurrent ERP handoff requests produce one immutable request and outbox',async()=>{
  const f=await fixture(),source=await f.allocate(f.fulfillment.fulfillmentId),unit=await f.unit(1);
  await f.scan(source.fulfillmentSourceAllocationId,unit.serialNo);
  const service=new FulfillmentErpHandoffService(db as any,new AuditService());
  const results=await Promise.all([service.request({fulfillmentId:f.fulfillment.fulfillmentId,...context()}),service.request({fulfillmentId:f.fulfillment.fulfillmentId,...context()})]);
  expect(results.map(r=>r.replayed).sort()).toEqual([false,true]);
  expect(results[0].handoff.payloadHash).toBe(results[1].handoff.payloadHash);
  expect(await db.outboxEvent.count({where:{aggregateId:f.fulfillment.fulfillmentId,eventType:'FULFILLMENT_ERP_HANDOFF_REQUESTED'}})).toBe(1);
  expect(await db.fulfillmentQcEvidence.count({where:{fulfillmentId:f.fulfillment.fulfillmentId,policyId:SERIAL_PACK_POLICY}})).toBe(1);
 });
 it('requires exact scan quantity and atomically records immutable pack evidence once',async()=>{
  const f=await fixture(),source=await f.allocate(f.fulfillment.fulfillmentId),unit=await f.unit(1);
  const service=new FulfillmentPackVerificationService(db as any,new AuditService());
  const verify=()=>service.verify({fulfillmentId:f.fulfillment.fulfillmentId,...context()});
  await expect(verify()).rejects.toMatchObject({response:{code:'FULFILLMENT_SERIAL_SCAN_INCOMPLETE'}});
  expect(await db.fulfillmentQcEvidence.count({where:{fulfillmentId:f.fulfillment.fulfillmentId}})).toBe(0);
  await f.scan(source.fulfillmentSourceAllocationId,unit.serialNo);
  const results=await Promise.all([verify(),verify()]);
  expect(results.map(r=>r.replayed).sort()).toEqual([false,true]);
  expect(results[0].evidence.policySnapshotRef).toBe(results[1].evidence.policySnapshotRef);
  expect(JSON.stringify(results[0].evidence.checks)).toContain(unit.serialNo);
  expect((await db.fulfillment.findUniqueOrThrow({where:{fulfillmentId:f.fulfillment.fulfillmentId}})).status).toBe('PACKED');
  await expect(db.fulfillmentQcEvidence.update({where:{fulfillmentQcEvidenceId:results[0].evidence.fulfillmentQcEvidenceId},data:{reason:'rewrite'}})).rejects.toThrow();
 });
 it('blocks ERP handoff if a scanned unit is recalled before packing',async()=>{
  const f=await fixture(),source=await f.allocate(f.fulfillment.fulfillmentId),unit=await f.unit(1);
  await f.scan(source.fulfillmentSourceAllocationId,unit.serialNo);
  await db.serializedUnit.update({where:{serializedUnitId:unit.serializedUnitId},data:{status:'RECALLED'}});
  await expect(new FulfillmentErpHandoffService(db as any,new AuditService()).request({fulfillmentId:f.fulfillment.fulfillmentId,...context()})).rejects.toMatchObject({response:{code:'SERIAL_PACK_UNIT_INELIGIBLE'}});
  expect(await db.fulfillmentErpHandoff.count({where:{fulfillmentId:f.fulfillment.fulfillmentId}})).toBe(0);
  expect((await db.fulfillment.findUniqueOrThrow({where:{fulfillmentId:f.fulfillment.fulfillmentId}})).status).toBe('READY');
 });
});
