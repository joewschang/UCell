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
(url?describe:describe.skip)('LINEAGE_RBAC_BOLA / LINEAGE_NO_NORMAL_UI_UUID_LEAK',()=>{
 let db:PrismaClient,app:NestFastifyApplication,orderNo:string,orderId:string;
 const authorized:string[]=[],privateIds:string[]=[];
 let outsider:string;
 beforeAll(async()=>{
  db=new PrismaClient({datasources:{db:{url}}});const tokens=new IdentityTokenService(db as any),service=new AdminOperationsService(db as any,new AuditService());
  async function actor(roleCode:string){const person=await db.person.create({data:{legalName:'Synthetic lineage HTTP'}}),subject=randomUUID();await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode,validFrom:new Date(Date.now()-1000)}});return (await tokens.issue({provider:'ENTRA',personId:person.personId,subject,roleCode})).accessToken;}
  for(const role of ['FINANCE','COMPLIANCE_AUDIT','ORDER_OPS','SUPER_ADMIN'])authorized.push(await actor(role));
  outsider=await actor('MEMBERSHIP_OPS');
  const module=await Test.createTestingModule({controllers:[AdminOperationsController],providers:[{provide:AdminOperationsService,useValue:service},{provide:PrismaService,useValue:db},{provide:IdentityTokenService,useValue:tokens},{provide:ConfigService,useValue:{get:(name:string)=>name==='NODE_ENV'?'production':'false'}},AdminAuthenticationGuard,AdminRoleGuard]}).compile();
  app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalGuards(module.get(AdminAuthenticationGuard),module.get(AdminRoleGuard));await app.init();await app.getHttpAdapter().getInstance().ready();
  const person=await db.person.create({data:{legalName:'PRIVATE-LINEAGE-PURCHASER'}}),product=await db.productReference.create({data:{sku:'HTTP-LINEAGE-'+Date.now(),displayName:'Synthetic lineage',currentPrice:100}});
  privateIds.push(randomUUID(),randomUUID());
  const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:'R1.0B',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{profileId:privateIds[0],ruleVersionCode:'R1.0B',privateBankDetail:'PRIVATE-BANK-DETAIL'},commercialOfferingSnapshot:{commercialOfferingVersionId:privateIds[1],offeringCode:'TEST_OFFERING',offeringType:'CORE_PRODUCT',version:1,privateToken:'PRIVATE-TOKEN'}}}}});
  orderNo=order.orderNo.toString();orderId=order.orderId;privateIds.push(person.personId,product.productId,orderId);
 });
 afterAll(async()=>{await app?.close();await db?.$disconnect();});
 const request=(token?:string,reference=orderNo)=>app.inject({method:'GET',url:`/api/v1/admin/operations/economic-lineage/orders/${reference}`,headers:token?{authorization:`Bearer ${token}`}:{}});
 it('denies unauthenticated and non-lineage roles before exposing any order object',async()=>{
  expect((await request()).statusCode).toBe(401);
  expect((await request(outsider)).statusCode).toBe(403);
  expect((await request(outsider,orderId)).statusCode).toBe(403);
  expect((await request(authorized[0],orderId)).statusCode).toBe(422);
 });
 it('uses approved role scope, safe business references and stable reads without arbitrary snapshot fields',async()=>{
  let first:unknown;
  for(const token of authorized){
   const response=await request(token);expect(response.statusCode).toBe(200);const result=response.json().data;
   expect(result.order.orderNo).toBe(orderNo);
   expect(result.lines[0].offering).toMatchObject({offeringCode:'TEST_OFFERING',offeringType:'CORE_PRODUCT',version:1});
   expect(result.lines[0].ruleSnapshot).toMatchObject({ruleVersionCode:'R1.0B'});
   for(const secret of [...privateIds,'PRIVATE-TOKEN','PRIVATE-BANK-DETAIL','PRIVATE-LINEAGE-PURCHASER'])expect(response.body).not.toContain(secret);
   if(first)expect(result).toEqual(first);else first=result;
  }
  expect((await request(authorized[0])).json().data).toEqual(first);
 });
});
