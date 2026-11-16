import {publishAutomaticGreeting} from './greeting-automatic-publication';
import {Injectable,Logger,ServiceUnavailableException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {AuditService} from '../../common/audit/audit.service';
import {CloudGreetingProvider} from './cloud-greeting-provider';
import {CLOUD_GREETING_POLICY,cloudConfiguration,cloudDate,cloudCopy,cloudPrompt} from './cloud-greeting-policy';
import {renderGeneratedGreeting} from './cloud-greeting-render';
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
   const background=await this.provider.generate(date),rendered=await renderGeneratedGreeting(background,date);cloudDate(date);
   return await publishAutomaticGreeting(this.db,this.audit,{date,...cloudCopy(date),png:rendered.image,backgroundHash:rendered.backgroundHash,actor,policy:CLOUD_GREETING_POLICY,owner,lease:true,provenance:{promptHash:createHash('sha256').update(cloudPrompt(date)).digest('hex'),modelDeployment:config.deployment}});
  }catch{
   try{await this.db.$transaction(async tx=>{await tx.$executeRaw`UPDATE learning.daily_greeting_generation SET status='FAILED',lease_until=NULL,retry_at=now()+interval '1 minute',error_code='GENERATION_FAILED' WHERE greeting_date=${date} AND lease_owner=${owner}::uuid AND status='RUNNING'`;await this.audit.write(tx,{actorType:'SYSTEM',action:'GREETING_GENERATION_FAILED',entityType:'DailyGreeting',result:'FAILED',requestId:owner,correlationId:owner,afterData:{date,actorSubject:actor,code:'GENERATION_FAILED'}});});}catch{this.logger.error('GREETING_GENERATION_FAILURE_AUDIT_UNAVAILABLE');}
   throw new ServiceUnavailableException({code:'GREETING_CLOUD_GENERATION_FAILED'});
  }
 }
}
