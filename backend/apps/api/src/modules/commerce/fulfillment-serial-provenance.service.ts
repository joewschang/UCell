import {ConflictException,Injectable} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {SERIAL_PACK_POLICY,verifySerialPack} from './fulfillment-pack-verification.service';
type Context={actorId:string;requestId:string;correlationId:string};
function hasDispatchEvidence(shipment:any,states=['PICKED_UP','IN_TRANSIT','DELIVERED']){return shipment.stateTransitions.some((t:any)=>states.includes(t.toStatus)&&t.trackingEvidence?.shipmentId===shipment.shipmentId&&t.trackingEvidence.providerConnectionVersionId===shipment.providerConnectionVersionId&&t.trackingEvidence.providerShipmentRef===shipment.providerShipmentRef&&t.trackingEvidence.normalizedStatus===t.toStatus);}

@Injectable()
export class FulfillmentSerialProvenanceService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService){}
 async bindShipment(fulfillmentId:string,shipmentId:string,context:Context){
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${fulfillmentId}::uuid FOR UPDATE`;
   const fulfillment=await tx.fulfillment.findUniqueOrThrow({where:{fulfillmentId}});
   if(['CANCELLED','EXCEPTION'].includes(fulfillment.status))throw new ConflictException({code:'FULFILLMENT_SHIPMENT_STATE_CONFLICT'});
   await tx.$queryRaw`SELECT shipment_id FROM commerce.shipment WHERE shipment_id=${shipmentId}::uuid FOR UPDATE`;
   const shipment=await tx.shipment.findUnique({where:{shipmentId},include:{parcel:true,qcEvidence:true,serialBindings:true,stateTransitions:{include:{trackingEvidence:true}}}});
   if(!shipment||shipment.fulfillmentId!==fulfillmentId||!shipment.providerShipmentRef||['CANCELLED','RETURNING','RETURNED'].includes(shipment.status))throw new ConflictException({code:'SHIPMENT_NOT_BINDABLE'});
   const allocations=await tx.fulfillmentSerialAllocation.findMany({where:{fulfillmentId},include:{shipmentBinding:true,serializedUnit:true}});
   if(!allocations.length)throw new ConflictException({code:'FULFILLMENT_SERIAL_SCAN_INCOMPLETE'});
   if(allocations.some(a=>a.shipmentBinding&&a.shipmentBinding.shipmentId!==shipmentId))throw new ConflictException({code:'SERIAL_ALREADY_BOUND_TO_SHIPMENT'});
   const replayed=allocations.every(a=>a.shipmentBinding?.shipmentId===shipmentId);
   if(!replayed){
    const packed=await verifySerialPack(tx,this.audit,{fulfillmentId,...context});
    if(shipment.qcEvidence.policyId!==SERIAL_PACK_POLICY||shipment.qcEvidence.result!=='PASS'||shipment.qcEvidence.policySnapshotRef!==packed.evidence.policySnapshotRef||shipment.parcel.contentSnapshotRef!==packed.evidence.policySnapshotRef)throw new ConflictException({code:'SHIPMENT_PACK_EVIDENCE_MISMATCH'});
    for(const allocation of allocations)if(!allocation.shipmentBinding)await tx.shipmentSerialBinding.create({data:{shipmentId,fulfillmentSerialAllocationId:allocation.fulfillmentSerialAllocationId,boundByActor:context.actorId}});
    await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'SHIPMENT_SERIALS_BOUND',entityType:'FULFILLMENT',entityId:fulfillmentId,afterData:{serialCount:allocations.length},requestId:context.requestId,correlationId:context.correlationId});
   }
   const shippedStates=['PICKED_UP','IN_TRANSIT','DELIVERED'];
   if(shippedStates.includes(shipment.status)){
    const proof=hasDispatchEvidence(shipment);
    if(!proof)throw new ConflictException({code:'SHIPMENT_DISPATCH_EVIDENCE_REQUIRED'});
    const unitIds=allocations.map(a=>a.serializedUnitId);
    await tx.$queryRaw`SELECT u.serialized_unit_id FROM commerce.serialized_unit u JOIN commerce.product_serial_batch b ON b.product_serial_batch_id=u.product_serial_batch_id WHERE u.serialized_unit_id IN (${Prisma.join(unitIds.map(id=>Prisma.sql`${id}::uuid`))}) ORDER BY u.serialized_unit_id FOR UPDATE OF u FOR SHARE OF b`;
    const units=await tx.serializedUnit.findMany({where:{serializedUnitId:{in:unitIds}},include:{batch:true}});
    if(units.some(u=>!['ALLOCATED','SHIPPED','RETURNED'].includes(u.status)||u.status==='ALLOCATED'&&(u.batch.status!=='EFFECTIVE'||u.batch.expiresAt&&u.batch.expiresAt<=new Date())))throw new ConflictException({code:'SERIAL_SHIPMENT_STATE_CONFLICT'});
    const changed=await tx.serializedUnit.updateMany({where:{serializedUnitId:{in:unitIds},status:'ALLOCATED'},data:{status:'SHIPPED'}});
    if(changed.count){
     await tx.fulfillment.update({where:{fulfillmentId},data:{status:'SHIPPED'}});
     await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'SHIPMENT_SERIAL_DISPATCH_CONFIRMED',entityType:'FULFILLMENT',entityId:fulfillmentId,afterData:{serialCount:changed.count},requestId:context.requestId,correlationId:context.correlationId});
    }
    if(shipment.status==='DELIVERED'&&hasDispatchEvidence(shipment,['DELIVERED'])&&fulfillment.status!=='DELIVERED'){
     await tx.fulfillment.update({where:{fulfillmentId},data:{status:'DELIVERED'}});
     await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'SHIPMENT_SERIAL_DELIVERY_CONFIRMED',entityType:'FULFILLMENT',entityId:fulfillmentId,afterData:{serialCount:allocations.length},requestId:context.requestId,correlationId:context.correlationId});
    }
   }
   return {serialCount:allocations.length,replayed};
  },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
 }

 async receiveReturn(fulfillmentId:string,returnCaseId:string,serialNos:string[],context:Context){
  if(!serialNos.length||serialNos.length>10000||new Set(serialNos).size!==serialNos.length)throw new ConflictException({code:'RETURN_SERIAL_INPUT_INVALID'});
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${fulfillmentId}::uuid FOR UPDATE`;
   const fulfillment=await tx.fulfillment.findUniqueOrThrow({where:{fulfillmentId}});
   const ret=await tx.returnCase.findUnique({where:{returnCaseId},include:{lines:true}});
   if(!ret||ret.orderId!==fulfillment.orderId||ret.status!=='POSTED')throw new ConflictException({code:'POSTED_RETURN_REQUIRED'});
   // Shared return-line locks serialize receipts from different fulfillments
   // against the same accepted quantity without touching economic authority.
   await tx.$queryRaw`SELECT return_line_id FROM commerce.return_line WHERE return_case_id=${returnCaseId}::uuid ORDER BY return_line_id FOR UPDATE`;
   const allocations=await tx.fulfillmentSerialAllocation.findMany({where:{fulfillmentId,serializedUnit:{serialNo:{in:serialNos}}},include:{sourceAllocation:true,shipmentBinding:{include:{returnReceipt:true,shipment:{include:{stateTransitions:{include:{trackingEvidence:true}}}}}},serializedUnit:true}});
   if(allocations.length!==serialNos.length)throw new ConflictException({code:'RETURN_SERIAL_SOURCE_MISMATCH'});
   const unitIds=allocations.map(a=>a.serializedUnitId);
   await tx.$queryRaw`SELECT serialized_unit_id FROM commerce.serialized_unit WHERE serialized_unit_id IN (${Prisma.join(unitIds.map(id=>Prisma.sql`${id}::uuid`))}) ORDER BY serialized_unit_id FOR UPDATE`;
   const units=await tx.serializedUnit.findMany({where:{serializedUnitId:{in:unitIds}}});
   let created=0;
   for(const allocation of allocations){
    const line=ret.lines.find(l=>l.orderLineId===allocation.sourceAllocation.orderLineId),binding=allocation.shipmentBinding;
    if(!line||!binding)throw new ConflictException({code:'RETURN_SERIAL_SOURCE_MISMATCH'});
    if(binding.returnReceipt){if(binding.returnReceipt.returnLineId!==line.returnLineId)throw new ConflictException({code:'SERIAL_ALREADY_RETURNED'});continue;}
    if(!hasDispatchEvidence(binding.shipment)||!['SHIPPED','RECALLED','QUARANTINED'].includes(units.find(u=>u.serializedUnitId===allocation.serializedUnitId)?.status??''))throw new ConflictException({code:'RETURN_SERIAL_NOT_SHIPPED'});
    const received=await tx.returnSerialReceipt.count({where:{returnLineId:line.returnLineId}});
    if(!line.quantity.isInteger()||new Prisma.Decimal(received+1).gt(line.quantity))throw new ConflictException({code:'RETURN_SERIAL_QUANTITY_EXCEEDED'});
    await tx.returnSerialReceipt.create({data:{returnLineId:line.returnLineId,shipmentSerialBindingId:binding.shipmentSerialBindingId,receivedByActor:context.actorId}});
    await tx.serializedUnit.update({where:{serializedUnitId:allocation.serializedUnitId},data:{status:'RETURNED'}});created++;
   }
   if(created)await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'RETURN_SERIALS_RECEIVED',entityType:'FULFILLMENT',entityId:fulfillmentId,afterData:{serialCount:created},requestId:context.requestId,correlationId:context.correlationId});
   return {serialCount:serialNos.length,replayed:created===0};
  },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});
 }
}
