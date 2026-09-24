import { createLineMessagingObserverHandler } from '../../worker/src/line-messaging-handler';

const base={providerWebhookInboxId:'10000000-0000-4000-8000-000000000001',providerEventIdentity:null,payloadHash:'a'.repeat(64),safeEvidenceRef:'line://messaging/webhook',correlationId:'20000000-0000-4000-8000-000000000001',attemptCount:1,leaseOwner:'worker-1',leaseExpiresAt:new Date()};
describe('LINE Messaging worker observer',()=>{
 it('acknowledges only the exact LINE identity inbox registration',async()=>{
  const updateMany=jest.fn().mockResolvedValue({count:1}),handler=createLineMessagingObserverHandler({lineMessagingEvent:{updateMany}} as any);
  await expect(handler.process({...base,domain:'IDENTITY',provider:'LINE_MESSAGING',connectionId:'LINE_MESSAGING_DEFAULT'})).resolves.toBe('SUCCESS');
  await expect(handler.process({...base,domain:'PAYMENT',provider:'LINE_MESSAGING',connectionId:'LINE_MESSAGING_DEFAULT'})).resolves.toBe('PERMANENT_FAILURE');
  expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({eventType:{in:['follow','unfollow','postback']},status:'PENDING'})}));
 });
});
