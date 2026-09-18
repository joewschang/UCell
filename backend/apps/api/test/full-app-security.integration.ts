import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaService} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {resolve} from 'node:path';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
import {ApiExceptionFilter} from '../src/common/filters/api-exception.filter';
const url=process.env.PHASE2_TEST_DATABASE_URL;
if(!url||!/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1)))throw Error('ISOLATED_DATABASE_REQUIRED');
const db=new PrismaService();let app:NestFastifyApplication;
afterAll(async()=>{await app?.close();await db.$disconnect();});
it('passes the existing security HTTP gate against the complete App with synthetic Entra identities and bypass disabled',async()=>{
 process.env.ADMIN_AUTH_BYPASS='false';
 const {AppModule}=await import('../src/app.module');
 const module=await Test.createTestingModule({imports:[AppModule]}).overrideProvider(PrismaService).useValue(db).compile();
 module.get(ConfigService).set('ADMIN_AUTH_BYPASS','false');
 app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalInterceptors(new EnvelopeInterceptor());app.useGlobalFilters(new ApiExceptionFilter());await app.listen(0,'127.0.0.1');
 const tokens=new IdentityTokenService(db),env={...process.env,UCELL_API_BASE:(await app.getUrl())+'/api/v1'};
 for(const [name,roleCode] of [['UAT_TOKEN_MEMBERSHIP','MEMBERSHIP_OPS'],['UAT_TOKEN_FINANCE','FINANCE'],['UAT_TOKEN_COMPLIANCE','COMPLIANCE_AUDIT']]){
  const person=await db.person.create({data:{legalName:'SYNTHETIC FULL APP SECURITY '+roleCode}}),subject=randomUUID();
  await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
  await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode,validFrom:new Date(Date.now()-1000)}});
  (env as any)[name]=(await tokens.issue({personId:person.personId,provider:'ENTRA',subject,roleCode})).accessToken;
 }
 const result=await promisify(execFile)(process.execPath,[resolve('../../scripts/security-http-e2e.mjs')],{env,timeout:30000});
 expect(result.stdout).toContain('SECURITY_E2E_PASS');expect(result.stdout).not.toContain('PARTIAL');console.log('SECURITY_E2E_PASS (synthetic identity; external Entra credentials not verified)');
},120000);
