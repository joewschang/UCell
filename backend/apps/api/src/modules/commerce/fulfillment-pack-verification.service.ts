import {ConflictException,Injectable} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {createHash} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';

export const SERIAL_PACK_POLICY='UCELL_SERIAL_PACK_V1';
type PackCommand={fulfillmentId:string;actorId:string;requestId:string;correlationId:string};

/** Reuses immutable QC evidence rather than creating a parallel packing ledger.
 * Caller holds the fulfillment row lock, shared by allocation/scan/handoff. */
export async function verifySerialPack(tx:Prisma.TransactionClient,audit:AuditService,input:PackCommand){
 await tx.$queryRaw`SELECT u.serialized_unit_id FROM commerce.fulfillment_serial_allocation a JOIN commerce.serialized_unit u ON u.serialized_unit_id=a.serialized_unit_id JOIN commerce.product_serial_batch b ON b.product_serial_batch_id=u.product_serial_batch_id WHERE a.fulfillment_id=${input.fulfillmentId}::uuid ORDER BY u.serialized_unit_id FOR SHARE OF u,b`;
 const fulfillment=await tx.fulfillment.findUnique({where:{fulfillmentId:input.fulfillmentId},include:{sourceAllocations:{include:{orderLine:true,serialAllocations:{include:{serializedUnit:{include:{batch:true}}}}},orderBy:{fulfillmentSourceAllocationId:'asc'}}}});
 if(!fulfillment) throw new ConflictException({code:'FULFILLMENT_NOT_FOUND'});
 if(['SHIPPING_REQUESTED','SHIPPED','DELIVERED','CANCELLED','EXCEPTION'].includes(fulfillment.status)) throw new ConflictException({code:'FULFILLMENT_NOT_PACKABLE'});
 if(!fulfillment.sourceAllocations.length) throw new ConflictException({code:'FULFILLMENT_SOURCE_ALLOCATION_REQUIRED'});
 for(const source of fulfillment.sourceAllocations){
  if(source.orderLine.orderId!==fulfillment.orderId||source.skuSnapshot!==source.orderLine.skuSnapshot) throw new ConflictException({code:'FULFILLMENT_ALLOCATION_SOURCE_MISMATCH'});
  if(!source.allocatedQuantity.isInteger()||source.allocatedQuantity.lte(0)||source.serialAllocations.length!==source.allocatedQuantity.toNumber()) throw new ConflictException({code:'FULFILLMENT_SERIAL_SCAN_INCOMPLETE'});
  for(const allocation of source.serialAllocations){
   const unit=allocation.serializedUnit;
   if(allocation.fulfillmentId!==fulfillment.fulfillmentId||unit.batch.productId!==source.orderLine.productId) throw new ConflictException({code:'SERIAL_SKU_MISMATCH'});
   if(unit.status!=='ALLOCATED'||unit.batch.status!=='EFFECTIVE'||(unit.batch.expiresAt&&unit.batch.expiresAt.getTime()<=Date.now())) throw new ConflictException({code:'SERIAL_PACK_UNIT_INELIGIBLE'});
  }
 }
 const snapshot={schemaVersion:1,fulfillmentKey:fulfillment.fulfillmentKey,lines:fulfillment.sourceAllocations.map(source=>({sku:source.skuSnapshot,quantity:source.allocatedQuantity.toString(),serialNos:source.serialAllocations.map(row=>row.serializedUnit.serialNo).sort()}))};
 const snapshotHash=createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
 const existing=await tx.fulfillmentQcEvidence.findFirst({where:{fulfillmentId:input.fulfillmentId,policyId:SERIAL_PACK_POLICY},orderBy:{occurredAt:'asc'}});
 if(existing){
  if(existing.policySnapshotRef!==snapshotHash||existing.result!=='PASS') throw new ConflictException({code:'FULFILLMENT_PACK_SNAPSHOT_CONFLICT'});
  return {evidence:existing,replayed:true};
 }
 const evidence=await tx.fulfillmentQcEvidence.create({data:{fulfillmentId:input.fulfillmentId,policyId:SERIAL_PACK_POLICY,policyVersion:'1',policySnapshotRef:snapshotHash,result:'PASS',checks:snapshot,inspectorActor:input.actorId,reason:'EXACT_SERIAL_QUANTITY_VERIFIED',occurredAt:new Date(),correlationId:input.correlationId}});
 await tx.fulfillment.update({where:{fulfillmentId:input.fulfillmentId},data:{status:'PACKED'}});
 await audit.write(tx,{actorType:'USER',actorId:input.actorId,action:'FULFILLMENT_PACK_VERIFIED',entityType:'FULFILLMENT',entityId:input.fulfillmentId,afterData:{fulfillmentKey:fulfillment.fulfillmentKey,snapshotHash},requestId:input.requestId,correlationId:input.correlationId});
 return {evidence,replayed:false};
}

@Injectable()
export class FulfillmentPackVerificationService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService){}
 verify(input:PackCommand){return this.db.$transaction(async tx=>{
  await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${input.fulfillmentId}::uuid FOR UPDATE`;
  return verifySerialPack(tx,this.audit,input);
 },{isolationLevel:Prisma.TransactionIsolationLevel.ReadCommitted});}
}
