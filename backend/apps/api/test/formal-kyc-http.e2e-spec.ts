import {Test} from '@nestjs/testing';
import {ConfigService} from '@nestjs/config';
import {UnauthorizedException,UnprocessableEntityException} from '@nestjs/common';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {AdminFormalMemberApplicationController} from '../src/modules/member/admin-formal-member-application.controller';
import {FormalMemberApplicationService} from '../src/modules/member/formal-member-application.service';
import {FormalMembershipConflictService} from '../src/modules/member/formal-membership-conflict.service';
import {FormalKycDocumentService} from '../src/modules/member/formal-kyc-document.service';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
import {ApiExceptionFilter} from '../src/common/filters/api-exception.filter';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const id='11111111-1111-4111-8111-111111111111';
const contentUrl='/api/v1/admin/formal-member-applications/documents/'+id+'/content';
const bytes=readFileSync(join(__dirname,'fixtures/kyc-valid-1x1.png'));
describe('KYC HTTP private content and authorization boundary (synthetic sessions)',()=>{
 let app:NestFastifyApplication;
 const kyc={adminContent:jest.fn(async()=>({bytes,mimeType:'image/png'}))};
 const service={adminDetail:jest.fn(async()=>({id,payload:{legalName:'TEST ONLY APPLICANT'}}))};
 beforeAll(async()=>{
  const module=await Test.createTestingModule({controllers:[AdminFormalMemberApplicationController],providers:[
   AdminAuthenticationGuard,AdminRoleGuard,
   {provide:ConfigService,useValue:{get:()=>undefined}},
   {provide:IdentityTokenService,useValue:{authenticate:async(token:string)=>{
    if(!['MEMBERSHIP_OPS','COMPLIANCE_AUDIT','FINANCE'].includes(token))throw new UnauthorizedException();
    return {personId:id,role:token,provider:'ENTRA',sessionId:'synthetic'};
   }}},
   {provide:FormalMemberApplicationService,useValue:service},
   {provide:FormalMembershipConflictService,useValue:{}},
   {provide:FormalKycDocumentService,useValue:kyc},
  ]}).compile();
  app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});
  app.setGlobalPrefix('api/v1');
  app.useGlobalGuards(module.get(AdminAuthenticationGuard),module.get(AdminRoleGuard));
  app.useGlobalInterceptors(new EnvelopeInterceptor());app.useGlobalFilters(new ApiExceptionFilter());
  await app.init();await app.getHttpAdapter().getInstance().ready();
 });
 afterAll(()=>app?.close());
 beforeEach(()=>jest.clearAllMocks());
 it.each(['MEMBERSHIP_OPS','COMPLIANCE_AUDIT'])('streams exact image bytes privately for authorized %s',async role=>{
  const res=await app.inject({method:'GET',url:contentUrl,headers:{authorization:'Bearer '+role}});
  expect(res.statusCode).toBe(200);expect(res.rawPayload.equals(bytes)).toBe(true);
  expect(res.headers['content-type']).toBe('image/png');
  expect(res.headers['cache-control']).toBe('private, no-store');
  expect(res.headers['x-content-type-options']).toBe('nosniff');
  expect(res.headers['referrer-policy']).toBe('no-referrer');
  expect(kyc.adminContent).toHaveBeenCalledWith(id,id,undefined);
 });
 it('rejects absent/invalid sessions and unauthorized roles before touching private storage',async()=>{
  for(const [token,status] of [['',401],['expired',401],['FINANCE',403]] as const){
   const res=await app.inject({method:'GET',url:contentUrl,headers:token?{authorization:'Bearer '+token}:{}});
   expect(res.statusCode).toBe(status);expect(res.rawPayload.equals(bytes)).toBe(false);
  }
  expect(kyc.adminContent).not.toHaveBeenCalled();
 });
 it('does not wrap or stream bytes when the service scan gate rejects the read',async()=>{
  kyc.adminContent.mockRejectedValueOnce(new UnprocessableEntityException({code:'FORMAL_KYC_SCAN_CLEAN_REQUIRED'}));
  const res=await app.inject({method:'GET',url:contentUrl,headers:{authorization:'Bearer MEMBERSHIP_OPS'}});
  expect(res.statusCode).toBe(422);expect(res.rawPayload.equals(bytes)).toBe(false);
 });
 it('returns decrypted detail with no-store and forbids Finance from accessing it',async()=>{
  const url='/api/v1/admin/formal-member-applications/'+id+'/detail';
  const res=await app.inject({method:'GET',url,headers:{authorization:'Bearer COMPLIANCE_AUDIT'}});
  expect(res.statusCode).toBe(200);expect(res.headers['cache-control']).toBe('private, no-store');
  expect(res.json().data.payload.legalName).toBe('TEST ONLY APPLICANT');
  expect((await app.inject({method:'GET',url,headers:{authorization:'Bearer FINANCE'}})).statusCode).toBe(403);
  expect(service.adminDetail).toHaveBeenCalledTimes(1);
 });
 it('has no HTTP route for an operator to mark a document CLEAN',async()=>{
  const res=await app.inject({method:'POST',url:'/api/v1/admin/formal-member-applications/documents/'+id+'/scan',headers:{authorization:'Bearer MEMBERSHIP_OPS'},payload:{status:'CLEAN'}});
  expect(res.statusCode).toBe(404);expect(kyc.adminContent).not.toHaveBeenCalled();
 });
});
