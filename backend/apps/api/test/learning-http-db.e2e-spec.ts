import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaClient} from '@prisma/client';
import {PrismaService} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {AdminLearningController,MemberLearningController} from '../src/modules/learning/learning.controller';
import {LearningService} from '../src/modules/learning/learning.service';
import {MemberAuthenticationGuard} from '../src/modules/auth/member-authentication.guard';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {LineIdentityService} from '../src/modules/auth/line-identity.service';
import {AuditService} from '../src/common/audit/audit.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('Learning authenticated HTTP lifecycle',()=>{
 let db:PrismaClient,app:NestFastifyApplication,admin:string,denied:string,member:string;
 const headers=(token:string)=>({authorization:'Bearer '+token,'idempotency-key':randomUUID()});
 beforeAll(async()=>{
  db=new PrismaClient({datasources:{db:{url}}});const tokens=new IdentityTokenService(db as any);
  async function actor(roleCode?:string){const p=await db.person.create({data:{legalName:'PRIVATE LEARNING HTTP',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}}),subject=randomUUID(),provider=roleCode?'ENTRA':'LINE';await db.identityLink.create({data:{provider,providerSubject:subject,personId:p.personId}});if(roleCode)await db.adminAccessGrant.create({data:{personId:p.personId,provider,providerSubject:subject,roleCode,validFrom:new Date(Date.now()-1000)}});return (await tokens.issue({provider,subject,personId:p.personId,...(roleCode?{roleCode}:{})})).accessToken;}
  admin=await actor('MEMBERSHIP_OPS');denied=await actor('FINANCE');member=await actor();
  const mod=await Test.createTestingModule({controllers:[AdminLearningController,MemberLearningController],providers:[LearningService,MemberAuthenticationGuard,AdminAuthenticationGuard,AdminRoleGuard,LineIdentityService,AuditService,IdempotencyService,{provide:PrismaService,useValue:db},{provide:IdentityTokenService,useValue:tokens},{provide:ConfigService,useValue:{get:(name:string)=>name==='NODE_ENV'?'production':'false'}}]}).compile();app=mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalGuards(mod.get(AdminAuthenticationGuard),mod.get(AdminRoleGuard));app.useGlobalInterceptors(new EnvelopeInterceptor());await app.init();await app.getHttpAdapter().getInstance().ready();
 });afterAll(async()=>{await app?.close();await db?.$disconnect();});
 it('requires real roles, validates nested course input and preserves member history after governed archive',async()=>{
  const base='/api/v1/admin/learning/courses',courseCode=`HTTP-${randomUUID().slice(0,8).toUpperCase()}`,payload={courseCode,title:'HTTP course',categoryCode:'ONBOARDING',lessons:[{title:'Article',contentType:'ARTICLE',contentReference:'Safe text'}]};
  expect((await app.inject({url:base})).statusCode).toBe(401);expect((await app.inject({url:base,headers:headers(denied)})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:base,headers:headers(admin),payload:{...payload,personId:randomUUID()}})).statusCode).toBe(400);
  expect((await app.inject({method:'POST',url:base,headers:headers(admin),payload:{...payload,lessons:[{...payload.lessons[0],required:'false'}]}})).statusCode).toBe(400);
  expect((await app.inject({method:'POST',url:base,headers:headers(admin),payload})).statusCode).toBe(201);
  expect((await app.inject({method:'POST',url:base+'/'+courseCode+'/publish',headers:headers(admin),payload:{approvalReference:'APPROVED-HTTP'}})).statusCode).toBe(201);
  const path='/api/v1/member/learning/courses/'+courseCode;expect((await app.inject({url:path})).statusCode).toBe(401);
  expect((await app.inject({method:'POST',url:path+'/enroll',headers:headers(member)})).statusCode).toBe(201);
  expect((await app.inject({method:'POST',url:path+'/lessons/1/complete',headers:headers(member)})).statusCode).toBe(201);
  expect((await app.inject({url:path,headers:headers(member)})).json().data).toMatchObject({canComplete:true,completedRequiredCount:1});
  expect((await app.inject({method:'POST',url:path+'/complete',headers:headers(member)})).statusCode).toBe(201);
  expect((await app.inject({method:'POST',url:base+'/'+courseCode+'/archive',headers:headers(denied),payload:{reason:'Archive'}})).statusCode).toBe(403);
  const archive={method:'POST' as const,url:base+'/'+courseCode+'/archive',headers:headers(admin),payload:{reason:'課程已結束'}};expect((await app.inject(archive)).statusCode).toBe(201);expect((await app.inject(archive)).statusCode).toBe(201);
  const detail=await app.inject({url:path,headers:headers(member)});expect(detail.json().data).toMatchObject({status:'COMPLETED',courseStatus:'ARCHIVED',available:false});expect(detail.body).not.toContain('PRIVATE LEARNING HTTP');const course=await db.learningCourse.findUniqueOrThrow({where:{courseCode}});expect(detail.body).not.toContain(course.learningCourseId);expect((await app.inject({url:base,headers:headers(admin)})).body).not.toContain(course.learningCourseId);
 });
});
