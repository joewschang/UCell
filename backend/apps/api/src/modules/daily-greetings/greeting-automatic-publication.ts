import {ConflictException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {AuditService} from '../../common/audit/audit.service';
import {createHash,randomUUID} from 'node:crypto';
import {cloudDate} from './cloud-greeting-policy';
export interface AutomaticGreeting {date:string;title:string;message:string;png:Buffer;backgroundHash:string;actor:string;policy:string;owner:string;lease?:boolean;requestHash?:string;provenance:Record<string,string>;}
/** One locked/atomic publication and audit path for both generated and externally pushed images. */
export async function publishAutomaticGreeting(db:PrismaService,audit:AuditService,input:AutomaticGreeting){
 const {date,title,message,png,backgroundHash,actor,policy,owner}=input;cloudDate(date);
 return db.$transaction(async tx=>{
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${date}))`;
  cloudDate(date);
  const jobs=await tx.$queryRaw<any[]>`SELECT *,lease_until>now() AS live FROM learning.daily_greeting_generation WHERE greeting_date=${date} FOR UPDATE`;
  const job=jobs[0];
  const published=await tx.$queryRaw<{id:string}[]>`SELECT id FROM learning.daily_greeting_publication WHERE greeting_date=${date} AND status='PUBLISHED'`;
  if(published.length){
   if(!input.lease){if(job?.request_hash===input.requestHash&&job?.actor_subject===actor&&job?.publication_id===published[0].id)return {date,id:published[0].id,status:'ALREADY_PUBLISHED'};throw new ConflictException({code:'GREETING_DATE_ALREADY_PUBLISHED'});}
   if(job?.lease_owner===owner&&job?.status==='RUNNING')await tx.$executeRaw`UPDATE learning.daily_greeting_generation SET status='SKIPPED',lease_until=NULL WHERE greeting_date=${date}`;
   return {date,id:published[0].id,status:'ALREADY_PUBLISHED'};
  }
  if(input.lease){if(job?.lease_owner!==owner||job?.status!=='RUNNING'||!job?.live)throw new ConflictException({code:'GREETING_GENERATION_LEASE_LOST'});}
  else if(job&&(job.status==='PUBLISHED'||(job.status==='RUNNING'&&job.live)))throw new ConflictException({code:'GREETING_DATE_RESERVED'});
  const old=await tx.$queryRaw<{greeting_date:string}[]>`SELECT greeting_date FROM learning.daily_greeting_generation WHERE background_hash=${backgroundHash} AND greeting_date<>${date}`;
  if(old.length)throw new ConflictException({code:'GREETING_BACKGROUND_ALREADY_USED'});
  if(!input.lease){const replay=await tx.$queryRaw<any[]>`SELECT request_hash FROM learning.daily_greeting_generation WHERE request_id=${owner}::uuid`;if(replay.length)throw new ConflictException({code:'GREETING_IDEMPOTENCY_CONFLICT'});}
  const id=randomUUID(),imageHash=createHash('sha256').update(png).digest('hex'),publishAt=new Date(date+'T07:00:00+08:00');
  if(input.lease)await tx.$executeRaw`UPDATE learning.daily_greeting_generation SET status='PUBLISHED',background_hash=${backgroundHash},publication_id=${id}::uuid,lease_until=NULL WHERE greeting_date=${date}`;
  else await tx.$executeRaw`INSERT INTO learning.daily_greeting_generation (greeting_date,status,lease_owner,attempts,actor_subject,background_hash,publication_id,request_hash,request_id) VALUES (${date},'PUBLISHED',${owner}::uuid,1,${actor},${backgroundHash},${id}::uuid,${input.requestHash},${owner}::uuid) ON CONFLICT(greeting_date) DO UPDATE SET status='PUBLISHED',lease_until=NULL,actor_subject=${actor},background_hash=${backgroundHash},publication_id=${id}::uuid,request_hash=${input.requestHash},request_id=${owner}::uuid`;
  await tx.$executeRaw`INSERT INTO learning.daily_greeting_publication (id,greeting_date,title,message,image,image_hash,created_by,status,publish_at,approved_by,approved_at,approval_reference) VALUES (${id}::uuid,${date},${title},${message},${png},${imageHash},${actor},'PUBLISHED',${publishAt},${actor},now(),${policy})`;
  await audit.write(tx,{actorType:'SYSTEM',action:input.lease?'GREETING_GENERATED_PUBLISHED':'GREETING_PUSH_PUBLISHED',entityType:'DailyGreeting',entityId:id,requestId:owner,correlationId:owner,afterData:{date,actorSubject:actor,imageHash,backgroundHash,policy,automatic:true,...input.provenance}});
  return {date,id,status:'PUBLISHED'};
 },{isolationLevel:'Serializable'});
}
