import {ConflictException,Injectable,UnprocessableEntityException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {createHash} from 'node:crypto';
import {FulfillmentSerialScanService} from './fulfillment-serial-scan.service';
import {FulfillmentPackVerificationService,SERIAL_PACK_POLICY} from './fulfillment-pack-verification.service';
import {FulfillmentErpHandoffService} from './fulfillment-erp-handoff.service';

const sourceReference=(id:string)=>createHash('sha256').update(`FULFILLMENT_SOURCE:${id}`).digest('hex');
type Context={actorId:string;requestId:string;correlationId:string};
@Injectable()
export class FulfillmentOperationsService{
 constructor(private readonly db:PrismaService,private readonly scanner:FulfillmentSerialScanService,private readonly packer:FulfillmentPackVerificationService,private readonly erp:FulfillmentErpHandoffService){}
 private orderNumber(value:string){if(!/^\d{1,19}$/.test(value)||BigInt(value)>9223372036854775807n)throw new UnprocessableEntityException({code:'INVALID_ORDER_NO'});return BigInt(value);}
 async order(orderNo:string){
  const order=await this.db.order.findUnique({where:{orderNo:this.orderNumber(orderNo)},include:{fulfillments:{orderBy:{createdAt:'asc'},include:{sourceAllocations:{orderBy:{fulfillmentSourceAllocationId:'asc'},include:{serialAllocations:{include:{serializedUnit:true}}}},qcEvidence:{where:{policyId:SERIAL_PACK_POLICY},orderBy:{occurredAt:'asc'}},erpHandoffs:true}}}});
  if(!order)throw new ConflictException({code:'ORDER_NOT_FOUND'});
  return {orderNo:order.orderNo.toString(),status:order.status,fulfillments:order.fulfillments.map(f=>({fulfillmentKey:f.fulfillmentKey,status:f.status,sources:f.sourceAllocations.map(s=>({sourceReference:sourceReference(s.fulfillmentSourceAllocationId),sku:s.skuSnapshot,quantity:s.allocatedQuantity.toString(),serialNos:s.serialAllocations.map(a=>a.serializedUnit.serialNo).sort()})),packVerification:f.qcEvidence[0]?{status:'PACK_VERIFIED',snapshotHash:f.qcEvidence[0].policySnapshotRef,occurredAt:f.qcEvidence[0].occurredAt.toISOString()}:null,erpHandoff:f.erpHandoffs[0]?{providerCode:f.erpHandoffs[0].providerCode,payloadHash:f.erpHandoffs[0].payloadHash,requestedAt:f.erpHandoffs[0].requestedAt.toISOString()}:null}))};
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
}
