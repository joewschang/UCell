import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { createHash, randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
export interface NetworkRegistrationInput {contractVersionId:string;accepted:true;legalName:string;alias:string;gender:string;birthDate:string;mobile:string;email:string;}
@Injectable()
export class NetworkRegistrationService {
 constructor(private readonly db:PrismaService,private readonly idempotency:IdempotencyService,private readonly audit:AuditService){}
 async registerLinePerson(personId:string,input:NetworkRegistrationInput,key:string,requestId:string){
  if(input.accepted!==true)throw new UnprocessableEntityException({code:'CONTRACT_ACCEPTANCE_REQUIRED'});
  const birthDate=new Date(`${input.birthDate}T00:00:00.000Z`);if(!Number.isFinite(birthDate.getTime())||birthDate>=new Date())throw new UnprocessableEntityException({code:'INVALID_BIRTH_DATE'});
  try{const result=await this.idempotency.execute(`registration:network:line:${personId}`,key,input,async tx=>{
   const now=new Date(),correlationId=randomUUID(),person=await tx.person.findUnique({where:{personId}});
   if(!person||person.status!=='EFFECTIVE')throw new UnprocessableEntityException({code:'LINE_PERSON_REQUIRED'});
   if(person.membershipState)throw new ConflictException({code:'MEMBERSHIP_STATE_CONFLICT'});
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${input.mobile},0))) AS lock_row`;
   if(await tx.person.findFirst({where:{mobile:input.mobile,personId:{not:personId}},select:{personId:true}}))throw new ConflictException({code:'MOBILE_ALREADY_REGISTERED'});
   const contract=await tx.contractDocumentVersion.findFirst({where:{contractDocumentVersionId:input.contractVersionId,required:true,audience:{in:['NETWORK_MEMBER','ALL_MEMBERS']},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}});
   if(!contract)throw new UnprocessableEntityException({code:'REQUIRED_CONTRACT_VERSION_INVALID'});
   const updated=await tx.person.update({where:{personId},data:{legalName:input.legalName,preferredName:input.alias,genderCode:input.gender,birthDate,mobile:input.mobile,email:input.email,membershipState:'NETWORK_MEMBER',mobileVerifiedAt:null}});
   await tx.personMembershipStateEvent.create({data:{personId,toState:'NETWORK_MEMBER',fromState:person.membershipState,reasonCode:'LINE_NETWORK_REGISTRATION_COMPLETED',sourceType:'LINE_AUTHENTICATED_REGISTRATION',correlationId}});
   let consent=await tx.consentEvidence.findUnique({where:{personId_contractDocumentVersionId:{personId,contractDocumentVersionId:contract.contractDocumentVersionId}}});
   if(!consent){const evidenceHash=createHash('sha256').update(JSON.stringify({personId,contractVersionId:contract.contractDocumentVersionId,contentHash:contract.contentHash,channel:'LIFF',requestId,correlationId})).digest('hex');consent=await tx.consentEvidence.create({data:{personId,contractDocumentVersionId:contract.contractDocumentVersionId,contentHashSnapshot:contract.contentHash,channel:'LIFF',requestId,correlationId,evidenceHash}});}
   await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'NETWORK_MEMBER_REGISTERED',entityType:'Person',entityId:personId,beforeData:{membershipState:person.membershipState},afterData:{membershipState:'NETWORK_MEMBER',authProvider:'LINE',contractVersionId:contract.contractDocumentVersionId},requestId,correlationId});
   await tx.outboxEvent.create({data:{eventType:'NETWORK_MEMBER_REGISTERED',aggregateType:'Person',aggregateId:personId,payload:{schemaVersion:1,personId,membershipState:'NETWORK_MEMBER',authProvider:'LINE'},correlationId}});
   return {personId:updated.personId,membershipState:'NETWORK_MEMBER' as const,consentEvidenceId:consent.consentEvidenceId,enabledAuthenticationProvider:'LINE' as const,qualificationCreated:false};
  });return {...result.value,replayed:result.replayed};}catch(error){if((error as any).code==='P2034')throw new ConflictException({code:'RETRYABLE_CONFLICT'});throw error;}
 }
}
