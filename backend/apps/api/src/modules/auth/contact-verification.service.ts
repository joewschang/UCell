import {ConflictException,Injectable,ServiceUnavailableException,UnprocessableEntityException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PrismaService} from '@ucell/database';
import {createHmac,randomInt,randomUUID,timingSafeEqual} from 'node:crypto';
import {SmsOtpProviderService} from './sms-otp-provider.service';
import {ContactVerificationEmailService} from './contact-verification-email.service';
import {GoogleTokenVerifierService} from './google-token-verifier.service';
import {LineTokenVerifierService} from './line-token-verifier.service';
export type ContactChannel='SMS'|'EMAIL';
export type ContactPurpose='REGISTRATION'|'PROFILE';
export function normalizeContact(channel:ContactChannel,value:string){
 const normalized=channel==='EMAIL'?value.trim().toLowerCase():value.trim().replace(/[\s()-]/g,'').replace(/^09(\d{8})$/,'+8869$1');
 if(channel==='SMS'?!/^\+[1-9][0-9]{7,14}$/.test(normalized):!/^\S+@\S+\.\S+$/.test(normalized)||normalized.length>254)throw new UnprocessableEntityException({code:'CONTACT_DESTINATION_INVALID'});
 return normalized;
}
@Injectable()
export class ContactVerificationService{
 constructor(private readonly db:PrismaService,private readonly config:ConfigService,private readonly sms:SmsOtpProviderService,private readonly email:ContactVerificationEmailService,private readonly google:GoogleTokenVerifierService,private readonly line:LineTokenVerifierService){}
 policy(){
  const setting=this.config.get<string>('CONTACT_VERIFICATION_SMS_REQUIRED');
  if(setting!==undefined&&!['true','false'].includes(setting))throw new ServiceUnavailableException({code:'CONTACT_POLICY_CONFIGURATION_INVALID'});
  if(setting==='false'&&this.config.get<string>('UCELL_ENVIRONMENT')!=='STAGE')throw new ServiceUnavailableException({code:'CONTACT_POLICY_CONFIGURATION_INVALID'});
  return {emailRequired:true as const,smsRequired:setting!=='false'};
 }
 async consumeMobile(tx:any,owner:string,purpose:ContactPurpose,destination:string,proof?:string){
  normalizeContact('SMS',destination);
  if(this.policy().smsRequired||proof)return this.consume(tx,owner,purpose,'SMS',destination,proof);
  // Email-first Stage release retains the phone as explicitly unverified.
  return null;
 }
 private hash(value:string){const secret=this.config.get<string>('OTP_HASH_SECRET');if(!secret||secret.length<32)throw new ServiceUnavailableException({code:'OTP_CONFIGURATION_PENDING'});return createHmac('sha256',secret).update(value).digest('hex');}
 async registrationOwner(input:{googleIdToken?:string;lineIdToken?:string}){
  if(Boolean(input.googleIdToken)===Boolean(input.lineIdToken))throw new UnprocessableEntityException({code:'REGISTRATION_IDENTITY_REQUIRED'});
  if(input.lineIdToken)return 'LINE:'+(await this.line.verify(input.lineIdToken)).subject;
  return 'GOOGLE:'+(await this.google.verify(input.googleIdToken!)).subject;
 }
 private context(owner:string,purpose:ContactPurpose,channel:ContactChannel,destination:string){return {subjectHash:this.hash(owner),purpose,channel,destinationHash:this.hash(channel+':'+normalizeContact(channel,destination))};}
 async send(owner:string,purpose:ContactPurpose,channel:ContactChannel,destination:string,requestKey:string){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(requestKey??''))throw new UnprocessableEntityException({code:'OTP_REQUEST_KEY_REQUIRED'});
  if(channel==='SMS'&&!this.policy().smsRequired)throw new ServiceUnavailableException({code:'SMS_PROVIDER_CONFIGURATION_PENDING'});
  const normalized=normalizeContact(channel,destination),context=this.context(owner,purpose,channel,normalized);
  channel==='SMS'?this.sms.assertConfigured():this.email.assertConfigured();
  const id=randomUUID(),code=String(randomInt(0,1000000)).padStart(6,'0'),now=new Date();
  const reserved=await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${context.subjectHash},0))) AS lock_row`;
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${context.destinationHash},0))) AS lock_row`;
   const existing=await tx.contactVerificationChallenge.findUnique({where:{subjectHash_requestKey:{subjectHash:context.subjectHash,requestKey}}});
   if(existing){if(existing.destinationHash!==context.destinationHash||existing.channel!==channel||existing.purpose!==purpose)throw new ConflictException({code:'OTP_REQUEST_KEY_CONFLICT'});return {row:existing,replayed:true};}
   const latest=await tx.contactVerificationChallenge.findFirst({where:{destinationHash:context.destinationHash},orderBy:{createdAt:'desc'}});
   if(latest&&latest.resendAt>now)throw new UnprocessableEntityException({code:'OTP_RESEND_COOLDOWN'});
   const hour=new Date(now.getTime()-3600000),day=new Date(now.getTime()-86400000);
   const [hourCount,dayCount,subjectCount]=await Promise.all([tx.contactVerificationChallenge.count({where:{destinationHash:context.destinationHash,createdAt:{gte:hour}}}),tx.contactVerificationChallenge.count({where:{destinationHash:context.destinationHash,createdAt:{gte:day}}}),tx.contactVerificationChallenge.count({where:{subjectHash:context.subjectHash,createdAt:{gte:day}}})]);
   if(hourCount>=5||dayCount>=10||subjectCount>=20)throw new UnprocessableEntityException({code:'OTP_RATE_LIMITED'});
   const row=await tx.contactVerificationChallenge.create({data:{id,...context,requestKey,codeHash:this.hash(id+':'+code),expiresAt:new Date(now.getTime()+300000),resendAt:new Date(now.getTime()+60000)}});
   return {row,replayed:false};
  });
  if(!reserved.replayed){
   try{if(channel==='SMS')await this.sms.send(normalized,code);else await this.email.send(normalized,code);await this.db.contactVerificationChallenge.update({where:{id},data:{status:'SENT'}});reserved.row.status='SENT';}
   catch(error){await this.db.contactVerificationChallenge.update({where:{id},data:{status:'FAILED'}});throw error;}
  }
  if(reserved.row.status==='FAILED')throw new ServiceUnavailableException({code:'OTP_DELIVERY_FAILED'});
  return {challengeId:reserved.row.id,status:reserved.row.status,expiresAt:reserved.row.expiresAt.toISOString(),resendAt:reserved.row.resendAt.toISOString(),replayed:reserved.replayed};
 }
 async verify(owner:string,purpose:ContactPurpose,channel:ContactChannel,destination:string,challengeId:string,code:string){
  const context=this.context(owner,purpose,channel,destination);
  const result=await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT id FROM identity.contact_verification_challenge WHERE id=${challengeId}::uuid FOR UPDATE`;
   const row=await tx.contactVerificationChallenge.findUnique({where:{id:challengeId}}),now=new Date();
   if(!row||row.subjectHash!==context.subjectHash||row.destinationHash!==context.destinationHash||row.channel!==channel||row.purpose!==purpose)return {error:'OTP_CHALLENGE_INVALID'};
   if(row.consumedAt||row.expiresAt<=now||!['SENT','VERIFIED'].includes(row.status))return {error:'OTP_CHALLENGE_EXPIRED_OR_UNAVAILABLE'};
   if(row.attempts>=5)return {error:'OTP_CHALLENGE_LOCKED'};
   const expected=Buffer.from(row.codeHash),actual=Buffer.from(this.hash(challengeId+':'+code));
   if(!/^\d{6}$/.test(code)||!timingSafeEqual(expected,actual)){await tx.contactVerificationChallenge.update({where:{id:challengeId},data:{attempts:{increment:1}}});return {error:row.attempts>=4?'OTP_CHALLENGE_LOCKED':'OTP_CODE_INVALID'};}
   const proof=this.hash('proof:'+challengeId+':'+code);
   await tx.contactVerificationChallenge.update({where:{id:challengeId},data:{status:'VERIFIED',verifiedAt:row.verifiedAt??now,proofHash:this.hash(proof)}});
   return {proof,expiresAt:row.expiresAt.toISOString()};
  });
  if('error' in result)throw new UnprocessableEntityException({code:result.error});return result;
 }
 async consume(tx:any,owner:string,purpose:ContactPurpose,channel:ContactChannel,destination:string,proof?:string){
  if(!proof)throw new UnprocessableEntityException({code:channel==='SMS'?'MOBILE_VERIFICATION_REQUIRED':'EMAIL_VERIFICATION_REQUIRED'});
  const context=this.context(owner,purpose,channel,destination),proofHash=this.hash(proof);
  const changed=await tx.contactVerificationChallenge.updateMany({where:{...context,proofHash,status:'VERIFIED',consumedAt:null,expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}});
  if(changed.count!==1)throw new UnprocessableEntityException({code:'CONTACT_VERIFICATION_PROOF_INVALID'});
  const row=await tx.contactVerificationChallenge.findUniqueOrThrow({where:{proofHash}});
  return row.verifiedAt as Date;
 }
}
