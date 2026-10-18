import {ConflictException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {PrismaService} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {SmsNotificationService} from './sms-notification.service';
import {AuditService} from '../../common/audit/audit.service';
@Injectable() export class EngagementNotificationService{
 constructor(private db:PrismaService,private config:ConfigService,private sms:SmsNotificationService,private audit:AuditService){}
 async notify(kind:'EVENT'|'COURSE',code:string,input:{memberNo:string;channel:'SMS'|'LINE';message:string},actor:string,key:string){
  const person=await this.db.person.findFirst({where:{memberNo:input.memberNo,status:'EFFECTIVE',securityStatus:'NORMAL'}});
  if(!person)throw new NotFoundException('NOTIFICATION_MEMBER_NOT_FOUND');
  const registration=kind==='EVENT'?await this.db.memberEventRegistration.findFirst({where:{personId:person.personId,event:{eventCode:code,status:'PUBLISHED'},status:{not:'CANCELLED'}}}):await this.db.learningEnrollment.findFirst({where:{personId:person.personId,course:{courseCode:code,status:'PUBLISHED'},status:{not:'CANCELLED'}}});
  if(!registration)throw new ConflictException('NOTIFICATION_REGISTRATION_REQUIRED');
  if(input.channel==='SMS'){
   const draft=await this.sms.draft(actor,{memberNos:[input.memberNo],message:input.message},key);
   const result=await this.sms.send(actor,draft.id,draft.contentHash,draft.recipientCount);
   return {status:result.status,channel:'SMS',memberNo:input.memberNo};
  }
  const token=this.config.get<string>('LINE_CHANNEL_ACCESS_TOKEN')??this.config.get<string>('LINE_MESSAGING_CHANNEL_ACCESS_TOKEN');
  if(!token)throw new ServiceUnavailableException('LINE_NOTIFICATION_NOT_CONFIGURED');
  const binding=await this.db.identityLink.findFirst({where:{personId:person.personId,provider:'LINE',status:'ACTIVE'}});
  if(!binding)throw new ConflictException('LINE_BINDING_REQUIRED');
  const hash=createHash('sha256').update(JSON.stringify({actor,key,kind,code,...input})).digest('hex');
  const reservation=await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key},0))) AS l`;
   const prior=await tx.notificationDelivery.findFirst({where:{providerCorrelation:key,notificationType:'ENGAGEMENT_DIRECT'}});
   if(prior){if(prior.evidenceHash!==hash)throw new ConflictException('NOTIFICATION_REQUEST_CONFLICT');return {row:prior,send:false};}
   const row=await tx.notificationDelivery.create({data:{personId:person.personId,channel:'LINE',notificationType:'ENGAGEMENT_DIRECT',destinationBindingId:binding.identityLinkId,status:'FAILED',failureCode:'SUBMISSION_UNCONFIRMED',providerCorrelation:key,evidenceHash:hash,attemptCount:1,lastAttemptAt:new Date()}});
   await this.audit.write(tx,{actorType:'USER',action:'ENGAGEMENT_NOTIFICATION_REQUESTED',entityType:'NotificationDelivery',entityId:row.notificationDeliveryId,afterData:{actorReference:actor,kind,code,channel:'LINE',memberNo:input.memberNo},requestId:randomUUID(),correlationId:key});
   return {row,send:true};
  });
  if(!reservation.send)return {status:reservation.row.status==='SENT'?'SUBMITTED':'UNKNOWN',channel:'LINE',memberNo:input.memberNo};
  let accepted=false,failure='SUBMISSION_UNCONFIRMED';
  try{const response=await fetch('https://api.line.me/v2/bot/message/push',{method:'POST',signal:AbortSignal.timeout(15000),headers:{Authorization:'Bearer '+token,'Content-Type':'application/json','X-Line-Retry-Key':key},body:JSON.stringify({to:binding.providerSubject,messages:[{type:'text',text:'【UCell】'+input.message}]})});accepted=response.ok||response.status===409;if(!accepted)failure='LINE_HTTP_'+response.status;}catch{}
  await this.db.notificationDelivery.update({where:{notificationDeliveryId:reservation.row.notificationDeliveryId},data:{status:accepted?'SENT':'FAILED',failureCode:accepted?null:failure,sentAt:accepted?new Date():null}});
  return {status:accepted?'SUBMITTED':'UNKNOWN',channel:'LINE',memberNo:input.memberNo};
 }
}
