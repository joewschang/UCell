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
 legalName?:string;gender?:string;birthDate?:string;nationalityCode?:string;
 identityDocumentType?:'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';identityDocumentNumber?:string;
 legalEntityName?:string;legalEntityRegistrationNo?:string;legalEntityRegisteredAddress?:string;legalEntityRegistrationCountryCode?:string;
 representativeLegalName?:string;representativeNationalityCode?:string;
 representativeIdentityDocumentType?:'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';representativeIdentityDocumentNumber?:string;
 hasSpouse?:boolean;spouseName?:string;spouseNationalityCode?:string;
 spouseIdentityDocumentType?:'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';spouseIdentityDocumentNumber?:string;
};
export type AdminPaperFormalInput=FormalDraftInput&{
 representativePersonId:string;
 paperApplicationReference:string;
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
   spouseNationalityCode:hasSpouse?this.required(input.spouseNationalityCode,'FORMAL_SPOUSE_NATIONALITY_REQUIRED').toUpperCase():undefined,
   spouseIdentityDocumentType:hasSpouse?this.required(input.spouseIdentityDocumentType,'FORMAL_SPOUSE_DOCUMENT_TYPE_REQUIRED') as any:undefined,
   spouseIdentityDocumentNumber:hasSpouse?this.fingerprint.normalizeIdentityDocumentNumber(this.required(input.spouseIdentityDocumentNumber,'FORMAL_SPOUSE_DOCUMENT_NUMBER_REQUIRED')):undefined,
  };
  if(applicantType==='INDIVIDUAL'){
   return {...common,
    legalName:this.required(input.legalName,'FORMAL_LEGAL_NAME_REQUIRED'),
    gender:this.required(input.gender,'FORMAL_GENDER_REQUIRED'),
    birthDate:this.required(input.birthDate,'FORMAL_BIRTH_DATE_REQUIRED'),
    nationalityCode:this.required(input.nationalityCode,'FORMAL_NATIONALITY_REQUIRED').toUpperCase(),
    identityDocumentType:this.required(input.identityDocumentType,'FORMAL_IDENTITY_DOCUMENT_TYPE_REQUIRED') as any,
    identityDocumentNumber:this.fingerprint.normalizeIdentityDocumentNumber(this.required(input.identityDocumentNumber,'FORMAL_IDENTITY_DOCUMENT_NUMBER_REQUIRED')),
   };
  }
  if(applicantType==='LEGAL_ENTITY'){
   return {...common,
    legalEntityName:this.required(input.legalEntityName,'FORMAL_LEGAL_ENTITY_NAME_REQUIRED'),
    legalEntityRegistrationNo:this.required(input.legalEntityRegistrationNo,'FORMAL_LEGAL_ENTITY_REGISTRATION_NO_REQUIRED').toUpperCase().replace(/\s+/g,''),
    legalEntityRegisteredAddress:this.required(input.legalEntityRegisteredAddress,'FORMAL_LEGAL_ENTITY_ADDRESS_REQUIRED'),
    legalEntityRegistrationCountryCode:this.required(input.legalEntityRegistrationCountryCode,'FORMAL_LEGAL_ENTITY_COUNTRY_REQUIRED').toUpperCase(),
    representativeLegalName:this.required(input.representativeLegalName,'FORMAL_REPRESENTATIVE_NAME_REQUIRED'),
    representativeNationalityCode:this.required(input.representativeNationalityCode,'FORMAL_REPRESENTATIVE_NATIONALITY_REQUIRED').toUpperCase(),
    representativeIdentityDocumentType:this.required(input.representativeIdentityDocumentType,'FORMAL_REPRESENTATIVE_DOCUMENT_TYPE_REQUIRED') as any,
    representativeIdentityDocumentNumber:this.fingerprint.normalizeIdentityDocumentNumber(this.required(input.representativeIdentityDocumentNumber,'FORMAL_REPRESENTATIVE_DOCUMENT_NUMBER_REQUIRED')),
   };
  }
  throw new UnprocessableEntityException({code:'FORMAL_APPLICANT_TYPE_INVALID'});
 }

 private mask(value:string|undefined){return value?'***'+value.slice(-4):null;}
 private view(application:any,payload:any,version:number){
  const primaryId=payload.applicantType==='LEGAL_ENTITY'?payload.representativeIdentityDocumentNumber:payload.identityDocumentNumber;
  return {
   id:application.formalMemberApplicationId,status:application.status,version,
   applicantType:payload.applicantType??'INDIVIDUAL',
   contractVersionId:payload.formalContractVersionId,
   legalName:payload.legalName??null,gender:payload.gender??null,birthDate:payload.birthDate??null,
   legalEntityName:payload.legalEntityName??null,legalEntityRegistrationNo:payload.legalEntityRegistrationNo??null,
   legalEntityRegisteredAddress:payload.legalEntityRegisteredAddress??null,representativeLegalName:payload.representativeLegalName??null,
   communicationAddress:payload.communicationAddress,phone:payload.phone,email:payload.email,
   nationalityCode:payload.nationalityCode??payload.representativeNationalityCode??null,identityDocumentType:payload.identityDocumentType??payload.representativeIdentityDocumentType??null,identityDocumentNumberMasked:this.mask(primaryId),hasSpouse:payload.hasSpouse===true,
   spouseNameMasked:payload.spouseName?(payload.spouseName.slice(0,1)+'*'.repeat(Math.max(payload.spouseName.length-1,1))):null,
   spouseNationalityCode:payload.spouseNationalityCode??null,spouseIdentityDocumentType:payload.spouseIdentityDocumentType??null,spouseIdentityDocumentNumberMasked:this.mask(payload.spouseIdentityDocumentNumber),
   spouseVerificationStatus:application.spouseVerificationStatus,
   crossLineReviewStatus:application.crossLineReviewStatus,
   bankCode:payload.bankCode,bankAccountMasked:this.mask(payload.bankAccount),accountHolder:payload.accountHolder,
   updatedAt:application.updatedAt.toISOString(),
  };
 }

 async save(personId:string,input:FormalDraftInput,key:string,requestId:string){
  const normalized=this.normalize(input) as any;
  if(normalized.applicantType==='LEGAL_ENTITY')throw new UnprocessableEntityException({code:'LEGAL_ENTITY_PAPER_APPLICATION_REQUIRED'});
  const primaryId=normalized.applicantType==='LEGAL_ENTITY'?normalized.representativeIdentityDocumentNumber:normalized.identityDocumentNumber;
  const primaryNationality=normalized.applicantType==='LEGAL_ENTITY'?normalized.representativeNationalityCode:normalized.nationalityCode;
  const primaryDocumentType=normalized.applicantType==='LEGAL_ENTITY'?normalized.representativeIdentityDocumentType:normalized.identityDocumentType;
  const applicantIdentityFingerprint=this.fingerprint.fingerprintIdentityDocument(primaryNationality,primaryDocumentType,primaryId);
  const spouseIdentityFingerprint=normalized.hasSpouse?this.fingerprint.fingerprintIdentityDocument(normalized.spouseNationalityCode,normalized.spouseIdentityDocumentType,normalized.spouseIdentityDocumentNumber):null;
  const hash=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
  const idempotentRequest={
   ...normalized,
   identityDocumentNumber:undefined,representativeIdentityDocumentNumber:undefined,spouseIdentityDocumentNumber:undefined,bankAccount:undefined,
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
     sourceChannel:'MEMBER_WEB',
     applicantNationalityCode:primaryNationality,
     applicantIdentityDocumentType:primaryDocumentType,
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

 async createPaper(input:AdminPaperFormalInput,actorId:string,key:string,requestId:string){
  if(!actorId)throw new ConflictException({code:'ADMIN_PERSON_ID_REQUIRED'});
  const normalized=this.normalize(input) as any;
  const paperReference=this.required(input.paperApplicationReference,'PAPER_APPLICATION_REFERENCE_REQUIRED');
  const representative=await this.db.person.findUnique({where:{personId:input.representativePersonId}});
  if(!representative)throw new NotFoundException({code:'REPRESENTATIVE_PERSON_NOT_FOUND'});
  const primaryId=normalized.applicantType==='LEGAL_ENTITY'?normalized.representativeIdentityDocumentNumber:normalized.identityDocumentNumber;
  const primaryNationality=normalized.applicantType==='LEGAL_ENTITY'?normalized.representativeNationalityCode:normalized.nationalityCode;
  const primaryDocumentType=normalized.applicantType==='LEGAL_ENTITY'?normalized.representativeIdentityDocumentType:normalized.identityDocumentType;
  const applicantIdentityFingerprint=this.fingerprint.fingerprintIdentityDocument(primaryNationality,primaryDocumentType,primaryId);
  const spouseIdentityFingerprint=normalized.hasSpouse?this.fingerprint.fingerprintIdentityDocument(normalized.spouseNationalityCode,normalized.spouseIdentityDocumentType,normalized.spouseIdentityDocumentNumber):null;
  const safeRequest={paperReference,representativePersonId:input.representativePersonId,applicantType:normalized.applicantType,applicantIdentityFingerprint,spouseIdentityFingerprint,legalEntityRegistrationNo:normalized.legalEntityRegistrationNo??null};
  return this.idempotency.execute('admin:formal-paper:create:'+actorId,key,safeRequest,async tx=>{
   const now=new Date();
   const contract=await tx.contractDocumentVersion.findFirst({where:{contractDocumentVersionId:normalized.formalContractVersionId,required:true,audience:{in:['FORMAL_MEMBER','ALL_MEMBERS']},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}});
   if(!contract)throw new UnprocessableEntityException({code:'FORMAL_CONTRACT_VERSION_INVALID'});
   let legalEntityId:string|null=null;
   if(normalized.applicantType==='LEGAL_ENTITY'){
    let entity=await tx.legalEntity.findUnique({where:{registrationNo:normalized.legalEntityRegistrationNo}});
    if(entity&&entity.registeredName!==normalized.legalEntityName)throw new ConflictException({code:'LEGAL_ENTITY_REGISTRATION_CONFLICT'});
    if(!entity)entity=await tx.legalEntity.create({data:{registeredName:normalized.legalEntityName,registrationNo:normalized.legalEntityRegistrationNo,registeredAddress:normalized.legalEntityRegisteredAddress,registrationCountryCode:normalized.legalEntityRegistrationCountryCode,status:'DRAFT'}});
    legalEntityId=entity.legalEntityId;
    const currentRep=await tx.legalEntityRepresentative.findFirst({where:{legalEntityId,effectiveTo:null,roleCode:'PRIMARY_OPERATING_REPRESENTATIVE'}});
    if(currentRep&&currentRep.personId!==representative.personId)throw new ConflictException({code:'LEGAL_ENTITY_REPRESENTATIVE_CONFLICT'});
    if(!currentRep)await tx.legalEntityRepresentative.create({data:{legalEntityId,personId:representative.personId,roleCode:'PRIMARY_OPERATING_REPRESENTATIVE',effectiveFrom:now}});
   }
   const open=await tx.formalMemberApplication.findFirst({where:{personId:representative.personId,status:{in:['DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFO'] as any}}});
   if(open)throw new ConflictException({code:'FORMAL_APPLICATION_ALREADY_OPEN'});
   const encrypted=this.pii.encrypt(normalized),payloadHash=createHash('sha256').update(JSON.stringify(normalized)).digest('hex');
   const app=await tx.formalMemberApplication.create({data:{
    personId:representative.personId,applicantType:normalized.applicantType,sourceChannel:'ADMIN_PAPER',paperApplicationReference:paperReference,enteredBy:actorId,enteredAt:now,
    legalEntityId,legalEntityRegistrationNo:normalized.applicantType==='LEGAL_ENTITY'?normalized.legalEntityRegistrationNo:null,
    applicantNationalityCode:primaryNationality,applicantIdentityDocumentType:primaryDocumentType,applicantIdentityFingerprint,spouseIdentityFingerprint,
    spouseVerificationStatus:normalized.hasSpouse?'PENDING':'NOT_APPLICABLE',crossLineReviewStatus:'NOT_EVALUATED',currentSnapshotHash:payloadHash,status:'DRAFT'
   }});
   await tx.formalMemberApplicationSnapshot.create({data:{formalMemberApplicationId:app.formalMemberApplicationId,version:1,payloadCiphertext:encrypted.ciphertext,keyVersion:encrypted.keyVersion,payloadHash}});
   const required=normalized.applicantType==='LEGAL_ENTITY'
    ?['SIGNED_APPLICATION_AGREEMENT','CORPORATE_REGISTRATION','REPRESENTATIVE_IDENTITY_FRONT','REPRESENTATIVE_IDENTITY_BACK','CORPORATE_BANK_PROOF']
    :['SIGNED_APPLICATION_AGREEMENT','IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'];
   await tx.formalPaperEvidence.createMany({data:required.map((evidenceType:any)=>({formalMemberApplicationId:app.formalMemberApplicationId,evidenceType,status:'PENDING'}))});
   const correlationId=randomUUID();
   await this.audit.write(tx,{actorType:'ADMIN',actorId,action:'FORMAL_PAPER_APPLICATION_ENTERED',entityType:'FormalMemberApplication',entityId:app.formalMemberApplicationId,afterData:{applicantType:normalized.applicantType,sourceChannel:'ADMIN_PAPER',paperApplicationReference:paperReference,legalEntityId},requestId,correlationId});
   return {id:app.formalMemberApplicationId,status:app.status,applicantType:app.applicantType,sourceChannel:app.sourceChannel,legalEntityId,memberNo:legalEntityId?(await tx.legalEntity.findUniqueOrThrow({where:{legalEntityId}})).memberNo:representative.memberNo,paperApplicationReference:paperReference};
  });
 }

 async reviewPaperEvidence(applicationId:string,evidenceType:string,decision:'REVIEWED'|'REJECTED',sourceReference:string|undefined,note:string|undefined,actorId:string,requestId:string){
  if(!actorId)throw new ConflictException({code:'ADMIN_PERSON_ID_REQUIRED'});
  const allowed=['SIGNED_APPLICATION_AGREEMENT','IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER','CORPORATE_REGISTRATION','REPRESENTATIVE_IDENTITY_FRONT','REPRESENTATIVE_IDENTITY_BACK','CORPORATE_BANK_PROOF','TAX_REGISTRATION','OTHER'];
  if(!allowed.includes(evidenceType))throw new UnprocessableEntityException({code:'PAPER_EVIDENCE_TYPE_INVALID'});
  const now=new Date();
  return this.db.$transaction(async tx=>{
   const app=await tx.formalMemberApplication.findUnique({where:{formalMemberApplicationId:applicationId}});
   if(!app||app.sourceChannel!=='ADMIN_PAPER')throw new NotFoundException({code:'PAPER_FORMAL_APPLICATION_NOT_FOUND'});
   const row=await tx.formalPaperEvidence.upsert({
    where:{formalMemberApplicationId_evidenceType:{formalMemberApplicationId:applicationId,evidenceType:evidenceType as any}},
    create:{formalMemberApplicationId:applicationId,evidenceType:evidenceType as any,status:decision,sourceReference,reviewedBy:actorId,reviewedAt:now,note},
    update:{status:decision,sourceReference,reviewedBy:actorId,reviewedAt:now,note},
   });
   const correlationId=randomUUID();
   await this.audit.write(tx,{actorType:'ADMIN',actorId,action:'FORMAL_PAPER_EVIDENCE_REVIEWED',entityType:'FormalPaperEvidence',entityId:row.formalPaperEvidenceId,afterData:{applicationId,evidenceType,status:decision,sourceReference:sourceReference??null},requestId,correlationId});
   return {applicationId,evidenceType:row.evidenceType,status:row.status,reviewedAt:row.reviewedAt?.toISOString()??null};
  });
 }

 private async evidenceGate(applicationId:string){
  const app=await this.db.formalMemberApplication.findUnique({where:{formalMemberApplicationId:applicationId}});
  if(!app)throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
  if(app.spouseIdentityFingerprint&&app.spouseVerificationStatus!=='VERIFIED')return {ready:false,codes:['SPOUSE_VERIFICATION_REQUIRED']};
  if(app.crossLineReviewStatus!=='CLEAR')return {ready:false,codes:['CROSS_LINE_REVIEW_CLEAR_REQUIRED']};

  if(app.sourceChannel==='ADMIN_PAPER'){
   const required=app.applicantType==='LEGAL_ENTITY'
    ?['SIGNED_APPLICATION_AGREEMENT','CORPORATE_REGISTRATION','REPRESENTATIVE_IDENTITY_FRONT','REPRESENTATIVE_IDENTITY_BACK','CORPORATE_BANK_PROOF']
    :['SIGNED_APPLICATION_AGREEMENT','IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'];
   const rows=await this.db.formalPaperEvidence.findMany({where:{formalMemberApplicationId:applicationId,evidenceType:{in:required as any}}});
   const status=new Map(rows.map(row=>[row.evidenceType,row.status]));
   const codes=required.filter(type=>status.get(type as any)!=='REVIEWED').map(type=>type+'_REVIEW_REQUIRED');
   return {ready:codes.length===0,codes};
  }

  if(app.applicantType!=='INDIVIDUAL')return {ready:false,codes:['LEGAL_ENTITY_PAPER_APPLICATION_REQUIRED']};
  const required=['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'];
  const docs=await this.db.formalApplicationDocument.findMany({where:{formalMemberApplicationId:applicationId,status:'PRESENT',documentType:{in:required as any}}});
  const status=new Map(docs.map(row=>[row.documentType,row.malwareScanStatus]));
  const codes=required.flatMap(type=>!status.has(type as any)?[type+'_MISSING']:status.get(type as any)!=='CLEAN'?[type+'_SCAN_CLEAN_REQUIRED']:[]);
  return {ready:codes.length===0,codes};
 }

 async beginReview(applicationId:string,actorId:string,requestId:string){
  if(!actorId)throw new ConflictException({code:'ADMIN_PERSON_ID_REQUIRED'});
  const gate=await this.evidenceGate(applicationId);
  if(!gate.ready)throw new UnprocessableEntityException({code:'FORMAL_REVIEW_GATE_BLOCKED',details:{codes:gate.codes}});
  const now=new Date(),app=await this.db.formalMemberApplication.findUnique({where:{formalMemberApplicationId:applicationId}});
  if(!app||!['DRAFT','NEEDS_MORE_INFO'].includes(app.status))throw new ConflictException({code:'FORMAL_APPLICATION_NOT_REVIEWABLE'});
  const updated=await this.db.formalMemberApplication.update({where:{formalMemberApplicationId:applicationId},data:{status:'UNDER_REVIEW'}});
  await this.db.$transaction(tx=>this.audit.write(tx,{actorType:'ADMIN',actorId,action:'FORMAL_APPLICATION_REVIEW_STARTED',entityType:'FormalMemberApplication',entityId:applicationId,afterData:{status:'UNDER_REVIEW'},requestId,correlationId:randomUUID()}));
  return {applicationId,status:updated.status,reviewStartedAt:now.toISOString()};
 }

 async approve(applicationId:string,actorId:string,requestId:string){
  if(!actorId)throw new ConflictException({code:'ADMIN_PERSON_ID_REQUIRED'});
  const gate=await this.evidenceGate(applicationId);
  if(!gate.ready)throw new UnprocessableEntityException({code:'FORMAL_APPROVAL_GATE_BLOCKED',details:{codes:gate.codes}});
  return this.db.$transaction(async tx=>{
   const now=new Date(),app=await tx.formalMemberApplication.findUnique({where:{formalMemberApplicationId:applicationId}});
   if(!app||app.status!=='UNDER_REVIEW')throw new ConflictException({code:'FORMAL_APPLICATION_NOT_APPROVABLE'});
   if(!app.applicantIdentityFingerprint)throw new UnprocessableEntityException({code:'FORMAL_IDENTITY_FINGERPRINT_REQUIRED'});

   const existingIdentity=await tx.formalIdentityIndex.findUnique({where:{identityDocumentFingerprint:app.applicantIdentityFingerprint}});
   if(existingIdentity&&existingIdentity.personId!==app.personId)throw new ConflictException({code:'FORMAL_IDENTITY_ALREADY_OWNED'});

   if(!existingIdentity)await tx.formalIdentityIndex.create({data:{personId:app.personId,identityDocumentFingerprint:app.applicantIdentityFingerprint,verifiedAt:now,verifiedBy:actorId,sourceFormalApplicationId:applicationId}});

   if(app.applicantType==='INDIVIDUAL'){
    const person=await tx.person.findUniqueOrThrow({where:{personId:app.personId}});
    if(person.membershipState!=='FORMAL_MEMBER'){
     await tx.person.update({where:{personId:app.personId},data:{membershipState:'FORMAL_MEMBER',status:'EFFECTIVE'}});
     await tx.personMembershipStateEvent.create({data:{personId:app.personId,fromState:person.membershipState,toState:'FORMAL_MEMBER',reasonCode:'FORMAL_APPLICATION_APPROVED',sourceType:'FORMAL_APPLICATION',sourceId:applicationId,correlationId:randomUUID()}});
    }
   }else{
    if(!app.legalEntityId)throw new UnprocessableEntityException({code:'LEGAL_ENTITY_REQUIRED'});
    await tx.legalEntity.update({where:{legalEntityId:app.legalEntityId},data:{membershipState:'FORMAL_MEMBER',status:'ACTIVE'}});
    await tx.legalEntityRepresentative.updateMany({where:{legalEntityId:app.legalEntityId,personId:app.personId,effectiveTo:null,roleCode:'PRIMARY_OPERATING_REPRESENTATIVE'},data:{verifiedAt:now,verifiedBy:actorId}});
   }

   const updated=await tx.formalMemberApplication.update({where:{formalMemberApplicationId:applicationId},data:{status:'APPROVED',reviewedAt:now,reviewerId:actorId}});
   const correlationId=randomUUID();
   await this.audit.write(tx,{actorType:'ADMIN',actorId,action:'FORMAL_APPLICATION_APPROVED',entityType:'FormalMemberApplication',entityId:applicationId,afterData:{status:'APPROVED',applicantType:app.applicantType,personId:app.personId,legalEntityId:app.legalEntityId},requestId,correlationId});
   return {applicationId,status:updated.status,applicantType:app.applicantType,personId:app.personId,legalEntityId:app.legalEntityId,qualificationCreated:false};
  });
 }

 async verifySpouse(applicationId:string,actorId:string,key:string,requestId:string){
  if(!actorId)throw new ConflictException({code:'ADMIN_PERSON_ID_REQUIRED'});
  const result=await this.idempotency.execute('admin:formal-spouse-verify:'+applicationId,key,{applicationId},async tx=>{
   const application=await tx.formalMemberApplication.findUnique({where:{formalMemberApplicationId:applicationId},include:{snapshots:{orderBy:{version:'desc'},take:1}}});
   if(!application||!application.snapshots[0])throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
   if(!application.spouseIdentityFingerprint)throw new UnprocessableEntityException({code:'FORMAL_SPOUSE_NOT_DECLARED'});
   const payload=this.pii.decrypt<any>(application.snapshots[0].payloadCiphertext,application.snapshots[0].keyVersion);
   if(!payload.hasSpouse||!payload.spouseName)throw new UnprocessableEntityException({code:'FORMAL_SPOUSE_DATA_INCOMPLETE'});
   const now=new Date(),current=await tx.spouseRelationship.findFirst({where:{personId:application.personId,effectiveTo:null,verificationStatus:'VERIFIED'},orderBy:{effectiveFrom:'desc'}});
   if(current&&current.spouseIdentityFingerprint!==application.spouseIdentityFingerprint){
    await tx.spouseRelationship.update({where:{spouseRelationshipId:current.spouseRelationshipId},data:{effectiveTo:now}});
   }
   let relationship=current&&current.spouseIdentityFingerprint===application.spouseIdentityFingerprint?current:null;
   if(!relationship){
    const masked=payload.spouseName.slice(0,1)+'*'.repeat(Math.max(payload.spouseName.length-1,1));
    relationship=await tx.spouseRelationship.create({data:{personId:application.personId,spouseIdentityFingerprint:application.spouseIdentityFingerprint,spouseNameMasked:masked,verificationStatus:'VERIFIED',effectiveFrom:now,verifiedAt:now,verifiedBy:actorId,sourceFormalApplicationId:applicationId}});
   }
   await tx.formalMemberApplication.update({where:{formalMemberApplicationId:applicationId},data:{spouseVerificationStatus:'VERIFIED',crossLineReviewStatus:'NOT_EVALUATED',crossLineConflictCode:null}});
   const correlationId=randomUUID();
   await this.audit.write(tx,{actorType:'ADMIN',actorId,action:'FORMAL_SPOUSE_VERIFIED',entityType:'FormalMemberApplication',entityId:applicationId,afterData:{spouseVerificationStatus:'VERIFIED',relationshipId:relationship.spouseRelationshipId},requestId,correlationId});
   return {applicationId,status:'VERIFIED',verifiedAt:(relationship.verifiedAt??now).toISOString()};
  });
  return {...result.value,replayed:result.replayed};
 }

 async current(personId:string){
  const application=await this.db.formalMemberApplication.findFirst({where:{personId,status:{in:['DRAFT','SUBMITTED','UNDER_REVIEW','NEEDS_MORE_INFO'] as any}},include:{snapshots:{orderBy:{version:'desc'},take:1}}});
  if(!application||!application.snapshots[0])throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
  const snapshot=application.snapshots[0],payload=this.pii.decrypt<any>(snapshot.payloadCiphertext,snapshot.keyVersion);
  return this.view(application,payload,snapshot.version);
 }

 async adminDetail(applicationId:string,actorId:string,requestId:string){
  if(!actorId)throw new ConflictException({code:'ADMIN_PERSON_ID_REQUIRED'});
  const application=await this.db.formalMemberApplication.findUnique({
   where:{formalMemberApplicationId:applicationId},
   include:{person:{select:{personId:true,memberNo:true,legalName:true,membershipState:true}},legalEntity:true,snapshots:{orderBy:{version:'desc'},take:1},paperEvidence:{orderBy:{evidenceType:'asc'}}}
  });
  if(!application||!application.snapshots[0])throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
  const snapshot=application.snapshots[0],payload=this.pii.decrypt<any>(snapshot.payloadCiphertext,snapshot.keyVersion);
  await this.db.$transaction(tx=>this.audit.write(tx,{actorType:'ADMIN',actorId,action:'FORMAL_APPLICATION_PII_VIEWED',entityType:'FormalMemberApplication',entityId:applicationId,afterData:{version:snapshot.version,applicantType:application.applicantType,sourceChannel:application.sourceChannel},requestId,correlationId:randomUUID()}));
  return {
   id:application.formalMemberApplicationId,status:application.status,applicantType:application.applicantType,sourceChannel:application.sourceChannel,
   paperApplicationReference:application.paperApplicationReference,enteredAt:application.enteredAt?.toISOString()??null,
   person:application.person,
   legalEntity:application.legalEntity?{legalEntityId:application.legalEntity.legalEntityId,memberNo:application.legalEntity.memberNo,registeredName:application.legalEntity.registeredName,registrationNo:application.legalEntity.registrationNo,registrationCountryCode:application.legalEntity.registrationCountryCode,status:application.legalEntity.status,membershipState:application.legalEntity.membershipState}:null,
   spouseVerificationStatus:application.spouseVerificationStatus,crossLineReviewStatus:application.crossLineReviewStatus,crossLineConflictCode:application.crossLineConflictCode,
   version:snapshot.version,payload,paperEvidence:application.paperEvidence.map(row=>({id:row.formalPaperEvidenceId,type:row.evidenceType,status:row.status,sourceReference:row.sourceReference,reviewedAt:row.reviewedAt?.toISOString()??null,note:row.note}))
  };
 }

 async adminList(input:{status?:string;take?:number}={}){
  const take=Math.min(Math.max(input.take??50,1),100);
  const rows=await this.db.formalMemberApplication.findMany({where:input.status?{status:input.status}:undefined,include:{person:{select:{legalName:true,membershipState:true}},snapshots:{select:{version:true,payloadHash:true},orderBy:{version:'desc'},take:1}},orderBy:{updatedAt:'desc'},take});
  return rows.map(row=>({
   id:row.formalMemberApplicationId,
   personNameMasked:row.person.legalName?(row.person.legalName.slice(0,1)+'*'.repeat(Math.max(row.person.legalName.length-1,1))):'**',
   applicantType:row.applicantType,sourceChannel:row.sourceChannel,paperApplicationReference:row.paperApplicationReference,membershipState:row.person.membershipState,status:row.status,
   spouseVerificationStatus:row.spouseVerificationStatus,crossLineReviewStatus:row.crossLineReviewStatus,crossLineConflictCode:row.crossLineConflictCode,
   version:row.snapshots[0]?.version??null,payloadHash:row.snapshots[0]?.payloadHash??row.currentSnapshotHash,
   createdAt:row.createdAt.toISOString(),updatedAt:row.updatedAt.toISOString(),submittedAt:row.submittedAt?.toISOString()??null,reviewedAt:row.reviewedAt?.toISOString()??null,decisionReasonCode:row.decisionReasonCode,
  }));
 }
}
