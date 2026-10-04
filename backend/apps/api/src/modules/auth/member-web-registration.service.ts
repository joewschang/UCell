import { ConflictException,Injectable,UnauthorizedException,UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { createHash,randomBytes,randomUUID,scryptSync } from 'node:crypto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { IdentityTokenService } from './identity-token.service';
import { GoogleTokenVerifierService } from './google-token-verifier.service';
import {LineTokenVerifierService} from './line-token-verifier.service';
import {ContactVerificationService} from './contact-verification.service';
import {PiiCryptoService} from '../../common/security/pii-crypto.service';
import {IdentityMatchFingerprintService} from '../../common/security/identity-match-fingerprint.service';

export type WebRegistrationInput={
 contractVersionId:string;accepted:true;legalName:string;alias:string;gender:string;
 birthDate:string;mobile:string;email:string;password:string;googleIdToken?:string;lineIdToken?:string;
 nationalityCode:string;identityDocumentType:'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';identityDocumentNumber:string;
 mobileVerificationProof?:string;emailVerificationProof?:string;
};

@Injectable()
export class MemberWebRegistrationService{
 constructor(private readonly db:PrismaService,private readonly idempotency:IdempotencyService,private readonly google:GoogleTokenVerifierService,private readonly pii:PiiCryptoService,private readonly fingerprint:IdentityMatchFingerprintService,private readonly line?:LineTokenVerifierService,private readonly contacts?:ContactVerificationService){}

 async requiredContract(){
  const now=new Date();
  const contract=await this.db.contractDocumentVersion.findFirst({where:{required:true,audience:{in:['NETWORK_MEMBER','ALL_MEMBERS']},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},orderBy:{effectiveFrom:'desc'}});
  if(!contract)throw new UnprocessableEntityException({code:'NETWORK_CONTRACT_NOT_CONFIGURED'});
  return {contractVersionId:contract.contractDocumentVersionId,title:contract.title,versionCode:contract.versionCode,contentText:contract.contentText,contentHash:contract.contentHash};
 }

 private passwordHash(password:string){
  if(password.length<12||password.length>256)throw new UnprocessableEntityException({code:'PASSWORD_POLICY'});
  const salt=randomBytes(16).toString('base64url');
  const key=scryptSync(password,salt,32,{N:16384,r:8,p:1,maxmem:64*1024*1024});
  return `scrypt$16384$8$1$${salt}$${key.toString('base64url')}`;
 }

 async complete(input:WebRegistrationInput,key:string){
  if(!input.googleIdToken&&!input.lineIdToken)throw new UnauthorizedException({code:'GOOGLE_REGISTRATION_REQUIRED'});
  if(input.googleIdToken&&input.lineIdToken)throw new UnauthorizedException({code:'REGISTRATION_IDENTITY_AMBIGUOUS'});
  const provider=input.lineIdToken?'LINE' as const:'GOOGLE' as const;
  if(provider==='LINE'&&!this.line)throw new UnauthorizedException({code:'LINE_TOKEN_INVALID'});
  const identity:{subject:string;email?:string;emailVerified?:boolean;displayName?:string}=provider==='LINE'?await this.line!.verify(input.lineIdToken!):await this.google.verify(input.googleIdToken!);
  if(provider==='GOOGLE'){
   if(!identity.email||identity.emailVerified!==true)throw new UnauthorizedException({code:'GOOGLE_VERIFIED_EMAIL_REQUIRED'});
   if(identity.email.trim().toLowerCase()!==input.email.trim().toLowerCase())throw new UnprocessableEntityException({code:'GOOGLE_EMAIL_MISMATCH'});
  }
  const birthDate=new Date(`${input.birthDate}T00:00:00.000Z`);
  if(!Number.isFinite(birthDate.getTime())||birthDate>=new Date())throw new UnprocessableEntityException({code:'INVALID_BIRTH_DATE'});
  const nationalityCode=input.nationalityCode.trim().toUpperCase();
  const identityDocumentNumber=this.fingerprint.normalizeIdentityDocumentNumber(input.identityDocumentNumber);
  const identityDocumentFingerprint=this.fingerprint.fingerprintIdentityDocument(nationalityCode,input.identityDocumentType,identityDocumentNumber);
  const encrypted=this.pii.encrypt(identityDocumentNumber);
  const result=await this.idempotency.execute(`registration:web:${provider.toLowerCase()}:${identity.subject}`,key,{...input,identityDocumentNumber:undefined,identityDocumentFingerprint,googleIdToken:input.googleIdToken?'[REDACTED]':undefined,lineIdToken:input.lineIdToken?'[REDACTED]':undefined},async tx=>{
    const now=new Date(),correlationId=randomUUID();
    if(!this.contacts)throw new UnprocessableEntityException({code:'CONTACT_VERIFICATION_REQUIRED'});
    const owner=provider+':'+identity.subject;
    const mobileVerifiedAt=await this.contacts.consumeMobile(tx,owner,'REGISTRATION',input.mobile,input.mobileVerificationProof);
    const emailVerifiedAt=await this.contacts.consume(tx,owner,'REGISTRATION','EMAIL',input.email,input.emailVerificationProof);
    if(await tx.person.findFirst({where:{email:{equals:input.email,mode:'insensitive'}},select:{personId:true}}))throw new ConflictException({code:'EMAIL_ALREADY_REGISTERED'});
    const existingIdentity=await tx.identityLink.findUnique({where:{provider_providerSubject:{provider,providerSubject:identity.subject}}});
    if(existingIdentity)throw new ConflictException({code:`${provider}_IDENTITY_ALREADY_LINKED`});
    if(await tx.person.findFirst({where:{identityDocumentFingerprint},select:{personId:true}}))throw new ConflictException({code:'IDENTITY_DOCUMENT_ALREADY_REGISTERED'});
    if(await tx.person.findFirst({where:{mobile:input.mobile},select:{personId:true}}))throw new ConflictException({code:'MOBILE_ALREADY_REGISTERED'});
    const contract=await tx.contractDocumentVersion.findFirst({where:{contractDocumentVersionId:input.contractVersionId,required:true,audience:{in:['NETWORK_MEMBER','ALL_MEMBERS']},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}});
    if(!contract||input.accepted!==true)throw new UnprocessableEntityException({code:'REQUIRED_CONTRACT_VERSION_INVALID'});
    const person=await tx.person.create({data:{legalName:input.legalName,preferredName:input.alias,genderCode:input.gender,birthDate,nationalityCode,identityDocumentType:input.identityDocumentType,identityDocumentNumberCiphertext:encrypted.ciphertext,identityDocumentKeyVersion:encrypted.keyVersion,identityDocumentFingerprint,mobile:input.mobile,email:input.email.trim().toLowerCase(),membershipState:'NETWORK_MEMBER',mobileVerifiedAt,emailVerifiedAt,status:'EFFECTIVE'}});
    await tx.identityLink.create({data:{personId:person.personId,provider,providerSubject:identity.subject,email:identity.email,displayName:identity.displayName}});
    await tx.memberPasswordCredential.create({data:{personId:person.personId,passwordHash:this.passwordHash(input.password)}});
    const evidenceHash=createHash('sha256').update(JSON.stringify({personId:person.personId,contractVersionId:contract.contractDocumentVersionId,contentHash:contract.contentHash,channel:'MEMBER_WEB',correlationId})).digest('hex');
    await tx.consentEvidence.create({data:{personId:person.personId,contractDocumentVersionId:contract.contractDocumentVersionId,contentHashSnapshot:contract.contentHash,channel:'MEMBER_WEB',requestId:correlationId,correlationId,evidenceHash}});
    await tx.personMembershipStateEvent.create({data:{personId:person.personId,toState:'NETWORK_MEMBER',reasonCode:`WEB_${provider}_NETWORK_REGISTRATION_COMPLETED`,sourceType:`WEB_${provider}_REGISTRATION`,correlationId}});
    const session=await new IdentityTokenService(tx as any).issue({provider,subject:identity.subject,personId:person.personId,ttlSeconds:3600});
    return {memberNo:person.memberNo,membershipState:'NETWORK_MEMBER',qualificationCreated:false,...session};
  }).catch(error=>{
    if(['P2034','P2002'].includes(error?.code))throw new ConflictException({code:'RETRYABLE_CONFLICT'});
    throw error;
  });
  return {...result.value,replayed:result.replayed};
 }
}
