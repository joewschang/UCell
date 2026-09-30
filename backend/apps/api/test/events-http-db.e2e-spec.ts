import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaClient} from '@prisma/client';
import {PrismaService} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {AdminEventsController,MemberEventsController} from '../src/modules/events/events.controller';
import {MemberEventsService} from '../src/modules/events/events.service';
import {MemberAuthenticationGuard} from '../src/modules/auth/member-authentication.guard';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {LineIdentityService} from '../src/modules/auth/line-identity.service';
import {AuditService} from '../src/common/audit/audit.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('Events real HTTP authorization and participation',()=>{
 let db:PrismaClient,app:NestFastifyApplication,admin:string,denied:string,member:string,foreign:string,memberNo:string;
 const headers=(token:string)=>({authorization:'Bearer '+token,'idempotency-key':randomUUID()});
 beforeAll(async()=>{
  db=new PrismaClient({datasources:{db:{url}}});const tokens=new IdentityTokenService(db as any);
  async function actor(roleCode?:string){const p=await db.person.create({data:{legalName:'PRIVATE EVENT HTTP',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}}),subject=randomUUID(),provider=roleCode?'ENTRA':'LINE';await db.identityLink.create({data:{provider,providerSubject:subject,personId:p.personId}});if(roleCode)await db.adminAccessGrant.create({data:{personId:p.personId,provider,providerSubject:subject,roleCode,validFrom:new Date(Date.now()-1000)}});return {p,token:(await tokens.issue({provider,subject,personId:p.personId,...(roleCode?{roleCode}:{})})).accessToken};}
  admin=(await actor('ORDER_OPS')).token;denied=(await actor('FINANCE')).token;const m=await actor();member=m.token;memberNo=m.p.memberNo;foreign=(await actor()).token;
  const mod=await Test.createTestingModule({controllers:[AdminEventsController,MemberEventsController],providers:[MemberEventsService,MemberAuthenticationGuard,AdminAuthenticationGuard,AdminRoleGuard,LineIdentityService,AuditService,IdempotencyService,{provide:PrismaService,useValue:db},{provide:IdentityTokenService,useValue:tokens},{provide:ConfigService,useValue:{get:(name:string)=>name==='NODE_ENV'?'production':'false'}}]}).compile();app=mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalGuards(mod.get(AdminAuthenticationGuard),mod.get(AdminRoleGuard));app.useGlobalInterceptors(new EnvelopeInterceptor());await app.init();await app.getHttpAdapter().getInstance().ready();
 });afterAll(async()=>{jest.restoreAllMocks();await app?.close();await db?.$disconnect();});
 it('validates role/input and performs owner-only credential issuance, governed check-in and attendance',async()=>{
  const base='/api/v1/admin/events',eventCode=`HTTP-${randomUUID().slice(0,8).toUpperCase()}`,startsAt=new Date(Date.now()+3600000).toISOString(),payload={eventCode,title:'HTTP activity',eventType:'ONLINE',startsAt,endsAt:new Date(Date.now()+7200000).toISOString(),onlineJoinReference:'https://example.test/private-join',capacity:2};
  expect((await app.inject({url:base})).statusCode).toBe(401);expect((await app.inject({url:base,headers:headers(denied)})).statusCode).toBe(403);expect((await app.inject({method:'POST',url:base,headers:headers(admin),payload:{...payload,capacity:0}})).statusCode).toBe(400);expect((await app.inject({method:'POST',url:base,headers:headers(admin),payload:{...payload,personId:randomUUID()}})).statusCode).toBe(400);expect((await app.inject({method:'POST',url:base,headers:headers(admin),payload})).statusCode).toBe(201);expect((await app.inject({method:'POST',url:base+'/'+eventCode+'/publish',headers:headers(admin),payload:{approvalReference:'APPROVED-HTTP'}})).statusCode).toBe(201);
  const path='/api/v1/member/events/'+eventCode;expect((await app.inject({url:path})).statusCode).toBe(401);expect((await app.inject({url:path,headers:headers(foreign)})).json().data.onlineJoinReference).toBeNull();expect((await app.inject({method:'POST',url:path+'/register',headers:headers(member)})).statusCode).toBe(201);
  expect((await app.inject({method:'POST',url:path+'/credential',headers:headers(foreign)})).statusCode).toBe(404);expect((await app.inject({method:'POST',url:path+'/credential',headers:{authorization:'Bearer '+member}})).statusCode).toBe(400);const issued=await app.inject({method:'POST',url:path+'/credential',headers:headers(member)});expect(issued.statusCode).toBe(201);const token=issued.json().data.checkInToken;expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
  jest.spyOn(app.get(MemberEventsService) as any,'now').mockReturnValue(new Date(Date.parse(startsAt)+1000));expect((await app.inject({method:'POST',url:base+'/check-in',headers:headers(denied),payload:{checkInToken:token}})).statusCode).toBe(403);expect((await app.inject({method:'POST',url:base+'/check-in',headers:headers(admin),payload:{checkInToken:token}})).statusCode).toBe(201);expect((await app.inject({method:'POST',url:base+'/'+eventCode+'/attend',headers:headers(admin),payload:{memberNo}})).statusCode).toBe(201);
  const roster=await app.inject({url:base+'/'+eventCode+'/registrations',headers:headers(admin)});expect(roster.json().data.registrations[0]).toMatchObject({memberNo,status:'ATTENDED'});expect(roster.body).not.toContain(token);expect(roster.body).not.toContain('PRIVATE EVENT HTTP');expect((await app.inject({url:path,headers:headers(member)})).json().data.history).toHaveLength(3);
  expect((await app.inject({method:'POST',url:base+'/'+eventCode+'/archive',headers:headers(admin),payload:{reason:'活動完成'}})).statusCode).toBe(201);expect((await app.inject({url:path,headers:headers(member)})).json().data).toMatchObject({eventStatus:'ARCHIVED',status:'ATTENDED',canIssueCredential:false,onlineJoinReference:null});
 });
});
