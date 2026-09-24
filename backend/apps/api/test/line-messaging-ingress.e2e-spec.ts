import { createHmac } from 'node:crypto';
import { LineMessagingAdapter } from '../src/modules/auth/line-messaging.adapter';
import { LineMessagingIngressService } from '../src/modules/auth/line-messaging-ingress.service';

describe('LINE Messaging ingress',()=>{
 const secret='synthetic-secret',body=Buffer.from(JSON.stringify({events:[{webhookEventId:'evt-1',type:'follow',timestamp:1720000000000}]}));
 it('persists only a verified raw payload in the IDENTITY inbox domain',async()=>{
  const receive=jest.fn().mockResolvedValue({providerWebhookInboxId:'inbox-1',status:'RECEIVED'});
  const db={$transaction:(work:any)=>work({lineMessagingEvent:{createMany:jest.fn()}})};
  const service=new LineMessagingIngressService({receive} as any,new LineMessagingAdapter(),db as any);
  const signature=createHmac('sha256',secret).update(body).digest('base64');
  await expect(service.receive({rawBody:body,signature,channelSecret:secret,configVersion:'dev-v1',correlationId:'10000000-0000-4000-8000-000000000001'})).resolves.toEqual({providerWebhookInboxId:'inbox-1',status:'RECEIVED',eventCount:1});
  expect(receive).toHaveBeenCalledWith(expect.objectContaining({domain:'IDENTITY',provider:'LINE_MESSAGING',rawBody:body}),expect.anything());
 });
 it('rejects invalid signatures before parsing or persistence',async()=>{
  const receive=jest.fn(),service=new LineMessagingIngressService({receive} as any,new LineMessagingAdapter(),{} as any);
  await expect(service.receive({rawBody:body,signature:'bad',channelSecret:secret,configVersion:'dev-v1'})).rejects.toMatchObject({response:{code:'LINE_WEBHOOK_SIGNATURE_INVALID'}});
  expect(receive).not.toHaveBeenCalled();
 });
});
