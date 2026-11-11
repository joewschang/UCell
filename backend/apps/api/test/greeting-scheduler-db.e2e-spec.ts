import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {PrismaService} from '@ucell/database';
import {AuditService} from '../src/common/audit/audit.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {GreetingPublicationService} from '../src/modules/daily-greetings/greeting-publication.service';
import {DailyGreetingScheduler} from '../src/modules/daily-greetings/daily-greeting.scheduler';
import {greetingDate} from '../src/modules/daily-greetings/daily-greeting';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('API scheduler across isolated PostgreSQL replicas',()=>{
 const keys=['DAILY_GREETING_API_SCHEDULER_ENABLED','DAILY_GREETING_PUBLISHING_ENABLED','DAILY_GREETING_TEMPLATE_AUTO_APPROVAL','DAILY_GREETING_TEMPLATE_APPROVAL_REFERENCE'];
 const previous=keys.map(key=>process.env[key]);const clients:PrismaService[]=[];const services:GreetingPublicationService[]=[];const schedulers:DailyGreetingScheduler[]=[];
 const png=readFileSync(join(__dirname,'../../../../member/tests/fixtures/daily-greeting-2026-11-11.png'));let publishedId:string;
 beforeAll(async()=>{
  if(!url||!['localhost','127.0.0.1'].includes(new URL(url).hostname)||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))||process.env.DATABASE_URL!==url)throw Error('ISOLATED_DATABASE_REQUIRED');
  keys.forEach((key,index)=>process.env[key]=index===3?'ISOLATED scheduler review':'true');
  for(let index=0;index<2;index++){const db=new PrismaService();await db.$connect();clients.push(db);const service=new GreetingPublicationService(db,new IdempotencyService(db),new AuditService());services.push(service);schedulers.push(new DailyGreetingScheduler({image:async()=>png} as any,service));}
 });
 afterAll(async()=>{schedulers.forEach(s=>s.onModuleDestroy());await Promise.all(clients.map(c=>c.$disconnect()));keys.forEach((key,index)=>{if(previous[index]===undefined)delete process.env[key];else process.env[key]=previous[index]});});
 it('concurrent replicas converge to one immutable publication and one upload/publish audit pair',async()=>{
  const results=await Promise.allSettled(schedulers.map(s=>s.runOnce()));expect(results.some(r=>r.status==='fulfilled')).toBe(true);
  for(let index=0;index<results.length;index++)if(results[index].status==='rejected')await schedulers[index].runOnce();
  const date=greetingDate(),rows=await clients[0].$queryRaw<{id:string,status:string}[]>`SELECT id,status FROM learning.daily_greeting_publication WHERE greeting_date=${date}`;
  expect(rows).toHaveLength(1);expect(rows[0].status).toBe('PUBLISHED');publishedId=rows[0].id;
  expect(await clients[0].auditEvent.count({where:{entityId:publishedId,action:{in:['GREETING_UPLOADED','GREETING_PUBLISHED']}}})).toBe(2);
 });
 it('restart and a lost acknowledgement do not duplicate a committed publication',async()=>{
  const restarted=new DailyGreetingScheduler({image:async()=>{throw Error('must not render committed date')}} as any,services[1]);
  expect((await restarted.runOnce()).status).toBe('ALREADY_PUBLISHED');
  const results=await Promise.all(schedulers.map(s=>s.runOnce()));expect(results.every(r=>r.status==='ALREADY_PUBLISHED')).toBe(true);
  expect((await services[0].released())?.id).toBe(publishedId);expect(await clients[0].auditEvent.count({where:{entityId:publishedId}})).toBe(2);restarted.onModuleDestroy();
 });
});
