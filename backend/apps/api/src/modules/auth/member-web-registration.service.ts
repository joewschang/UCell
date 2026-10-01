import { ConflictException,Injectable,UnauthorizedException,UnprocessableEntityException } from '@nestjs/common';
import { Prisma,PrismaService } from '@ucell/database';
import { createHash,createHmac,randomUUID } from 'node:crypto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { OtpService } from './otp.service';
import { IdentityTokenService } from './identity-token.service';

export type WebRegistrationInput={
 registrationSessionId:string;challengeId:string;contractVersionId:string;accepted:true;
 legalName:string;alias:string;gender:string;birthDate:string;mobile:string;email:string;
};

@Injectable()
export class MemberWebRegistrationService{
 constructor(private readonly db:PrismaService,private readonly otp:OtpService,private readonly idempotency:IdempotencyService){}

 async requiredContract(){
  const now=new Date();
  const contract=await this.db.contractDocumentVersion.findFirst({where:{required:true,audience:{in:['NETWORK_MEMBER','ALL_MEMBERS']},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]},orderBy:{effectiveFrom:'desc'}});
  if(!contract)throw new UnprocessableEntityException({code:'NETWORK_CONTRACT_NOT_CONFIGURED'});
  return {contractVersionId:contract.contractDocumentVersionId,title:contract.title,versionCode:contract.versionCode,contentText:contract.contentText,contentHash:contract.contentHash};
 }

 async start(registrationSessionId:string,mobile:string,key:string){
  return this.otp.create({purpose:'NETWORK_REGISTRATION',destination:mobile,registrationSessionId},key);
 }

 private destinationFingerprint(mobile:string){
  const secret=process.env.OTP_HASH_SECRET;
  if(!secret||secret.length<32)throw new UnprocessableEntityException({code:'OTP_CONFIGURATION_PENDING'});
  return createHmac('sha256',secret).update(mobile).digest('hex');
 }

 async complete(input:WebRegistrationInput,key:string){
  const birthDate=new Date(`${input.birthDate}T00:00:00.000Z`);
  if(!Number.isFinite(birthDate.getTime())||birthDate>=new Date())throw new UnprocessableEntityException({code:'INVALID_BIRTH_DATE'});
  const result=await this.idempotency.execute(`registration:web:${input.registrationSessionId}`,key,input,async tx=>{
    const now=new Date(),correlationId=randomUUID();
    const rows=await tx.$queryRaw<Array<{purpose:string;status:string;registrationSessionId:string|null;personId:string|null;destinationFingerprint:string;consumedAt:Date|null;expiresAt:Date}>>`
      SELECT purpose::text,status::text,registration_session_id AS "registrationSessionId",person_id AS "personId",destination_fingerprint AS "destinationFingerprint",consumed_at AS "consumedAt",expires_at AS "expiresAt"
      FROM identity.otp_challenge WHERE otp_challenge_id=${input.challengeId}::uuid FOR UPDATE`;
    const otp=rows[0];
    if(!otp||otp.purpose!=='NETWORK_REGISTRATION'||otp.status!=='VERIFIED'||otp.registrationSessionId!==input.registrationSessionId||otp.personId||otp.consumedAt||otp.expiresAt<=now||otp.destinationFingerprint!==this.destinationFingerprint(input.mobile))throw new UnauthorizedException({code:'REGISTRATION_OTP_INVALID'});
    if(await tx.person.findFirst({where:{mobile:input.mobile},select:{personId:true}}))throw new ConflictException({code:'MOBILE_ALREADY_REGISTERED'});
    const contract=await tx.contractDocumentVersion.findFirst({where:{contractDocumentVersionId:input.contractVersionId,required:true,audience:{in:['NETWORK_MEMBER','ALL_MEMBERS']},effectiveFrom:{lte:now},OR:[{effectiveTo:null},{effectiveTo:{gt:now}}]}});
    if(!contract||input.accepted!==true)throw new UnprocessableEntityException({code:'REQUIRED_CONTRACT_VERSION_INVALID'});
    const person=await tx.person.create({data:{legalName:input.legalName,preferredName:input.alias,genderCode:input.gender,birthDate,mobile:input.mobile,email:input.email,membershipState:'NETWORK_MEMBER',mobileVerifiedAt:now,status:'EFFECTIVE'}});
    const evidenceHash=createHash('sha256').update(JSON.stringify({personId:person.personId,contractVersionId:contract.contractDocumentVersionId,contentHash:contract.contentHash,channel:'MEMBER_WEB',correlationId})).digest('hex');
    await tx.consentEvidence.create({data:{personId:person.personId,contractDocumentVersionId:contract.contractDocumentVersionId,contentHashSnapshot:contract.contentHash,channel:'MEMBER_WEB',requestId:correlationId,correlationId,evidenceHash}});
    await tx.personMembershipStateEvent.create({data:{personId:person.personId,toState:'NETWORK_MEMBER',reasonCode:'WEB_OTP_NETWORK_REGISTRATION_COMPLETED',sourceType:'WEB_OTP_REGISTRATION',correlationId}});
    await tx.otpChallenge.update({where:{otpChallengeId:input.challengeId},data:{consumedAt:now,consumedByPersonId:person.personId}});
    const session=await new IdentityTokenService(tx as any).issue({provider:'SMS_OTP',subject:input.mobile,personId:person.personId,ttlSeconds:3600});
    return {memberNo:person.memberNo,membershipState:'NETWORK_MEMBER',qualificationCreated:false,...session};
  });
  return {...result.value,replayed:result.replayed};
 }
}
