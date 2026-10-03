import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {OrganizationGeoController} from '../src/modules/organization-geo/organization-geo.controller';
import {OrganizationGeoService} from '../src/modules/organization-geo/organization-geo.service';
import {GeoProfileService} from '../src/modules/organization-geo/geo-profile.service';
import {PrismaService} from '@ucell/database';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';

describe('Geo HTTP capability and CSV transport',()=>{
 let app:NestFastifyApplication;
 const capture=jest.fn(async()=>({status:'PARTIAL',reason:null,distribution:[{areaCode:'63000',areaName:'臺北市',balls:2,members:1,activeBalls:0,activeRate:null,newBalls:1,gpv:null,status:'PARTIAL'}]}));
 const query=new URLSearchParams({rootBallNo:'A000001',dateFrom:'2026-01-01T00:00:00.000Z',dateTo:'2026-02-01T00:00:00.000Z',asOf:'2026-02-01T00:00:00.000Z',knowledgeCutoff:'2026-02-01T00:00:00.000Z'}).toString();
 beforeAll(async()=>{
  const mod=await Test.createTestingModule({controllers:[OrganizationGeoController],providers:[AdminAuthenticationGuard,AdminRoleGuard,{provide:OrganizationGeoService,useValue:{capture}},{provide:GeoProfileService,useValue:{}},{provide:PrismaService,useValue:{}},{provide:ConfigService,useValue:{get:(key:string)=>key==='NODE_ENV'?'production':undefined}},{provide:IdentityTokenService,useValue:{authenticate:async(role:string)=>({role})}}]}).compile();
  app=mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalGuards(mod.get(AdminAuthenticationGuard),mod.get(AdminRoleGuard));app.useGlobalInterceptors(new EnvelopeInterceptor());
  await app.init();await app.getHttpAdapter().getInstance().ready();
 });
 afterAll(()=>app.close());
 beforeEach(()=>capture.mockClear());
 it('requires admin authentication on the canonical route',async()=>{
  const response=await app.inject({url:'/api/v1/admin/organization/geo/summary?'+query});expect(response.statusCode).toBe(401);expect(capture).not.toHaveBeenCalled();
 });
 it('denies member and view-only export credentials before querying evidence',async()=>{
  for(const role of ['MEMBER','ORG_GEO_VIEW']){
   const response=await app.inject({url:'/api/v1/admin/organization/geo/export?'+query,headers:{authorization:'Bearer '+role}});expect(response.statusCode).toBe(403);
  }expect(capture).not.toHaveBeenCalled();
 });
 it('rejects unexpected address fields and invalid query enums',async()=>{
  for(const extra of ['&address=private','&side=SPONSOR','&limit=21']){
   const response=await app.inject({url:'/api/v1/admin/organization/geo/summary?'+query+extra,headers:{authorization:'Bearer SUPER_ADMIN'}});expect(response.statusCode).toBe(400);
  }expect(capture).not.toHaveBeenCalled();
 });
 it('streams the same aggregate rows as BOM CSV without serializing an envelope or missing evidence as zero',async()=>{
  const response=await app.inject({url:'/api/v1/admin/organization/geo/export?'+query,headers:{authorization:'Bearer ORG_GEO_EXPORT'}});
  expect(response.statusCode).toBe(200);expect(response.headers['content-type']).toContain('text/csv');expect(response.headers['cache-control']).toBe('private, no-store');
  expect(response.rawPayload.subarray(0,3)).toEqual(Buffer.from([0xef,0xbb,0xbf]));
  expect(response.body).toContain('"63000","臺北市","2","1","0","","1","","PARTIAL"');expect(response.body).not.toContain('"meta"');
  expect(capture.mock.calls[0][2]).toBe(true);
 });
});
