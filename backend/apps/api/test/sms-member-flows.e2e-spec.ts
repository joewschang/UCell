import {PrismaService} from '@ucell/database';
import {ConfigService} from '@nestjs/config';
import {randomUUID} from 'node:crypto';
import {ContactVerificationService} from '../src/modules/auth/contact-verification.service';
import {SmsLoginService} from '../src/modules/auth/sms-login.service';
import {SmsNotificationService} from '../src/modules/auth/sms-notification.service';
import {SmsNotificationGuard} from '../src/modules/auth/sms-notification.controller';
import {AuditService} from '../src/common/audit/audit.service';
describe('SMS member flows against isolated PostgreSQL',()=>{
 const db=new PrismaService(),codes=new Map<string,string>();
 const config=new ConfigService({AUTH_MEMBER_SMS_LOGIN_ENABLED:'true',SMS_NOTIFICATIONS_ENABLED:'true',OTP_HASH_SECRET:'TEST_ONLY_SMS_SECRET_32_CHARACTERS_LONG'});
 const provider={assertConfigured:jest.fn(),send:jest.fn(async(mobile:string,code:string)=>{codes.set(mobile,code);return {providerRef:randomUUID()}}),sendMessage:jest.fn(async()=>({providerRef:randomUUID()}))};
 const verification=new ContactVerificationService(db,config,provider as any,{} as any,{} as any,{} as any),login=new SmsLoginService(db,config,verification);
 const notices=new SmsNotificationService(db,config,provider as any,new AuditService());
 beforeAll(()=>{const url=new URL(process.env.DATABASE_URL!);if(!['127.0.0.1','localhost'].includes(url.hostname)||!url.pathname.startsWith('/ucell_jest_'))throw Error('Isolated database required');});
 afterAll(()=>db.$disconnect());
 async function person(verified=true){return db.person.create({data:{legalName:'SMS TEST',mobile:'+8869'+String(Math.floor(Math.random()*1e8)).padStart(8,'0'),mobileVerifiedAt:verified?new Date():null,status:'EFFECTIVE',securityStatus:'NORMAL'}});}
 it('issues one session under concurrent replay, only after valid phone proof',async()=>{
  const p=await person(),c=await login.request(p.mobile!,randomUUID());
  expect(c.status).toBe('ACCEPTED');
  await expect(login.login(p.mobile!,c.challengeId,'abcdef')).rejects.toThrow();
  const result=await Promise.allSettled([login.login(p.mobile!,c.challengeId,codes.get(p.mobile!)!),login.login(p.mobile!,c.challengeId,codes.get(p.mobile!)!)]);
  expect(result.filter(r=>r.status==='fulfilled')).toHaveLength(1);
  expect(await db.authSession.count({where:{personId:p.personId}})).toBe(1);
 });
 it('never sends login codes for unverified or ambiguous phones and gives generic acceptance',async()=>{
  const p=await person(false),calls=provider.send.mock.calls.length;
  const c=await login.request(p.mobile!,randomUUID());expect(c.status).toBe('ACCEPTED');expect(provider.send).toHaveBeenCalledTimes(calls);
  await expect(login.login(p.mobile!,c.challengeId,'123456')).rejects.toThrow();
  const shared=await person();await db.person.create({data:{legalName:'SMS TEST DUPLICATE',mobile:shared.mobile,status:'EFFECTIVE',securityStatus:'NORMAL',mobileVerifiedAt:new Date()}});
  await login.request(shared.mobile!,randomUUID());expect(provider.send).toHaveBeenCalledTimes(calls);
 });
 it('rechecks disabled member before issuing a session',async()=>{
  const p=await person(),c=await login.request(p.mobile!,randomUUID());
  await db.person.update({where:{personId:p.personId},data:{securityStatus:'SECURITY_LOCKED'}});
  await expect(login.login(p.mobile!,c.challengeId,codes.get(p.mobile!)!)).rejects.toThrow();
  expect(await db.authSession.count({where:{personId:p.personId}})).toBe(0);
 });
 it('reserves one notification send on concurrent retries and masks phones in preview',async()=>{
  const p=await person(),draft=await notices.draft('ADMIN_LOCAL:test',{message:'測試通知',memberNos:[p.memberNo]},randomUUID());
  expect(JSON.stringify(draft)).not.toContain(p.mobile!);const calls=provider.sendMessage.mock.calls.length;
  await Promise.all([notices.send('ADMIN_LOCAL:test',draft.id,draft.contentHash,1),notices.send('ADMIN_LOCAL:test',draft.id,draft.contentHash,1)]);
  expect(provider.sendMessage).toHaveBeenCalledTimes(calls+1);
  await expect(notices.send('ADMIN_LOCAL:other',draft.id,draft.contentHash,1)).rejects.toThrow();
 });
 it('does not send when a recipient phone changed after preview',async()=>{
  const p=await person(),draft=await notices.draft('ADMIN_LOCAL:test',{message:'測試通知',memberNos:[p.memberNo]},randomUUID());
  await db.person.update({where:{personId:p.personId},data:{mobileVerifiedAt:null}});
  const calls=provider.sendMessage.mock.calls.length;
  await expect(notices.send('ADMIN_LOCAL:test',draft.id,draft.contentHash,1)).rejects.toThrow();expect(provider.sendMessage).toHaveBeenCalledTimes(calls);
 });
 it('records ambiguous provider failures without retrying or claiming delivery',async()=>{
  const p=await person(),draft=await notices.draft('ADMIN_LOCAL:test',{message:'測試通知',memberNos:[p.memberNo]},randomUUID());
  provider.sendMessage.mockRejectedValueOnce(Error('timeout'));
  const result=await notices.send('ADMIN_LOCAL:test',draft.id,draft.contentHash,1);expect(result.status).toBe('UNKNOWN');
  const calls=provider.sendMessage.mock.calls.length;await notices.send('ADMIN_LOCAL:test',draft.id,draft.contentHash,1);expect(provider.sendMessage).toHaveBeenCalledTimes(calls);
 });
 it('refuses admin DEV_BYPASS without a real bearer session',async()=>{
  const guard=new SmsNotificationGuard({authenticate:jest.fn()} as any);
  await expect(guard.canActivate({switchToHttp:()=>({getRequest:()=>({headers:{},user:{role:'SUPER_ADMIN',sessionId:'DEV_BYPASS'}})})} as any)).rejects.toThrow('ADMIN_BEARER_REQUIRED');
 });
 it('rejects invalid notification request keys before querying or sending',async()=>{
  await expect(notices.draft('ADMIN_LOCAL:test',{message:'test',allVerified:true},'invalid-key')).rejects.toThrow();
 });
 it('allows idempotent OTP replay at the global budget without another provider call',async()=>{
  const p=await person(),key=randomUUID(),challenge=await login.request(p.mobile!,key);
  const used=await db.contactVerificationChallenge.count({where:{channel:'SMS'}});
  config.set('SMS_OTP_DAILY_LIMIT',String(used));const calls=provider.send.mock.calls.length;
  try{expect((await login.request(p.mobile!,key)).challengeId).toBe(challenge.challengeId);expect(provider.send).toHaveBeenCalledTimes(calls);const other=await person();await expect(login.request(other.mobile!,randomUUID())).rejects.toThrow();}
  finally{config.set('SMS_OTP_DAILY_LIMIT','200');}
 });
});
