import {ConflictException,UnprocessableEntityException} from '@nestjs/common';
import {Prisma,PrismaService,erpProjectionReference,replayHash,sealErpBusinessProjection,verifyErpBusinessProjection} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
type Identity={sourceIdentity:string;configurationHash:string;purpose:string;previousProjectionReference:string};
type Candidate={body:Record<string,unknown>;drillback:Record<string,unknown>;reviewHash:string};
type Builder=(tx:Prisma.TransactionClient)=>Promise<Candidate>;
type Context={actorId:string;requestId:string;correlationId:string};
const conflict=(code:string)=>new ConflictException({code});
function publicTotals(value:any){const result:Record<string,string>={};for(const key of ['memberPayableGross','recoveryRequired','recoveryApplied','recoveryOutstanding','payoutRecoveryOffset','payoutNet','bankPaid']){if(value?.[key]===undefined)continue;if(typeof value[key]!=='string'||!/^(0|[1-9][0-9]*)(\.[0-9]{1,4})?$/.test(value[key]))throw conflict('ERP_SUPPLEMENT_PRIOR_EVIDENCE_INVALID');result[key]=new Prisma.Decimal(value[key]).toFixed(4);}return result;}
function valid(input:Identity){if(!/^ERP-PROJECTION-[a-f0-9]{40}$/.test(input.previousProjectionReference))throw new UnprocessableEntityException({code:'ERP_SUPPLEMENT_REFERENCE_INVALID'});}
async function parent(tx:Prisma.TransactionClient,input:Identity){
 const row=await tx.erpBusinessProjection.findUnique({where:{projectionReference:input.previousProjectionReference}});
 if(!row||row.stream!=='COMPENSATION'||row.sourceIdentity!==input.sourceIdentity)throw conflict('ERP_SUPPLEMENT_SOURCE_MISMATCH');
 const payload=verifyErpBusinessProjection(row);if(payload.projectionPurpose!==input.purpose)throw conflict('ERP_SUPPLEMENT_SOURCE_MISMATCH');
 if(!('memberPayableGross' in publicTotals(payload.totals)))throw conflict('ERP_SUPPLEMENT_PRIOR_EVIDENCE_INVALID');
 return {row,payload};
}
async function prepare(tx:Prisma.TransactionClient,input:Identity,build:Builder){
 const previous=await parent(tx,input),latest=await tx.erpBusinessProjection.findFirst({where:{stream:'COMPENSATION',sourceIdentity:input.sourceIdentity},orderBy:{revision:'desc'}});
 if(latest?.projectionReference!==input.previousProjectionReference)throw conflict('ERP_SUPPLEMENT_LATEST_REVISION_REQUIRED');
 const candidate=await build(tx);if(candidate.reviewHash===(previous.payload.economicSnapshotHash??previous.payload.reviewHash))throw conflict('ERP_SUPPLEMENT_NO_CHANGE');
 const revision=previous.row.revision+1,reviewHash=replayHash({previousProjectionReference:input.previousProjectionReference,previousPayloadHash:previous.row.payloadHash,candidateHash:candidate.reviewHash});
 const drillback={...candidate.drillback,previousProjectionReference:input.previousProjectionReference,previousPayloadHash:previous.row.payloadHash};
 return {previous,candidate,revision,reviewHash,drillback,drillbackHash:replayHash(drillback),projectionReference:erpProjectionReference('COMPENSATION',input.sourceIdentity,revision)};
}
export async function previewAccountingSupplement(db:PrismaService,input:Identity,build:Builder){
 valid(input);return db.$transaction(async tx=>{const value=await prepare(tx,input,build);return {projectionReference:value.projectionReference,revision:value.revision,reviewHash:value.reviewHash,drillbackHash:value.drillbackHash,previous:{projectionReference:input.previousProjectionReference,revision:value.previous.row.revision,payloadHash:value.previous.row.payloadHash,totals:publicTotals(value.previous.payload.totals)},expected:value.candidate.body};},{isolationLevel:Prisma.TransactionIsolationLevel.RepeatableRead,timeout:30000});
}
export async function approveAccountingSupplement(db:PrismaService,audit:AuditService,input:Identity&{reviewHash:string;approvalReference:string;reasonReference:string},context:Context,build:Builder){
 valid(input);if(!/^[a-f0-9]{64}$/.test(input.reviewHash)||![input.approvalReference,input.reasonReference].every(value=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/.test(value)))throw new UnprocessableEntityException({code:'ERP_SUPPLEMENT_APPROVAL_INVALID'});
 for(let attempt=0;;attempt++)try{return await db.$transaction(async tx=>{
  const root=erpProjectionReference('COMPENSATION',input.sourceIdentity);await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${root},0))`;
  const previous=await parent(tx,input),ref=erpProjectionReference('COMPENSATION',input.sourceIdentity,previous.row.revision+1),existing=await tx.erpBusinessProjection.findUnique({where:{projectionReference:ref}});
  if(existing){const payload=verifyErpBusinessProjection(existing);if(payload.reviewHash!==input.reviewHash||payload.configurationHash!==input.configurationHash||payload.supplementReasonReference!==input.reasonReference||existing.approvalReference!==input.approvalReference)throw conflict('ERP_SUPPLEMENT_APPROVAL_CONFLICT');return {projectionReference:ref,payloadHash:existing.payloadHash,replayed:true};}
  const value=await prepare(tx,input,build);if(value.reviewHash!==input.reviewHash)throw conflict('ERP_SUPPLEMENT_PREVIEW_STALE');
  const result=await sealErpBusinessProjection(tx,{stream:'COMPENSATION',sourceIdentity:input.sourceIdentity,revision:value.revision,previousProjectionReference:input.previousProjectionReference,body:{...value.candidate.body,reviewHash:value.reviewHash,economicSnapshotHash:value.candidate.reviewHash,supplementReasonReference:input.reasonReference},drillback:value.drillback,context:{...context,approvalReference:input.approvalReference}});
  await audit.write(tx,{actorType:'USER',actorId:context.actorId,action:'ERP_ACCOUNTING_SUPPLEMENT_APPROVED',entityType:'ERP_BUSINESS_PROJECTION',entityId:result.projection.projectionId,afterData:{projectionReference:ref,previousProjectionReference:input.previousProjectionReference,reviewHash:input.reviewHash,payloadHash:result.projection.payloadHash,reasonReference:input.reasonReference,approvalReference:input.approvalReference},requestId:context.requestId,correlationId:context.correlationId});
  return {projectionReference:ref,payloadHash:result.projection.payloadHash,replayed:false};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable,timeout:30000});}catch(error){if(attempt<3&&error instanceof Prisma.PrismaClientKnownRequestError&&['P2034','P2002'].includes(error.code))continue;throw error;}
}
