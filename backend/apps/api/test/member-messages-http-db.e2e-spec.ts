import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaClient} from '@prisma/client';
import {PrismaService,appendMemberMessage,memberMessageReference} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {MemberMessagesController} from '../src/modules/member/member-messages.controller';
import {MemberMessagesService} from '../src/modules/member/member-messages.service';
import {MemberAuthenticationGuard} from '../src/modules/auth/member-authentication.guard';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {MemberIdentityService} from '../src/modules/auth/member-identity.service';
import {AuditService} from '../src/common/audit/audit.service';
import {IdempotencyService} from '../src/common/idempotency/idempotency.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('MEMBER_MESSAGES_HTTP_REAL_DB',()=>{
 let db:PrismaClient,app:NestFastifyApplication,token:string,foreign:string,noticeId:string;
 const headers=(value=token)=>({authorization:'Bearer '+value,'idempotency-key':randomUUID()});
 beforeAll(async()=>{
  db=new PrismaClient({datasources:{db:{url}}});const tokens=new IdentityTokenService(db as any);
  async function member(){const p=await db.person.create({data:{legalName:'PRIVATE HTTP MEMBER',status:'EFFECTIVE'}}),subject=randomUUID();await db.identityLink.create({data:{provider:'LINE',providerSubject:subject,personId:p.personId}});const auth=await tokens.issue({provider:'LINE',subject,personId:p.personId});return {p,token:auth.accessToken};}
  const a=await member(),b=await member();token=a.token;foreign=b.token;noticeId=(await db.$transaction(tx=>appendMemberMessage(tx,{messageKey:randomUUID(),personId:a.p.personId,category:'EVENT',title:'活動通知',body:'請查看活動中心。',sourceType:'EVENT',sourceReference:'EVENT:TEST_EVENT',deepLink:'/events'}))).notificationId;
  const mod=await Test.createTestingModule({controllers:[MemberMessagesController],providers:[MemberMessagesService,MemberAuthenticationGuard,MemberIdentityService,AuditService,IdempotencyService,{provide:PrismaService,useValue:db},{provide:IdentityTokenService,useValue:tokens},{provide:ConfigService,useValue:{get:()=>undefined}}]}).compile();app=mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalInterceptors(new EnvelopeInterceptor());await app.init();await app.getHttpAdapter().getInstance().ready();
 });afterAll(async()=>{await app?.close();await db?.$disconnect();});
 it('authenticates Person-only messages without requiring a qualification and rejects BOLA and forged audiences',async()=>{
  const path='/api/v1/member/messages',reference=memberMessageReference(noticeId);
  expect((await app.inject({url:path})).statusCode).toBe(401);const response=await app.inject({url:path,headers:headers()});expect(response.statusCode).toBe(200);expect(response.json().data.items[0].reference).toBe(reference);expect(response.body).not.toContain(noticeId);expect(response.body).not.toContain('PRIVATE HTTP MEMBER');
  expect((await app.inject({url:path,headers:headers(foreign)})).json().data.items).toEqual([]);
  expect((await app.inject({method:'POST',url:path+'/'+reference+'/read',headers:headers(foreign),payload:{}})).statusCode).toBe(404);
  expect((await app.inject({method:'POST',url:path+'/'+reference+'/read',headers:headers(),payload:{personId:randomUUID()}})).statusCode).toBe(400);
  expect((await app.inject({url:path+'?take=101',headers:headers()})).statusCode).toBe(400);
  expect((await app.inject({method:'POST',url:path+'/'+reference+'/read',headers:{authorization:'Bearer '+token},payload:{}})).statusCode).toBe(400);
  const command={method:'POST' as const,url:path+'/'+reference+'/read',headers:headers(),payload:{}},first=await app.inject(command),again=await app.inject(command);expect(first.statusCode).toBe(201);expect(again.json().data).toEqual(first.json().data);
  const archived=await app.inject({method:'POST',url:path+'/'+reference+'/archive',headers:headers(),payload:{}});expect(archived.statusCode).toBe(201);expect((await app.inject({url:path+'?view=ARCHIVED',headers:headers()})).json().data.items[0]).toMatchObject({status:'ARCHIVED',deepLink:null});
 });
});
