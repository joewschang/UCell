import {Prisma} from '@prisma/client';
import {erpBusinessReference,erpProjectionReference,verifyErpBusinessProjection} from './erp-business-projection';
import {replayHash} from './historical-replay';

export type AccountingMappingConfiguration={connectionKey:string;connectionVersion:number;policyReference:string;policyVersion:number;previousMappingReference:string|null;entries:{groupReference:string;treatment:'MAP'|'REPORT_ONLY';mappingCode:string|null}[]};
const code=(value:unknown,min=1,max=100)=>typeof value==='string'&&value.length>=min&&value.length<=max&&/^[A-Za-z0-9][A-Za-z0-9._:/-]*$/.test(value);
function fail(value:string):never{throw new Error(value);}
const positive=(value:unknown)=>Number.isInteger(value)&&Number(value)>0&&Number(value)<=2147483647;
export const accountingMappingReference=(projectionReference:string,revision:number)=>erpBusinessReference('ERP-MAPPING',`${projectionReference}:${revision}`);

/** Full explicit coverage: no guessed account, amount allocation, debit/credit or tax rule. */
export async function previewErpAccountingMapping(tx:Prisma.TransactionClient,projectionReference:string,input:AccountingMappingConfiguration){
 if(!/^ERP-PROJECTION-[a-f0-9]{40}$/.test(projectionReference)||!code(input.connectionKey)||!positive(input.connectionVersion)||!code(input.policyReference,8)||!positive(input.policyVersion)||input.previousMappingReference!==null&&!/^ERP-MAPPING-[a-f0-9]{40}$/.test(input.previousMappingReference)||!Array.isArray(input.entries)||input.entries.length>1000)fail('ERP_MAPPING_CONFIGURATION_INVALID');
 const projection=await tx.erpBusinessProjection.findUnique({where:{projectionReference},include:{dispatch:true}});
 if(!projection||projection.stream!=='COMPENSATION')fail('ERP_MAPPING_COMPENSATION_REQUIRED');
 const payload=verifyErpBusinessProjection(projection);
 if(!['SUBLEDGER_ACCOUNTING_REVIEW','PAYOUT_ACCOUNTING_REVIEW'].includes(payload.projectionPurpose)||!Array.isArray(payload.aggregates)||!payload.aggregates.length||payload.aggregates.length>1000||!/^[A-Z]{3}$/.test(payload.currency)||!/^\d{4}-\d{2}-\d{2}$/.test(payload.configuration?.accountingDate??''))fail('ERP_MAPPING_SOURCE_INVALID');
 if(projection.dispatch)fail('ERP_MAPPING_DISPATCH_ALREADY_PINNED');
 const latest=await tx.erpBusinessProjection.findFirst({where:{stream:'COMPENSATION',sourceIdentity:projection.sourceIdentity},orderBy:{revision:'desc'}});if(latest?.projectionReference!==projectionReference)fail('ERP_MAPPING_LATEST_PROJECTION_REQUIRED');
 const previous=await tx.erpAccountingMapping.findFirst({where:{projectionId:projection.projectionId},orderBy:{revision:'desc'}});
 if((previous?.mappingReference??null)!==input.previousMappingReference)fail('ERP_MAPPING_PREVIOUS_REVISION_REQUIRED');
 if(previous)verifyErpAccountingMapping(projection,previous);
 const versions=await tx.providerConnectionVersion.findMany({where:{version:input.connectionVersion,connection:{domain:'ERP',connectionKey:input.connectionKey}},include:{connection:true},take:2}),version=versions.length===1?versions[0]:null,now=new Date();
 if(!version||version.connection.domain!=='ERP'||version.connection.status!=='ACTIVE'||!version.approvalReference?.trim()||version.effectiveFrom>now||version.effectiveTo&&version.effectiveTo<=now)fail('ERP_CONNECTION_NOT_APPROVED');
 const groups=new Map<string,any>();
 for(const group of payload.aggregates){
  if(!/^(COMPENSATION|PAYMENT)-GROUP-[a-f0-9]{40}$/.test(group.groupReference)||groups.has(group.groupReference)||!/^(0|[1-9][0-9]*)(\.[0-9]{1,4})?$/.test(group.amount)||!['MEMBER_PAYABLE_GROSS','RECOVERY_REQUIRED','RECOVERY_APPLIED','RECOVERY_OUTSTANDING','PAYOUT_RECOVERY_OFFSET','PAYOUT_NET','BANK_PAID'].includes(group.metric)||!code(group.economicCategory))fail('ERP_MAPPING_SOURCE_INVALID');
  groups.set(group.groupReference,group);
 }
 const seen=new Set<string>();
 const entries=input.entries.map(entry=>{
  if(!groups.has(entry.groupReference)||seen.has(entry.groupReference)||!['MAP','REPORT_ONLY'].includes(entry.treatment)||entry.treatment==='MAP'&&!code(entry.mappingCode)||entry.treatment==='REPORT_ONLY'&&entry.mappingCode!==null)fail('ERP_MAPPING_COVERAGE_INVALID');
  seen.add(entry.groupReference);return {groupReference:entry.groupReference,treatment:entry.treatment,mappingCode:entry.mappingCode};
 }).sort((a,b)=>a.groupReference.localeCompare(b.groupReference));
 if(seen.size!==groups.size)fail('ERP_MAPPING_COVERAGE_INVALID');
 const revision=(previous?.revision??0)+1,mappingReference=accountingMappingReference(projectionReference,revision);
 const configuration={connectionKey:input.connectionKey,connectionVersion:input.connectionVersion,policyReference:input.policyReference,policyVersion:input.policyVersion,entries};
 if(previous&&(previous.requestSnapshot as any).configurationHash===replayHash(configuration))fail('ERP_MAPPING_NO_CHANGE');
 const instant=(value:unknown)=>typeof value==='string'&&Number.isFinite(Date.parse(value))?new Date(value).toISOString():null;
 const scope={periodReference:/^COMPENSATION-PERIOD-[a-f0-9]{20}$/.test(payload.periodReference??'')?payload.periodReference:null,payoutReference:/^PAYOUT-[a-f0-9]{40}$/.test(payload.payoutReference??'')?payload.payoutReference:null,periodStart:instant(payload.configuration.periodStart),periodEnd:instant(payload.configuration.periodEnd),ruleVersionCode:code(payload.configuration.ruleVersionCode)?payload.configuration.ruleVersionCode:null,currencyBasisReference:code(payload.configuration.currencyBasisReference,8)?payload.configuration.currencyBasisReference:null,paymentScope:payload.projectionPurpose==='PAYOUT_ACCOUNTING_REVIEW'?'WHOLE_PAYOUT_BATCH_NO_AWARD_PERIOD_ALLOCATION':'NO_BANK_OR_NET_PAYMENT_ALLOCATION'};
 const request={format:'UCELL_APPROVED_ACCOUNTING_PROJECTION_V1',schemaVersion:1,mappingReference,mappingRevision:revision,previousMappingReference:input.previousMappingReference,projectionReference,projectionRevision:projection.revision,previousProjectionReference:payload.previousProjectionReference??null,sourcePayloadHash:projection.payloadHash,drillbackHash:projection.drillbackHash,projectionPurpose:payload.projectionPurpose,currency:payload.currency,accountingDate:payload.configuration.accountingDate,scope,configuration,configurationHash:replayHash(configuration),providerConfigHash:version.configHash,aggregates:entries.map(entry=>{const group=groups.get(entry.groupReference);return {...entry,metric:group.metric,economicCategory:group.economicCategory,payoutReference:group.payoutReference==='UNBATCHED'||/^PAYOUT-[a-f0-9]{40}$/.test(group.payoutReference??'')?group.payoutReference:null,amount:new Prisma.Decimal(group.amount).toFixed(4)};}),semantics:'APPROVED_SOURCE_MEASURES_NOT_A_JOURNAL'};
 const reviewHash=replayHash(request);
 return {projection,providerConnectionVersionId:version.providerConnectionVersionId,mappingReference,revision,request,reviewHash};
}

export function verifyErpAccountingMapping(projection:Parameters<typeof verifyErpBusinessProjection>[0],mapping:{mappingReference:string;revision:number;previousMappingReference:string|null;reviewHash:string;requestHash:string;requestSnapshot:unknown;approvalReference:string}){
 verifyErpBusinessProjection(projection);const request=mapping.requestSnapshot as any;
 if(!request||request.format!=='UCELL_APPROVED_ACCOUNTING_PROJECTION_V1'||request.schemaVersion!==1||request.projectionReference!==projection.projectionReference||request.sourcePayloadHash!==projection.payloadHash||request.drillbackHash!==projection.drillbackHash||request.mappingReference!==mapping.mappingReference||request.mappingRevision!==mapping.revision||request.previousMappingReference!==mapping.previousMappingReference||request.approvalReference!==mapping.approvalReference||replayHash(request)!==mapping.requestHash)fail('ERP_MAPPING_INTEGRITY_INVALID');
 const {approvalReference,...review}=request;if(replayHash(review)!==mapping.reviewHash)fail('ERP_MAPPING_INTEGRITY_INVALID');
 return request as Record<string,unknown>;
}

/** Caller supplies the transaction and writes the audit in that same transaction. */
export async function approveErpAccountingMapping(tx:Prisma.TransactionClient,projectionReference:string,input:AccountingMappingConfiguration&{reviewHash:string;approvalReference:string},actorId:string){
 if(!code(input.approvalReference,8)||!/^[a-f0-9]{64}$/.test(input.reviewHash))fail('ERP_MAPPING_APPROVAL_INVALID');
 const source=await tx.erpBusinessProjection.findUnique({where:{projectionReference}});if(!source||source.stream!=='COMPENSATION')fail('ERP_MAPPING_COMPENSATION_REQUIRED');
 const root=erpProjectionReference('COMPENSATION',source.sourceIdentity);await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${root},0))`;
 const rows=await tx.$queryRaw<{projection_id:string}[]>`SELECT projection_id FROM commerce.erp_business_projection WHERE projection_reference=${projectionReference} FOR UPDATE`;
 if(!rows.length)fail('ERP_MAPPING_COMPENSATION_REQUIRED');
 const previous=input.previousMappingReference?await tx.erpAccountingMapping.findUnique({where:{mappingReference:input.previousMappingReference}}):null;
 if(input.previousMappingReference&&(!previous||previous.projectionId!==rows[0].projection_id))fail('ERP_MAPPING_PREVIOUS_REVISION_REQUIRED');
 const ref=accountingMappingReference(projectionReference,(previous?.revision??0)+1),existing=await tx.erpAccountingMapping.findUnique({where:{mappingReference:ref}});
 if(existing){
  const projection=await tx.erpBusinessProjection.findUniqueOrThrow({where:{projectionReference}});verifyErpAccountingMapping(projection,existing);
  const request=existing.requestSnapshot as any,configuration={connectionKey:input.connectionKey,connectionVersion:input.connectionVersion,policyReference:input.policyReference,policyVersion:input.policyVersion,entries:input.entries.map(entry=>({groupReference:entry.groupReference,treatment:entry.treatment,mappingCode:entry.mappingCode})).sort((a,b)=>a.groupReference.localeCompare(b.groupReference))};
  if(existing.reviewHash!==input.reviewHash||existing.approvalReference!==input.approvalReference||request.configurationHash!==replayHash(configuration))fail('ERP_MAPPING_APPROVAL_CONFLICT');
  return {mapping:existing,replayed:true};
 }
 const preview=await previewErpAccountingMapping(tx,projectionReference,input);if(preview.reviewHash!==input.reviewHash)fail('ERP_MAPPING_PREVIEW_STALE');
 const requestSnapshot={...preview.request,approvalReference:input.approvalReference};
 const mapping=await tx.erpAccountingMapping.create({data:{mappingReference:preview.mappingReference,projectionId:preview.projection.projectionId,revision:preview.revision,previousMappingReference:input.previousMappingReference,providerConnectionVersionId:preview.providerConnectionVersionId,reviewHash:preview.reviewHash,requestHash:replayHash(requestSnapshot),requestSnapshot,approvalReference:input.approvalReference,approvedByActor:actorId}});
 return {mapping,replayed:false};
}
