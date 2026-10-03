import {ConfigService} from '@nestjs/config';
import {ContactVerificationEmailService} from '../src/modules/auth/contact-verification-email.service';
describe('Contact verification email delivery contract',()=>{
 const original=global.fetch;
 afterEach(()=>{global.fetch=original});
 it('requests delivery from the approved company sender and does not report provider rejection as success',async()=>{
  const fetch=jest.fn(async()=>new Response('',{status:202}));global.fetch=fetch as any;
  const service=new ContactVerificationEmailService(new ConfigService({CONTACT_VERIFICATION_EMAIL_WEBHOOK_URL:'https://delivery.example.invalid/send',CONTACT_VERIFICATION_EMAIL_WEBHOOK_TOKEN:'TEST_ONLY_TOKEN'}));
  await service.send('recipient@example.invalid','123456');
  const init=(fetch.mock.calls[0] as any)[1];
  expect(JSON.parse(init.body)).toEqual({template:'UCELL_CONTACT_VERIFICATION',from:'service@ucell.life',to:'recipient@example.invalid',code:'123456',expiresInSeconds:300});
  fetch.mockResolvedValueOnce(new Response('',{status:403}));
  await expect(service.send('recipient@example.invalid','123456')).rejects.toMatchObject({response:{code:'EMAIL_DELIVERY_FAILED'}});
 });
});
