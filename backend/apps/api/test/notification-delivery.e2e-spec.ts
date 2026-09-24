import { NotificationDeliveryService } from '../src/modules/auth/notification-delivery.service';
describe('notification delivery foundation',()=>{
 it('queues only approved notification classes as idempotent configuration-pending records',async()=>{
  const upsert=jest.fn().mockResolvedValue({status:'CONFIGURATION_PENDING'}),service=new NotificationDeliveryService({notificationDelivery:{upsert}} as any);
  await expect(service.queue({personId:'person-1',bindingId:'binding-1',type:'ORDER',sourceReference:'order-1'})).resolves.toMatchObject({status:'CONFIGURATION_PENDING'});
  expect(upsert).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({personId_channel_notificationType_evidenceHash:expect.objectContaining({personId:'person-1',channel:'LINE',notificationType:'ORDER'})})}));
  await expect(service.queue({personId:'person-1',type:'PV_UPDATE',sourceReference:'pv-1'})).rejects.toMatchObject({response:{code:'LINE_NOTIFICATION_TYPE_NOT_ALLOWED'}});
 });
 it('expires pending records without attempting an external delivery',async()=>{
  const updateMany=jest.fn().mockResolvedValue({count:1}),service=new NotificationDeliveryService({notificationDelivery:{updateMany}} as any);
  await expect(service.expirePending({notificationDelivery:{updateMany}} as any,new Date('2026-09-24T00:00:00Z'))).resolves.toEqual({count:1});
  expect(updateMany).toHaveBeenCalledWith({where:{status:{in:['PENDING','CONFIGURATION_PENDING']},expiresAt:{lte:new Date('2026-09-24T00:00:00Z')}},data:{status:'EXPIRED'}});
 });
});