import {PrismaService} from '@ucell/database';
import {ConfigService} from '@nestjs/config';
import {createHash,randomUUID} from 'node:crypto';
import {ContactVerificationService} from '../src/modules/auth/contact-verification.service';
import {MemberWebRegistrationService} from '../src/modules/auth/member-web-registration.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {PiiCryptoService} from '../src/common/security/pii-crypto.service';
import {IdentityMatchFingerprintService} from '../src/common/security/identity-match-fingerprint.service';
import {MemberService} from '../src/modules/member/member.service';
describe('Contact verification (real isolated DB; synthetic delivery providers)',()=>{
 const db=new PrismaService(),codes=new Map<string,string>();
 const sms={assertConfigured:jest.fn(),send:jest.fn(async(destination:string,code:string)=>{codes.set(destination,code);return {providerRef:randomUUID()}})};
 const email={assertConfigured:jest.fn(),send:jest.fn(async(destination:string,code:string)=>{codes.set(destination,code)})};
 const service=new ContactVerificationService(db,new ConfigService({OTP_HASH_SECRET:'TEST_ONLY_CONTACT_SECRET_32_CHARACTERS'}),sms as any,email as any,{verify:async(token:string)=>({subject:token})} as any,{verify:async(token:string)=>({subject:token})} as any);
 beforeAll(()=>{const url=new URL(process.env.DATABASE_URL!);if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^\/ucell_jest_[a-f0-9]{32}$/.test(url.pathname))throw Error('Isolated API DB required');});
 afterAll(()=>db.$disconnect());
 function fixture(){return {owner:'GOOGLE:'+randomUUID(),destination:'+8869'+String(Math.floor(Math.random()*1e8)).padStart(8,'0')};}
 async function verified(owner:string,destination:string,channel:'SMS'|'EMAIL'='SMS'){
  const challenge=await service.send(owner,'REGISTRATION',channel,destination,randomUUID());
  const result=await service.verify(owner,'REGISTRATION',channel,destination,challenge.challengeId,codes.get(destination)!);
  return {...challenge,...result};
 }
 it('normalizes contacts, never persists raw codes or destinations, and returns proof only after verification',async()=>{
  const {owner,destination}=fixture(),result=await verified(owner,destination);
  expect(result.proof).toMatch(/^[a-f0-9]{64}$/);
  const row=await db.contactVerificationChallenge.findUniqueOrThrow({where:{id:result.challengeId}}),stored=JSON.stringify(row);
  expect(stored).not.toContain(destination);expect(row.codeHash).not.toBe(codes.get(destination));expect(row.proofHash).not.toBe(result.proof);
 });
 it('binds proof to identity, destination, channel and purpose; consumes once atomically',async()=>{
  const {owner,destination}=fixture(),result=await verified(owner,destination);
  for(const context of [{owner:'GOOGLE:'+randomUUID(),purpose:'REGISTRATION',channel:'SMS',destination},{owner,purpose:'PROFILE',channel:'SMS',destination},{owner,purpose:'REGISTRATION',channel:'EMAIL',destination:'other@example.invalid'},{owner,purpose:'REGISTRATION',channel:'SMS',destination:fixture().destination}]){
   await expect(db.$transaction(tx=>service.consume(tx,context.owner,context.purpose as any,context.channel as any,context.destination,result.proof))).rejects.toMatchObject({response:{code:'CONTACT_VERIFICATION_PROOF_INVALID'}});
  }
  await expect(db.$transaction(async tx=>{await service.consume(tx,owner,'REGISTRATION','SMS',destination,result.proof);throw Error('rollback')})).rejects.toThrow('rollback');
  const results=await Promise.allSettled([db.$transaction(tx=>service.consume(tx,owner,'REGISTRATION','SMS',destination,result.proof)),db.$transaction(tx=>service.consume(tx,owner,'REGISTRATION','SMS',destination,result.proof))]);
  expect(results.filter(r=>r.status==='fulfilled')).toHaveLength(1);
 });
 it('commits incorrect attempts and locks after five, even when the correct code is submitted later',async()=>{
  const {owner,destination}=fixture(),challenge=await service.send(owner,'REGISTRATION','SMS',destination,randomUUID());
  const bad=codes.get(destination)==='000000'?'000001':'000000';
  for(let i=0;i<5;i++)await expect(service.verify(owner,'REGISTRATION','SMS',destination,challenge.challengeId,bad)).rejects.toThrow();
  expect((await db.contactVerificationChallenge.findUniqueOrThrow({where:{id:challenge.challengeId}})).attempts).toBe(5);
  await expect(service.verify(owner,'REGISTRATION','SMS',destination,challenge.challengeId,codes.get(destination)!)).rejects.toMatchObject({response:{code:'OTP_CHALLENGE_LOCKED'}});
 });
 it('rejects expired codes and proofs, and requires both channels independently',async()=>{
  const {owner,destination}=fixture(),challenge=await verified(owner,destination);
  await db.contactVerificationChallenge.update({where:{id:challenge.challengeId},data:{expiresAt:new Date(0)}});
  await expect(service.verify(owner,'REGISTRATION','SMS',destination,challenge.challengeId,codes.get(destination)!)).rejects.toThrow();
  await expect(db.$transaction(tx=>service.consume(tx,owner,'REGISTRATION','SMS',destination,challenge.proof))).rejects.toThrow();
  await expect(db.$transaction(tx=>service.consume(tx,owner,'REGISTRATION','EMAIL','test@example.invalid'))).rejects.toMatchObject({response:{code:'EMAIL_VERIFICATION_REQUIRED'}});
 });
 it('reserves before delivery, enforces cooldown across identities and does not duplicate sends on retry',async()=>{
  const {owner,destination}=fixture(),key=randomUUID(),before=sms.send.mock.calls.length;
  const first=await service.send(owner,'REGISTRATION','SMS',destination,key),repeat=await service.send(owner,'REGISTRATION','SMS',destination,key);
  expect(repeat.challengeId).toBe(first.challengeId);expect(sms.send.mock.calls.length-before).toBe(1);
  await expect(service.send('LINE:'+randomUUID(),'REGISTRATION','SMS',destination,randomUUID())).rejects.toMatchObject({response:{code:'OTP_RESEND_COOLDOWN'}});
  await expect(service.send(owner,'REGISTRATION','SMS',fixture().destination,key)).rejects.toMatchObject({response:{code:'OTP_REQUEST_KEY_CONFLICT'}});
 });
 it('marks provider failure unavailable and never verifies a failed delivery',async()=>{
  const {owner,destination}=fixture();sms.send.mockRejectedValueOnce(Error('TEST_FAILURE'));
  await expect(service.send(owner,'REGISTRATION','SMS',destination,randomUUID())).rejects.toThrow();
  const row=await db.contactVerificationChallenge.findFirstOrThrow({where:{status:'FAILED'},orderBy:{createdAt:'desc'}});
  await expect(service.verify(owner,'REGISTRATION','SMS',destination,row.id,'000000')).rejects.toThrow();
 });
 it('verifies email separately and rejects another subject attempting to verify its challenge',async()=>{
  const owner='GOOGLE:'+randomUUID(),destination=randomUUID()+'@example.invalid',challenge=await service.send(owner,'REGISTRATION','EMAIL',destination,randomUUID());
  await expect(service.verify('LINE:'+randomUUID(),'REGISTRATION','EMAIL',destination,challenge.challengeId,codes.get(destination)!)).rejects.toThrow();
  const result=await service.verify(owner,'REGISTRATION','EMAIL',destination,challenge.challengeId,codes.get(destination)!);
  await expect(db.$transaction(tx=>service.consume(tx,owner,'REGISTRATION','EMAIL',destination,result.proof))).resolves.toBeInstanceOf(Date);
 });
 it('enforces both proofs during real registration, rolls back partial consumption and stores verified dates',async()=>{
  const subject=randomUUID(),owner='GOOGLE:'+subject,destination=fixture().destination,emailAddress=subject+'@example.invalid';
  const pii=new PiiCryptoService(),fingerprint=new IdentityMatchFingerprintService();
  const originalKey=process.env.PII_ENCRYPTION_KEY,originalVersion=process.env.PII_ENCRYPTION_KEY_VERSION;
  process.env.PII_ENCRYPTION_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';process.env.PII_ENCRYPTION_KEY_VERSION='TEST_ONLY_CONTACT';
  try{
   const content='TEST ONLY CONTACT CONTRACT';
   const contract=await db.contractDocumentVersion.create({data:{contractType:'NETWORK_MEMBERSHIP',versionCode:'TEST_'+randomUUID(),title:content,contentText:content,contentHash:createHash('sha256').update(content).digest('hex'),audience:'NETWORK_MEMBER',required:true,effectiveFrom:new Date('2020-01-01'),approvalReference:'TEST_ONLY'}});
   const registration=new MemberWebRegistrationService(db,new IdempotencyService(db),{verify:async()=>({subject,email:emailAddress,emailVerified:true})} as any,pii,fingerprint,undefined,service);
   const input={contractVersionId:contract.contractDocumentVersionId,accepted:true as const,legalName:'TEST ONLY CONTACT',alias:'TEST',gender:'UNDISCLOSED',birthDate:'1990-01-02',nationalityCode:'TW',identityDocumentType:'NATIONAL_ID' as const,identityDocumentNumber:'TEST-'+randomUUID(),mobile:destination,email:emailAddress,password:'TEST_ONLY_PASSWORD_123!',googleIdToken:subject};
   const before=await db.person.count();
   await expect(registration.complete(input,randomUUID())).rejects.toMatchObject({response:{code:'MOBILE_VERIFICATION_REQUIRED'}});
   const smsProof=await verified(owner,destination);
   await expect(registration.complete({...input,mobileVerificationProof:smsProof.proof},randomUUID())).rejects.toMatchObject({response:{code:'EMAIL_VERIFICATION_REQUIRED'}});
   expect(await db.person.count()).toBe(before);
   expect((await db.contactVerificationChallenge.findUniqueOrThrow({where:{id:smsProof.challengeId}})).consumedAt).toBeNull();
   const emailProof=await verified(owner,emailAddress,'EMAIL'),key=randomUUID();
   const payload={...input,mobileVerificationProof:smsProof.proof,emailVerificationProof:emailProof.proof};
   const result=await registration.complete(payload,key);
   const person=await db.person.findUniqueOrThrow({where:{memberNo:result.memberNo}});
   expect(person.mobileVerifiedAt).toBeInstanceOf(Date);expect(person.emailVerifiedAt).toBeInstanceOf(Date);
   expect(await registration.complete(payload,key)).toMatchObject({replayed:true,memberNo:result.memberNo});
   const member=new MemberService(db,{} as any,{} as any,{write:async()=>{}} as any,service),changedEmail=randomUUID()+'@example.invalid';
   await expect(member.profile(person.personId,{email:changedEmail},randomUUID(),randomUUID())).rejects.toMatchObject({response:{code:'EMAIL_VERIFICATION_REQUIRED'}});
   await expect(member.profile(person.personId,{email:changedEmail,emailVerificationProof:emailProof.proof},randomUUID(),randomUUID())).rejects.toThrow();
   const challenge=await service.send('PERSON:'+person.personId,'PROFILE','EMAIL',changedEmail,randomUUID());
   const proof=await service.verify('PERSON:'+person.personId,'PROFILE','EMAIL',changedEmail,challenge.challengeId,codes.get(changedEmail)!);
   expect(await member.profile(person.personId,{email:changedEmail,emailVerificationProof:proof.proof},randomUUID(),randomUUID())).toMatchObject({email:changedEmail,emailVerifiedAt:expect.any(String)});
  }finally{
   if(originalKey===undefined)delete process.env.PII_ENCRYPTION_KEY;else process.env.PII_ENCRYPTION_KEY=originalKey;
   if(originalVersion===undefined)delete process.env.PII_ENCRYPTION_KEY_VERSION;else process.env.PII_ENCRYPTION_KEY_VERSION=originalVersion;
  }
 });
 it('serializes concurrent delivery retries so only one message is sent',async()=>{
  const {owner,destination}=fixture(),key=randomUUID(),before=sms.send.mock.calls.length;
  const results=await Promise.all([service.send(owner,'REGISTRATION','SMS',destination,key),service.send(owner,'REGISTRATION','SMS',destination,key)]);
  expect(results[0].challengeId).toBe(results[1].challengeId);expect(sms.send.mock.calls.length-before).toBe(1);
 });
 it('permits Email-first only in Stage and never marks an unproven phone verified',async()=>{
  const make=(settings:Record<string,string>)=>new ContactVerificationService(db,new ConfigService({OTP_HASH_SECRET:'TEST_ONLY_CONTACT_SECRET_32_CHARACTERS',...settings}),sms as any,email as any,{} as any,{} as any);
  expect(make({}).policy()).toEqual({emailRequired:true,smsRequired:true});
  for(const settings of [{CONTACT_VERIFICATION_SMS_REQUIRED:'false'}, {CONTACT_VERIFICATION_SMS_REQUIRED:'false',UCELL_ENVIRONMENT:'PRODUCTION'}, {CONTACT_VERIFICATION_SMS_REQUIRED:'typo',UCELL_ENVIRONMENT:'STAGE'}])expect(()=>make(settings).policy()).toThrow();
  const stage=make({CONTACT_VERIFICATION_SMS_REQUIRED:'false',UCELL_ENVIRONMENT:'STAGE'}),owner='PERSON:'+randomUUID(),phone=fixture().destination;
  expect(stage.policy()).toEqual({emailRequired:true,smsRequired:false});
  expect(await stage.consumeMobile({},owner,'PROFILE',phone)).toBeNull();
  await expect(stage.consumeMobile({},owner,'PROFILE','invalid')).rejects.toThrow();
  await expect(stage.consumeMobile(db,owner,'PROFILE',phone,'invalid')).rejects.toThrow();
  await expect(stage.send(owner,'PROFILE','SMS',phone,randomUUID())).rejects.toMatchObject({response:{code:'SMS_PROVIDER_CONFIGURATION_PENDING'}});
  const person=await db.person.create({data:{legalName:'TEST ONLY EMAIL FIRST',mobile:phone,mobileVerifiedAt:new Date()}});
  const member=new MemberService(db,{} as any,{} as any,{write:async()=>{}} as any,stage),destination=randomUUID()+'@example.invalid';
  await expect(member.profile(person.personId,{email:destination,phone:fixture().destination},randomUUID(),randomUUID())).rejects.toMatchObject({response:{code:'EMAIL_VERIFICATION_REQUIRED'}});
  const challenge=await stage.send('PERSON:'+person.personId,'PROFILE','EMAIL',destination,randomUUID());
  const proof=await stage.verify('PERSON:'+person.personId,'PROFILE','EMAIL',destination,challenge.challengeId,codes.get(destination)!);
  const result=await member.profile(person.personId,{email:destination,emailVerificationProof:proof.proof,phone:fixture().destination},randomUUID(),randomUUID());
  expect(result.emailVerifiedAt).toEqual(expect.any(String));expect(result.mobileVerifiedAt).toBeNull();
  await expect(member.profile(person.personId,{email:randomUUID()+'@example.invalid',emailVerificationProof:proof.proof},randomUUID(),randomUUID())).rejects.toThrow();
 });

});
