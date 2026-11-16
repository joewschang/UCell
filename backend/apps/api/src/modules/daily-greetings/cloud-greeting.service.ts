import {Injectable,Logger,ServiceUnavailableException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {CloudGreetingProvider} from './cloud-greeting-provider';
import {CLOUD_GREETING_POLICY,cloudConfiguration,cloudDate,cloudCopy,cloudPrompt} from './cloud-greeting-policy';
import {renderCloudGreeting} from './cloud-greeting-render';
@Injectable()
export class CloudGreetingService {
 private readonly logger=new Logger(CloudGreetingService.name);
 constructor(private db:PrismaService,private audit:AuditService,private provider:CloudGreetingProvider){}
 async run(date:string,actor='SYSTEM:daily-greeting-generated'){
  cloudDate(date);const config=cloudConfiguration();if(process.env.DAILY_GREETING_PUBLISHING_ENABLED!=='true')throw new ServiceUnavailableException({code:'GREETING_PUBLISHING_NOT_CONFIGURED'});
  const active=await this.db.$queryRaw<{id:string}[]>`SELECT id FROM learning.daily_greeting_publication WHERE greeting_date=${date} AND status='PUBLISHED'`;
  if(active.length)return {date,id:active[0].id,status:'ALREADY_PUBLISHED'};
  const owner=randomUUID(),claimed=await this.db.$queryRaw<{attempts:number}[]>`INSERT INTO learning.daily_greeting_generation (greeting_date,status,lease_owner,lease_until,attempts,actor_subject) VALUES (${date},'RUNNING',${owner}::uuid,now()+interval '5 minutes',1,${actor}) ON CONFLICT (greeting_date) DO UPDATE SET status='RUNNING',lease_owner=${owner}::uuid,lease_until=now()+interval '5 minutes',attempts=learning.daily_greeting_generation.attempts+1,actor_subject=${actor} WHERE learning.daily_greeting_generation.attempts<${config.attempts} AND ((learning.daily_greeting_generation.status='FAILED' AND learning.daily_greeting_generation.retry_at<=now()) OR (learning.daily_greeting_generation.status='RUNNING' AND learning.daily_greeting_generation.lease_until<now())) RETURNING attempts`;
  if(!claimed.length)return {date,status:'IN_PROGRESS_OR_ATTEMPT_LIMIT'};
  try{
   await this.db.$transaction(tx=>this.audit.write(tx,{actorType:'SYSTEM',action:'GREETING_GENERATION_STARTED',entityType:'DailyGreeting',requestId:owner,correlationId:owner,afterData:{date,actorSubject:actor,attempt:claimed[0].attempts,policy:CLOUD_GREETING_POLICY}}));
   const background=await this.provider.generate(date),png=await renderCloudGreeting(background,date);cloudDate(date);
   const backgroundHash=createHash('sha256').update(background).digest('hex'),imageHash=createHash('sha256').update(png).digest('hex'),promptHash=createHash('sha256').update(cloudPrompt(date)).digest('hex'),copy=cloudCopy(date);
   return await this.db.$transaction(async tx=>{
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${date}))`;
    const lease=await tx.$queryRaw<{lease_owner:string}[]>`SELECT lease_owner FROM learning.daily_greeting_generation WHERE greeting_date=${date} AND lease_owner=${owner}::uuid AND status='RUNNING' AND lease_until>now() FOR UPDATE`;
    if(!lease.length)throw new Error('lease lost');
    const published=await tx.$queryRaw<{id:string}[]>`SELECT id FROM learning.daily_greeting_publication WHERE greeting_date=${date} AND status='PUBLISHED'`;
    if(published.length){await tx.$executeRaw`UPDATE learning.daily_greeting_generation SET status='SKIPPED',lease_until=NULL WHERE greeting_date=${date}`;return {date,id:published[0].id,status:'ALREADY_PUBLISHED'};}
    const id=randomUUID(),publishAt=new Date(date+'T07:00:00+08:00');
    await tx.$executeRaw`UPDATE learning.daily_greeting_generation SET status='PUBLISHED',background_hash=${backgroundHash},publication_id=${id}::uuid,lease_until=NULL WHERE greeting_date=${date}`;
    await tx.$executeRaw`INSERT INTO learning.daily_greeting_publication (id,greeting_date,title,message,image,image_hash,created_by,status,publish_at,approved_by,approved_at,approval_reference) VALUES (${id}::uuid,${date},${copy.title},${copy.message},${png},${imageHash},${actor},'PUBLISHED',${publishAt},${actor},now(),${CLOUD_GREETING_POLICY})`;
    await this.audit.write(tx,{actorType:'SYSTEM',action:'GREETING_GENERATED_PUBLISHED',entityType:'DailyGreeting',entityId:id,requestId:owner,correlationId:owner,afterData:{date,actorSubject:actor,imageHash,backgroundHash,promptHash,modelDeployment:config.deployment,policy:CLOUD_GREETING_POLICY,automatic:true}});
    return {date,id,status:'PUBLISHED'};
   },{isolationLevel:'Serializable'});
  }catch{
   try{await this.db.$transaction(async tx=>{await tx.$executeRaw`UPDATE learning.daily_greeting_generation SET status='FAILED',lease_until=NULL,retry_at=now()+interval '1 minute',error_code='GENERATION_FAILED' WHERE greeting_date=${date} AND lease_owner=${owner}::uuid AND status='RUNNING'`;await this.audit.write(tx,{actorType:'SYSTEM',action:'GREETING_GENERATION_FAILED',entityType:'DailyGreeting',result:'FAILED',requestId:owner,correlationId:owner,afterData:{date,actorSubject:actor,code:'GENERATION_FAILED'}});});}catch{this.logger.error('GREETING_GENERATION_FAILURE_AUDIT_UNAVAILABLE');}
   throw new ServiceUnavailableException({code:'GREETING_CLOUD_GENERATION_FAILED'});
  }
 }
}
