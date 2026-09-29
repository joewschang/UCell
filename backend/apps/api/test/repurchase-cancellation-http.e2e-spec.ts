import {Test} from '@nestjs/testing';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {SubscriptionController} from '../src/modules/subscription/subscription.controller';
import {SubscriptionService} from '../src/modules/subscription/subscription.service';
import {SubscriptionCancellationService} from '../src/modules/subscription/subscription-cancellation.service';

describe('repurchase cancellation legacy HTTP contract (authorization tested separately)',()=>{
 let app:NestFastifyApplication;
 const cancellation={cancel:jest.fn(async()=>({replayed:false}))};
 beforeAll(async()=>{
  const module=await Test.createTestingModule({controllers:[SubscriptionController],providers:[{provide:SubscriptionService,useValue:{}},{provide:SubscriptionCancellationService,useValue:cancellation}]}).compile();
  app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');await app.init();await app.getHttpAdapter().getInstance().ready();
 });
 afterAll(()=>app.close());
 it.each([undefined,'explicit-cancel-key'])('accepts cancellation with key %s and delegates identity enforcement to the service',async key=>{
  const response=await app.inject({method:'POST',url:'/api/v1/admin/subscriptions/legacy-sub/cancel',headers:key?{'idempotency-key':key}:{},payload:{effectiveAt:'2026-09-29T00:00:00Z',reasonCode:'FULL_RETURN'}});
  expect(response.statusCode).toBe(201);
  expect(cancellation.cancel).toHaveBeenLastCalledWith('legacy-sub',new Date('2026-09-29T00:00:00Z'),'FULL_RETURN','0',{sourceReturnCaseId:undefined,idempotencyKey:key});
 });
});
