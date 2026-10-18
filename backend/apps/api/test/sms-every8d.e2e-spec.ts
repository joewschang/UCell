import {ConfigService} from '@nestjs/config';
import {SmsOtpProviderService} from '../src/modules/auth/sms-otp-provider.service';
describe('Every8D SMS adapter',()=>{
 const original=global.fetch;
 afterEach(()=>{global.fetch=original});
 const provider=()=>new SmsOtpProviderService(new ConfigService({EVERY8D_SMS_ENDPOINT:'https://oms.every8d.com/API21/HTTP/SendSMS.ashx',EVERY8D_UID:'TEST_ONLY_UID',EVERY8D_PASSWORD:'TEST_ONLY_PASSWORD'}));
 it('uses HTTPS POST body credentials and treats accepted single-recipient batch as submitted',async()=>{
  const fetch=jest.fn(async()=>new Response('100,1,1,0,11111111-1111-4111-8111-111111111111'));global.fetch=fetch as any;
  await expect(provider().send('+886912345678','123456')).resolves.toMatchObject({providerRef:'11111111-1111-4111-8111-111111111111'});
  const [url,init]=fetch.mock.calls[0] as any;expect(url).not.toContain('TEST_ONLY_PASSWORD');expect(init.method).toBe('POST');expect(init.body.get('DEST')).toBe('+886912345678');expect(init.body.get('RETRYTIME')).toBe('5');
 });
 it.each(['-99,Provider error','0,0,0,1,11111111-1111-4111-8111-111111111111','100,1,1,0,invalid'])('does not mistake provider response %s for success',async text=>{
  global.fetch=jest.fn(async()=>new Response(text)) as any;await expect(provider().send('+886912345678','123456')).rejects.toMatchObject({response:{code:'SMS_DELIVERY_FAILED'}});
 });
 it('rejects an edge HTTP 403 without accepting or retrying delivery',async()=>{
  const call=jest.fn(async()=>new Response('<html>CloudFront</html>',{status:403}));global.fetch=call as any;
  await expect(provider().send('+886912345678','123456')).rejects.toMatchObject({response:{code:'SMS_DELIVERY_FAILED'}});expect(call).toHaveBeenCalledTimes(1);
 });
 it('fails closed when the account is not configured and does not contact a provider',async()=>{
  global.fetch=jest.fn() as any;await expect(new SmsOtpProviderService(new ConfigService()).send('+886912345678','123456')).rejects.toMatchObject({response:{code:'SMS_PROVIDER_CONFIGURATION_PENDING'}});expect(global.fetch).not.toHaveBeenCalled();
 });
 it('uses comma-separated recipients and does not claim partial acceptance as success',async()=>{
  const call=jest.fn(async()=>new Response('100,2,2,0,11111111-1111-4111-8111-111111111111'));global.fetch=call as any;
  await provider().sendMessage(['+886912345678','+886912345679'],'UCell 通知');
  expect((call.mock.calls[0] as any)[1].body.get('DEST')).toBe('+886912345678,+886912345679');
  global.fetch=jest.fn(async()=>new Response('0,1,1,1,11111111-1111-4111-8111-111111111111')) as any;
  await expect(provider().sendMessage(['+886912345678','+886912345679'],'UCell 通知')).rejects.toThrow();
 });
});
