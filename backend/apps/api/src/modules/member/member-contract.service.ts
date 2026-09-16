import { ConflictException, Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { createHash, randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';

@Injectable()
export class MemberContractService {
 constructor(private readonly db:PrismaService,private readonly idempotency:IdempotencyService,private readonly audit:AuditService){}
 async required(personId:string,at=new Date()){
  const rows=await this.db.contractDocumentVersion.findMany({where:{required:true,audience:{in:['NETWORK_MEMBER','ALL_MEMBERS']},effectiveFrom:{lte:at},OR:[{effectiveTo:null},{effectiveTo:{gt:at}}]},include:{consentEvidence:{where:{personId},take:1}},orderBy:[{contractType:'asc'},{effectiveFrom:'desc'}]});
  return rows.map(row=>({id:row.contractDocumentVersionId,type:row.contractType,version:row.versionCode,title:row.title,content:row.contentText,contentHash:row.contentHash,required:row.required,effectiveFrom:row.effectiveFrom.toISOString(),effectiveTo:row.effectiveTo?.toISOString()??null,acceptedAt:row.consentEvidence[0]?.acceptedAt.toISOString()??null}));
 }
 async consent(personId:string,versionId:string,input:{accepted:boolean;channel:'MEMBER_WEB'|'LIFF'},key:string,requestId:string){
  if(input.accepted!==true)throw new UnprocessableEntityException({code:'CONTRACT_ACCEPTANCE_REQUIRED'});
  try{const result=await this.idempotency.execute(`member:contract:consent:${personId}`,key,{versionId,...input},async tx=>{
   const now=new Date(),contract=await tx.contractDocumentVersion.findFirst({where:{contractDocumentVersionId:versionId,effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}});
   if(!contract)throw new NotFoundException({code:'CONTRACT_VERSION_NOT_AVAILABLE'});
   if(!['NETWORK_MEMBER','ALL_MEMBERS'].includes(contract.audience))throw new NotFoundException({code:'CONTRACT_VERSION_NOT_AVAILABLE'});
   const correlationId=randomUUID();
   const evidenceHash=createHash('sha256').update(JSON.stringify({personId,versionId,contentHash:contract.contentHash,channel:input.channel,requestId,correlationId})).digest('hex');
   const evidence=await tx.consentEvidence.create({data:{personId,contractDocumentVersionId:versionId,contentHashSnapshot:contract.contentHash,channel:input.channel,requestId,correlationId,evidenceHash}});
   await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'CONTRACT_CONSENTED',entityType:'ConsentEvidence',entityId:evidence.consentEvidenceId,afterData:{contractDocumentVersionId:versionId,contentHash:contract.contentHash,channel:input.channel},requestId,correlationId});
   await tx.outboxEvent.create({data:{eventType:'CONTRACT_CONSENTED',aggregateType:'Person',aggregateId:personId,payload:{schemaVersion:1,personId,contractVersionId:versionId,contentHash:contract.contentHash,channel:input.channel},correlationId}});
   return {consentEvidenceId:evidence.consentEvidenceId,contractVersionId:versionId,contentHash:contract.contentHash,acceptedAt:evidence.acceptedAt.toISOString(),channel:evidence.channel};
  });return {...result.value,replayed:result.replayed};}catch(error){if(['P2002','P2034'].includes((error as any).code))throw new ConflictException({code:'RETRYABLE_CONFLICT',message:'Retry identical consent using the same Idempotency-Key.'});throw error;}
 }
}
