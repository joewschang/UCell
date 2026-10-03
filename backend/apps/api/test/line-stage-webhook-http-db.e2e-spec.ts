import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter,NestFastifyApplication } from '@nestjs/platform-fastify';
import { PrismaClient } from '@prisma/client';
import { PrismaService } from '@ucell/database';
import { createHmac,randomUUID } from 'node:crypto';
import { LineStageWebhookController } from '../src/modules/auth/line-stage-webhook.controller';
import { LineMessagingWebhookController } from '../src/modules/auth/line-messaging-webhook.controller';
import { LineMessagingIngressService } from '../src/modules/auth/line-messaging-ingress.service';
import { LineMessagingAdapter } from '../src/modules/auth/line-messaging.adapter';
import { ProviderWebhookInboxService } from '../src/modules/commerce/provider-webhook-inbox.service';
import { configureLineWebhookTransport } from '../src/modules/auth/line-webhook-transport';
import { createLineMessagingObserverHandler } from '../../worker/src/line-messaging-handler';

const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('Stage LINE exact HTTP transport and durable deduplication',()=>{
 let db:PrismaClient,app:NestFastifyApplication;
 const secret='synthetic-stage-secret',path='/api/line/webhook';
 const sign=(body:string)=>createHmac('sha256',secret).update(body).digest('base64');
 const send=(body:string,signature=sign(body),route=path)=>app.inject({method:'POST',url:route,headers:{'content-type':'application/json','x-line-signature':signature},payload:body});
 beforeAll(async()=>{
  db=new PrismaClient({datasources:{db:{url}}});
  const mod=await Test.createTestingModule({controllers:[LineStageWebhookController,LineMessagingWebhookController],providers:[LineMessagingIngressService,LineMessagingAdapter,ProviderWebhookInboxService,{provide:PrismaService,useValue:db},{provide:ConfigService,useValue:{get:(name:string)=>name==='LINE_CHANNEL_SECRET'?secret:undefined}}]}).compile();
  app=mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});configureLineWebhookTransport(app);await app.init();await app.getHttpAdapter().getInstance().ready();
 });
 afterAll(async()=>{await app?.close();await db?.$disconnect();});
 it('accepts empty verification on canonical and legacy paths',async()=>{
  for(const route of [path,'/api/v1/integrations/line/messaging/webhook'])expect((await send('{ "events": [] }',undefined,route)).statusCode).toBe(200);
 });
 it('verifies exact UTF-8 bytes, receives follow/unfollow/text and deduplicates redelivery',async()=>{
  const ids=[randomUUID(),randomUUID(),randomUUID()],events=['follow','unfollow','message'].map((type,index)=>({webhookEventId:ids[index],type,timestamp:Date.now(),source:{type:'user',userId:'PRIVATE_LINE_SUBJECT'},...(type==='message'?{message:{id:'private-message',type:'text',text:'私人內容\n你好 ✓'}}:{})}));
  const body=JSON.stringify({events},null,2);
  expect((await send(body,sign(JSON.stringify({events})))).statusCode).toBe(401);
  expect(await db.lineMessagingEvent.count({where:{providerEventIdentity:{in:ids}}})).toBe(0);
  expect((await send(body)).statusCode).toBe(200);
  expect((await send(body)).statusCode).toBe(200);
  expect((await send(JSON.stringify({events:events.map(e=>({...e,deliveryContext:{isRedelivery:true}}))}))).statusCode).toBe(200);
  const rows=await db.lineMessagingEvent.findMany({where:{providerEventIdentity:{in:ids}}});expect(rows).toHaveLength(3);
  expect(JSON.stringify(rows)).not.toMatch(/PRIVATE_LINE_SUBJECT|私人內容|private-message|synthetic-stage-secret/);
  const handler=createLineMessagingObserverHandler(db as any),inbox=await db.providerWebhookInbox.findUniqueOrThrow({where:{providerWebhookInboxId:rows[0].providerWebhookInboxId}});
  expect(await handler.process({...inbox} as any)).toBe('SUCCESS');expect(await handler.process({...inbox} as any)).toBe('SUCCESS');
  const processed=await db.lineMessagingEvent.findMany({where:{providerEventIdentity:{in:ids}}});expect(processed.every(e=>e.status==='PROCESSED'&&e.attemptCount===1)).toBe(true);
 });
 it.each(['{}','{"events":{}}','{"events":[null]}','{"events":[{"webhookEventId":"bad","type":"message","timestamp":1}]}'])('rejects signed malformed payload without persistence: %s',async body=>{
  const before=await db.providerWebhookInbox.count();expect((await send(body)).statusCode).toBe(401);expect(await db.providerWebhookInbox.count()).toBe(before);
 });
 it('rejects malformed JSON and unsigned requests',async()=>{
  expect((await send('{')).statusCode).toBe(400);
  expect((await app.inject({method:'POST',url:path,headers:{'content-type':'application/json'},payload:'{"events":[]}'})).statusCode).toBe(401);
 });
});
