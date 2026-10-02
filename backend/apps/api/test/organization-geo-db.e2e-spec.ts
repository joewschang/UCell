import {randomUUID} from 'node:crypto';
import {PrismaService,recognizeConsumption} from '@ucell/database';
import {readBallActiveEvidence,readBallsActiveEvidence} from '../src/modules/binary-tree/tree-active-evidence';
import {BinaryTreeService,TreePrincipal} from '../src/modules/binary-tree/binary-tree.service';
import {OrganizationService} from '../src/modules/organization/organization.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {OrganizationGeoService,GeoQuery} from '../src/modules/organization-geo/organization-geo.service';
describe('Geo authorized historical subtree real DB',()=>{
 const db=new PrismaService(),geo=new OrganizationGeoService(db),trees=new BinaryTreeService(db,new IdempotencyService(db),new OrganizationService(db));
 let admin:TreePrincipal,rootBallNo:string,input:GeoQuery;
 beforeAll(async()=>{
  const url=new URL(process.env.DATABASE_URL!);
  if(!['127.0.0.1','localhost'].includes(url.hostname)||!/^\/ucell_jest_[a-f0-9]{32}$/.test(url.pathname))throw new Error('Use isolated API DB harness');
  const person=await db.person.create({data:{legalName:'TEST ONLY GEO ADMIN'}}),subject=randomUUID();
  await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
  await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode:'SUPER_ADMIN',validFrom:new Date(Date.now()-1000)}});
  const session=await db.authSession.create({data:{personId:person.personId,provider:'ENTRA',subject,roleCode:'SUPER_ADMIN',tokenHash:randomUUID(),issuedAt:new Date(),expiresAt:new Date(Date.now()+3600000)}});
  admin={personId:person.personId,provider:'ENTRA',subject,role:'SUPER_ADMIN',sessionId:session.authSessionId};
  const tree=(await trees.create(admin,{treeName:'TEST ONLY GEO TREE',reason:'Synthetic reconciliation'},randomUUID())).value;
  rootBallNo=(await db.qualification.findUniqueOrThrow({where:{qualificationId:tree.companyQualificationIds[0]}})).ballNo!;
  const now=new Date();input={rootBallNo,dateFrom:new Date(now.getTime()-86400000).toISOString(),dateTo:now.toISOString(),asOf:now.toISOString(),knowledgeCutoff:now.toISOString()};
 });
 afterAll(()=>db.$disconnect());
 it('excludes root self, reconciles LEFT+RIGHT, preserves company ownership and unlocated population',async()=>{
  const result=await geo.capture(admin,input);
  expect(result.status).toBe('AVAILABLE');
  expect(result.summary).toMatchObject({descendantBalls:6,uniqueMembers:0,leftBalls:3,rightBalls:3,unlocatedBalls:6,gpv:'0.0000',eligibleMemberBalls:0,activeRate:null});
  expect(result.distribution).toHaveLength(1);
  expect(result.distribution[0]).toMatchObject({areaCode:'UNLOCATED',balls:6,members:0,gpv:'0.0000'});
  expect(result.carry).toMatchObject({status:'UNAVAILABLE',reason:'NO_SETTLED_CARRY'});
  expect(JSON.stringify(result)).not.toMatch(/addressCiphertext|latitude|longitude|TEST ONLY GEO ADMIN|personId/);
 });
 it('applies the exact same firstSide to counts and GPV',async()=>{
  const left=await geo.capture(admin,{...input,side:'LEFT'}),right=await geo.capture(admin,{...input,side:'RIGHT'});
  expect(left.summary?.descendantBalls).toBe(3);expect(right.summary?.descendantBalls).toBe(3);
  expect(left.summary?.gpv).toBe('0.0000');expect(right.summary?.gpv).toBe('0.0000');
 });
 it('historical root absence never falls back to current tree',async()=>{
  await expect(geo.capture(admin,{...input,dateFrom:'2020-01-01T00:00:00.000Z',dateTo:'2020-02-01T00:00:00.000Z',asOf:'2020-02-01T00:00:00.000Z'})).rejects.toMatchObject({response:{code:'GEO_ROOT_NOT_FOUND'}});
 });
 it('denies Member credentials before root lookup',async()=>{
  await expect(geo.capture({...admin,provider:'LINE',role:'MEMBER'},input)).rejects.toMatchObject({response:{code:'TREE_ACCESS_DENIED'}});
 });
 it('batch Active evidence preserves single-ball semantics for active, inactive and unknown qualifications',async()=>{
  const person=await db.person.create({data:{legalName:'TEST ONLY BATCH ACTIVE'}});
  const qualifications=[];
  for(let i=0;i<3;i++)qualifications.push(await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}}));
  const at=new Date('2026-09-10T00:00:00.000Z');
  for(let i=0;i<2;i++)await db.$transaction(tx=>recognizeConsumption(tx,{qualificationId:qualifications[i].qualificationId,sourceType:'TEST_ORDER',sourceId:randomUUID(),amount:i===0?1400:100,eligible:true,concreteVolumeType:'GPV',productProfileVersion:'TEST',ruleVersionCode:'R1',parameterSnapshotHash:'a'.repeat(64),recognizedAt:at,activeThreshold:1200}));
  const time={timezone:'Asia/Taipei' as const,asOf:'2026-09-15T00:00:00.000Z',knowledgeCutoff:new Date().toISOString(),periodStart:'2026-08-31T16:00:00.000Z',periodEnd:'2026-09-30T16:00:00.000Z'};
  await db.$transaction(async tx=>{
   const batch=await readBallsActiveEvidence(tx,qualifications.map(q=>q.qualificationId),time);
   for(const q of qualifications)expect(batch.get(q.qualificationId)).toEqual(await readBallActiveEvidence(tx,q.qualificationId,time));
   expect(qualifications.map(q=>batch.get(q.qualificationId)?.state)).toEqual(['ACTIVE','INACTIVE','UNKNOWN']);
  });
 });
 it('clamps all-time trend to evidenced root creation rather than fabricating pre-creation snapshots',async()=>{
  const result=await geo.trend(admin,{...input,dateFrom:'1970-01-01T00:00:00.000Z',interval:'MONTH'});
  expect(result.actualPeriodStart).not.toBe('1970-01-01T00:00:00.000Z');
  expect(result.rows).toHaveLength(1);
  expect(result.rows[0].summary?.descendantBalls).toBe(6);
 });
 it('rejects revoked sessions and does not trust the client role',async()=>{
  await db.authSession.update({where:{authSessionId:admin.sessionId},data:{status:'REVOKED',revokedAt:new Date()}});
  await expect(geo.capture(admin,input)).rejects.toMatchObject({response:{code:'TREE_ACCESS_DENIED'}});
 });
});
