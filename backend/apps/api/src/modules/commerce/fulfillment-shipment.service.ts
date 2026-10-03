import {ConflictException,Injectable} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {createHash} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {verifySerialPack} from './fulfillment-pack-verification.service';
type Context={actorId:string;requestId:string;correlationId:string};
export type RegisterShipmentInput={connectionReference:string;providerShipmentReference:string;trackingNo:string;packageIntegrityConfirmed:boolean;labelVerified:boolean};
const ref=(kind:string,id:string)=>createHash('sha256').update(`${kind}:${id}`).digest('hex');
const token=/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
function environment(){const configured=process.env.UCELL_DEPLOYMENT_ENVIRONMENT;if(configured==='PRODUCTION')return 'PRODUCTION';if(configured==='UAT')return 'STAGE';if(configured==='LOCAL'||configured==='CONNECTED_DEV'||!configured&&process.env.NODE_ENV!=='production')return 'TEST';throw new ConflictException({code:'LOGISTICS_ENVIRONMENT_REQUIRED'});}

@Injectable()
export class FulfillmentShipmentService{
 constructor(private readonly db:PrismaService,private readonly audit:AuditService){}
 async connections(){
  const now=new Date(),rows=await this.db.providerConnectionVersion.findMany({where:{environment:environment(),approvalReference:{not:null},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}],connection:{domain:'LOGISTICS',status:'ACTIVE'}},include:{connection:true},orderBy:[{providerConnectionId:'asc'},{version:'desc'}],take:100});
  return rows.filter(r=>!!r.approvalReference?.trim()).map(r=>({connectionReference:ref('LOGISTICS_CONNECTION',r.providerConnectionVersionId),provider:r.connection.provider,connectionKey:r.connection.connectionKey,version:r.version,environment:r.environment}));
 }
 async register(fulfillmentId:string,input:RegisterShipmentInput,context:Context){
  if(typeof input.connectionReference!=='string'||!/^[a-f0-9]{64}$/.test(input.connectionReference)||typeof input.providerShipmentReference!=='string'||!token.test(input.providerShipmentReference)||typeof input.trackingNo!=='string'||!token.test(input.trackingNo)||input.packageIntegrityConfirmed!==true||input.labelVerified!==true)throw new ConflictException({code:'SHIPMENT_REGISTRATION_INVALID'});
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${fulfillmentId}::uuid FOR UPDATE`;
   const f=await tx.fulfillment.findUniqueOrThrow({where:{fulfillmentId},include:{order:{select:{orderNo:true}},shipments:true,deliverySnapshots:{orderBy:{version:'desc'},take:1},serialAllocations:{include:{shipmentBinding:true}},erpHandoffs:{include:{dispatch:true}}}});
   const replay=f.shipments.find(s=>s.providerShipmentRef===input.providerShipmentReference&&ref('LOGISTICS_CONNECTION',s.providerConnectionVersionId)===input.connectionReference);
   if(replay){if(replay.trackingNo!==input.trackingNo)throw new ConflictException({code:'SHIPMENT_REGISTRATION_CONFLICT'});return {shipmentReference:ref('SHIPMENT',replay.shipmentId),trackingNo:replay.trackingNo,serialCount:f.serialAllocations.length,replayed:true};}
   if(f.shipments.length||f.serialAllocations.some(a=>a.shipmentBinding))throw new ConflictException({code:'FULFILLMENT_SHIPMENT_ALREADY_EXISTS'});
   const delivery=f.deliverySnapshots[0];if(!delivery)throw new ConflictException({code:'DELIVERY_SNAPSHOT_REQUIRED'});
   if(f.erpHandoffs.some(h=>h.dispatch&&h.dispatch.deliverySnapshotId!==delivery.deliverySnapshotId))throw new ConflictException({code:'ERP_SHIPMENT_DELIVERY_MISMATCH'});
   const now=new Date(),versions=await tx.providerConnectionVersion.findMany({where:{environment:environment(),approvalReference:{not:null},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}],connection:{domain:'LOGISTICS',status:'ACTIVE'}},include:{connection:true}});
   const version=versions.find(v=>ref('LOGISTICS_CONNECTION',v.providerConnectionVersionId)===input.connectionReference&&!!v.approvalReference?.trim());
   if(!version)throw new ConflictException({code:'LOGISTICS_CONNECTION_NOT_APPROVED'});
   const pack=await verifySerialPack(tx,this.audit,{fulfillmentId,...context});
   const checks={schemaVersion:1,PACKAGE_INTEGRITY:true,LABEL:true,source:'EXPLICIT_WAREHOUSE_INSPECTION',serialPackSnapshotHash:pack.evidence.policySnapshotRef,providerShipmentReference:input.providerShipmentReference,trackingNo:input.trackingNo};
   const packageHash=createHash('sha256').update(JSON.stringify(checks)).digest('hex');
   await tx.fulfillmentQcEvidence.create({data:{fulfillmentId,policyId:'UCELL_PACKAGE_LABEL_V1',policyVersion:'1',policySnapshotRef:packageHash,result:'PASS',checks,inspectorActor:context.actorId,reason:'WAREHOUSE_CONFIRMED_PACKAGE_AND_EXISTING_LABEL',occurredAt:now,correlationId:context.correlationId}});
   const parcel=await tx.fulfillmentParcel.create({data:{fulfillmentId,parcelKey:`${f.fulfillmentKey}-01`,contentSnapshotRef:pack.evidence.policySnapshotRef,packageSnapshotRef:packageHash}});
   const shipment=await tx.shipment.create({data:{fulfillmentId,fulfillmentParcelId:parcel.fulfillmentParcelId,fulfillmentQcEvidenceId:pack.evidence.fulfillmentQcEvidenceId,provider:version.connection.provider,connectionId:version.connection.connectionKey,providerConnectionVersionId:version.providerConnectionVersionId,carrier:version.connection.provider,shippingMethod:delivery.shippingMethod,recipientSnapshotRef:`FULFILLMENT_DELIVERY:${delivery.snapshotHash}`,deliverySnapshotId:delivery.deliverySnapshotId,providerShipmentRef:input.providerShipmentReference,trackingNo:input.trackingNo,status:'LABEL_CREATED'}});
   for(const allocation of f.serialAllocations)await tx.shipmentSerialBinding.create({data:{shipmentId:shipment.shipmentId,fulfillmentSerialAllocationId:allocation.fulfillmentSerialAllocationId,boundByActor:context.actorId}});
   await this.audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'FULFILLMENT_SHIPMENT_REGISTERED',entityType:'FULFILLMENT',entityId:fulfillmentId,afterData:{fulfillmentKey:f.fulfillmentKey,serialCount:f.serialAllocations.length,packageHash,deliveryVersion:delivery.version},requestId:context.requestId,correlationId:context.correlationId});
   await tx.outboxEvent.create({data:{eventType:'FULFILLMENT_SHIPMENT_REGISTERED',aggregateType:'FULFILLMENT',aggregateId:fulfillmentId,payload:{schemaVersion:1,orderNo:f.order.orderNo.toString(),fulfillmentKey:f.fulfillmentKey},correlationId:context.correlationId}});
   return {shipmentReference:ref('SHIPMENT',shipment.shipmentId),trackingNo:shipment.trackingNo,serialCount:f.serialAllocations.length,replayed:false};
  }).catch(error=>{if(error?.code==='P2002')throw new ConflictException({code:'SHIPMENT_REFERENCE_ALREADY_USED'});throw error;});
 }
}
