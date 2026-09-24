import { expireNotificationDeliveries } from '../../worker/src/main';
describe('notification delivery worker maintenance',()=>{
 it('expires only past-due undelivered records',async()=>{
  const updateMany=jest.fn().mockResolvedValue({count:2});
  await expect(expireNotificationDeliveries({notificationDelivery:{updateMany}} as any,new Date('2026-09-24T00:00:00Z'))).resolves.toEqual({count:2});
  expect(updateMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({status:{in:['PENDING','CONFIGURATION_PENDING']},expiresAt:{lte:new Date('2026-09-24T00:00:00Z')}})}));
 });
});