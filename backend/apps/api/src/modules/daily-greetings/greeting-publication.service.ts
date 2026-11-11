import {BadRequestException,ConflictException,Injectable,NotFoundException,ServiceUnavailableException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {IdempotencyService} from '../../common/idempotency/idempotency.service';
import {normalizeGreetingUpload} from './greeting-upload';
export interface GreetingPublication {id:string;greeting_date:string;title:string;message:string;image_hash:string;status:string;created_at:Date;publish_at:Date;approval_reference:string|null;image?:Buffer;}
export interface GreetingDraft {date:string;title:string;message:string;contentBase64:string;}
@Injectable()
export class GreetingPublicationService {
 constructor(private db:PrismaService,private idem:IdempotencyService,private audit:AuditService){}
 enabled(){return process.env.DAILY_GREETING_PUBLISHING_ENABLED==='true';}
 private check(){if(!this.enabled())throw new ServiceUnavailableException({code:'GREETING_PUBLISHING_NOT_CONFIGURED'});}
 async generateTemplate(input:{date:string;title:string;message:string},png:Buffer,version:string){
  this.check();const actor='SYSTEM:daily-greeting-template',requestId=randomUUID();
  const existing=await this.released();if(existing?.greeting_date===input.date)return {id:existing.id,status:'ALREADY_PUBLISHED'};
  const draft=await this.storeDraft(input,png,`template:${version}:${input.date}`,requestId,actor);
  const approval=process.env.DAILY_GREETING_TEMPLATE_APPROVAL_REFERENCE;
  if(process.env.DAILY_GREETING_TEMPLATE_AUTO_APPROVAL!=='true'||!approval?.trim())return draft.data;
  return (await this.transition(draft.data.id,'publish',approval,`template-publish:${version}:${input.date}`,requestId,actor)).data;
 }
 async list(){this.check();return this.db.$queryRaw<GreetingPublication[]>`SELECT id,greeting_date,title,message,image_hash,status,created_at,publish_at,approval_reference FROM learning.daily_greeting_publication ORDER BY created_at DESC LIMIT 100`;}
 async draft(input:GreetingDraft,key:string,requestId:string,actor:string){
  this.check();const {date,title,message}=input;
  if(!/^20[0-9]{2}-[0-9]{2}-[0-9]{2}$/.test(date)||!Number.isFinite(Date.parse(date+'T00:00:00Z'))||new Date(date+'T00:00:00Z').toISOString().slice(0,10)!==date||!title.trim()||title.length>160||!message.trim()||message.length>1000)throw new BadRequestException({code:'GREETING_DRAFT_INVALID'});
  const png=await normalizeGreetingUpload(input.contentBase64);return this.storeDraft({date,title,message},png,key,requestId,actor);
 }
 private async storeDraft(input:{date:string;title:string;message:string},png:Buffer,key:string,requestId:string,actor:string){
  const {date,title,message}=input,hash=createHash('sha256').update(png).digest('hex');
  const result=await this.idem.execute('admin:greeting:draft:'+actor,key,{date,title,message,hash},async tx=>{
   const id=randomUUID(),publishAt=new Date(date+'T07:00:00+08:00');
   await tx.$executeRaw`INSERT INTO learning.daily_greeting_publication (id,greeting_date,title,message,image,image_hash,created_by,publish_at) VALUES (${id}::uuid,${date},${title},${message},${png},${hash},${actor},${publishAt})`;
   await this.audit.write(tx,{actorType:actor.startsWith('SYSTEM:')?'SYSTEM':'USER',actorId:/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(actor)?actor:undefined,action:'GREETING_UPLOADED',entityType:'DailyGreeting',entityId:id,afterData:{date,hash,actorSubject:actor},requestId,correlationId:randomUUID()});
   return {id,status:'DRAFT',imageHash:hash};
  });return {data:result.value,meta:{replayed:result.replayed}};
 }
 async transition(id:string,action:'publish'|'archive',approval:string,key:string,requestId:string,actor:string){
  this.check();if(action==='publish'&&(!approval.trim()||approval.length>200))throw new BadRequestException({code:'GREETING_APPROVAL_REQUIRED'});
  const result=await this.idem.execute('admin:greeting:'+action+':'+id+':'+actor,key,{approval},async tx=>{
   const rows=await tx.$queryRaw<GreetingPublication[]>`SELECT * FROM learning.daily_greeting_publication WHERE id=${id}::uuid FOR UPDATE`;
   const row=rows[0];if(!row)throw new NotFoundException({code:'GREETING_DRAFT_NOT_FOUND'});
   let replaced:string[]=[];
   if(action==='publish'){
    if(!['DRAFT','ARCHIVED'].includes(row.status))throw new ConflictException({code:'GREETING_NOT_DRAFT'});
    // Serializes different drafts for the same date across replicas.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${row.greeting_date}))`;
    if(actor==='SYSTEM:daily-greeting-template'){const active=await tx.$queryRaw<{id:string}[]>`SELECT id FROM learning.daily_greeting_publication WHERE greeting_date=${row.greeting_date} AND status='PUBLISHED'`;if(active.length)return {id:active[0].id,status:'ALREADY_PUBLISHED'};}
    const previous=await tx.$queryRaw<{id:string}[]>`UPDATE learning.daily_greeting_publication SET status='ARCHIVED' WHERE greeting_date=${row.greeting_date} AND status='PUBLISHED' RETURNING id`;replaced=previous.map(item=>item.id);
    await tx.$executeRaw`UPDATE learning.daily_greeting_publication SET status='PUBLISHED',approved_by=${actor},approved_at=now(),approval_reference=${approval} WHERE id=${id}::uuid`;
   }else await tx.$executeRaw`UPDATE learning.daily_greeting_publication SET status='ARCHIVED' WHERE id=${id}::uuid`;
   await this.audit.write(tx,{actorType:actor.startsWith('SYSTEM:')?'SYSTEM':'USER',actorId:/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(actor)?actor:undefined,action:action==='publish'?'GREETING_PUBLISHED':'GREETING_ARCHIVED',entityType:'DailyGreeting',entityId:id,afterData:{actorSubject:actor,imageHash:row.image_hash,approvalReference:approval,date:row.greeting_date,replaced},requestId,correlationId:randomUUID()});
   return {id,status:action==='publish'?'PUBLISHED':'ARCHIVED'};
  });return {data:result.value,meta:{replayed:result.replayed}};
 }
 async preview(id:string){this.check();const rows=await this.db.$queryRaw<GreetingPublication[]>`SELECT image FROM learning.daily_greeting_publication WHERE id=${id}::uuid`;if(!rows[0]?.image)throw new NotFoundException();return Buffer.from(rows[0].image);}
 async released(now=new Date()){
  if(!this.enabled())return null;
  const rows=await this.db.$queryRaw<GreetingPublication[]>`SELECT id,greeting_date,title,message,image_hash,status,created_at,publish_at,approval_reference FROM learning.daily_greeting_publication WHERE status='PUBLISHED' AND publish_at<=${now} ORDER BY publish_at DESC LIMIT 1`;
  return rows[0]??null;
 }
 async publicImage(id:string,hash:string){
  if(!this.enabled())throw new NotFoundException();const now=new Date();
  const rows=await this.db.$queryRaw<GreetingPublication[]>`SELECT image FROM learning.daily_greeting_publication WHERE id=${id}::uuid AND image_hash=${hash} AND status='PUBLISHED' AND publish_at<=${now}`;
  if(!rows[0]?.image)throw new NotFoundException();return Buffer.from(rows[0].image);
 }
}
