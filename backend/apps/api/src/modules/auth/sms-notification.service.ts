import {ConflictException,Injectable,ServiceUnavailableException,UnprocessableEntityException} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {Prisma,PrismaService} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {normalizeContact} from './contact-verification.service';
import {SmsOtpProviderService} from './sms-otp-provider.service';
type Recipient={personId:string;memberNo:string;mobile:string};
type Campaign={id:string;actor_id:string;message:string;recipients:Recipient[];status:string;content_hash:string;expires_at:Date;provider_ref:string|null;failure_code:string|null;created_at:Date};
@Injectable()
export class SmsNotificationService{
 constructor(private readonly db:PrismaService,private readonly config:ConfigService,private readonly sms:SmsOtpProviderService,private readonly audit:AuditService){}
 private enabled(){if(this.config.get('SMS_NOTIFICATIONS_ENABLED')!=='true')throw new ServiceUnavailableException({code:'SMS_NOTIFICATIONS_DISABLED'});this.sms.assertConfigured();}
 private view(row:Campaign){return {id:row.id,message:row.message,status:row.status,recipientCount:row.recipients.length,recipients:row.recipients.map(r=>({memberNo:r.memberNo,mobile:r.mobile.slice(0,4)+'••••'+r.mobile.slice(-3)})),contentHash:row.content_hash,expiresAt:row.expires_at,createdAt:row.created_at,providerRef:row.provider_ref,failureCode:row.failure_code};}
 private async evidence(tx:Prisma.TransactionClient,actor:string,id:string,event:string,count:number){await this.audit.write(tx,{actorType:'USER',action:event,entityType:'SmsCampaign',entityId:id,afterData:{actorReference:actor,recipientCount:count},requestId:randomUUID(),correlationId:randomUUID()});}
 async list(){const rows=await this.db.$queryRaw<Campaign[]>`SELECT * FROM integration.sms_campaign ORDER BY created_at DESC LIMIT 50`;return rows.map(row=>this.view(row));}
 async draft(actor:string,input:{message:string;memberNos?:string[];allVerified?:boolean},key:string){
  if(!/^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(key??''))throw new UnprocessableEntityException({code:'SMS_REQUEST_KEY_INVALID'});
  this.enabled();if(!input.message.trim()||input.message.length>300||Boolean(input.allVerified)===Boolean(input.memberNos?.length))throw new UnprocessableEntityException({code:'SMS_AUDIENCE_REQUIRED'});
  const message='【UCell】'+input.message.trim();if(message.length>300)throw new UnprocessableEntityException({code:'SMS_MESSAGE_TOO_LONG'});
  const people=await this.db.person.findMany({where:{status:'EFFECTIVE',securityStatus:'NORMAL',mobileVerifiedAt:{not:null},...(input.allVerified?{}:{memberNo:{in:input.memberNos}})},select:{personId:true,memberNo:true,mobile:true},orderBy:{memberNo:'asc'},take:501});
  const recipients:Recipient[]=[],seen=new Set<string>();
  for(const person of people){if(!person.mobile)continue;let mobile:string;try{mobile=normalizeContact('SMS',person.mobile);}catch{continue;}if(!seen.has(mobile)){seen.add(mobile);recipients.push({...person,mobile});}}
  if(!recipients.length||people.length>500)throw new UnprocessableEntityException({code:'SMS_AUDIENCE_LIMIT',message:'請選擇 1 至 500 位已驗證手機的有效會員。'});
  const contentHash=createHash('sha256').update(JSON.stringify({message,recipients})).digest('hex'),id=randomUUID();
  return this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${key},0))) AS lock_row`;
   const existing=await tx.$queryRaw<Campaign[]>`SELECT * FROM integration.sms_campaign WHERE request_key=${key}::uuid`;
   if(existing[0]){if(existing[0].actor_id!==actor||existing[0].content_hash!==contentHash)throw new ConflictException({code:'SMS_REQUEST_KEY_CONFLICT'});return this.view(existing[0]);}
   const rows=await tx.$queryRaw<Campaign[]>`INSERT INTO integration.sms_campaign(id,request_key,actor_id,message,recipients,content_hash,expires_at) VALUES (${id}::uuid,${key}::uuid,${actor},${message},${JSON.stringify(recipients)}::jsonb,${contentHash},now()+interval '30 minutes') RETURNING *`;
   await this.evidence(tx,actor,id,'SMS_DRAFT_CREATED',recipients.length);return this.view(rows[0]);
  });
 }
 async send(actor:string,id:string,hash:string,count:number){
  this.enabled();
  const reserved=await this.db.$transaction(async tx=>{
   await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended('sms-notification-daily-budget',0))) AS lock_row`;
   const rows=await tx.$queryRaw<Campaign[]>`SELECT * FROM integration.sms_campaign WHERE id=${id}::uuid FOR UPDATE`;
   const row=rows[0];if(!row||row.actor_id!==actor||row.content_hash!==hash||row.recipients.length!==count)throw new ConflictException({code:'SMS_PREVIEW_MISMATCH'});
   if(row.status!=='DRAFT')return {row,send:false};
   if(row.expires_at<=new Date())throw new ConflictException({code:'SMS_DRAFT_EXPIRED'});
   const people=await tx.person.findMany({where:{personId:{in:row.recipients.map(r=>r.personId)},status:'EFFECTIVE',securityStatus:'NORMAL',mobileVerifiedAt:{not:null}},select:{personId:true,mobile:true}});
   if(row.recipients.some(r=>!people.some(p=>p.personId===r.personId&&p.mobile&&normalizeContact('SMS',p.mobile)===r.mobile)))throw new ConflictException({code:'SMS_RECIPIENT_CHANGED'});
   const totals=await tx.$queryRaw<Array<{total:number}>>`SELECT coalesce(sum(jsonb_array_length(recipients)),0)::int AS total FROM integration.sms_campaign WHERE status IN ('SENDING','SUBMITTED','UNKNOWN') AND submitted_at>now()-interval '24 hours'`;
   const limit=Number(this.config.get('SMS_NOTIFICATION_DAILY_LIMIT')??500);
   if(!Number.isSafeInteger(limit)||limit<1||totals[0].total+count>limit)throw new UnprocessableEntityException({code:'SMS_NOTIFICATION_DAILY_LIMIT'});
   await tx.$executeRaw`UPDATE integration.sms_campaign SET status='SENDING',submitted_at=now() WHERE id=${id}::uuid`;
   await this.evidence(tx,actor,id,'SMS_SEND_REQUESTED',count);return {row,send:true};
  });
  if(!reserved.send)return this.view(reserved.row);
  let providerRef:string|null=null,status='SUBMITTED',failure:string|null=null;
  try{providerRef=(await this.sms.sendMessage(reserved.row.recipients.map(r=>r.mobile),reserved.row.message)).providerRef;}
  catch{status='UNKNOWN';failure='SMS_SUBMISSION_UNCONFIRMED';}
  // Never automatically resend after a timeout/partial response: the provider may have accepted it.
  return this.db.$transaction(async tx=>{
   const rows=await tx.$queryRaw<Campaign[]>`UPDATE integration.sms_campaign SET status=${status},provider_ref=${providerRef},failure_code=${failure} WHERE id=${id}::uuid RETURNING *`;
   await this.evidence(tx,actor,id,status==='SUBMITTED'?'SMS_PROVIDER_ACCEPTED':'SMS_SUBMISSION_UNKNOWN',count);return this.view(rows[0]);
  });
 }
}
