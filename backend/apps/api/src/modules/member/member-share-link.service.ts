import {currentShareTarget,ShareTarget} from '../content/share-target';
import {currentContent} from '../content/content-visibility';
import { Injectable, ServiceUnavailableException, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { PrismaService } from '@ucell/database';
import { QualificationAccessService } from '../auth/qualification-access.service';

type ShareTokenPayload={version:1;qualificationId:string;issuedAt:string;expiresAt:string;contentId?:string;contentVersionId?:string;productSku?:string;eventCode?:string};
type TransitionPayload={version:1;kind:'REFERRAL_TRANSITION';anonymousId:string;referralAttributionId:string;referrerQualificationId:string;attributionVersion:number;issuedAt:string;expiresAt:string};

@Injectable()
export class MemberShareLinkService {
 constructor(private readonly access:QualificationAccessService,private readonly db:PrismaService){}
 private configuration(){
  const secret=process.env.MEMBER_SHARE_TOKEN_SECRET;
  const base=process.env.MEMBER_REFERRAL_BASE_URL;
  const ttl=Number(process.env.MEMBER_SHARE_TOKEN_TTL_SECONDS);
  if(!secret||secret.length<32||!base||!Number.isSafeInteger(ttl)||ttl<=0)throw new ServiceUnavailableException({code:'MEMBER_SHARE_CONFIGURATION_PENDING'});
  let url:URL;try{url=new URL(base);}catch{throw new ServiceUnavailableException({code:'MEMBER_SHARE_CONFIGURATION_INVALID'});}
  if(url.protocol!=='https:'&&!['localhost','127.0.0.1'].includes(url.hostname))throw new ServiceUnavailableException({code:'MEMBER_SHARE_CONFIGURATION_INVALID'});
  return {key:createHash('sha256').update(secret).digest(),url,ttl};
 }
 async create(personId:string,qualificationId:string,now=new Date(),contentId?:string,target:ShareTarget={}){
  await this.access.assertHolder(personId,qualificationId,now);
  if([contentId,target.productSku,target.eventCode].filter(Boolean).length>1)throw new UnprocessableEntityException({code:'SHARE_TARGET_AMBIGUOUS'});
  const resource=await currentShareTarget(this.db,target,now);
  if((target.productSku||target.eventCode)&&!resource)throw new UnprocessableEntityException({code:'SHARE_TARGET_UNAVAILABLE'});
  const content=contentId?await currentContent(this.db,contentId,now):null;
  if(contentId&&(!content||!content.shareable||!['PUBLIC','NETWORK_MEMBER'].includes(content.audiencePolicy)))throw new UnprocessableEntityException({code:'CONTENT_NOT_SHAREABLE'});
  const {key,url,ttl}=this.configuration(),iv=randomBytes(12),expiresAt=new Date(now.getTime()+ttl*1000);
  const payload:ShareTokenPayload={version:1,qualificationId,issuedAt:now.toISOString(),expiresAt:expiresAt.toISOString(),...(resource?target:{}),...(content?{contentId:content.id,contentVersionId:content.versionId}:{})};
  const cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]),tag=cipher.getAuthTag();
  const token=Buffer.concat([iv,tag,encrypted]).toString('base64url');
  const data={tokenHash:this.hash(token),referrerQualificationId:qualificationId,policyVersion:'NR-DEC-003-V1',createdAt:now,expiresAt};
  if(content||resource)await this.db.$transaction(async tx=>{
   const link=await tx.referralLink.create({data});
   if(content)await tx.$executeRaw`INSERT INTO integration.content_share_link (referral_link_id,content_id,content_version_id) VALUES (${link.referralLinkId}::uuid,${content.id}::uuid,${content.versionId}::uuid)`;
  if(resource)await tx.$executeRaw`INSERT INTO integration.resource_share_link (referral_link_id,target_type,target_reference) VALUES (${link.referralLinkId}::uuid,${resource.kind},${resource.reference})`;
  });else await this.db.referralLink.create({data});
  return {qualificationId,shareUrl:new URL(`/r/${token}`,url).toString(),expiresAt:expiresAt.toISOString()};
 }
 async preview(token:string,now=new Date()){
  const payload=this.verify(token,now),link=await this.db.referralLink.findUnique({where:{tokenHash:this.hash(token)}});
  if(!link||link.status!=='ACTIVE'||link.expiresAt<=now||link.referrerQualificationId!==payload.qualificationId)throw new NotFoundException({code:'SHARE_LINK_UNAVAILABLE'});
  if(payload.productSku||payload.eventCode){const resource=await currentShareTarget(this.db,payload,now);if(!resource)throw new NotFoundException({code:'SHARE_TARGET_UNAVAILABLE'});return {content:null,resource,requiresLogin:false,expiresAt:link.expiresAt.toISOString(),destination:resource.destination};}
  if(!payload.contentId)return {content:null,requiresLogin:false,expiresAt:link.expiresAt.toISOString(),destination:'/'};
  const row=await currentContent(this.db,payload.contentId,now);
  if(!row||!row.shareable||!['PUBLIC','NETWORK_MEMBER'].includes(row.audiencePolicy))throw new NotFoundException({code:'SHARE_CONTENT_UNAVAILABLE'});
  return {content:row.audiencePolicy==='PUBLIC'?row:null,requiresLogin:row.audiencePolicy!=='PUBLIC',expiresAt:link.expiresAt.toISOString(),destination:'/content/'+row.id};
 }
 async revoke(personId:string,qualificationId:string,id:string){await this.access.assertHolder(personId,qualificationId);const result=await this.db.referralLink.updateMany({where:{referralLinkId:id,referrerQualificationId:qualificationId,status:'ACTIVE'},data:{status:'REVOKED'}});return {revoked:result.count>0};}
 hash(token:string){return createHash('sha256').update(token).digest('hex');}
 createTransition(input:{anonymousId:string;referralAttributionId:string;referrerQualificationId:string;attributionVersion:number;issuedAt:Date;expiresAt:Date}){
  const {key}=this.configuration(),iv=randomBytes(12),payload:TransitionPayload={version:1,kind:'REFERRAL_TRANSITION',anonymousId:input.anonymousId,referralAttributionId:input.referralAttributionId,referrerQualificationId:input.referrerQualificationId,attributionVersion:input.attributionVersion,issuedAt:input.issuedAt.toISOString(),expiresAt:input.expiresAt.toISOString()};
  const cipher=createCipheriv('aes-256-gcm',key,iv),encrypted=Buffer.concat([cipher.update(JSON.stringify(payload),'utf8'),cipher.final()]),tag=cipher.getAuthTag();
  return Buffer.concat([iv,tag,encrypted]).toString('base64url');
 }
 verifyTransition(token:string,now=new Date()){
  const {key}=this.configuration();
  try{
   if(!/^[A-Za-z0-9_-]{1,4096}$/.test(token))throw new Error('format');
   const bytes=Buffer.from(token,'base64url');if(bytes.length<29)throw new Error('short');
   const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));
   const payload=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8')) as TransitionPayload;
   const issuedAt=new Date(payload.issuedAt),expiresAt=new Date(payload.expiresAt);
   if(payload.version!==1||payload.kind!=='REFERRAL_TRANSITION'||!payload.anonymousId||!payload.referralAttributionId||!payload.referrerQualificationId||!Number.isSafeInteger(payload.attributionVersion)||payload.attributionVersion<1||!Number.isFinite(issuedAt.getTime())||!Number.isFinite(expiresAt.getTime())||issuedAt>now||expiresAt<=issuedAt||expiresAt<=now)throw new Error('invalid');
   return payload;
  }catch{throw new ServiceUnavailableException({code:'REFERRAL_TRANSITION_INVALID'});}
 }
 verify(token:string,now=new Date()){
  const {key}=this.configuration();
  try{
   if(!/^[A-Za-z0-9_-]{1,4096}$/.test(token))throw new Error('format');
   const bytes=Buffer.from(token,'base64url');if(bytes.length<29)throw new Error('short');
   const decipher=createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));decipher.setAuthTag(bytes.subarray(12,28));
   const payload=JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)),decipher.final()]).toString('utf8')) as ShareTokenPayload;
   const issuedAt=new Date(payload.issuedAt),expiresAt=new Date(payload.expiresAt);
   if(payload.version!==1||!payload.qualificationId||!Number.isFinite(issuedAt.getTime())||!Number.isFinite(expiresAt.getTime())||issuedAt>now||expiresAt<=issuedAt||expiresAt<=now)throw new Error('invalid');
   return payload;
  }catch{throw new ServiceUnavailableException({code:'MEMBER_SHARE_TOKEN_INVALID'});}
 }
}
