import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaClient} from '@prisma/client';
import {PrismaService} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {FulfillmentOperationsController} from '../src/modules/commerce/fulfillment-operations.controller';
import {FulfillmentOperationsService} from '../src/modules/commerce/fulfillment-operations.service';
import {FulfillmentSerialScanService} from '../src/modules/commerce/fulfillment-serial-scan.service';
import {FulfillmentPackVerificationService} from '../src/modules/commerce/fulfillment-pack-verification.service';
import {FulfillmentErpHandoffService} from '../src/modules/commerce/fulfillment-erp-handoff.service';
import {FulfillmentSourceAllocationService} from '../src/modules/commerce/fulfillment-source-allocation.service';
import {AuditService} from '../src/common/audit/audit.service';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
describeDb('FULFILLMENT_HTTP_REAL_DB',()=>{
 let db:PrismaClient,app:NestFastifyApplication,ops:string,auditor:string,finance:string,orderNo:string,key:string,sourceId:string,sourceRef:string,personId:string;
 const base='/api/v1/admin/fulfillment/orders';
 const headers=(token:string)=>({authorization:`Bearer ${token}`});
 beforeAll(async()=>{
  db=new PrismaClient({datasources:{db:{url}}});
  const tokens=new IdentityTokenService(db as any);
  async function actor(roleCode:string){
   const person=await db.person.create({data:{legalName:'Synthetic warehouse '+roleCode}}),subject=randomUUID();
   await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});
   await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode,validFrom:new Date(Date.now()-1000)}});
   return (await tokens.issue({provider:'ENTRA',subject,personId:person.personId,roleCode})).accessToken;
  }
  ops=await actor('ORDER_OPS');auditor=await actor('COMPLIANCE_AUDIT');finance=await actor('FINANCE');
  const module=await Test.createTestingModule({controllers:[FulfillmentOperationsController],providers:[
   {provide:PrismaService,useValue:db},AuditService,FulfillmentOperationsService,FulfillmentSerialScanService,FulfillmentPackVerificationService,FulfillmentErpHandoffService,FulfillmentSourceAllocationService,
   {provide:IdentityTokenService,useValue:tokens},{provide:ConfigService,useValue:{get:(name:string)=>name==='NODE_ENV'?'production':'false'}},AdminAuthenticationGuard,AdminRoleGuard]}).compile();
  app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));
  app.useGlobalGuards(module.get(AdminAuthenticationGuard),module.get(AdminRoleGuard));await app.init();await app.getHttpAdapter().getInstance().ready();
  const person=await db.person.create({data:{legalName:'Private fulfillment purchaser'}});personId=person.personId;
  const product=await db.productReference.create({data:{sku:`HTTP-${randomUUID()}`,displayName:'HTTP product',currentPrice:100}});
  const order=await db.order.create({data:{purchaserPersonId:personId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:'R1',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{}}}},include:{lines:true}});orderNo=order.orderNo.toString();
  key='F-HTTP-'+Date.now();
  const f=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:key,allocationSnapshotRef:'http',fulfillmentPolicySnapshotRef:'http'}});
  const source=await db.$transaction(tx=>new FulfillmentSourceAllocationService(db as any).allocate(tx,{fulfillmentId:f.fulfillmentId,orderLineId:order.lines[0].orderLineId,quantity:'1'}));sourceId=source.fulfillmentSourceAllocationId;
  const batch=await db.productSerialBatch.create({data:{productId:product.productId,serialPrefix:'C',batchSequence:601,batchCode:randomUUID()}});
  await db.serializedUnit.create({data:{productSerialBatchId:batch.productSerialBatchId,serialSequence:1,serialNo:'C6010001'}});
 });
 afterAll(async()=>{await app?.close();await db?.$disconnect();});
 it('enforces authenticated role separation and hides internal identifiers',async()=>{
  expect((await app.inject({url:`${base}/${orderNo}`})).statusCode).toBe(401);
  expect((await app.inject({url:`${base}/${orderNo}`,headers:headers(finance)})).statusCode).toBe(403);
  const read=await app.inject({url:`${base}/${orderNo}`,headers:headers(auditor)});
  expect(read.statusCode).toBe(200);sourceRef=read.json().data.fulfillments[0].sources[0].sourceReference;
  expect(read.body).not.toContain(personId);expect(read.body).not.toContain(sourceId);expect(read.body).not.toContain('Private fulfillment purchaser');
  expect((await app.inject({method:'POST',url:`${base}/${orderNo}/${key}/pack-verification`,headers:headers(auditor)})).statusCode).toBe(403);
 });
 it('scopes source references to the order and completes scan/pack/handoff with safe responses',async()=>{
  const read=await app.inject({url:`${base}/${orderNo}`,headers:headers(ops)}),source=read.json().data.fulfillments[0].sources[0];
  const payload={sourceReference:source.sourceReference,sku:source.sku,serialNo:'C6010001'};
  expect((await app.inject({method:'POST',url:`${base}/${orderNo}/${key}/scans`,headers:headers(ops),payload:{...payload,personId}})).statusCode).toBe(400);
  expect((await app.inject({method:'POST',url:`${base}/${orderNo}/${key}/scans`,headers:headers(ops),payload:{...payload,sourceReference:'a'.repeat(64)}})).statusCode).toBe(409);
  expect((await app.inject({method:'POST',url:`${base}/9223372036854775807/${key}/scans`,headers:headers(ops),payload})).statusCode).toBe(409);
  for(const [path,body] of [['scans',payload],['pack-verification',{}],['erp-handoff',{}]] as const){
   const response=await app.inject({method:'POST',url:`${base}/${orderNo}/${key}/${path}`,headers:headers(ops),payload:body});
   expect(response.statusCode).toBe(201);expect(response.body).not.toContain(sourceId);expect(response.body).not.toContain(personId);
  }
  const final=await app.inject({url:`${base}/${orderNo}`,headers:headers(ops)});
  expect(final.json().data.fulfillments[0]).toMatchObject({status:'PACKED',packVerification:{status:'PACK_VERIFIED'},erpHandoff:{providerCode:'ERP_PENDING'}});
 });
 it('prepares a paid order once under concurrent requests and preserves source purpose',async()=>{
  const product=await db.productReference.create({data:{sku:'PREP-'+randomUUID(),displayName:'Preparation fixture',currentPrice:100}});
  const order=await db.order.create({data:{purchaserPersonId:personId,purpose:'RETAIL',status:'DRAFT',grossAmount:100,netAmount:100,ruleVersionCode:'R1',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:2,unitPrice:50,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,linePurpose:'ADDITIONAL_PURCHASE',commercialOfferingSnapshot:{offeringCode:'TEST',version:1},ruleProfileSnapshot:{}}}},include:{lines:true}});
  const url=`${base}/${order.orderNo}/prepare`;
  expect((await app.inject({method:'POST',url,headers:headers(auditor)})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url,headers:headers(ops)})).statusCode).toBe(409);
  await db.order.update({where:{orderId:order.orderId},data:{status:'PAID',paidAt:new Date()}});
  const results=await Promise.all([app.inject({method:'POST',url,headers:headers(ops)}),app.inject({method:'POST',url,headers:headers(ops)})]);
  expect(results.map(r=>r.statusCode)).toEqual([201,201]);expect(results.map(r=>r.json().data.replayed).sort()).toEqual([false,true]);
  const rows=await db.fulfillment.findMany({where:{orderId:order.orderId},include:{sourceAllocations:true}});
  expect(rows).toHaveLength(1);expect(rows[0].sourceAllocations).toHaveLength(1);
  expect(rows[0].sourceAllocations[0]).toMatchObject({orderLineId:order.lines[0].orderLineId,linePurpose:'ADDITIONAL_PURCHASE',commercialOfferingSnapshot:{offeringCode:'TEST',version:1}});
  expect(rows[0].sourceAllocations[0].allocatedQuantity.toString()).toBe('2');
  expect(await db.auditEvent.count({where:{entityId:rows[0].fulfillmentId,action:'FULFILLMENT_PREPARED'}})).toBe(1);
 });
});
