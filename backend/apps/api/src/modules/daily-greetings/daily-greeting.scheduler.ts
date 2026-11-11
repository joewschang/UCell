import {Injectable,Logger,Optional,OnApplicationBootstrap,OnModuleDestroy,ServiceUnavailableException} from '@nestjs/common';
import {DailyGreetingService} from './daily-greeting.service';
import {GreetingPublicationService} from './greeting-publication.service';
import {GREETING_VERSION,greetingCopy,greetingDate,greetingWindow} from './daily-greeting';

/** Uses the existing API identity/DB connection; no listener, new secret or paid job. */
@Injectable()
export class DailyGreetingScheduler implements OnApplicationBootstrap,OnModuleDestroy {
 private readonly logger=new Logger(DailyGreetingScheduler.name);
 private timer?:ReturnType<typeof setTimeout>;
 private stopped=false;
 private running=false;
 private failures=0;
 constructor(private readonly renderer:DailyGreetingService,@Optional() private readonly publications?:GreetingPublicationService){}
 private enabled(){return process.env.DAILY_GREETING_API_SCHEDULER_ENABLED==='true';}
 onApplicationBootstrap(){if(this.enabled()&&!this.stopped&&!this.timer&&!this.running)this.schedule(0);}
 onModuleDestroy(){this.stopped=true;if(this.timer)clearTimeout(this.timer);this.timer=undefined;}
 private schedule(delay:number){if(this.stopped)return;this.timer=setTimeout(()=>{this.timer=undefined;void this.tick();},delay);this.timer.unref();}

 /** One iteration, also used by isolated tests. Publishing keeps existing review controls. */
 async runOnce(){
  if(!this.enabled()||this.stopped)return {date:greetingDate(),status:'DISABLED'};
  if(!this.publications?.enabled())throw new ServiceUnavailableException({code:'GREETING_PUBLISHING_NOT_CONFIGURED'});
  // At most one date-boundary retry: never backfill an unbounded outage history.
  for(let attempt=0;attempt<2;attempt++){
   const date=greetingDate(),existing=await this.publications.released();
   if(this.stopped)return {date,status:'STOPPED'};
   if(greetingDate()!==date)continue;
   if(existing?.greeting_date===date)return {date,status:'ALREADY_PUBLISHED'};
   // Native rendering remains in the existing bounded worker-thread queue.
   const image=await this.renderer.image(date);
   if(this.stopped)return {date,status:'STOPPED'};
   if(greetingDate()!==date)continue;
   const copy=greetingCopy(date);
   // Shared version/date idempotency keys, serializable transactions and the
   // existing per-date PostgreSQL publication lock protect every API replica.
   const result=await this.publications.generateTemplate({date,title:copy.title,message:copy.lines.join('，')},image,GREETING_VERSION);
   if(this.stopped)return {date,status:'STOPPED'};
   if(greetingDate()===date)return {date,status:result.status};
  }
  throw new ServiceUnavailableException({code:'GREETING_DATE_CHANGED'});
 }

 private async tick(){
  if(this.stopped||this.running||!this.enabled())return;
  this.running=true;let completedDate:string|undefined;
  try{
   const result=await this.runOnce();completedDate=result.date;this.failures=0;
   if(!this.stopped)this.logger.log(JSON.stringify({event:'daily-greeting-api-scheduler',...result}));
  }catch{
   this.failures++;
   if(!this.stopped)this.logger.error(JSON.stringify({event:'daily-greeting-api-scheduler-failed',attempt:this.failures}));
  }finally{
   this.running=false;
   if(!this.stopped&&this.enabled()){
    const date=greetingDate(),untilNext=Math.max(1000,Date.parse(greetingWindow(date).nextRefreshAt)-Date.now());
    const delay=this.failures?Math.min(untilNext,30_000*2**Math.min(this.failures-1,5),15*60_000):completedDate!==date?1000:untilNext;
    this.schedule(delay);
   }
  }
 }
}
