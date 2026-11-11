/** One-shot cloud job. No listener, member messages, or external AI calls. */
import 'reflect-metadata';
import {PrismaService} from '@ucell/database';
import {AuditService} from './common/audit/audit.service';
import {IdempotencyService} from './common/idempotency/idempotency.service';
import {GreetingPublicationService} from './modules/daily-greetings/greeting-publication.service';
import {DailyGreetingService} from './modules/daily-greetings/daily-greeting.service';
import {greetingCopy,greetingDate,GREETING_VERSION} from './modules/daily-greetings/daily-greeting';
async function main(){
 if(process.env.DAILY_GREETING_PUBLISHING_ENABLED!=='true')throw new Error('GREETING_PUBLISHING_NOT_CONFIGURED');
 const db=new PrismaService(),renderer=new DailyGreetingService();
 try{
  await db.$connect();const publications=new GreetingPublicationService(db,new IdempotencyService(db),new AuditService());
  for(let attempt=0;attempt<3;attempt++){
   try{const date=greetingDate(),copy=greetingCopy(date),png=await renderer.image(date);const result=await publications.generateTemplate({date,title:copy.title,message:copy.lines.join('，')},png,GREETING_VERSION);console.log(JSON.stringify({event:'daily-greeting-job',date,...result}));return;}
   catch(error){if(attempt===2)throw error;console.error(JSON.stringify({event:'daily-greeting-job-retry',attempt:attempt+1}));await new Promise(resolve=>setTimeout(resolve,5000*2**attempt));}
  }
 }finally{renderer.onModuleDestroy();await db.$disconnect();}
}
void main().catch(()=>{console.error('Daily greeting job failed; inspect database, migration, font and publishing configuration.');process.exitCode=1;});
