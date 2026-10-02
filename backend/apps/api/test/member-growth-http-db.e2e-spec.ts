import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaClient} from '@prisma/client';
import {PrismaService} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {MemberController} from '../src/modules/member/member.controller';
import {MemberGrowthService} from '../src/modules/member/member-growth.service';
import {MemberContextGuard} from '../src/modules/member/member-context.guard';
import {QualificationAccessService} from '../src/modules/auth/qualification-access.service';
import {MemberAuthenticationGuard} from '../src/modules/auth/member-authentication.guard';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {MemberIdentityService} from '../src/modules/auth/member-identity.service';
import {AuditService} from '../src/common/audit/audit.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('Growth real member HTTP identity',()=>{
 let db:PrismaClient,app:NestFastifyApplication,token:string,foreignId:string,foreignNo:string;
 beforeAll(async()=>{
  db=new PrismaClient({datasources:{db:{url}}});const tokens=new IdentityTokenService(db as any),p=await db.person.create({data:{legalName:'Growth HTTP owner',status:'EFFECTIVE',membershipState:'NETWORK_MEMBER'}}),subject=randomUUID();await db.identityLink.create({data:{provider:'LINE',providerSubject:subject,personId:p.personId}});token=(await tokens.issue({provider:'LINE',subject,personId:p.personId})).accessToken;
  const other=await db.person.create({data:{legalName:'FOREIGN GROWTH PRIVATE'}}),q=await db.qualification.create({data:{currentHolderPersonId:other.personId,planLevelCode:'LEADER'}});foreignId=other.personId;foreignNo=q.qualificationNo.toString();
  // Only unrelated handlers are stubs; the actual route, guards, tokens and growth projection use PostgreSQL.
  const unrelated=(Reflect.getMetadata('design:paramtypes',MemberController) as any[]).filter(t=>t!==MemberGrowthService).map(provide=>({provide,useValue:{}}));
  const mod=await Test.createTestingModule({controllers:[MemberController],providers:[...unrelated,MemberGrowthService,MemberContextGuard,QualificationAccessService,MemberAuthenticationGuard,MemberIdentityService,AuditService,{provide:PrismaService,useValue:db},{provide:IdentityTokenService,useValue:tokens},{provide:ConfigService,useValue:{get:()=>undefined}}]}).compile();app=mod.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalInterceptors(new EnvelopeInterceptor());await app.init();await app.getHttpAdapter().getInstance().ready();
 });afterAll(async()=>{await app?.close();await db?.$disconnect();});
 it('serves a person without a qualification and rejects forged scope rather than leaking another member',async()=>{
  const path='/api/v1/member/my-growth',headers={authorization:'Bearer '+token};expect((await app.inject({url:path})).statusCode).toBe(401);const result=await app.inject({url:path,headers});expect(result.statusCode).toBe(200);expect(result.json().data.dimensions.qualification.items).toEqual([]);expect(result.body).not.toContain(foreignId);expect(result.body).not.toContain('"qualificationNo":"'+foreignNo+'"');expect(result.body).not.toContain('FOREIGN GROWTH PRIVATE');expect((await app.inject({url:path+'?personId='+foreignId,headers})).statusCode).toBe(400);
 });
});
