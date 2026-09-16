import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { QualificationAccessService } from '../auth/qualification-access.service';

type ShareTokenPayload={version:1;qualificationId:string;issuedAt:string;expiresAt:string};

@Injectable()
export class MemberShareLinkService {
 constructor(private readonly access:QualificationAccessService){}
 private configuration(){
  const secret=process.env.MEMBER_SHARE_TOKEN_SECRET;
  const base=process.env.MEMBER_REFERRAL_BASE_URL;
  const ttl=Number(process.env.MEMBER_SHARE_TOKEN_TTL_SECONDS);
  if(!secret||secret.length<32||!base||!Number.isSafeInteger(ttl)||ttl<=0)throw new ServiceUnavailableException({code:'MEMBER_SHARE_CONFIGURATION_PENDING'});
  let url:URL;try{url=new URL(base);}catch{throw new ServiceUnavailableException({code:'MEMBER_SHARE_CONFIGURATION_INVALID'});}
  if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new ServiceUnavailableException({code:'MEMBER_SHARE_CONFIGURATION_INVALID'});
  return {key:createHash('sha256').update(secret).digest(),url,ttl};
 }
 async create(personId:string,qualificationId:string,now=new Date()){
  await this.access.assertHolder(personId,qualificationId,now);
  const {key,url,ttl}=this.configuration(),iv=randomBytes(12),expiresAt=new Date(now.getTime()+ttl*1000);
  const payload:ShareTokenPayload={version:1,qualificationId,issuedAt:now.toISOString(),expiresAt:expiresAt.toISOString()};
  const cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]),tag=cipher.getAuthTag();
  const token=Buffer.concat([iv,tag,encrypted]).toString('base64url');
  return {qualificationId,shareUrl:new URL(`/r/${token}`,url).toString(),expiresAt:expiresAt.toISOString()};
 }
 verify(token:string,now=new Date()){
  const {key}=this.configuration();
  try{
   const bytes=Buffer.from(token,'base64url');if(bytes.length<29)throw new Error('short');
   const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));
   const payload=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8')) as ShareTokenPayload;
   if(payload.version!==1||!payload.qualificationId||new Date(payload.expiresAt)<=now)throw new Error('invalid');
   return payload;
  }catch{throw new ServiceUnavailableException({code:'MEMBER_SHARE_TOKEN_INVALID'});}
 }
}
