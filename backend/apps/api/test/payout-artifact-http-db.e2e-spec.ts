import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaClient} from '@prisma/client';
import {PrismaService} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {AdminOperationsController} from '../src/modules/admin-operations/admin-operations.controller';
import {AdminOperationsService} from '../src/modules/admin-operations/admin-operations.service';
import {AuditService} from '../src/common/audit/audit.service';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('finance artifact authenticated download',()=>{
 let db:PrismaClient,app:NestFastifyApplication,batchId:string,finance:string,auditor:string;
 beforeAll(async()=>{
  db=new PrismaClient({datasources:{db:{url}}});const tokens=new IdentityTokenService(db as any),service=new AdminOperationsService(db as any,new AuditService());
  async function actor(roleCode:string){const person=await db.person.create({data:{legalName:'Synthetic finance HTTP'}}),subject=randomUUID();await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode,validFrom:new Date(Date.now()-1000)}});return (await tokens.issue({provider:'ENTRA',personId:person.personId,subject,roleCode})).accessToken;}
  finance=await actor('FINANCE');auditor=await actor('COMPLIANCE_AUDIT');
  const module=await Test.createTestingModule({controllers:[AdminOperationsController],providers:[{provide:AdminOperationsService,useValue:service},{provide:PrismaService,useValue:db},{provide:IdentityTokenService,useValue:tokens},{provide:ConfigService,useValue:{get:(name:string)=>name==='NODE_ENV'?'production':'false'}},AdminAuthenticationGuard,AdminRoleGuard]}).compile();
  app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalGuards(module.get(AdminAuthenticationGuard),module.get(AdminRoleGuard));await app.init();await app.getHttpAdapter().getInstance().ready();
  const person=await db.person.create({data:{legalName:'Private fixture recipient'}}),q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
  const batch=await db.payoutBatch.create({data:{periodStart:new Date('2026-01-01Z'),periodEnd:new Date('2026-02-01Z'),status:'READY',totalGross:100,totalRecovery:0,totalNet:100}});batchId=batch.payoutBatchId;
  await db.payoutLine.create({data:{payoutBatchId:batchId,recipientQualificationId:q.qualificationId,grossAmount:100,netAmount:100,detailJson:{privateNote:'hidden'}}});
  await service.approvePayout(batchId,'FINANCE_REVIEW',person.personId,'FINANCE',undefined,randomUUID(),randomUUID());await service.approvePayout(batchId,'COMPLIANCE_REVIEW',randomUUID(),'COMPLIANCE_AUDIT',undefined,randomUUID(),randomUUID());await service.exportPayout(batchId,'HTTP-'+randomUUID(),person.personId,'FINANCE',randomUUID(),randomUUID());
 });
 afterAll(async()=>{await app?.close();await db?.$disconnect();});
 const request=(token?:string,payload:unknown={revision:1},id?:string)=>app.inject({method:'POST',url:`/api/v1/admin/operations/payout-batches/${id??batchId}/export-downloads`,headers:token?{authorization:`Bearer ${token}`}:{},payload:payload as any});
 it('restricts file content to authenticated Finance and validates revision input',async()=>{
  expect((await request()).statusCode).toBe(401);expect((await request(auditor)).statusCode).toBe(403);
  expect((await request(finance,{revision:0})).statusCode).toBe(400);expect((await request(finance,{revision:1,personId:randomUUID()})).statusCode).toBe(400);
  expect(await db.auditEvent.count({where:{entityId:batchId,action:'PAYOUT_ARTIFACT_DOWNLOADED'}})).toBe(0);
 });
 it('returns exact review bytes and records only safe download metadata',async()=>{
  const response=await request(finance);expect(response.statusCode).toBe(201);const file=response.json().data;expect(file.content).toContain('應付總額');expect(file.content).not.toContain(batchId);expect(file.content).not.toContain('Private fixture recipient');
  expect(file.fileHash).toMatch(/^[a-f0-9]{64}$/);expect(file.purpose).toBe('FINANCE_REVIEW_ONLY');
  const audits=await db.auditEvent.findMany({where:{entityId:batchId,action:'PAYOUT_ARTIFACT_DOWNLOADED'}});expect(audits).toHaveLength(1);expect(JSON.stringify(audits)).not.toContain(file.content);
  expect((await request(finance,{revision:2})).statusCode).toBe(409);expect((await request(finance,{revision:1},randomUUID())).statusCode).toBe(409);
 });
});
