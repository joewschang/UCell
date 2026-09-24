import { NotificationDeliveryService } from '../src/modules/auth/notification-delivery.service';
describe('notification delivery foundation',()=>{
 it('allows only approved LINE notification types and remains configuration pending',async()=>{
  const create=jest.fn().mockResolvedValue({status:'CONFIGURATION_PENDING'}),service=new NotificationDeliveryService({notificationDelivery:{create}} as any);
  await expect(service.queue({personId:'p',type:'ORDER',sourceReference:'order-1'})).resolves.toEqual({status:'CONFIGURATION_PENDING'});
  expect(create).toHaveBeenCalledWith(expect.objectContaining({data:expect.objectContaining({status:'CONFIGURATION_PENDING',channel:'LINE',notificationType:'ORDER',evidenceHash:expect.stringMatching(/^[a-f0-9]{64}$/)})}));
  await expect(service.queue({personId:'p',type:'PV_UPDATE',sourceReference:'x'})).rejects.toMatchObject({response:{code:'LINE_NOTIFICATION_TYPE_NOT_ALLOWED'}});
 });
});
