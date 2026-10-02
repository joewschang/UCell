import 'reflect-metadata';
import {Test} from '@nestjs/testing';
import {APP_GUARD} from '@nestjs/core';
import {ConfigService} from '@nestjs/config';
import {UnauthorizedException,ValidationPipe} from '@nestjs/common';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaService} from '@ucell/database';
import {MaturedPayableSourcesController} from '../src/modules/admin-operations/matured-payable-sources.controller';
import {MaturedPayableSourcesService} from '../src/modules/admin-operations/matured-payable-sources.service';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('MATURED_PAYABLE_SOURCE_HTTP_REAL_GUARDS',()=>{
 let app:NestFastifyApplication,db:PrismaService;
 beforeAll(async()=>{
  db=new PrismaService();await db.$connect();
  // Controlled token transport; actual route, guards, validation, service and DB.
  // This is not external provider or cryptographic session certification.
  const module=await Test.createTestingModule({controllers:[MaturedPayableSourcesController],providers:[MaturedPayableSourcesService,{provide:PrismaService,useValue:db},{provide:ConfigService,useValue:{get:(key:string)=>key==='NODE_ENV'?'production':undefined}},{provide:IdentityTokenService,useValue:{authenticate:async(role:string)=>{if(role==='INVALID')throw new UnauthorizedException();return {role};}}},{provide:APP_GUARD,useClass:AdminAuthenticationGuard},{provide:APP_GUARD,useClass:AdminRoleGuard}]}).compile();
  app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({transform:true,whitelist:true,forbidNonWhitelisted:true}));app.useGlobalInterceptors(new EnvelopeInterceptor());await app.init();await app.getHttpAdapter().getInstance().ready();
 });
 afterAll(async()=>{await app?.close();await db?.$disconnect();});
 const request=(query:string,role?:string)=>app.inject({method:'GET',url:'/api/v1/admin/operations/control/matured-payable-sources'+query,headers:role?{authorization:'Bearer '+role}:{}});
 it('requires authentication and rejects unrelated roles',async()=>{
  expect((await request('?thresholdHours=24')).statusCode).toBe(401);
  expect((await request('?thresholdHours=24','INVALID')).statusCode).toBe(401);
  for(const role of ['CUSTOMER_SERVICE','MEMBERSHIP_OPS','MEMBER'])expect((await request('?thresholdHours=24',role)).statusCode).toBe(403);
 });
 it('allows the three declared roles and returns a resolved typed empty envelope',async()=>{
  for(const role of ['SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT']){const response=await request('?thresholdHours=24',role);expect(response.statusCode).toBe(200);expect(response.json()).toMatchObject({data:{items:[],nextCursor:null,thresholdHours:24,coverage:'CURRENT_PAGE_ONLY'},meta:{api_version:'v1'}});expect(typeof response.json().data.asOf).toBe('string');}
 });
 it('rejects missing, fractional, excessive and injected query values',async()=>{
  for(const query of ['', '?thresholdHours=0','?thresholdHours=1.5','?thresholdHours=8761','?thresholdHours=24&take=101','?thresholdHours=24&cursor=private-id','?thresholdHours=24&asOf=bad','?thresholdHours=24&asOf=2999-01-01T00:00:00Z','?thresholdHours=24&sourceId=private-id'])expect((await request(query,'FINANCE')).statusCode).toBe(400);
 });
});
