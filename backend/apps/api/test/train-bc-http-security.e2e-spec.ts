import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaService} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {PeriodProjectionController} from '../src/modules/analytics/period-projection.controller';
import {PeriodProjectionService} from '../src/modules/analytics/period-projection.service';
import {PeriodExportService} from '../src/modules/analytics/period-export.service';
import {ReservoirController} from '../src/modules/reservoir/reservoir.controller';
import {ReservoirService} from '../src/modules/reservoir/reservoir.service';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
import {ApiExceptionFilter} from '../src/common/filters/api-exception.filter';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw Error('ISOLATED_DATABASE_REQUIRED');
describe('Train B/C synthetic identity real HTTP/DB security (external Entra credentials not verified)',()=>{
 const db=new PrismaService(),tokens=new IdentityTokenService(db),projections=new PeriodProjectionService(db),exports=new PeriodExportService(db,projections);
 let app:NestFastifyApplication,finance:any,audit:any,order:any,time:any,query:any;
 const base='/api/v1/admin/analytics/period-projections';
 async function actor(roleCode:string){
  const person=await db.person.create({data:{legalName:'SYNTHETIC HTTP '+roleCode}}),subject=randomUUID();
  await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
  const grant=await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode,validFrom:new Date(Date.now()-1000)}});
  return {...await tokens.issue({provider:'ENTRA',subject,personId:person.personId,roleCode}),grant};
 }
 const headers=(actor:any)=>({authorization:'Bearer '+actor.accessToken,'idempotency-key':randomUUID()});
 beforeAll(async()=>{
  finance=await actor('FINANCE');audit=await actor('COMPLIANCE_AUDIT');order=await actor('ORDER_OPS');
  const now=new Date().toISOString();time={timezone:'Asia/Taipei',asOf:now,knowledgeCutoff:now,periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2099-01-01T00:00:00.000Z'};
  query={metrics:['return.cohort_rates'],time,dimensions:['currency'],groupBy:['currency'],filters:{},limit:100};
  const module=await Test.createTestingModule({controllers:[PeriodProjectionController,ReservoirController],providers:[
   {provide:PrismaService,useValue:db},{provide:PeriodProjectionService,useValue:projections},{provide:PeriodExportService,useValue:exports},ReservoirService,
   {provide:IdentityTokenService,useValue:tokens},{provide:ConfigService,useValue:{get:(name:string)=>name==='NODE_ENV'?'production':'false'}},AdminAuthenticationGuard,AdminRoleGuard]}).compile();
  app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');
  app.useGlobalGuards(module.get(AdminAuthenticationGuard),module.get(AdminRoleGuard));
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalInterceptors(new EnvelopeInterceptor());app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();await app.getHttpAdapter().getInstance().ready();
 });
 afterAll(async()=>{await app?.close();await db.$disconnect();});
 it('requires bearer, rejects role forgery, and enforces DTO/domain error contracts',async()=>{
  expect((await app.inject({method:'POST',url:base+'/jobs',payload:{query,mode:'REBUILD'}})).statusCode).toBe(401);
  expect((await app.inject({method:'POST',url:base+'/jobs',headers:headers(order),payload:{query,mode:'REBUILD'}})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:base+'/jobs',headers:headers(finance),payload:{query,mode:'REBUILD',actorId:randomUUID()}})).statusCode).toBe(400);
  expect((await app.inject({method:'POST',url:base+'/jobs',headers:headers(finance),payload:{query:{...query,sql:'select * from identity.person'},mode:'REBUILD'}})).statusCode).toBe(422);
 });
 it('rejects a non-UUID settlement scope before any SQL cast',async()=>{
  const invalid={...query,metrics:['pool.k0'],dimensions:['settlementId'],groupBy:['settlementId'],time:{...time,settlementId:'not-a-uuid'}};
  const response=await app.inject({method:'POST',url:base+'/jobs',headers:headers(finance),payload:{query:invalid,mode:'REBUILD'}});
  expect(response.statusCode).toBe(422);expect(response.json().code).toBe('INVALID_SETTLEMENT_SCOPE');
 });
 it('enforces actor BOLA, idempotency, real worker generation and streamed private export',async()=>{
  const h=headers(finance),created=await app.inject({method:'POST',url:base+'/jobs',headers:h,payload:{query,mode:'REBUILD'}});
  expect(created.statusCode).toBe(201);const job=created.json().data;
  const repeated=await app.inject({method:'POST',url:base+'/jobs',headers:h,payload:{query,mode:'REBUILD'}});
  expect(repeated.json().data).toMatchObject({jobId:job.jobId,replayed:true});
  expect((await app.inject({method:'POST',url:base+'/jobs',headers:h,payload:{query,mode:'DRY_RUN'}})).statusCode).toBe(409);
  expect((await app.inject({method:'GET',url:base+'/jobs/'+job.jobId,headers:headers(audit)})).statusCode).toBe(404);
  expect(await projections.runOne()).toMatchObject({jobId:job.jobId,status:'COMPLETED'});
  const read=await app.inject({method:'POST',url:base+'/query',headers:headers(finance),payload:{query}});
  expect(read.statusCode).toBe(201);expect(read.json().data).toMatchObject({status:'AVAILABLE',projectionStatus:'CURRENT'});
  const snapshot=read.json().data.snapshot;
  const requested=await app.inject({method:'POST',url:base+'/exports',headers:headers(finance),payload:{query,snapshot}});
  expect(requested.statusCode).toBe(201);const exportId=requested.json().data.exportId;
  expect(await exports.runOne()).toMatchObject({exportId,status:'COMPLETED'});
  expect((await app.inject({method:'GET',url:base+'/exports/'+exportId+'/file',headers:headers(audit)})).statusCode).toBe(404);
  const csv=await app.inject({method:'GET',url:base+'/exports/'+exportId+'/file',headers:headers(finance)});
  expect(csv.statusCode).toBe(200);expect(csv.headers['content-type']).toContain('text/csv');expect(csv.body).toContain(snapshot);expect(csv.body).toContain('generatedAt,dataThrough,definitionVersion');
  const ledger='/api/v1/admin/finance/reservoirs?'+new URLSearchParams({...time,kind:'B'});
  expect((await app.inject({method:'GET',url:ledger,headers:headers(order)})).statusCode).toBe(403);
  const listed=await app.inject({method:'GET',url:ledger,headers:headers(finance)});
  expect(listed.statusCode).toBe(200);expect(listed.json().data).toMatchObject({kind:'B',dataClassification:'FINANCE_CONFIDENTIAL',items:[]});
 });
 it('rechecks live grant before background work and rejects revoked/expired sessions',async()=>{
  const requested=await app.inject({method:'POST',url:base+'/jobs',headers:headers(finance),payload:{query,mode:'REBUILD'}});
  expect(requested.statusCode).toBe(201);const id=requested.json().data.jobId;
  await db.adminAccessGrant.update({where:{adminAccessGrantId:finance.grant.adminAccessGrantId},data:{status:'REVOKED'}});
  expect(await projections.runOne()).toMatchObject({jobId:id,status:'FAILED'});
  expect((await app.inject({method:'POST',url:base+'/query',headers:headers(finance),payload:{query}})).statusCode).toBe(403);
  await db.authSession.update({where:{authSessionId:audit.sessionId},data:{revokedAt:new Date()}});
  expect((await app.inject({method:'POST',url:base+'/query',headers:headers(audit),payload:{query}})).statusCode).toBe(403);
  await db.authSession.update({where:{authSessionId:order.sessionId},data:{expiresAt:new Date(0)}});
  expect((await app.inject({method:'POST',url:base+'/query',headers:headers(order),payload:{query}})).statusCode).toBe(401);
 });
});
