import { ConflictException, Injectable, ServiceUnavailableException, UnprocessableEntityException } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import { createHmac, randomUUID } from 'node:crypto';
import { IdempotencyService } from '../../common/idempotency/idempotency.service';
import { OtpCodeService } from './otp-code.service';
import { SmsOtpProviderService } from './sms-otp-provider.service';

@Injectable()
export class OtpService {
 constructor(private readonly db:PrismaService,private readonly idempotency:IdempotencyService,private readonly codes:OtpCodeService,private readonly provider:SmsOtpProviderService){}
 private secret(){const value=process.env.OTP_HASH_SECRET;if(!value||value.length<32)throw new ServiceUnavailableException({code:'OTP_CONFIGURATION_PENDING'});return value;}
 private hash(value:string){return createHmac('sha256',this.secret()).update(value).digest('hex');}
 async create(input:{purpose:'NETWORK_REGISTRATION'|'MOBILE_CHANGE'|'ACCOUNT_RECOVERY';destination:string;registrationSessionId?:string;personId?:string},key:string){
  if(input.purpose!=='NETWORK_REGISTRATION'||!input.registrationSessionId||input.personId)throw new UnprocessableEntityException({code:'OTP_AUTHENTICATED_FLOW_REQUIRED'});
  const subjectCount=Number(Boolean(input.personId))+Number(Boolean(input.registrationSessionId));
  if(subjectCount!==1)throw new UnprocessableEntityException({code:'OTP_SUBJECT_REQUIRED'});
  try{const result=await this.idempotency.execute(`otp:create:${input.personId??input.registrationSessionId}`,key,input,async tx=>{
   const now=new Date(),fingerprint=this.hash(input.destination),hourAgo=new Date(now.getTime()-3600000),dayAgo=new Date(now.getTime()-86400000);
   const [latest,hourCount,dayCount]=await Promise.all([
    tx.otpChallenge.findFirst({where:{destinationFingerprint:fingerprint},orderBy:{createdAt:'desc'}}),
    tx.otpChallenge.count({where:{destinationFingerprint:fingerprint,createdAt:{gte:hourAgo}}}),
    tx.otpChallenge.count({where:{destinationFingerprint:fingerprint,createdAt:{gte:dayAgo}}}),
   ]);
   if(latest&&latest.resendAvailableAt>now)throw new UnprocessableEntityException({code:'OTP_RESEND_COOLDOWN'});
   if(hourCount>=5||dayCount>=10)throw new UnprocessableEntityException({code:'OTP_RATE_LIMITED'});
   const challengeId=randomUUID(),code=this.codes.generate(),correlationId=randomUUID();
   const delivery=await this.provider.send(input.destination,code);
   const row=await tx.otpChallenge.create({data:{otpChallengeId:challengeId,personId:input.personId,registrationSessionId:input.registrationSessionId,purpose:input.purpose,destinationFingerprint:fingerprint,codeHash:this.hash(`${challengeId}:${code}`),providerRef:delivery.providerRef,expiresAt:new Date(now.getTime()+300000),resendAvailableAt:new Date(now.getTime()+60000),correlationId}});
   return {challengeId:row.otpChallengeId,status:row.status,expiresAt:row.expiresAt.toISOString(),resendAvailableAt:row.resendAvailableAt.toISOString()};
  });return {...result.value,replayed:result.replayed};}catch(error){if((error as any).code==='P2034')throw new ConflictException({code:'RETRYABLE_CONFLICT'});throw error;}
 }
 async verify(challengeId:string,code:string){
  const result=await this.db.$transaction(async tx=>{
   const rows=await tx.$queryRaw<Array<{status:string;codeHash:string;attemptCount:number;expiresAt:Date;verifiedAt:Date|null}>>`SELECT status,code_hash AS "codeHash",attempt_count AS "attemptCount",expires_at AS "expiresAt",verified_at AS "verifiedAt" FROM identity.otp_challenge WHERE otp_challenge_id=${challengeId}::uuid FOR UPDATE`;
   const row=rows[0];if(!row)return {error:'OTP_CHALLENGE_NOT_FOUND'};
   if(row.status==='VERIFIED')return {status:'VERIFIED',verifiedAt:row.verifiedAt!.toISOString(),replayed:true};
   if(row.status==='LOCKED')return {error:'OTP_CHALLENGE_LOCKED'};
   const now=new Date();if(row.status==='EXPIRED'||row.expiresAt<=now){await tx.otpChallenge.update({where:{otpChallengeId:challengeId},data:{status:'EXPIRED'}});return {error:'OTP_CHALLENGE_EXPIRED'};}
   if(this.hash(`${challengeId}:${code}`)!==row.codeHash){const attempts=row.attemptCount+1,locked=attempts>=5;await tx.otpChallenge.update({where:{otpChallengeId:challengeId},data:{attemptCount:attempts,...(locked?{status:'LOCKED',lockedAt:now}:{})}});return {error:locked?'OTP_CHALLENGE_LOCKED':'OTP_CODE_INVALID',attemptsRemaining:Math.max(0,5-attempts)};}
   const updated=await tx.otpChallenge.update({where:{otpChallengeId:challengeId},data:{status:'VERIFIED',verifiedAt:now}});return {status:'VERIFIED',verifiedAt:updated.verifiedAt!.toISOString(),replayed:false};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if('error' in result)throw new UnprocessableEntityException(result);return result;
 }
}
