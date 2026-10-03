import {createHash,randomUUID} from 'node:crypto';
import {PrismaService,PiiCryptoService} from '@ucell/database';
import {GeoProfileService} from '../src/modules/organization-geo/geo-profile.service';

describe('Geo profile isolated DB source history',()=>{
 const db=new PrismaService(),pii=new PiiCryptoService(),service=new GeoProfileService(db,pii);
 const saved={key:process.env.PII_ENCRYPTION_KEY,version:process.env.PII_ENCRYPTION_KEY_VERSION,secret:process.env.IDENTITY_MATCH_HMAC_SECRET};
 let personId:string;
 beforeAll(async()=>{
  const url=new URL(process.env.DATABASE_URL!);
  if(!['localhost','127.0.0.1'].includes(url.hostname)||!/^\/ucell_jest_[a-f0-9]{32}$/.test(url.pathname))throw new Error('Use isolated API DB harness');
  process.env.PII_ENCRYPTION_KEY='AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=';
  process.env.PII_ENCRYPTION_KEY_VERSION='TEST_ONLY_GEO';
  process.env.IDENTITY_MATCH_HMAC_SECRET='TEST_ONLY_GEO_HMAC_SECRET_1234567890';
  personId=(await db.person.create({data:{legalName:'TEST ONLY GEO'}})).personId;
 });
 afterAll(async()=>{
  for(const [key,value] of Object.entries({PII_ENCRYPTION_KEY:saved.key,PII_ENCRYPTION_KEY_VERSION:saved.version,IDENTITY_MATCH_HMAC_SECRET:saved.secret})){if(value===undefined)delete process.env[key];else process.env[key]=value;}
  await db.$disconnect();
 });
 async function source(address:string,at:Date,approved=true){
  const payload={applicantType:'INDIVIDUAL',communicationAddress:address},encrypted=pii.encrypt(payload);
  const payloadHash=createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  const current=await db.formalMemberApplication.findFirst({where:{personId,status:'DRAFT'}});
  const app=current??await db.formalMemberApplication.create({data:{personId,status:'DRAFT',currentSnapshotHash:payloadHash}});
  const version=1+await db.formalMemberApplicationSnapshot.count({where:{formalMemberApplicationId:app.formalMemberApplicationId}});
  const snapshot=await db.formalMemberApplicationSnapshot.create({data:{formalMemberApplicationId:app.formalMemberApplicationId,version,payloadCiphertext:encrypted.ciphertext,keyVersion:encrypted.keyVersion,payloadHash,createdAt:new Date(at.getTime()-1000)}});
  if(approved)await db.auditEvent.create({data:{actorType:'SYSTEM',action:'FORMAL_APPLICATION_APPROVED',entityType:'FormalMemberApplication',entityId:app.formalMemberApplicationId,requestId:randomUUID(),correlationId:randomUUID(),occurredAt:at}});
  return snapshot;
 }
 it('migration seeds complete city/district coverage',async()=>{
  expect(await db.geoAdminArea.count({where:{level:'CITY'}})).toBe(22);
  expect(await db.geoAdminArea.count({where:{level:'DISTRICT'}})).toBe(368);
 });
 it('refresh is concurrent-idempotent and never exposes address or creates monetary facts',async()=>{
  await source('臺北市大安區和平東路100號',new Date('2026-01-01'));
  const before=[await db.pvLedger.count(),await db.bonusAward.count(),await db.qualification.count()];
  await Promise.all([service.refresh(),service.refresh()]);
  expect(await db.memberGeoProfileVersion.count({where:{memberId:personId}})).toBe(1);
  const row=await db.memberGeoProfile.findUniqueOrThrow({where:{memberId:personId}});
  expect(row).toMatchObject({cityCode:'63000',districtCode:'63000030',geoStatus:'NORMALIZED'});
  expect(JSON.stringify(row)).not.toContain('和平');
  expect([await db.pvLedger.count(),await db.bonusAward.count(),await db.qualification.count()]).toEqual(before);
 });
 it('new approved address preserves history; draft address cannot replace it',async()=>{
  await source('臺南市中西區民生路10號',new Date('2026-02-01'));
  await source('臺北市信義區松仁路1號',new Date('2026-03-01'),false);
  await service.refresh();
  expect(await db.memberGeoProfileVersion.count({where:{memberId:personId}})).toBe(2);
  expect(await db.memberGeoProfile.findUniqueOrThrow({where:{memberId:personId}})).toMatchObject({cityCode:'67000'});
  const january=await db.memberGeoProfileVersion.findFirst({where:{memberId:personId,sourceEffectiveAt:{lte:new Date('2026-01-15')},sourceRecordedAt:{lte:new Date('2026-01-15')}},orderBy:{sourceEffectiveAt:'desc'}});
  expect(january?.cityCode).toBe('63000');
 });
 it('immutable versions reject direct alteration',async()=>{
  const row=await db.memberGeoProfileVersion.findFirstOrThrow({where:{memberId:personId}});
  await expect(db.memberGeoProfileVersion.update({where:{geoProfileVersionId:row.geoProfileVersionId},data:{cityCode:null}})).rejects.toThrow();
 });
});
