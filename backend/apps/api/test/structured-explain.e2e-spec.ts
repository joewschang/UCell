import { Test } from '@nestjs/testing';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { Prisma, PrismaService } from '@ucell/database';
import { MemberStructuredExplainController } from '../src/modules/explain/member-structured-explain.controller';
import { MemberStructuredExplainService } from '../src/modules/explain/member-structured-explain.service';
import { MemberAuthenticationGuard } from '../src/modules/auth/member-authentication.guard';
import { MemberContextGuard } from '../src/modules/member/member-context.guard';
import { QualificationAccessService } from '../src/modules/auth/qualification-access.service';
import { IdentityTokenService } from '../src/modules/auth/identity-token.service';
import { LineIdentityService } from '../src/modules/auth/line-identity.service';
import { EnvelopeInterceptor } from '../src/common/interceptors/envelope.interceptor';
const qid='11111111-1111-4111-8111-111111111111',pid='22222222-2222-4222-8222-222222222222',sid='33333333-3333-4333-8333-333333333333';
const awardId='44444444-4444-4444-8444-444444444444',other='55555555-5555-4555-8555-555555555555';
const time={timezone:'Asia/Taipei',periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2026-02-01T00:00:00.000Z',asOf:'2026-02-01T00:00:00.000Z',knowledgeCutoff:'2026-02-02T00:00:00.000Z'};
function fixture(){
 const session:any={authSessionId:sid,personId:pid,provider:'LINE',subject:'line-private',roleCode:null,status:'ACTIVE',revokedAt:null,expiresAt:new Date(Date.now()+60000)};
 const award:any={bonusAwardId:awardId,recipientQualificationId:qid,occurredAt:new Date('2026-01-12'),createdAt:new Date('2026-01-13'),parameterSnapshotHash:'a'.repeat(64),ruleVersionCode:'R1.0B',theoryAmount:new Prisma.Decimal(100),kFactor:new Prisma.Decimal('.5'),payableAmount:new Prisma.Decimal('49.1234'),awardType:'BINARY',calculationDetail:{bankAccount:'private',token:'secret'}};
 const db:any={authSession:{findUnique:jest.fn(async()=>session)},person:{findUnique:jest.fn(async()=>({status:'EFFECTIVE',securityStatus:'NORMAL'}))},identityLink:{findUnique:jest.fn(async()=>({personId:pid}))},
 qualification:{findUnique:jest.fn(async(i:any)=>i.where.qualificationId===qid?{currentHolderPersonId:pid}:null)},
 qualificationHolderHistory:{findMany:jest.fn(async()=>[{holderPersonId:pid}]),findFirst:jest.fn(async(i:any)=>i.where.qualificationId===qid?{holderPersonId:pid}:null)},
 systemAssignmentPoolEntry:{findFirst:jest.fn(async()=>null)},bonusAward:{findUnique:jest.fn(async()=>award)},auditEvent:{create:jest.fn(async()=>({}))}};
 db.$transaction=jest.fn(async(f:any)=>f(db));return {db,session,award};
}
describe('Train A structured Member Explain HTTP boundary',()=>{
 let app:NestFastifyApplication;let data:ReturnType<typeof fixture>;
 const headers={authorization:'Bearer synthetic-test-token'};
 const url=(extra:Record<string,string>={})=>'/api/v1/member/explain/structured?'+new URLSearchParams({...time,qualificationId:qid,tool:'explainAward',resourceId:awardId,...extra});
 beforeEach(async()=>{
  data=fixture();const mod=await Test.createTestingModule({controllers:[MemberStructuredExplainController],providers:[MemberStructuredExplainService,MemberAuthenticationGuard,MemberContextGuard,QualificationAccessService,
   {provide:PrismaService,useValue:data.db},{provide:ConfigService,useValue:{get:jest.fn()}},{provide:IdentityTokenService,useValue:{authenticate:jest.fn(async()=>({sessionId:sid,personId:pid,provider:'LINE',subject:'line-private',role:null}))}},
   {provide:LineIdentityService,useValue:{resolveVerifiedSubject:jest.fn(async()=>({provider:'LINE',providerSubject:'line-private',personId:pid}))}}]}).compile();
  app=mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalInterceptors(new EnvelopeInterceptor());
  await app.init();await app.getHttpAdapter().getInstance().ready();
 });
 afterEach(async()=>{await app?.close();});
 it('requires authentication',async()=>expect((await app.inject({method:'GET',url:url()})).statusCode).toBe(401));
 it('returns exact stored final with source refs, no sensitive fields and no cache',async()=>{
  const r=await app.inject({method:'GET',url:url(),headers});expect(r.statusCode).toBe(200);
  expect(r.json().data).toMatchObject({status:'AVAILABLE',quality:'VERIFIED',result:{theory:'100',k:'0.5',final:'49.1234'},time});
  expect(r.headers['cache-control']).toBe('no-store');expect(r.body).not.toMatch(/bankAccount|private|token|secret/);
  expect(data.db.authSession.findUnique).toHaveBeenCalledTimes(2);expect(data.db.$transaction).toHaveBeenCalledWith(expect.any(Function),expect.objectContaining({isolationLevel:'RepeatableRead'}));
 });
 it('denies another selected Ball before reading any award',async()=>{
  expect((await app.inject({method:'GET',url:url({qualificationId:other}),headers})).statusCode).toBe(403);expect(data.db.bonusAward.findUnique).not.toHaveBeenCalled();
 });
 it('does not disclose another Ball award even when the selected Ball is owned',async()=>{
  data.award.recipientQualificationId=other;const r=await app.inject({method:'GET',url:url(),headers});expect(r.json().data).toMatchObject({status:'UNAVAILABLE',result:null,evidenceRefs:[]});
 });
 it.each(['roles','permissions','sql','prompt','actorId','binaryTreeId'])('rejects injected %s',async key=>{
  expect((await app.inject({method:'GET',url:url({[key]:'forged'}),headers})).statusCode).toBe(400);expect(data.db.bonusAward.findUnique).not.toHaveBeenCalled();
 });
 it('denies a finance tool via Member endpoint',async()=>expect((await app.inject({method:'GET',url:url({tool:'explainReservoirA'}),headers})).statusCode).toBe(400));
 it('does not substitute an award learned after the recorded-time cutoff',async()=>{
  data.award.createdAt=new Date('2026-02-03');const r=await app.inject({method:'GET',url:url(),headers});expect(r.json().data).toMatchObject({status:'UNAVAILABLE',result:null});
 });
 it('honors half-open effective time',async()=>{data.award.occurredAt=new Date(time.periodEnd);const r=await app.inject({method:'GET',url:url(),headers});expect(r.json().data.result).toBeNull();});
 it('suppresses evidence when the session is revoked mid-read',async()=>{
  data.db.bonusAward.findUnique.mockImplementation(async()=>{data.session.revokedAt=new Date();return data.award;});
  expect((await app.inject({method:'GET',url:url(),headers})).statusCode).toBe(403);
 });
 it('suppresses evidence when holder changes mid-read',async()=>{
  data.db.bonusAward.findUnique.mockImplementation(async()=>{data.db.qualification.findUnique.mockResolvedValue({currentHolderPersonId:other});return data.award;});
  expect((await app.inject({method:'GET',url:url(),headers})).statusCode).toBe(403);
 });
 it('fails closed and redacts audit persistence errors',async()=>{
  data.db.auditEvent.create.mockRejectedValue(new Error('DATABASE_URL=secret'));const r=await app.inject({method:'GET',url:url(),headers});expect(r.statusCode).toBe(503);expect(r.body).not.toMatch(/DATABASE_URL|secret|49.1234/);
 });
 it('rejects future queries without database evidence reads',async()=>{const r=await app.inject({method:'GET',url:url({asOf:'2099-02-01T00:00:00.000Z'}),headers});expect(r.statusCode).toBe(400);expect(data.db.bonusAward.findUnique).not.toHaveBeenCalled();});
});
