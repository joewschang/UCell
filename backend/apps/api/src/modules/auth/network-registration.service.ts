import { ConflictException, Injectable, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { AuditService } from '../../common/audit/audit.service';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';

export interface NetworkRegistrationInput {contractVersionId:string;accepted:true;legalName:string;alias:string;gender:string;birthDate:string;mobile:string;mobileChallengeId:string;registrationSessionId:string;email:string;}

@Injectable()
export class NetworkRegistrationService {
 constructor(private readonly db:PrismaService,private readonly idempotency:IdempotencyService,private readonly audit:AuditService){}
 private fingerprint(value:string){const secret=process.env.OTP_HASH_SECRET;if(!secret||secret.length<32)throw new ServiceUnavailableException({code:'OTP_CONFIGURATION_PENDING'});return createHmac('sha256',secret).update(value).digest('hex');}
 async register(input:NetworkRegistrationInput,key:string,requestId:string){
  if(input.accepted!==true)throw new UnprocessableEntityException({code:'CONTRACT_ACCEPTANCE_REQUIRED'});
  const birthDate=new Date(`${input.birthDate}T00:00:00.000Z`);if(!Number.isFinite(birthDate.getTime())||birthDate>=new Date())throw new UnprocessableEntityException({code:'INVALID_BIRTH_DATE'});
  try{const result=await this.idempotency.execute(`registration:network:${input.registrationSessionId}`,key,input,async tx=>{
   const now=new Date(),correlationId=randomUUID(),fingerprint=this.fingerprint(input.mobile);
   await tx.$queryRaw`SELECT otp_challenge_id FROM identity.otp_challenge WHERE otp_challenge_id=${input.mobileChallengeId}::uuid FOR UPDATE`;
   const challenge=await tx.otpChallenge.findUnique({where:{otpChallengeId:input.mobileChallengeId}});
   if(!challenge||challenge.registrationSessionId!==input.registrationSessionId||challenge.purpose!=='NETWORK_REGISTRATION'||challenge.destinationFingerprint!==fingerprint||challenge.status!=='VERIFIED'||challenge.expiresAt<=now)throw new UnprocessableEntityException({code:'VERIFIED_MOBILE_EVIDENCE_REQUIRED'});
   if(challenge.consumedAt)throw new ConflictException({code:'OTP_CHALLENGE_ALREADY_CONSUMED'});
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${fingerprint},0))) AS lock_row`;
   if(await tx.person.findFirst({where:{mobile:input.mobile},select:{personId:true}}))throw new ConflictException({code:'MOBILE_ALREADY_REGISTERED'});
   const contract=await tx.contractDocumentVersion.findFirst({where:{contractDocumentVersionId:input.contractVersionId,required:true,audience:{in:['NETWORK_MEMBER','ALL_MEMBERS']},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}});
   if(!contract)throw new UnprocessableEntityException({code:'REQUIRED_CONTRACT_VERSION_INVALID'});
   const person=await tx.person.create({data:{legalName:input.legalName,preferredName:input.alias,genderCode:input.gender,birthDate,mobile:input.mobile,email:input.email,status:'EFFECTIVE',membershipState:'NETWORK_MEMBER',mobileVerifiedAt:challenge.verifiedAt}});
   await tx.otpChallenge.update({where:{otpChallengeId:challenge.otpChallengeId},data:{consumedAt:now,consumedByPersonId:person.personId}});
   await tx.personMembershipStateEvent.create({data:{personId:person.personId,toState:'NETWORK_MEMBER',reasonCode:'NETWORK_REGISTRATION_COMPLETED',sourceType:'NETWORK_REGISTRATION',correlationId}});
   const evidenceHash=createHash('sha256').update(JSON.stringify({personId:person.personId,contractVersionId:contract.contractDocumentVersionId,contentHash:contract.contentHash,channel:'MEMBER_WEB',requestId,correlationId})).digest('hex');
   const consent=await tx.consentEvidence.create({data:{personId:person.personId,contractDocumentVersionId:contract.contractDocumentVersionId,contentHashSnapshot:contract.contentHash,channel:'MEMBER_WEB',requestId,correlationId,evidenceHash}});
   await this.audit.write(tx,{actorType:'SYSTEM',action:'NETWORK_MEMBER_REGISTERED',entityType:'Person',entityId:person.personId,afterData:{membershipState:'NETWORK_MEMBER',contractVersionId:contract.contractDocumentVersionId,otpChallengeId:challenge.otpChallengeId},requestId,correlationId});
   await tx.outboxEvent.createMany({data:[{eventType:'NETWORK_MEMBER_REGISTERED',aggregateType:'Person',aggregateId:person.personId,payload:{schemaVersion:1,personId:person.personId,membershipState:'NETWORK_MEMBER'},correlationId},{eventType:'CONTRACT_CONSENTED',aggregateType:'Person',aggregateId:person.personId,payload:{schemaVersion:1,personId:person.personId,contractVersionId:contract.contractDocumentVersionId,contentHash:contract.contentHash},correlationId}]});
   return {personId:person.personId,membershipState:'NETWORK_MEMBER' as const,consentEvidenceId:consent.consentEvidenceId,providerLinkOptions:['LINE','GOOGLE'],qualificationCreated:false};
  });return {...result.value,replayed:result.replayed};}catch(error){if((error as any).code==='P2034')throw new ConflictException({code:'RETRYABLE_CONFLICT'});throw error;}
 }
}
