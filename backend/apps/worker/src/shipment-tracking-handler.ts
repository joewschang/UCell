import {createHash} from 'node:crypto';
import {Prisma,PrismaService,decideTrackingProjection,type ShipmentStatus,type ProviderWebhookHandler,type ProviderWebhookWorkerLease} from '@ucell/database';

/** Implementations read the protected evidence object and verify its digest and
 * pinned verification/mapping configuration. Raw callbacks never enter this API. */
export interface VerifiedShipmentTrackingAdapter {
 readonly provider:'BLACK_CAT'|'SEVEN_ELEVEN'|'ECPAY_LOGISTICS'|'OTHER';
 readonly connectionId:string;
 readonly providerConnectionVersionId:string;
 readVerified(input:Readonly<{safeEvidenceRef:string;payloadHash:string;providerEventIdentity:string;providerConnectionVersionId:string;verificationConfigVersion:string}>):Promise<Readonly<{
  payloadHash:string;providerShipmentRef:string;eventIdentity:string;rawStatusCode:string;
  status:ShipmentStatus|null;mappingSnapshotRef:string|null;eventTime:string;
 }>>;
}
const hash=(value:string)=>createHash('sha256').update(value).digest('hex');
const states:readonly string[]=['READY','LABEL_CREATED','PICKED_UP','IN_TRANSIT','DELIVERED','DELIVERY_FAILED','RETURNING','RETURNED','CANCELLED'];
const token=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(value);

/** Runs only behind the existing verified Inbox worker and its exact registry.
 * An unexpired lease is rechecked after adapter IO and held through commit. */
export function createShipmentTrackingHandler(db:PrismaService,adapter:VerifiedShipmentTrackingAdapter):ProviderWebhookHandler{
 return {async process(lease){
  if(lease.domain!=='LOGISTICS'||lease.provider!==adapter.provider||lease.connectionId!==adapter.connectionId)return 'PERMANENT_FAILURE';
  const inbox=await db.providerWebhookInbox.findUnique({where:{providerWebhookInboxId:lease.providerWebhookInboxId},include:{providerConnectionVersion:{include:{connection:true}}}});
  if(!inbox||!matchesLease(inbox,lease)||!inbox.verifiedAt||!inbox.verificationEvidenceHash||!inbox.providerEventIdentity||!inbox.providerConnectionVersionId)return 'PERMANENT_FAILURE';
  const version=inbox.providerConnectionVersion;
  if(!version||version.providerConnectionVersionId!==adapter.providerConnectionVersionId||!version.approvalReference?.trim()||version.effectiveFrom>inbox.verifiedAt||version.effectiveTo&&version.effectiveTo<=inbox.verifiedAt||version.connection.domain!=='LOGISTICS'||version.connection.provider!==adapter.provider||version.connection.connectionKey!==adapter.connectionId)return 'PERMANENT_FAILURE';
  const fact=await bounded(adapter.readVerified({safeEvidenceRef:inbox.safeEvidenceRef,payloadHash:inbox.payloadHash,providerEventIdentity:inbox.providerEventIdentity,providerConnectionVersionId:version.providerConnectionVersionId,verificationConfigVersion:inbox.verificationConfigVersion}));
  if(fact.payloadHash!==inbox.payloadHash||fact.eventIdentity!==inbox.providerEventIdentity||!token(fact.providerShipmentRef)||!token(fact.eventIdentity)||!token(fact.rawStatusCode)||!Number.isFinite(Date.parse(fact.eventTime))||fact.status!==null&&(!states.includes(fact.status)||!token(fact.mappingSnapshotRef)))return 'PERMANENT_FAILURE';
  return db.$transaction(async tx=>{
   const owned=await tx.$queryRaw<Array<{provider_webhook_inbox_id:string}>>`SELECT provider_webhook_inbox_id FROM commerce.provider_webhook_inbox WHERE provider_webhook_inbox_id=${lease.providerWebhookInboxId}::uuid AND status='PROCESSING' AND lease_owner=${lease.leaseOwner} AND attempt_count=${lease.attemptCount} AND lease_expires_at>clock_timestamp() FOR UPDATE`;
   if(!owned.length)return 'UNKNOWN_FAILURE' as const;
   const locked=await tx.providerWebhookInbox.findUniqueOrThrow({where:{providerWebhookInboxId:lease.providerWebhookInboxId}});
   if(!matchesLease(locked,lease)||locked.providerConnectionVersionId!==version.providerConnectionVersionId||locked.verificationEvidenceHash!==inbox.verificationEvidenceHash||locked.verificationConfigVersion!==inbox.verificationConfigVersion)return 'PERMANENT_FAILURE' as const;
   const found=await tx.shipment.findFirst({where:{providerConnectionVersionId:version.providerConnectionVersionId,providerShipmentRef:fact.providerShipmentRef}});
   if(!found)return 'PERMANENT_FAILURE' as const;
   await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${found.fulfillmentId}::uuid FOR UPDATE`;
   await tx.$queryRaw`SELECT shipment_id FROM commerce.shipment WHERE shipment_id=${found.shipmentId}::uuid FOR UPDATE`;
   const shipment=await tx.shipment.findUniqueOrThrow({where:{shipmentId:found.shipmentId},include:{fulfillment:{include:{order:{select:{orderNo:true}},serialAllocations:true}},stateTransitions:{orderBy:{occurredAt:'desc'},take:1},serialBindings:{include:{allocation:true}}}});
   if(shipment.providerConnectionVersionId!==version.providerConnectionVersionId||shipment.providerShipmentRef!==fact.providerShipmentRef)return 'PERMANENT_FAILURE' as const;
   const source={sourceType:'SHIPMENT',sourceId:`${shipment.fulfillment.order.orderNo}:${shipment.fulfillment.fulfillmentKey}`,exceptionCode:'SHIPMENT_TRACKING_REQUIRES_RECONCILIATION'};
   const exception=async(reason:string)=>{await tx.operationalException.upsert({where:{sourceType_sourceId_exceptionCode:source},update:{},create:{...source,severity:'CRITICAL',summary:`物流追蹤需核對：${reason}`,evidenceHash:inbox.payloadHash}});};
   const data={shipmentId:shipment.shipmentId,providerConnectionVersionId:version.providerConnectionVersionId,providerEventIdentity:fact.eventIdentity,providerShipmentRef:fact.providerShipmentRef,rawStatusCode:fact.rawStatusCode,normalizedStatus:fact.status,mappingSnapshotRef:fact.status===null?null:fact.mappingSnapshotRef,payloadHash:inbox.payloadHash,safeEvidenceRef:inbox.safeEvidenceRef,eventTime:new Date(fact.eventTime),verifiedAt:inbox.verifiedAt!,correlationId:inbox.correlationId};
   const prior=await tx.shipmentTrackingEventEvidence.findUnique({where:{providerConnectionVersionId_providerEventIdentity:{providerConnectionVersionId:version.providerConnectionVersionId,providerEventIdentity:fact.eventIdentity}}});
   if(prior&&(prior.shipmentId!==data.shipmentId||prior.payloadHash!==data.payloadHash||prior.providerShipmentRef!==data.providerShipmentRef||prior.rawStatusCode!==data.rawStatusCode||prior.normalizedStatus!==data.normalizedStatus||prior.mappingSnapshotRef!==data.mappingSnapshotRef||prior.eventTime.getTime()!==data.eventTime.getTime())){await exception('EVENT_IDENTITY_CONFLICT');return 'PERMANENT_FAILURE' as const;}
   const evidence=prior??await tx.shipmentTrackingEventEvidence.create({data});
   if(fact.status===null){await exception('UNMAPPED_PROVIDER_STATUS');return 'PERMANENT_FAILURE' as const;}
   const businessEffectIdentity=`SHIPMENT_TRACKING:${version.providerConnectionVersionId}:${fact.eventIdentity}`;
   if(await tx.shipmentOperationClaim.findUnique({where:{businessEffectIdentity}}))return 'SUCCESS' as const;
   let decision:ReturnType<typeof decideTrackingProjection>;
   try{decision=decideTrackingProjection({expected:{shipmentId:shipment.shipmentId,provider:adapter.provider,providerShipmentRef:fact.providerShipmentRef,currentStatus:shipment.status,currentEventTime:(shipment.stateTransitions[0]?.occurredAt??new Date(0)).toISOString()},callbackProvider:adapter.provider,fact:{...fact,status:fact.status,shipmentId:shipment.shipmentId}});}
   catch{await exception('INVALID_STATE_TRANSITION');return 'PERMANENT_FAILURE' as const;}
   const operationHash=hash(JSON.stringify({shipmentId:shipment.shipmentId,eventIdentity:fact.eventIdentity,payloadHash:fact.payloadHash,status:fact.status,eventTime:data.eventTime.toISOString(),mapping:fact.mappingSnapshotRef}));
   if(decision.action==='APPLY'){
    await tx.shipmentStateTransition.create({data:{shipmentId:shipment.shipmentId,shipmentTrackingEventEvidenceId:evidence.shipmentTrackingEventEvidenceId,fromStatus:shipment.status,toStatus:fact.status,businessEffectIdentity,operationHash,occurredAt:data.eventTime,correlationId:inbox.correlationId}});
    await tx.shipment.update({where:{shipmentId:shipment.shipmentId},data:{status:fact.status}});
    if(['PICKED_UP','IN_TRANSIT','DELIVERED'].includes(fact.status)){
     const ids=shipment.serialBindings.map(b=>b.allocation.serializedUnitId);
     const complete=ids.length>0&&shipment.fulfillment.serialAllocations.length===ids.length&&shipment.serialBindings.every(b=>b.allocation.fulfillmentId===shipment.fulfillmentId);
     if(!complete||['CANCELLED','EXCEPTION'].includes(shipment.fulfillment.status))await exception('SERIAL_ALLOCATION_REQUIRES_REVIEW');
     else{
      await tx.$queryRaw`SELECT u.serialized_unit_id FROM commerce.serialized_unit u JOIN commerce.product_serial_batch b ON b.product_serial_batch_id=u.product_serial_batch_id WHERE u.serialized_unit_id IN (${Prisma.join(ids.map(id=>Prisma.sql`${id}::uuid`))}) ORDER BY u.serialized_unit_id FOR UPDATE OF u FOR SHARE OF b`;
      const units=await tx.serializedUnit.findMany({where:{serializedUnitId:{in:ids}},include:{batch:true}});
      if(units.some(u=>!['ALLOCATED','SHIPPED','RETURNED'].includes(u.status)||u.status==='ALLOCATED'&&(u.batch.status!=='EFFECTIVE'||u.batch.expiresAt&&u.batch.expiresAt<=data.eventTime)))await exception('SERIAL_STATE_REQUIRES_REVIEW');
      else{
       await tx.serializedUnit.updateMany({where:{serializedUnitId:{in:ids},status:'ALLOCATED'},data:{status:'SHIPPED'}});
       await tx.fulfillment.update({where:{fulfillmentId:shipment.fulfillmentId},data:{status:fact.status==='DELIVERED'?'DELIVERED':'SHIPPED'}});
      }
     }
    }
   }
   const outbox=await tx.outboxEvent.create({data:{eventType:'SHIPMENT_TRACKING_OBSERVED',aggregateType:'FULFILLMENT',aggregateId:shipment.fulfillmentId,payload:{schemaVersion:1,orderNo:shipment.fulfillment.order.orderNo.toString(),fulfillmentKey:shipment.fulfillment.fulfillmentKey,shipmentReference:hash(`SHIPMENT:${shipment.shipmentId}`),status:fact.status,projectionAction:decision.action},correlationId:inbox.correlationId}});
   await tx.shipmentOperationClaim.create({data:{shipmentId:shipment.shipmentId,operationType:'APPLY_TRACKING_EVENT',businessEffectIdentity,operationHash,committedEffectRef:evidence.shipmentTrackingEventEvidenceId,outboxEventId:outbox.outboxEventId}});
   return 'SUCCESS' as const;
  });
 }};
}
function matchesLease(row:{status:string;leaseOwner:string|null;attemptCount:number;domain:string;provider:string;connectionId:string;payloadHash:string;safeEvidenceRef:string;providerEventIdentity:string|null},lease:ProviderWebhookWorkerLease){return row.status==='PROCESSING'&&row.leaseOwner===lease.leaseOwner&&row.attemptCount===lease.attemptCount&&row.domain===lease.domain&&row.provider===lease.provider&&row.connectionId===lease.connectionId&&row.payloadHash===lease.payloadHash&&row.safeEvidenceRef===lease.safeEvidenceRef&&row.providerEventIdentity===lease.providerEventIdentity;}
async function bounded<T>(work:Promise<T>):Promise<T>{let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([work,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('SHIPMENT_TRACKING_ADAPTER_TIMEOUT')),20_000);})]);}finally{if(timer)clearTimeout(timer);}}
