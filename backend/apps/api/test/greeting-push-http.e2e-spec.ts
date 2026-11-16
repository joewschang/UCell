import {Module} from '@nestjs/common';
import {NestFactory} from '@nestjs/core';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaService} from '@ucell/database';
import {AuditService} from '../src/common/audit/audit.service';
import {GreetingPushController} from '../src/modules/daily-greetings/greeting-push.controller';
import {GreetingPushService} from '../src/modules/daily-greetings/greeting-push.service';
import {GreetingPushGuard} from '../src/modules/daily-greetings/cloud-greeting-auth';
import {configureGreetingPushTransport} from '../src/modules/daily-greetings/greeting-push-transport';
import {DailyGreetingScheduler} from '../src/modules/daily-greetings/daily-greeting.scheduler';
const service={publish:jest.fn()},audit={write:jest.fn()},db={$transaction:jest.fn(async f=>f({}))};
@Module({controllers:[GreetingPushController],providers:[GreetingPushGuard,{provide:GreetingPushService,useValue:service},{provide:PrismaService,useValue:db},{provide:AuditService,useValue:audit}]})class PushTestModule{}
describe('Dot upload route transport and authorization',()=>{
 let app:NestFastifyApplication;const saved={...process.env},url='/api/v1/integrations/dot/daily-greetings/publish';
 beforeAll(async()=>{app=await NestFactory.create<NestFastifyApplication>(PushTestModule,new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');configureGreetingPushTransport(app);app.getHttpAdapter().getInstance().post('/unrelated',async()=>({ok:true}));await app.init();await app.getHttpAdapter().getInstance().ready();});
 afterAll(async()=>{await app.close();process.env={...saved};});
 it('is disabled without a dedicated configured push identity',async()=>{delete process.env.GREETING_PUSH_ENABLED;expect((await app.inject({method:'POST',url,payload:{date:'2026-11-17'}})).statusCode).toBe(503);});
 it('accepts larger JSON only on this route but denies unauthenticated publication',async()=>{Object.assign(process.env,{GREETING_PUSH_ENABLED:'true',GREETING_PUSH_TENANT:'11111111-1111-4111-8111-111111111111',GREETING_PUSH_AUDIENCE:'22222222-2222-4222-8222-222222222222',GREETING_PUSH_CLIENT:'33333333-3333-4333-8333-333333333333',GREETING_PUSH_OBJECT_ID:'44444444-4444-4444-8444-444444444444'});const payload={contentBase64:'A'.repeat(1_100_000)};expect((await app.inject({method:'POST',url,payload})).statusCode).toBe(401);expect((await app.inject({method:'POST',url:'/unrelated',payload})).statusCode).toBe(413);expect((await app.inject({method:'POST',url,payload:{contentBase64:'A'.repeat(11_000_001)}})).statusCode).toBe(413);expect(service.publish).not.toHaveBeenCalled();});
 it('prevents the legacy template scheduler from filling the date before Dot arrives',async()=>{process.env.DAILY_GREETING_API_SCHEDULER_ENABLED='true';process.env.GREETING_PUSH_ENABLED='true';const renderer={image:jest.fn()},cloud={run:jest.fn()};const scheduler=new DailyGreetingScheduler(renderer as any,undefined,cloud as any);expect((await scheduler.runOnce()).status).toBe('EXTERNAL_PUSH_MANAGED');expect(renderer.image).not.toHaveBeenCalled();expect(cloud.run).not.toHaveBeenCalled();scheduler.onModuleDestroy();});
});
