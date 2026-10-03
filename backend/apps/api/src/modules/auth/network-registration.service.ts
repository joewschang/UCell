import { ConflictException, Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { createHash, randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { PiiCryptoService } from '../../common/security/pii-crypto.service';
import { IdentityMatchFingerprintService } from '../../common/security/identity-match-fingerprint.service';
import {ContactVerificationService} from './contact-verification.service';

export interface NetworkRegistrationInput {
 contractVersionId:string;accepted:true;legalName:string;alias:string;gender:string;birthDate:string;
 nationalityCode:string;identityDocumentType:'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';identityDocumentNumber:string;
 mobile:string;email:string;
 mobileVerificationProof?:string;emailVerificationProof?:string;
}
@Injectable()
export class NetworkRegistrationService {
 constructor(
  private readonly db:PrismaService,
  private readonly idempotency:IdempotencyService,
  private readonly audit:AuditService,
  private readonly pii:PiiCryptoService,
  private readonly fingerprint:IdentityMatchFingerprintService,
  private readonly contacts?:ContactVerificationService,
 ){}
 async registerLinePerson(personId:string,input:NetworkRegistrationInput,key:string,requestId:string){
  if(input.accepted!==true)throw new UnprocessableEntityException({code:'CONTRACT_ACCEPTANCE_REQUIRED'});
  const birthDate=new Date(`${input.birthDate}T00:00:00.000Z`);if(!Number.isFinite(birthDate.getTime())||birthDate>=new Date())throw new UnprocessableEntityException({code:'INVALID_BIRTH_DATE'});
  const nationalityCode=input.nationalityCode.trim().toUpperCase();
  if(!/^[A-Z]{2}$/.test(nationalityCode))throw new UnprocessableEntityException({code:'INVALID_NATIONALITY_CODE'});
  const identityDocumentNumber=this.fingerprint.normalizeIdentityDocumentNumber(input.identityDocumentNumber);
  const identityDocumentFingerprint=this.fingerprint.fingerprintIdentityDocument(nationalityCode,input.identityDocumentType,identityDocumentNumber);
  const encryptedIdentity=this.pii.encrypt(identityDocumentNumber);
  const safeRequest={...input,identityDocumentNumber:undefined,identityDocumentFingerprint,nationalityCode};
  try{const result=await this.idempotency.execute(`registration:network:line:${personId}`,key,safeRequest,async tx=>{
   const now=new Date(),correlationId=randomUUID(),person=await tx.person.findUnique({where:{personId}});
   if(!person||person.status!=='EFFECTIVE')throw new UnprocessableEntityException({code:'LINE_PERSON_REQUIRED'});
   if(person.membershipState)throw new ConflictException({code:'MEMBERSHIP_STATE_CONFLICT'});
   if(!this.contacts)throw new UnprocessableEntityException({code:'CONTACT_VERIFICATION_REQUIRED'});
   const mobileVerifiedAt=await this.contacts.consume(tx,'PERSON:'+personId,'REGISTRATION','SMS',input.mobile,input.mobileVerificationProof);
   const emailVerifiedAt=await this.contacts.consume(tx,'PERSON:'+personId,'REGISTRATION','EMAIL',input.email,input.emailVerificationProof);
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${identityDocumentFingerprint},0))) AS lock_row`;
   if(await tx.person.findFirst({where:{identityDocumentFingerprint,personId:{not:personId}},select:{personId:true}}))throw new ConflictException({code:'IDENTITY_DOCUMENT_ALREADY_REGISTERED'});
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${input.mobile},0))) AS lock_row`;
   if(await tx.person.findFirst({where:{mobile:input.mobile,personId:{not:personId}},select:{personId:true}}))throw new ConflictException({code:'MOBILE_ALREADY_REGISTERED'});
   const contract=await tx.contractDocumentVersion.findFirst({where:{contractDocumentVersionId:input.contractVersionId,required:true,audience:{in:['NETWORK_MEMBER','ALL_MEMBERS']},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}});
   if(!contract)throw new UnprocessableEntityException({code:'REQUIRED_CONTRACT_VERSION_INVALID'});
   const updated=await tx.person.update({where:{personId},data:{
    legalName:input.legalName,preferredName:input.alias,genderCode:input.gender,birthDate,mobile:input.mobile,email:input.email,
    nationalityCode,identityDocumentType:input.identityDocumentType,
    identityDocumentNumberCiphertext:encryptedIdentity.ciphertext,identityDocumentKeyVersion:encryptedIdentity.keyVersion,
    identityDocumentFingerprint,membershipState:'NETWORK_MEMBER',mobileVerifiedAt,emailVerifiedAt
   }});
   await tx.personMembershipStateEvent.create({data:{personId,toState:'NETWORK_MEMBER',fromState:person.membershipState,reasonCode:'LINE_NETWORK_REGISTRATION_COMPLETED',sourceType:'LINE_AUTHENTICATED_REGISTRATION',correlationId}});
   let consent=await tx.consentEvidence.findUnique({where:{personId_contractDocumentVersionId:{personId,contractDocumentVersionId:contract.contractDocumentVersionId}}});
   if(!consent){const evidenceHash=createHash('sha256').update(JSON.stringify({personId,contractVersionId:contract.contractDocumentVersionId,contentHash:contract.contentHash,channel:'LIFF',requestId,correlationId})).digest('hex');consent=await tx.consentEvidence.create({data:{personId,contractDocumentVersionId:contract.contractDocumentVersionId,contentHashSnapshot:contract.contentHash,channel:'LIFF',requestId,correlationId,evidenceHash}});}
   await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'NETWORK_MEMBER_REGISTERED',entityType:'Person',entityId:personId,beforeData:{membershipState:person.membershipState},afterData:{membershipState:'NETWORK_MEMBER',authProvider:'LINE',contractVersionId:contract.contractDocumentVersionId,nationalityCode,identityDocumentType:input.identityDocumentType,identityDocumentFingerprint},requestId,correlationId});
   await tx.outboxEvent.create({data:{eventType:'NETWORK_MEMBER_REGISTERED',aggregateType:'Person',aggregateId:personId,payload:{schemaVersion:2,personId,membershipState:'NETWORK_MEMBER',authProvider:'LINE',nationalityCode,identityDocumentType:input.identityDocumentType},correlationId}});
   return {personId:updated.personId,membershipState:'NETWORK_MEMBER' as const,consentEvidenceId:consent.consentEvidenceId,enabledAuthenticationProvider:'LINE' as const,qualificationCreated:false};
  });return {...result.value,replayed:result.replayed};}catch(error){if(['P2002','P2034'].includes((error as any).code))throw new ConflictException({code:'RETRYABLE_CONFLICT'});throw error;}
 }
}
