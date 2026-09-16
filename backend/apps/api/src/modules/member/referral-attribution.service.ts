import {ConflictException,Injectable,ServiceUnavailableException} from '@nestjs/common';
import {Prisma,PrismaService} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {MemberShareLinkService} from './member-share-link.service';

const LOCK_WINDOW_MS=30*24*60*60*1000;

@Injectable()
export class ReferralAttributionService {
 constructor(private readonly db:PrismaService,private readonly links:MemberShareLinkService){}

 async land(token:string,anonymousId:string=randomUUID(),now=new Date()){
  const payload=this.links.verify(token,now),tokenHash=this.links.hash(token),correlationId=randomUUID();
  try{return await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${anonymousId},0))) AS lock_row`;
   const link=await tx.referralLink.findUnique({where:{tokenHash}});
   if(!link||link.status!=='ACTIVE'||link.expiresAt<=now||link.referrerQualificationId!==payload.qualificationId)throw new ServiceUnavailableException({code:'MEMBER_SHARE_TOKEN_INVALID'});
   const current=await tx.referralAttribution.findUnique({where:{anonymousId}});
   if(!current){
    const lockedUntil=new Date(now.getTime()+LOCK_WINDOW_MS);
    const created=await tx.referralAttribution.create({data:{anonymousId,referrerQualificationId:link.referrerQualificationId,referralLinkId:link.referralLinkId,firstTouchAt:now,lastTouchAt:now,lockedUntil}});
    await tx.referralAttributionHistory.create({data:{referralAttributionId:created.referralAttributionId,action:'CREATED',newReferrerQualificationId:link.referrerQualificationId,reasonCode:'FIRST_VALID_TOUCH',referralLinkId:link.referralLinkId,correlationId,occurredAt:now}});
    return this.view(created,true,false,'FIRST_VALID_TOUCH',link.policyVersion);
   }
   if(current.referrerQualificationId===link.referrerQualificationId){
    const updated=await tx.referralAttribution.update({where:{referralAttributionId:current.referralAttributionId},data:{lastTouchAt:now,referralLinkId:link.referralLinkId,version:{increment:1}}});
    await tx.referralAttributionHistory.create({data:{referralAttributionId:current.referralAttributionId,action:'TOUCH_RECORDED',previousReferrerQualificationId:current.referrerQualificationId,newReferrerQualificationId:link.referrerQualificationId,reasonCode:'SAME_REFERRER_LOCK_UNCHANGED',referralLinkId:link.referralLinkId,correlationId,occurredAt:now}});
    return this.view(updated,true,false,'SAME_REFERRER_LOCK_UNCHANGED',link.policyVersion);
   }
   if(now<current.lockedUntil){
    await tx.referralAttributionHistory.create({data:{referralAttributionId:current.referralAttributionId,action:'COMPETING_TOUCH_RECORDED',previousReferrerQualificationId:current.referrerQualificationId,newReferrerQualificationId:link.referrerQualificationId,reasonCode:'ATTRIBUTION_LOCK_ACTIVE',referralLinkId:link.referralLinkId,correlationId,occurredAt:now}});
    return this.view(current,false,false,'ATTRIBUTION_LOCK_ACTIVE',link.policyVersion);
   }
   const lockedUntil=new Date(now.getTime()+LOCK_WINDOW_MS);
   const replaced=await tx.referralAttribution.update({where:{referralAttributionId:current.referralAttributionId},data:{referrerQualificationId:link.referrerQualificationId,referralLinkId:link.referralLinkId,firstTouchAt:now,lastTouchAt:now,lockedUntil,version:{increment:1}}});
   await tx.referralAttributionHistory.create({data:{referralAttributionId:current.referralAttributionId,action:'REPLACED',previousReferrerQualificationId:current.referrerQualificationId,newReferrerQualificationId:link.referrerQualificationId,reasonCode:'ATTRIBUTION_LOCK_EXPIRED',referralLinkId:link.referralLinkId,correlationId,occurredAt:now}});
   return this.view(replaced,true,true,'ATTRIBUTION_LOCK_EXPIRED',link.policyVersion);
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}
  catch(error){if((error as any).code==='P2034')throw new ConflictException({code:'RETRYABLE_CONFLICT'});throw error;}
 }

 private view(row:any,accepted:boolean,replaced:boolean,reasonCode:string,policyVersion:string){return {anonymousId:row.anonymousId,referralAttributionId:row.referralAttributionId,referrerQualificationId:row.referrerQualificationId,firstTouchAt:row.firstTouchAt.toISOString(),lastTouchAt:row.lastTouchAt.toISOString(),lockedUntil:row.lockedUntil.toISOString(),accepted,replaced,reasonCode,policyVersion};}
}
