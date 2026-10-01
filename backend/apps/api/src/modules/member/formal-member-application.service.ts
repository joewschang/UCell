import {ConflictException,Injectable,NotFoundException,UnprocessableEntityException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {PiiCryptoService} from '../../common/security/pii-crypto.service';
import {IdentityMatchFingerprintService} from '../../common/security/identity-match-fingerprint.service';

export type FormalDraftInput={
 formalContractVersionId:string;
 applicantType?:'INDIVIDUAL'|'LEGAL_ENTITY';
 communicationAddress:string;phone:string;email:string;bankCode:string;bankAccount:string;accountHolder:string;
 legalName?:string;gender?:string;birthDate?:string;nationalId?:string;
 legalEntityName?:string;legalEntityRegistrationNo?:string;legalEntityRegisteredAddress?:string;
 representativeLegalName?:string;representativeNationalId?:string;
 hasSpouse?:boolean;spouseName?:string;spouseNationalId?:string;
};

@Injectable()
export class FormalMemberApplicationService {
 constructor(
  private readonly db:PrismaService,
  private readonly idempotency:IdempotencyService,
  private readonly audit:AuditService,
  private readonly pii:PiiCryptoService,
  private readonly fingerprint:IdentityMatchFingerprintService,
 ){}

 private required(value:string|undefined,code:string){
  const normalized=value?.trim();
  if(!normalized)throw new UnprocessableEntityException({code});
  return normalized;
 }

 private normalize(input:FormalDraftInput){
  const applicantType=input.applicantType??'INDIVIDUAL',hasSpouse=input.hasSpouse===true;
  const common={
   formalContractVersionId:input.formalContractVersionId,
   applicantType,
   communicationAddress:this.required(input.communicationAddress,'FORMAL_COMMUNICATION_ADDRESS_REQUIRED'),
   phone:this.required(input.phone,'FORMAL_PHONE_REQUIRED'),
   email:this.required(input.email,'FORMAL_EMAIL_REQUIRED').toLowerCase(),
   bankCode:this.required(input.bankCode,'FORMAL_BANK_CODE_REQUIRED'),
   bankAccount:this.required(input.bankAccount,'FORMAL_BANK_ACCOUNT_REQUIRED').replace(/\s+/g,''),
   accountHolder:this.required(input.accountHolder,'FORMAL_ACCOUNT_HOLDER_REQUIRED'),
   hasSpouse,
   spouseName:hasSpouse?this.required(input.spouseName,'FORMAL_SPOUSE_NAME_REQUIRED'):undefined,
   spouseNationalId:hasSpouse?this.fingerprint.normalizeNationalId(this.required(input.spouseNationalId,'FORMAL_SPOUSE_ID_REQUIRED')):undefined,
  };
  if(applicantType==='INDIVIDUAL'){
   return {...common,
    legalName:this.required(input.legalName,'FORMAL_LEGAL_NAME_REQUIRED'),
    gender:this.required(input.gender,'FORMAL_GENDER_REQUIRED'),
    birthDate:this.required(input.birthDate,'FORMAL_BIRTH_DATE_REQUIRED'),
    nationalId:this.fingerprint.normalizeNationalId(this.required(input.nationalId,'FORMAL_NATIONAL_ID_REQUIRED')),
   };
  }
  if(applicantType==='LEGAL_ENTITY'){
   return {...common,
    legalEntityName:this.required(input.legalEntityName,'FORMAL_LEGAL_ENTITY_NAME_REQUIRED'),
    legalEntityRegistrationNo:this.required(input.legalEntityRegistrationNo,'FORMAL_LEGAL_ENTITY_REGISTRATION_NO_REQUIRED').toUpperCase().replace(/\s+/g,''),
    legalEntityRegisteredAddress:this.required(input.legalEntityRegisteredAddress,'FORMAL_LEGAL_ENTITY_ADDRESS_REQUIRED'),
    representativeLegalName:this.required(input.representativeLegalName,'FORMAL_REPRESENTATIVE_NAME_REQUIRED'),
    representativeNationalId:this.fingerprint.normalizeNationalId(this.required(input.representativeNationalId,'FORMAL_REPRESENTATIVE_ID_REQUIRED')),
   };
  }
  throw new UnprocessableEntityException({code:'FORMAL_APPLICANT_TYPE_INVALID'});
 }

 private mask(value:string|undefined){return value?'***'+value.slice(-4):null;}
 private view(application:any,payload:any,version:number){
  const primaryId=payload.applicantType==='LEGAL_ENTITY'?payload.representativeNationalId:payload.nationalId;
  return {
   id:application.formalMemberApplicationId,status:application.status,version,
   applicantType:payload.applicantType??'INDIVIDUAL',
   contractVersionId:payload.formalContractVersionId,
   legalName:payload.legalName??null,gender:payload.gender??null,birthDate:payload.birthDate??null,
   legalEntityName:payload.legalEntityName??null,legalEntityRegistrationNo:payload.legalEntityRegistrationNo??null,
   legalEntityRegisteredAddress:payload.legalEntityRegisteredAddress??null,representativeLegalName:payload.representativeLegalName??null,
   communicationAddress:payload.communicationAddress,phone:payload.phone,email:payload.email,
   nationalIdMasked:this.mask(primaryId),hasSpouse:payload.hasSpouse===true,
   spouseNameMasked:payload.spouseName?(payload.spouseName.slice(0,1)+'*'.repeat(Math.max(payload.spouseName.length-1,1))):null,
   spouseNationalIdMasked:this.mask(payload.spouseNationalId),
   spouseVerificationStatus:application.spouseVerificationStatus,
   crossLineReviewStatus:application.crossLineReviewStatus,
   bankCode:payload.bankCode,bankAccountMasked:this.mask(payload.bankAccount),accountHolder:payload.accountHolder,
   updatedAt:application.updatedAt.toISOString(),
  };
 }

 async save(personId:string,input:FormalDraftInput,key:string,requestId:string){
  const normalized=this.normalize(input) as any;
  const primaryId=normalized.applicantType==='LEGAL_ENTITY'?normalized.representativeNationalId:normalized.nationalId;
  const applicantIdentityFingerprint=this.fingerprint.fingerprintNationalId(primaryId);
  const spouseIdentityFingerprint=normalized.hasSpouse?this.fingerprint.fingerprintNationalId(normalized.spouseNationalId):null;
  const hash=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const idempotentRequest={
   ...normalized,
   nationalId:undefined,representativeNationalId:undefined,spouseNationalId:undefined,bankAccount:undefined,
   applicantIdentityFingerprint,spouseIdentityFingerprint,
   bankAccountHash:createHash('sha256').update(normalized.bankAccount).digest('hex'),
  };
  try{
   const result=await this.idempotency.execute('member:formal-application:save:'+personId,key,idempotentRequest,async tx=>{
    const person=await tx.person.findUnique({where:{personId}});
    if(!person||!['NETWORK_MEMBER','FORMAL_PENDING'].includes(person.membershipState??''))throw new ConflictException({code:'FORMAL_APPLICATION_NOT_AVAILABLE'});
    const now=new Date(),contract=await tx.contractDocumentVersion.findFirst({where:{contractDocumentVersionId:normalized.formalContractVersionId,required:true,audience:{in:['FORMAL_MEMBER','ALL_MEMBERS']},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},include:{consentEvidence:{where:{personId},take:1}}});
    if(!contract||!contract.consentEvidence.length)throw new UnprocessableEntityException({code:'FORMAL_CONTRACT_CONSENT_REQUIRED'});
    const current=await tx.formalMemberApplication.findFirst({where:{personId,status:{in:['DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFO'] as any}},include:{snapshots:{orderBy:{version:'desc'},take:1}}});
    if(current&&current.status!=='DRAFT'&&current.status!=='NEEDS_MORE_INFO')throw new ConflictException({code:'FORMAL_APPLICATION_LOCKED'});
    if(current&&current.applicantType!==normalized.applicantType)throw new ConflictException({code:'FORMAL_APPLICANT_TYPE_LOCKED'});
    const encrypted=this.pii.encrypt(normalized),version=(current?.snapshots[0]?.version??0)+1;
    const metadata={
     applicantType:normalized.applicantType,
     legalEntityRegistrationNo:normalized.applicantType==='LEGAL_ENTITY'?normalized.legalEntityRegistrationNo:null,
     applicantIdentityFingerprint,
     spouseIdentityFingerprint,
     spouseVerificationStatus:normalized.hasSpouse?'PENDING':'NOT_APPLICABLE',
     crossLineReviewStatus:'NOT_EVALUATED',
     crossLineConflictCode:null,
    } as any;
    const application=current
     ?await tx.formalMemberApplication.update({where:{formalMemberApplicationId:current.formalMemberApplicationId},data:{currentSnapshotHash:hash,status:'DRAFT',...metadata}})
     :await tx.formalMemberApplication.create({data:{personId,currentSnapshotHash:hash,status:'DRAFT',...metadata}});
    await tx.formalMemberApplicationSnapshot.create({data:{formalMemberApplicationId:application.formalMemberApplicationId,version,payloadCiphertext:encrypted.ciphertext,keyVersion:encrypted.keyVersion,payloadHash:hash}});
    const correlationId=randomUUID();
    await this.audit.write(tx,{actorType:'MEMBER',actorId:personId,action:'FORMAL_APPLICATION_DRAFT_SAVED',entityType:'FormalMemberApplication',entityId:application.formalMemberApplicationId,afterData:{version,payloadHash:hash,formalContractVersionId:normalized.formalContractVersionId,applicantType:normalized.applicantType,hasSpouse:normalized.hasSpouse,fieldsComplete:true},requestId,correlationId});
    await tx.outboxEvent.create({data:{eventType:'FORMAL_APPLICATION_DRAFT_SAVED',aggregateType:'Person',aggregateId:personId,payload:{schemaVersion:2,personId,applicationId:application.formalMemberApplicationId,applicationVersion:version,payloadHash:hash,applicantType:normalized.applicantType,hasSpouse:normalized.hasSpouse},correlationId}});
    return this.view(application,normalized,version);
   });
   return {...result.value,replayed:result.replayed};
  }catch(error){
   if(['P2002','P2034'].includes((error as any).code))throw new ConflictException({code:'RETRYABLE_CONFLICT'});
   throw error;
  }
 }

 async current(personId:string){
  const application=await this.db.formalMemberApplication.findFirst({where:{personId,status:{in:['DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFO'] as any}},include:{snapshots:{orderBy:{version:'desc'},take:1}}});
  if(!application||!application.snapshots[0])throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
  const snapshot=application.snapshots[0],payload=this.pii.decrypt<any>(snapshot.payloadCiphertext,snapshot.keyVersion);
  return this.view(application,payload,snapshot.version);
 }

 async adminList(input:{status?:string;take?:number}={}){
  const take=Math.min(Math.max(input.take??50,1),100);
  const rows=await this.db.formalMemberApplication.findMany({where:input.status?{status:input.status}:undefined,include:{person:{select:{legalName:true,membershipState:true}},snapshots:{select:{version:true,payloadHash:true},orderBy:{version:'desc'},take:1}},orderBy:{updatedAt:'desc'},take});
  return rows.map(row=>({
   id:row.formalMemberApplicationId,
   personNameMasked:row.person.legalName?(row.person.legalName.slice(0,1)+'*'.repeat(Math.max(row.person.legalName.length-1,1))):'**',
   applicantType:row.applicantType,membershipState:row.person.membershipState,status:row.status,
   spouseVerificationStatus:row.spouseVerificationStatus,crossLineReviewStatus:row.crossLineReviewStatus,crossLineConflictCode:row.crossLineConflictCode,
   version:row.snapshots[0]?.version??null,payloadHash:row.snapshots[0]?.payloadHash??row.currentSnapshotHash,
   createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),submittedAt:row.submittedAt?.toISOString()??null,reviewedAt:row.reviewedAt?.toISOString()??null,decisionReasonCode:row.decisionReasonCode,
  }));
 }
}
