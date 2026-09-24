import { LineIntegrationStatusService } from '../src/modules/auth/line-integration-status.service';

describe('LINE integration readiness',()=>{
  it('returns only readiness flags, aggregate delivery states, and safe webhook metadata',async()=>{
    const service=new LineIntegrationStatusService({notificationDelivery:{groupBy:jest.fn().mockResolvedValue([{status:'CONFIGURATION_PENDING',_count:{_all:2}}])},providerWebhookInbox:{findFirst:jest.fn().mockResolvedValue({receivedAt:new Date('2026-09-24T00:00:00Z'),status:'PROCESSED'})}} as any,{get:jest.fn((key:string)=>({LINE_MESSAGING_CHANNEL_SECRET:'secret-present',LINE_MESSAGING_CONFIG_VERSION:'v1',LINE_MESSAGING_CHANNEL_ACCESS_TOKEN:undefined,LINE_MESSAGING_WORKER_ENABLED:'false'}[key]))} as any);
    await expect(service.read()).resolves.toEqual({messaging:{webhookConfigured:true,senderConfigured:false,workerEnabled:false,lastWebhook:{receivedAt:new Date('2026-09-24T00:00:00Z'),status:'PROCESSED'}},deliveries:[{status:'CONFIGURATION_PENDING',count:2}]});
  });
});