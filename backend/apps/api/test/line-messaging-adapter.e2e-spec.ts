import { createHmac } from 'node:crypto';
import { LineMessagingAdapter } from '../src/modules/auth/line-messaging.adapter';

describe('LINE Messaging adapter',()=>{
 const adapter=new LineMessagingAdapter(),secret='synthetic-channel-secret',body=Buffer.from('{"events":[]}');
 it('validates LINE HMAC-SHA256 over the exact raw body',()=>{
  const signature=createHmac('sha256',secret).update(body).digest('base64');
  expect(adapter.validateWebhookSignature(body,signature,secret)).toBe(true);
  expect(adapter.validateWebhookSignature(Buffer.from('{"events":[1]}'),signature,secret)).toBe(false);
 });
 it('fails closed for missing secret or malformed signature',()=>{
  expect(adapter.validateWebhookSignature(body,undefined,secret)).toBe(false);
  expect(adapter.validateWebhookSignature(body,'x',undefined)).toBe(false);
 });
 it('normalizes only events with a stable provider identity',()=>{
  expect(adapter.normalizeWebhookEvent({webhookEventId:'event-1',type:'follow',timestamp:1720000000000,source:{userId:'line-user'}})).toEqual({eventId:'event-1',type:'follow',timestamp:1720000000000,sourceUserId:'line-user'});
  expect(adapter.normalizeWebhookEvent({type:'follow',timestamp:1})).toBeNull();
 });
});
