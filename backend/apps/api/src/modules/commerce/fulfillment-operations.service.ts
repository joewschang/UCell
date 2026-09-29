import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {createHash} from 'node:crypto';
import {FulfillmentSerialScanService} from './fulfillment-serial-scan.service';
import {FulfillmentPackVerificationService,SERIAL_PACK_POLICY} from './fulfillment-pack-verification.service';
import {FulfillmentErpHandoffService} from './fulfillment-erp-handoff.service';
import {FulfillmentSourceAllocationService} from './fulfillment-source-allocation.service';
import {AuditService} from '../../common/audit/audit.service';
import {FulfillmentErpReconciliationService,ErpPhysicalResult} from './fulfillment-erp-reconciliation.service';

const sourceReference=(id:string)=>createHash('sha256').update(`FULFILLMENT_SOURCE:${id}`).digest('hex');
type Context={actorId:string;requestId:string;correlationId:string};
@Injectable()
export class FulfillmentOperationsService{
 constructor(private readonly db:PrismaService,private readonly scanner:FulfillmentSerialScanService,private readonly packer:FulfillmentPackVerificationService,private readonly erp:FulfillmentErpHandoffService,private readonly allocator:FulfillmentSourceAllocationService,private readonly audit:AuditService,private readonly reconciler:FulfillmentErpReconciliationService){}
 private orderNumber(value:string){if(!/^\d{1,19}$/.test(value)||BigInt(value)>9223372036854775807n)throw new UnprocessableEntityException({code:'INVALID_ORDER_NO'});return BigInt(value);}
 async prepare(orderNo:string,context:Context){
  const number=this.orderNumber(orderNo);
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT order_id FROM commerce."order" WHERE order_no=${number} FOR UPDATE`;
   const order=await tx.order.findUnique({where:{orderNo:number},include:{lines:{orderBy:{orderLineId:'asc'}},fulfillments:true}});
   if(!order)throw new ConflictException({code:'ORDER_NOT_FOUND'});
   const fulfillmentKey=`F${number.toString()}-01`,existing=order.fulfillments.find(f=>f.fulfillmentKey===fulfillmentKey&&f.fulfillmentPolicySnapshotRef==='UCELL_IMMEDIATE_PAID_V1');
   if(existing)return {fulfillmentKey,replayed:true};
   if(order.status!=='PAID'||!order.paidAt)throw new ConflictException({code:'FULFILLMENT_PAID_ORDER_REQUIRED'});
   if(order.fulfillments.length)throw new ConflictException({code:'FULFILLMENT_ALREADY_CONFIGURED'});
   if(!order.lines.length||order.lines.some(line=>!line.quantity.isInteger()||line.quantity.lte(0)))throw new ConflictException({code:'FULFILLMENT_PHYSICAL_QUANTITY_INVALID'});
   const allocationSnapshotRef=createHash('sha256').update(JSON.stringify(order.lines.map(line=>({line:line.orderLineId,sku:line.skuSnapshot,quantity:line.quantity.toString(),offering:line.commercialOfferingSnapshot,purpose:line.linePurpose})))).digest('hex');
   const fulfillment=await tx.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey,allocationSnapshotRef,fulfillmentPolicySnapshotRef:'UCELL_IMMEDIATE_PAID_V1'}});
   for(const line of order.lines)await this.allocator.allocate(tx,{fulfillmentId:fulfillment.fulfillmentId,orderLineId:line.orderLineId,quantity:line.quantity.toString()});
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'FULFILLMENT_PREPARED',entityType:'FULFILLMENT',entityId:fulfillment.fulfillmentId,afterData:{orderNo:number.toString(),fulfillmentKey,allocationSnapshotRef},requestId:context.requestId,correlationId:context.correlationId});
   return {fulfillmentKey,replayed:false};
  });
 }
 async order(orderNo:string){
  const order=await this.db.order.findUnique({where:{orderNo:this.orderNumber(orderNo)},include:{fulfillments:{orderBy:{createdAt:'asc'},include:{sourceAllocations:{orderBy:{fulfillmentSourceAllocationId:'asc'},include:{serialAllocations:{include:{serializedUnit:true}}}},qcEvidence:{where:{policyId:SERIAL_PACK_POLICY},orderBy:{occurredAt:'asc'}},erpHandoffs:{include:{outboxEvent:{select:{processStatus:true}},reconciliations:{orderBy:{recordedAt:'desc'},take:50},dispatch:{include:{attempts:{orderBy:{attemptNumber:'desc'},take:1},providerConnectionVersion:{include:{connection:true}}}}}}}}}});
  if(!order)throw new ConflictException({code:'ORDER_NOT_FOUND'});
  return {orderNo:order.orderNo.toString(),status:order.status,fulfillments:order.fulfillments.map(f=>({fulfillmentKey:f.fulfillmentKey,status:f.status,sources:f.sourceAllocations.map(s=>({sourceReference:sourceReference(s.fulfillmentSourceAllocationId),sku:s.skuSnapshot,quantity:s.allocatedQuantity.toString(),serialNos:s.serialAllocations.map(a=>a.serializedUnit.serialNo).sort()})),packVerification:f.qcEvidence[0]?{status:'PACK_VERIFIED',snapshotHash:f.qcEvidence[0].policySnapshotRef,occurredAt:f.qcEvidence[0].occurredAt.toISOString()}:null,erpHandoff:f.erpHandoffs[0]?{providerCode:f.erpHandoffs[0].providerCode,deliveryState:f.erpHandoffs[0].outboxEvent.processStatus,dispatch:f.erpHandoffs[0].dispatch?{provider:f.erpHandoffs[0].dispatch.providerConnectionVersion.connection.provider,outcome:f.erpHandoffs[0].dispatch.attempts[0]?.outcome??'PENDING',attemptNumber:f.erpHandoffs[0].dispatch.attempts[0]?.attemptNumber??0}:null,payloadHash:f.erpHandoffs[0].payloadHash,requestedAt:f.erpHandoffs[0].requestedAt.toISOString(),results:f.erpHandoffs[0].reconciliations.map(r=>({outcome:r.outcome,reasonCode:r.reasonCode,resultHash:r.resultHash,occurredAt:r.occurredAt.toISOString(),recordedAt:r.recordedAt.toISOString()}))}:null}))};
 }
 private async resolve(orderNo:string,fulfillmentKey:string){
  const row=await this.db.fulfillment.findFirst({where:{fulfillmentKey,order:{orderNo:this.orderNumber(orderNo)}},include:{sourceAllocations:true}});
  if(!row)throw new ConflictException({code:'FULFILLMENT_NOT_FOUND'});
  return row;
 }
 async scan(orderNo:string,key:string,input:{sourceReference:string;sku:string;serialNo:string},context:Context){
  const fulfillment=await this.resolve(orderNo,key),source=fulfillment.sourceAllocations.find(s=>sourceReference(s.fulfillmentSourceAllocationId)===input.sourceReference);
  if(!source)throw new ConflictException({code:'FULFILLMENT_SOURCE_ALLOCATION_NOT_FOUND'});
  if(input.sku!==source.skuSnapshot)throw new ConflictException({code:'SERIAL_SKU_MISMATCH'});
  const result=await this.scanner.scan({fulfillmentSourceAllocationId:source.fulfillmentSourceAllocationId,serialNo:input.serialNo,...context});
  return {fulfillmentKey:key,sourceReference:input.sourceReference,serialNo:input.serialNo.trim().toUpperCase(),replayed:result.replayed};
 }
 async pack(orderNo:string,key:string,context:Context){
  const f=await this.resolve(orderNo,key),result=await this.packer.verify({fulfillmentId:f.fulfillmentId,...context});
  return {fulfillmentKey:key,status:'PACK_VERIFIED',snapshotHash:result.evidence.policySnapshotRef,replayed:result.replayed};
 }
 async handoff(orderNo:string,key:string,context:Context){
  const f=await this.resolve(orderNo,key),result=await this.erp.request({fulfillmentId:f.fulfillmentId,...context});
  return {fulfillmentKey:key,providerCode:result.handoff.providerCode,payloadHash:result.handoff.payloadHash,requestedAt:result.handoff.requestedAt.toISOString(),replayed:result.replayed};
 }
 async reconcile(orderNo:string,key:string,input:ErpPhysicalResult,context:Context){const f=await this.resolve(orderNo,key);return this.reconciler.record(f.fulfillmentId,input,context);}
 async retryHandoff(orderNo:string,key:string,context:Context){
  const f=await this.resolve(orderNo,key),handoff=await this.db.fulfillmentErpHandoff.findUnique({where:{fulfillmentId:f.fulfillmentId}});
  if(!handoff)throw new ConflictException({code:'ERP_HANDOFF_REQUIRED'});
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT outbox_event_id FROM integration.outbox_event WHERE outbox_event_id=${handoff.outboxEventId}::uuid FOR UPDATE`;
   const event=await tx.outboxEvent.findUniqueOrThrow({where:{outboxEventId:handoff.outboxEventId}});
   if(event.processStatus!=='DEAD')return {fulfillmentKey:key,replayed:true};
   await tx.outboxEvent.update({where:{outboxEventId:event.outboxEventId},data:{processStatus:'PENDING',availableAt:new Date(),lastError:null}});
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'FULFILLMENT_ERP_RETRY_REQUESTED',entityType:'FULFILLMENT',entityId:f.fulfillmentId,afterData:{fulfillmentKey:key,priorAttemptCount:event.attemptCount},requestId:context.requestId,correlationId:context.correlationId});
   return {fulfillmentKey:key,replayed:false};
  });
 }
}
