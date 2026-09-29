import {createHash} from 'node:crypto';
import {Prisma,PrismaService,PiiCryptoService,claimOutboxLease,withOutboxLease,releaseFailedOutboxLease,type OutboxLease} from '@ucell/database';
import {loadProviderEnablementManifest,validateProviderEnablementManifest} from './provider-enablement';
import {providerDeploymentEnvironment} from './provider-runtime';

export type PhysicalErpRequest=Readonly<{
 format:'UCELL_FULFILLMENT_ERP_V1';schemaVersion:1;orderNo:string;fulfillmentKey:string;
 lines:ReadonlyArray<Readonly<{sku:string;quantity:string;serialNos:readonly string[]}>>;
 deliveryRequirementsRef:string;
}>;
export type ErpDeliveryRequirements=Readonly<{schemaVersion:1;shippingMethod:'HOME_DELIVERY';recipientName:string;phone:string;countryCode:string;postalCode?:string;address:string}>;
export type ErpAcceptance=Readonly<{kind:'ACCEPTED';providerReference:string;requestHash:string}>;
export type ErpLookup=ErpAcceptance|Readonly<{kind:'ABSENT'|'UNKNOWN'|'REJECTED'}>;
/** A real adapter must prove stable-key deduplication and authoritative lookup
 * during provider enablement. No HTTP protocol or credentials are invented here. */
export interface PhysicalErpAdapter {
 readonly provider:'EZTOOL'|'DYNAMICS_365_BC';
 readonly providerConnectionVersionId:string;
 readonly environment:'TEST'|'STAGE'|'PRODUCTION';
 lookup(input:{idempotencyKey:string;requestHash:string;signal:AbortSignal}):Promise<ErpLookup>;
 submit(input:{idempotencyKey:string;requestHash:string;request:PhysicalErpRequest;delivery:ErpDeliveryRequirements;signal:AbortSignal}):Promise<ErpAcceptance|{kind:'UNKNOWN'|'REJECTED'}>;
}
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function bounded<T>(signal:AbortSignal,work:()=>Promise<T>):Promise<T>{
 signal.throwIfAborted();
 let listener:()=>void=()=>{};
 try{return await Promise.race([Promise.resolve().then(work),new Promise<never>((_,reject)=>{listener=()=>reject(new Error('ERP_TRANSPORT_TIMEOUT'));signal.addEventListener('abort',listener,{once:true});})]);}
 finally{signal.removeEventListener('abort',listener);}
}
function physicalRequest(raw:any):Omit<PhysicalErpRequest,'deliveryRequirementsRef'>{
 if(raw?.format!=='UCELL_FULFILLMENT_ERP_V1'||raw.schemaVersion!==1||!/^\d+$/.test(raw.orderNo)||typeof raw.fulfillmentKey!=='string'||!Array.isArray(raw.lines)||!raw.lines.length)throw new Error('ERP_HANDOFF_SNAPSHOT_INVALID');
 const seen=new Set<string>();
 const lines=raw.lines.map((line:any)=>{
  if(typeof line.sku!=='string'||!line.sku||typeof line.quantity!=='string'||!/^\d+$/.test(line.quantity)||!Number.isSafeInteger(Number(line.quantity))||Number(line.quantity)<1||!Array.isArray(line.serialNos)||line.serialNos.length!==Number(line.quantity))throw new Error('ERP_HANDOFF_SNAPSHOT_INVALID');
  const serialNos=line.serialNos.map((serial:unknown)=>{if(typeof serial!=='string'||!/^[A-E][0-9]{7}$/.test(serial)||seen.has(serial))throw new Error('ERP_HANDOFF_SNAPSHOT_INVALID');seen.add(serial);return serial;});
  return {sku:line.sku,quantity:line.quantity,serialNos};
 });
 // Explicit allowlist prevents commercial purpose/qualification/private fields
 // from leaking to execution adapters even if future snapshots gain fields.
 return {schemaVersion:1,format:'UCELL_FULFILLMENT_ERP_V1',orderNo:raw.orderNo,fulfillmentKey:raw.fulfillmentKey,lines};
}

export async function processErpHandoff(db:PrismaService,lease:OutboxLease,adapter:PhysicalErpAdapter){
 const prepared=await withOutboxLease(db,lease,async tx=>{
  const handoff=await tx.fulfillmentErpHandoff.findUnique({where:{outboxEventId:lease.outboxEventId},include:{dispatch:{include:{deliverySnapshot:true}}}});
  if(!handoff)throw new Error('ERP_HANDOFF_NOT_FOUND');
  await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${handoff.fulfillmentId}::uuid FOR UPDATE`;
  const version=await tx.providerConnectionVersion.findUnique({where:{providerConnectionVersionId:adapter.providerConnectionVersionId},include:{connection:true}}),now=new Date();
  if(!version||version.connection.domain!=='ERP'||version.connection.provider!==adapter.provider||version.connection.status!=='ACTIVE'||version.environment!==adapter.environment||!version.approvalReference||version.effectiveFrom>now||(version.effectiveTo&&version.effectiveTo<=now))throw new Error('ERP_CONNECTION_NOT_APPROVED');
  if(handoff.dispatch&&handoff.dispatch.providerConnectionVersionId!==version.providerConnectionVersionId)throw new Error('ERP_DISPATCH_CONNECTION_MISMATCH');
  if(handoff.dispatch&&(!handoff.dispatch.deliverySnapshot||!handoff.dispatch.requestHash))throw new Error('ERP_HISTORICAL_DELIVERY_EVIDENCE_MISSING');
  const deliverySnapshot=handoff.dispatch?.deliverySnapshot??await tx.fulfillmentDeliverySnapshot.findFirst({where:{fulfillmentId:handoff.fulfillmentId},orderBy:{version:'desc'}});
  if(!deliverySnapshot)throw new Error('ERP_DELIVERY_REQUIREMENTS_MISSING');
  if(createHash('sha256').update(deliverySnapshot.encryptedPayload).digest('hex')!==deliverySnapshot.snapshotHash)throw new Error('ERP_DELIVERY_SNAPSHOT_INVALID');
  const request={...physicalRequest(handoff.payloadSnapshot),deliveryRequirementsRef:deliverySnapshot.snapshotHash},requestHash=hash(request);
  if(handoff.dispatch&&handoff.dispatch.requestHash!==requestHash)throw new Error('ERP_DISPATCH_SNAPSHOT_MISMATCH');
  const dispatch=handoff.dispatch??await tx.fulfillmentErpDispatch.create({data:{fulfillmentErpHandoffId:handoff.fulfillmentErpHandoffId,providerConnectionVersionId:version.providerConnectionVersionId,idempotencyKey:'ucell-erp-'+hash(handoff.fulfillmentErpHandoffId),deliverySnapshotId:deliverySnapshot.deliverySnapshotId,requestHash}});
  return {dispatch,request,requestHash,deliverySnapshot,fulfillmentId:handoff.fulfillmentId};
 });
 if('lostLease' in prepared)return prepared;
 const input={idempotencyKey:prepared.dispatch.idempotencyKey,requestHash:prepared.requestHash};
 let result:ErpLookup={kind:'UNKNOWN'};
 try{
  const signal=AbortSignal.timeout(20000);
  result=await bounded(signal,()=>adapter.lookup({...input,signal}));
  // Unknown/timed-out lookups never trigger a blind send. The same stable key
  // remains pinned across restarts, claims and provider configuration changes.
  if(result.kind==='ABSENT'){
   const submitted=await withOutboxLease(db,lease,async tx=>{
    await tx.$queryRaw`SELECT fulfillment_id FROM commerce.fulfillment WHERE fulfillment_id=${prepared.fulfillmentId}::uuid FOR UPDATE`;
    await tx.$queryRaw`SELECT u.serialized_unit_id FROM commerce.fulfillment_serial_allocation a JOIN commerce.serialized_unit u ON u.serialized_unit_id=a.serialized_unit_id JOIN commerce.product_serial_batch b ON b.product_serial_batch_id=u.product_serial_batch_id WHERE a.fulfillment_id=${prepared.fulfillmentId}::uuid ORDER BY u.serialized_unit_id FOR SHARE OF u,b`;
    const f=await tx.fulfillment.findUnique({where:{fulfillmentId:prepared.fulfillmentId}});
    const allocations=await tx.fulfillmentSerialAllocation.findMany({where:{fulfillmentId:prepared.fulfillmentId},include:{sourceAllocation:{include:{orderLine:true}},serializedUnit:{include:{batch:true}}}});
    const expected=new Map(prepared.request.lines.flatMap(line=>line.serialNos.map(serial=>[serial,line.sku] as const)));
    if(!f||f.status!=='PACKED'||allocations.length!==expected.size||allocations.some(a=>{
     const u=a.serializedUnit,s=a.sourceAllocation;
     return u.status!=='ALLOCATED'||u.batch.status!=='EFFECTIVE'||u.batch.expiresAt&&u.batch.expiresAt<=new Date()||expected.get(u.serialNo)!==s.skuSnapshot||s.fulfillmentId!==f.fulfillmentId||s.orderLine.orderId!==f.orderId||u.batch.productId!==s.orderLine.productId;
    }))return {kind:'REJECTED' as const};
    const raw=new PiiCryptoService().decrypt<ErpDeliveryRequirements>(prepared.deliverySnapshot.encryptedPayload,prepared.deliverySnapshot.keyVersion);
    if(raw.schemaVersion!==1||raw.shippingMethod!=='HOME_DELIVERY'||typeof raw.recipientName!=='string'||typeof raw.phone!=='string'||typeof raw.countryCode!=='string'||typeof raw.address!=='string')throw new Error('ERP_DELIVERY_SNAPSHOT_INVALID');
    const delivery:ErpDeliveryRequirements={schemaVersion:1,shippingMethod:'HOME_DELIVERY',recipientName:raw.recipientName,phone:raw.phone,countryCode:raw.countryCode,postalCode:raw.postalCode,address:raw.address};
    // PII exists only during this approved adapter call, never in Outbox/audit.
    return bounded(signal,()=>adapter.submit({...input,request:prepared.request,delivery,signal}));
   });
   if('lostLease' in submitted)return submitted;
   result=submitted;
  }
 }catch{result={kind:'UNKNOWN'};}
 if(result.kind==='ACCEPTED'&&(!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(result.providerReference)||result.requestHash!==prepared.requestHash))result={kind:'REJECTED'};
 if(!['ACCEPTED','UNKNOWN','REJECTED'].includes(result.kind))result={kind:'UNKNOWN'};
 const outcome=result.kind as 'ACCEPTED'|'UNKNOWN'|'REJECTED';
 const providerReference=result.kind==='ACCEPTED'?result.providerReference:null;
 return withOutboxLease(db,lease,async tx=>{
  await tx.fulfillmentErpDispatchAttempt.create({data:{dispatchId:prepared.dispatch.dispatchId,attemptNumber:lease.attemptCount,outcome,providerReference,evidenceHash:hash({idempotencyKey:input.idempotencyKey,requestHash:input.requestHash,outcome,providerReference})}});
  const dead=outcome==='REJECTED'||lease.attemptCount>=10;
  await tx.outboxEvent.update({where:{outboxEventId:lease.outboxEventId},data:outcome==='ACCEPTED'?{processStatus:'PROCESSED',processedAt:new Date(),lastError:null}:{processStatus:dead?'DEAD':'PENDING',lastError:outcome==='REJECTED'?'ERP_ACCEPTANCE_REJECTED':'ERP_ACCEPTANCE_UNKNOWN',availableAt:new Date(Date.now()+30000)}});
  if(outcome!=='ACCEPTED'&&dead){
   const source={sourceType:'ERP_HANDOFF',sourceId:`${prepared.request.orderNo}:${prepared.request.fulfillmentKey}`,exceptionCode:'ERP_HANDOFF_REQUIRES_RECONCILIATION'};
   await tx.operationalException.upsert({where:{sourceType_sourceId_exceptionCode:source},update:{},create:{...source,severity:'CRITICAL',summary:'ERP 受理結果未確認，請核對交付證據後處理。',evidenceHash:prepared.requestHash}});
  }
  return {outcome};
 });
}

export async function pollErpHandoffs(db:PrismaService,adapters:readonly PhysicalErpAdapter[],environment:NodeJS.ProcessEnv=process.env){
 if(!adapters.length)return {configured:false,claimed:0};
 // Only one explicitly selected default is supported until routing is needed.
 if(adapters.length!==1)throw new Error('ERP_ADAPTER_ROUTING_AMBIGUOUS');
 const adapter=adapters[0];
 const version=await db.providerConnectionVersion.findUnique({where:{providerConnectionVersionId:adapter.providerConnectionVersionId},include:{connection:true}});
 if(!version)throw new Error('ERP_CONNECTION_NOT_APPROVED');
 const manifest=loadProviderEnablementManifest(environment);
 validateProviderEnablementManifest(manifest,providerDeploymentEnvironment(environment),new Date());
 const entry=manifest.entries.find(item=>item.domain==='ERP'&&item.provider===adapter.provider&&item.connectionId===version.connection.connectionKey&&item.providerConnectionVersionId===version.providerConnectionVersionId);
 if(!entry||entry.connectionEnvironment!==adapter.environment||entry.configHash!==version.configHash||entry.credentialSecretRef!==version.credentialSecretRef||entry.webhookVerificationRef!==version.webhookVerificationRef||entry.approvalReference!==version.approvalReference)throw new Error('ERP_ENABLEMENT_VERSION_MISMATCH');
 const events=await db.outboxEvent.findMany({where:{eventType:'FULFILLMENT_ERP_HANDOFF_REQUESTED',processStatus:{in:['PENDING','PROCESSING']},availableAt:{lte:new Date()}},orderBy:{createdAt:'asc'},take:20});
 let claimed=0;
 for(const event of events){
  const lease=await claimOutboxLease(db,event);if(!lease)continue;claimed++;
  try{await processErpHandoff(db,lease,adapter);}catch{
   // Adapter exceptions may contain response bodies/credentials: never persist
   // or log them. Structured result evidence is the only provider output stored.
   await releaseFailedOutboxLease(db,lease,new Error('ERP_HANDOFF_PROCESSING_FAILED'));
  }
 }
 return {configured:true,claimed};
}
