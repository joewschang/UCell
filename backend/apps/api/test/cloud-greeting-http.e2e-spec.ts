import {Module} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaService} from '@ucell/database';
import {AuditService} from '../src/common/audit/audit.service';
import {CloudGreetingController} from '../src/modules/daily-greetings/cloud-greeting.controller';
import {CloudGreetingService} from '../src/modules/daily-greetings/cloud-greeting.service';
import {GreetingMachineGuard} from '../src/modules/daily-greetings/cloud-greeting-auth';
import {DailyGreetingScheduler} from '../src/modules/daily-greetings/daily-greeting.scheduler';
const cloud={run:jest.fn()},audit={write:jest.fn()},db={$transaction:jest.fn(async f=>f({}))};
@Module({controllers:[CloudGreetingController],providers:[GreetingMachineGuard,{provide:CloudGreetingService,useValue:cloud},{provide:PrismaService,useValue:db},{provide:AuditService,useValue:audit}]})class TestModule{}
describe('Cloud greeting fail-closed HTTP and scheduler',()=>{
 let app:NestFastifyApplication;const saved={...process.env};
 beforeAll(async()=>{app=await NestFactory.create<NestFastifyApplication>(TestModule,new FastifyAdapter(),{logger:false});await app.init();await app.getHttpAdapter().getInstance().ready();});
 afterAll(async()=>{await app.close();process.env={...saved};});
 it('leaves an unconfigured endpoint unavailable, including with a bearer',async()=>{delete process.env.GREETING_MACHINE_ENABLED;for(const headers of [{},{authorization:'Bearer anything'}]){const res=await app.inject({method:'POST',url:'/integrations/dot/daily-greetings/generate',headers,payload:{date:'2026-11-17'}});expect(res.statusCode).toBe(503);}expect(cloud.run).not.toHaveBeenCalled();});
 it('requires bearer authentication after configuration and audits denial',async()=>{Object.assign(process.env,{GREETING_MACHINE_ENABLED:'true',GREETING_MACHINE_TENANT:'11111111-1111-4111-8111-111111111111',GREETING_MACHINE_AUDIENCE:'22222222-2222-4222-8222-222222222222',GREETING_MACHINE_CLIENT:'33333333-3333-4333-8333-333333333333',GREETING_MACHINE_OBJECT_ID:'44444444-4444-4444-8444-444444444444'});expect((await app.inject({method:'POST',url:'/integrations/dot/daily-greetings/generate',payload:{date:'2026-11-17'}})).statusCode).toBe(401);expect(audit.write).toHaveBeenCalledWith({},expect.objectContaining({action:'GREETING_MACHINE_DENIED'}));expect(cloud.run).not.toHaveBeenCalled();});
 it('accepts only a date, never arbitrary model prompts or images',()=>{const controller=new CloudGreetingController(cloud as any);for(const body of [{date:'2026-11-17',prompt:'anything'},{date:'2026-11-17',image:'anything'},null,[],{date:42}])expect(()=>controller.generate(body,{})).toThrow();});
 it('uses cloud generation at startup and the Taipei 07:00 boundary without template fallback',async()=>{
  jest.useFakeTimers().setSystemTime(new Date('2026-11-17T22:59:59Z'));Object.assign(process.env,{DAILY_GREETING_CLOUD_ENABLED:'true',DAILY_GREETING_API_SCHEDULER_ENABLED:'true'});
  const renderer={image:jest.fn()},publications={enabled:jest.fn()},generator={run:jest.fn(async date=>({date,status:'PUBLISHED'}))};const scheduler=new DailyGreetingScheduler(renderer as any,publications as any,generator as any);
  try{scheduler.onApplicationBootstrap();await jest.advanceTimersByTimeAsync(0);expect(generator.run).toHaveBeenLastCalledWith('2026-11-17');await jest.advanceTimersByTimeAsync(1000);expect(generator.run).toHaveBeenLastCalledWith('2026-11-18');generator.run.mockRejectedValueOnce(new Error('unavailable'));await expect(scheduler.runOnce()).rejects.toThrow();expect(renderer.image).not.toHaveBeenCalled();expect(publications.enabled).not.toHaveBeenCalled();}finally{scheduler.onModuleDestroy();jest.useRealTimers();}
 });
});
