import {PrismaService,OutboxLease,withOutboxLease,claimOutboxLease,releaseFailedOutboxLease,verifyErpBusinessProjection,verifyErpAccountingMapping,replayHash} from '@ucell/database';
import {loadProviderEnablementManifest,validateProviderEnablementManifest} from './provider-enablement';
import {providerDeploymentEnvironment} from './provider-runtime';

export type BusinessErpAcceptance={kind:'ACCEPTED';providerReference:string;requestHash:string};
export type BusinessErpLookup=BusinessErpAcceptance|{kind:'ABSENT'|'UNKNOWN'|'REJECTED'};
/** Approved adapters must support authoritative stable-key lookup before submit. */
export interface BusinessErpAdapter {
 readonly provider:'EZTOOL'|'DYNAMICS_365_BC';
 readonly providerConnectionVersionId:string;
 readonly environment:'TEST'|'STAGE'|'PRODUCTION';
 lookup(input:{idempotencyKey:string;requestHash:string;signal:AbortSignal}):Promise<BusinessErpLookup>;
 submit(input:{idempotencyKey:string;requestHash:string;request:Readonly<Record<string,unknown>>;signal:AbortSignal}):Promise<BusinessErpAcceptance|{kind:'UNKNOWN'|'REJECTED'}>;
}
async function bounded<T>(signal:AbortSignal,work:()=>Promise<T>):Promise<T>{
 signal.throwIfAborted();let listener=()=>{};
 try{return await Promise.race([Promise.resolve().then(work),new Promise<never>((_,reject)=>{listener=()=>reject(new Error('ERP_PROJECTION_TRANSPORT_TIMEOUT'));signal.addEventListener('abort',listener,{once:true});})]);}
 finally{signal.removeEventListener('abort',listener);}
}
export async function processErpBusinessProjection(db:PrismaService,lease:OutboxLease,adapter:BusinessErpAdapter){
 const prepared=await withOutboxLease(db,lease,async tx=>{
  await tx.$queryRaw`SELECT projection_id FROM commerce.erp_business_projection WHERE outbox_event_id=${lease.outboxEventId}::uuid FOR UPDATE`;
  const projection=await tx.erpBusinessProjection.findUnique({where:{outboxEventId:lease.outboxEventId},include:{dispatch:true,accountingMappings:{orderBy:{revision:'desc'},take:1}}});if(!projection)throw new Error('ERP_PROJECTION_NOT_FOUND');
  let request=verifyErpBusinessProjection(projection),requestHash=projection.payloadHash;
  const mapping=projection.accountingMappings[0];
  if(projection.stream==='COMPENSATION'){
   if(!mapping)throw new Error('ERP_ACCOUNT_MAPPING_REQUIRED');
   request=verifyErpAccountingMapping(projection,mapping);requestHash=mapping.requestHash;
   if(mapping.providerConnectionVersionId!==adapter.providerConnectionVersionId)throw new Error('ERP_MAPPING_CONNECTION_MISMATCH');
  }
  const version=await tx.providerConnectionVersion.findUnique({where:{providerConnectionVersionId:adapter.providerConnectionVersionId},include:{connection:true}}),now=new Date();
  if(!version||version.connection.domain!=='ERP'||version.connection.provider!==adapter.provider||version.connection.status!=='ACTIVE'||version.environment!==adapter.environment||!version.approvalReference||version.effectiveFrom>now||(version.effectiveTo&&version.effectiveTo<=now))throw new Error('ERP_CONNECTION_NOT_APPROVED');
  if(mapping&&request.providerConfigHash!==version.configHash)throw new Error('ERP_MAPPING_CONNECTION_MISMATCH');
  if(projection.dispatch&&(projection.dispatch.providerConnectionVersionId!==version.providerConnectionVersionId||projection.dispatch.requestHash!==requestHash))throw new Error('ERP_PROJECTION_DISPATCH_MISMATCH');
  const dispatch=projection.dispatch??await tx.erpProjectionDispatch.create({data:{projectionId:projection.projectionId,providerConnectionVersionId:version.providerConnectionVersionId,idempotencyKey:'ucell-erp-projection-'+replayHash(projection.projectionReference),requestHash}});
  return {dispatch,request,projectionReference:projection.projectionReference,providerConnectionId:version.providerConnectionId};
 });
 if('lostLease' in prepared)return prepared;
 const input={idempotencyKey:prepared.dispatch.idempotencyKey,requestHash:prepared.dispatch.requestHash};let result:BusinessErpLookup={kind:'UNKNOWN'};
 try{
  const signal=AbortSignal.timeout(20000);result=await bounded(signal,()=>adapter.lookup({...input,signal}));
  if(result.kind==='ABSENT'){
   const sent=await withOutboxLease(db,lease,()=>bounded(signal,()=>adapter.submit({...input,request:prepared.request,signal})));
   if('lostLease' in sent)return sent;result=sent;
  }
 }catch{result={kind:'UNKNOWN'};}
 if(result.kind==='ACCEPTED'&&(!/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/.test(result.providerReference)||result.requestHash!==input.requestHash))result={kind:'REJECTED'};
 if(!['ACCEPTED','UNKNOWN','REJECTED'].includes(result.kind))result={kind:'UNKNOWN'};
 const outcome=result.kind as 'ACCEPTED'|'UNKNOWN'|'REJECTED',providerReference=result.kind==='ACCEPTED'?result.providerReference:null;
 return withOutboxLease(db,lease,async tx=>{
  let recordedOutcome=outcome,recordedReference=providerReference,referenceConflict=false;
  if(outcome==='ACCEPTED'){
   const claims=await tx.erpProjectionExternalReference.findMany({where:{OR:[{projectionId:prepared.dispatch.projectionId},{providerConnectionId:prepared.providerConnectionId,providerReference:providerReference!}]}});
   referenceConflict=claims.some(row=>row.projectionId!==prepared.dispatch.projectionId||row.providerConnectionId!==prepared.providerConnectionId||row.providerReference!==providerReference);
   if(referenceConflict){recordedOutcome='REJECTED';recordedReference=null;}
   else if(!claims.length)await tx.erpProjectionExternalReference.create({data:{projectionId:prepared.dispatch.projectionId,providerConnectionId:prepared.providerConnectionId,providerReference:providerReference!}});
  }
  await tx.erpProjectionDispatchAttempt.create({data:{dispatchId:prepared.dispatch.dispatchId,attemptNumber:lease.attemptCount,outcome:recordedOutcome,providerReference:recordedReference,evidenceHash:replayHash({...input,outcome:recordedOutcome,providerReference:recordedReference})}});
  const dead=recordedOutcome==='REJECTED'||lease.attemptCount>=10;
  await tx.outboxEvent.update({where:{outboxEventId:lease.outboxEventId},data:recordedOutcome==='ACCEPTED'?{processStatus:'PROCESSED',processedAt:new Date(),lastError:null}:{processStatus:dead?'DEAD':'PENDING',lastError:referenceConflict?'ERP_PROJECTION_EXTERNAL_REFERENCE_CONFLICT':recordedOutcome==='REJECTED'?'ERP_PROJECTION_ACCEPTANCE_REJECTED':'ERP_PROJECTION_ACCEPTANCE_UNKNOWN',availableAt:new Date(Date.now()+30000)}});
  if(recordedOutcome!=='ACCEPTED'&&dead){const source={sourceType:'ERP_BUSINESS_PROJECTION',sourceId:prepared.projectionReference,exceptionCode:referenceConflict?'ERP_PROJECTION_EXTERNAL_REFERENCE_CONFLICT':'ERP_PROJECTION_REQUIRES_RECONCILIATION'};await tx.operationalException.upsert({where:{sourceType_sourceId_exceptionCode:source},update:{},create:{...source,severity:'CRITICAL',summary:'ERP 投影受理尚未確認，請核對外部證據。',evidenceHash:prepared.dispatch.requestHash}});}
  return {outcome:recordedOutcome};
 });
}

export async function pollErpBusinessProjections(db:PrismaService,adapters:readonly BusinessErpAdapter[],environment:NodeJS.ProcessEnv=process.env){
 if(!adapters.length)return {configured:false,claimed:0};
 if(adapters.length!==1)throw new Error('ERP_ADAPTER_ROUTING_AMBIGUOUS');
 const adapter=adapters[0],version=await db.providerConnectionVersion.findUnique({where:{providerConnectionVersionId:adapter.providerConnectionVersionId},include:{connection:true}});
 if(!version)throw new Error('ERP_CONNECTION_NOT_APPROVED');
 const manifest=loadProviderEnablementManifest(environment);validateProviderEnablementManifest(manifest,providerDeploymentEnvironment(environment),new Date());
 const entry=manifest.entries.find(row=>row.domain==='ERP'&&row.provider===adapter.provider&&row.connectionId===version.connection.connectionKey&&row.providerConnectionVersionId===version.providerConnectionVersionId);
 if(!entry||entry.connectionEnvironment!==adapter.environment||entry.configHash!==version.configHash||entry.credentialSecretRef!==version.credentialSecretRef||entry.webhookVerificationRef!==version.webhookVerificationRef||entry.approvalReference!==version.approvalReference)throw new Error('ERP_ENABLEMENT_VERSION_MISMATCH');
 const events=await erpBusinessProjectionCandidates(db,adapter.providerConnectionVersionId);
 let claimed=0;for(const event of events){const lease=await claimOutboxLease(db,event);if(!lease)continue;claimed++;
  try{await processErpBusinessProjection(db,lease,adapter);}catch{await releaseFailedOutboxLease(db,lease,new Error('ERP_PROJECTION_PROCESSING_FAILED'));}
 }
 return {configured:true,claimed};
}

/** Bounded routing uses the latest mapping, never an older matching attachment. */
export async function erpBusinessProjectionCandidates(db:PrismaService,providerConnectionVersionId:string){
 const candidates=await db.$queryRaw<{outbox_event_id:string}[]>`
  SELECT o.outbox_event_id FROM integration.outbox_event o
  JOIN commerce.erp_business_projection p ON p.outbox_event_id=o.outbox_event_id
  LEFT JOIN commerce.erp_projection_dispatch d ON d.projection_id=p.projection_id
  WHERE o.event_type='ERP_BUSINESS_PROJECTION_REQUESTED' AND o.process_status::text IN ('PENDING','PROCESSING') AND o.available_at<=now()
  AND (d.dispatch_id IS NULL OR d.provider_connection_version_id=${providerConnectionVersionId}::uuid)
  AND (p.stream IN ('SALES','RETURN') OR (p.stream='COMPENSATION' AND
   (SELECT m.provider_connection_version_id FROM commerce.erp_accounting_mapping m WHERE m.projection_id=p.projection_id ORDER BY m.revision DESC LIMIT 1)=${providerConnectionVersionId}::uuid))
  ORDER BY o.created_at,o.outbox_event_id LIMIT 20`;
 return db.outboxEvent.findMany({where:{outboxEventId:{in:candidates.map(row=>row.outbox_event_id)}},orderBy:[{createdAt:'asc'},{outboxEventId:'asc'}]});
}
