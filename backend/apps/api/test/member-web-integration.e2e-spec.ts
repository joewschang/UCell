import {PrismaService} from '@ucell/database';
import {createHash,randomUUID} from 'node:crypto';
import {ConfigService} from '@nestjs/config';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {PiiCryptoService} from '../src/common/security/pii-crypto.service';
import {IdentityMatchFingerprintService} from '../src/common/security/identity-match-fingerprint.service';
import {MemberWebRegistrationService} from '../src/modules/auth/member-web-registration.service';
import {MemberWebAuthService} from '../src/modules/auth/member-web-auth.service';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {MemberIdentityService} from '../src/modules/auth/member-identity.service';

describe('Integrated Web identity and password lifecycle (real isolated DB, synthetic Google verifier)',()=>{
 const db=new PrismaService(),pii=new PiiCryptoService(),fingerprint=new IdentityMatchFingerprintService();
 const sessions=new IdentityTokenService(db),identities=new MemberIdentityService(db);
 const google={verify:jest.fn(async(token:string)=>({subject:token,email:token+'@example.invalid',emailVerified:true,expiresAt:Math.floor(Date.now()/1000)+3600}))};
 const registration=new MemberWebRegistrationService(db,new IdempotencyService(db),google as any,pii,fingerprint);
 const auth=new MemberWebAuthService(db,sessions,google as any,{} as any,new ConfigService({MEMBER_SESSION_TTL_SECONDS:3600}));
 const original={key:process.env.PII_ENCRYPTION_KEY,version:process.env.PII_ENCRYPTION_KEY_VERSION};
 let contractId:string;
 beforeAll(async()=>{
  const url=new URL(process.env.DATABASE_URL!);
  if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^\/ucell_jest_[a-f0-9]{32}$/.test(url.pathname))throw Error('Use isolated API DB harness');
  process.env.PII_ENCRYPTION_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';process.env.PII_ENCRYPTION_KEY_VERSION='TEST_ONLY_WEB_INTEGRATION';
  const text='TEST ONLY NETWORK CONTRACT';
  contractId=(await db.contractDocumentVersion.create({data:{contractType:'NETWORK_MEMBERSHIP',versionCode:'TEST_'+randomUUID(),title:text,contentText:text,contentHash:createHash('sha256').update(text).digest('hex'),audience:'NETWORK_MEMBER',required:true,effectiveFrom:new Date('2020-01-01'),approvalReference:'TEST_ONLY'}})).contractDocumentVersionId;
 });
 afterAll(async()=>{
  if(original.key===undefined)delete process.env.PII_ENCRYPTION_KEY;else process.env.PII_ENCRYPTION_KEY=original.key;
  if(original.version===undefined)delete process.env.PII_ENCRYPTION_KEY_VERSION;else process.env.PII_ENCRYPTION_KEY_VERSION=original.version;
  await db.$disconnect();
 });
 function input(){const token='synthetic-'+randomUUID();return {contractVersionId:contractId,accepted:true as const,legalName:'TEST ONLY APPLICANT',alias:'TEST',gender:'UNDISCLOSED',birthDate:'1990-01-02',nationalityCode:'TW',identityDocumentType:'NATIONAL_ID' as const,identityDocumentNumber:'TEST-ID-'+randomUUID(),mobile:'+8869'+String(Math.floor(Math.random()*1e8)).padStart(8,'0'),email:token+'@example.invalid',password:'TEST_ONLY_PASSWORD_123!',googleIdToken:token};}
 it('stores the same encrypted document identity as LINE registration, issues provider-neutral sessions and creates no Ball',async()=>{
  const payload=input(),before=await db.qualification.count();
  const result=await registration.complete(payload,randomUUID());
  const person=await db.person.findUniqueOrThrow({where:{memberNo:result.memberNo},include:{memberPasswordCredential:true}});
  expect(person).toMatchObject({nationalityCode:'TW',identityDocumentType:'NATIONAL_ID',membershipState:'NETWORK_MEMBER',mobileVerifiedAt:null});
  expect(person.identityDocumentFingerprint).toBe(fingerprint.fingerprintIdentityDocument('TW','NATIONAL_ID',payload.identityDocumentNumber));
  expect(pii.decrypt(person.identityDocumentNumberCiphertext!,person.identityDocumentKeyVersion!)).toBe(fingerprint.normalizeIdentityDocumentNumber(payload.identityDocumentNumber));
  expect(person.memberPasswordCredential!.passwordHash).not.toContain(payload.password);
  expect(JSON.stringify(result)).not.toContain(payload.identityDocumentNumber);
  expect((await sessions.authenticate(result.accessToken)).personId).toBe(person.personId);
  const local=await auth.passwordLogin(person.memberNo,payload.password);
  expect(await sessions.authenticate(local.accessToken)).toMatchObject({personId:person.personId,provider:'MEMBER_LOCAL',role:null});
  expect(await identities.resolve({provider:'MEMBER_LOCAL',subject:person.memberNo,personId:person.personId})).toMatchObject({personId:person.personId});
  expect(await db.qualification.count()).toBe(before);
 });
 it('rejects a Google email mismatch before creating any Person',async()=>{
  const payload=input(),before=await db.person.count();
  await expect(registration.complete({...payload,email:'different@example.invalid'},randomUUID())).rejects.toMatchObject({response:{code:'GOOGLE_EMAIL_MISMATCH'}});
  expect(await db.person.count()).toBe(before);
 });
 it('blocks a repeated document identity across Google accounts without duplicate Person creation',async()=>{
  const first=input();await registration.complete(first,randomUUID());const before=await db.person.count();
  await expect(registration.complete({...input(),identityDocumentNumber:first.identityDocumentNumber},randomUUID())).rejects.toMatchObject({response:{code:'IDENTITY_DOCUMENT_ALREADY_REGISTERED'}});
  expect(await db.person.count()).toBe(before);
 });
 it('consumes a reset token once under concurrent attempts and revokes all Member sessions atomically',async()=>{
  const payload=input(),result=await registration.complete(payload,randomUUID());
  const person=await db.person.findUniqueOrThrow({where:{memberNo:result.memberNo}});
  const local=await auth.passwordLogin(person.memberNo,payload.password),token=randomUUID();
  await db.passwordResetToken.create({data:{personId:person.personId,tokenHash:createHash('sha256').update(token).digest('hex'),expiresAt:new Date(Date.now()+60000)}});
  const outcomes=await Promise.allSettled([auth.resetPassword(token,'TEST_ONLY_NEW_PASSWORD_A'),auth.resetPassword(token,'TEST_ONLY_NEW_PASSWORD_B')]);
  expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);
  expect((outcomes.find(x=>x.status==='rejected') as PromiseRejectedResult).reason).toMatchObject({response:{code:'PASSWORD_RESET_TOKEN_INVALID'}});
  await expect(sessions.authenticate(result.accessToken)).rejects.toThrow();await expect(sessions.authenticate(local.accessToken)).rejects.toThrow();
  const winner=outcomes[0].status==='fulfilled'?'TEST_ONLY_NEW_PASSWORD_A':'TEST_ONLY_NEW_PASSWORD_B';
  expect(await auth.passwordLogin(person.memberNo,winner)).toHaveProperty('accessToken');
  await expect(auth.passwordLogin(person.memberNo,payload.password)).rejects.toMatchObject({response:{code:'MEMBER_LOGIN_INVALID'}});
 });
});
