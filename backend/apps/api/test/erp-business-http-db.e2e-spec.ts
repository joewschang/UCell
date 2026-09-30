import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaClient} from '@prisma/client';
import {PrismaService,claimOutboxLease,erpBusinessReference,sealErpBusinessProjection} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {ErpBusinessProjectionController} from '../src/modules/commerce/erp-business-projection.controller';
import {ErpBusinessProjectionService} from '../src/modules/commerce/erp-business-projection.service';
import {ErpCompensationProjectionService} from '../src/modules/commerce/erp-compensation-projection.service';
import {ErpCompensationProjectionController} from '../src/modules/commerce/erp-compensation-projection.controller';
import {ErpPaymentProjectionService} from '../src/modules/commerce/erp-payment-projection.service';
import {ErpPaymentProjectionController} from '../src/modules/commerce/erp-payment-projection.controller';
import {ErpAccountingMappingController} from '../src/modules/commerce/erp-accounting-mapping.controller';
import {ErpAccountingMappingService} from '../src/modules/commerce/erp-accounting-mapping.service';
import {AuditService} from '../src/common/audit/audit.service';
import {IdentityTokenService} from '../src/modules/auth/identity-token.service';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
import {processErpBusinessProjection} from '../../worker/src/erp-business-runtime';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('ERP_BUSINESS_HTTP_REAL_DB',()=>{
 let db:PrismaClient,app:NestFastifyApplication,finance:string,auditor:string,orderOps:string;
 const base='/api/v1/admin/erp-projections',headers=(token:string)=>({authorization:`Bearer ${token}`});
 beforeAll(async()=>{
  db=new PrismaClient({datasources:{db:{url}}});const tokens=new IdentityTokenService(db as any);
  async function actor(roleCode:string){const person=await db.person.create({data:{legalName:'Synthetic ERP '+roleCode}}),subject=randomUUID();await db.identityLink.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject}});await db.adminAccessGrant.create({data:{personId:person.personId,provider:'ENTRA',providerSubject:subject,roleCode,validFrom:new Date(Date.now()-1000)}});return (await tokens.issue({provider:'ENTRA',subject,personId:person.personId,roleCode})).accessToken;}
  finance=await actor('FINANCE');auditor=await actor('COMPLIANCE_AUDIT');orderOps=await actor('ORDER_OPS');
  const module=await Test.createTestingModule({controllers:[ErpBusinessProjectionController,ErpCompensationProjectionController,ErpPaymentProjectionController,ErpAccountingMappingController],providers:[{provide:PrismaService,useValue:db},AuditService,ErpBusinessProjectionService,ErpCompensationProjectionService,ErpPaymentProjectionService,ErpAccountingMappingService,{provide:IdentityTokenService,useValue:tokens},{provide:ConfigService,useValue:{get:(name:string)=>name==='NODE_ENV'?'production':'false'}},AdminAuthenticationGuard,AdminRoleGuard]}).compile();
  app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter(),{logger:false});app.setGlobalPrefix('api/v1');app.useGlobalPipes(new ValidationPipe({whitelist:true,forbidNonWhitelisted:true,transform:true}));app.useGlobalGuards(module.get(AdminAuthenticationGuard),module.get(AdminRoleGuard));await app.init();await app.getHttpAdapter().getInstance().ready();
 });
 afterAll(async()=>{await app?.close();await db?.$disconnect();});
 async function fixture(){
  const person=await db.person.create({data:{legalName:'Private ERP buyer'}}),product=await db.productReference.create({data:{sku:'HTTPERP-'+randomUUID().slice(0,8),displayName:'Synthetic',currentPrice:100}});
  const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',status:'PAID',paidAt:new Date(),grossAmount:200,discountAmount:10,netAmount:190,ruleVersionCode:'SYNTHETIC',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:2,unitPrice:100,lineAmount:200,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{private:'secret-token'}}}},include:{lines:true}});
  return {person,order};
 }
 async function sales(orderNo:string){const result=await app.inject({method:'POST',url:`${base}/orders/${orderNo}/sales`,headers:headers(finance)});expect(result.statusCode).toBe(201);return result.json().data;}
 async function accept(projectionReference:string){
  const projection=await db.erpBusinessProjection.findUniqueOrThrow({where:{projectionReference}}),connection=await db.providerConnection.create({data:{domain:'ERP',provider:'EZTOOL',connectionKey:'TEST-'+randomUUID().slice(0,8),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'synthetic-secret-reference',webhookVerificationRef:'synthetic-reference',configHash:'a'.repeat(64),effectiveFrom:new Date(0),approvalReference:'TEST',createdByActor:randomUUID()}}},include:{versions:true}});
  const event=await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:projection.outboxEventId}}),lease=(await claimOutboxLease(db,event))!;
  const providerReference='ERP-'+projectionReference.slice(-12);
  await processErpBusinessProjection(db as any,lease,{provider:'EZTOOL',providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,environment:'TEST',lookup:async()=>({kind:'ABSENT'}),submit:async()=>({kind:'ACCEPTED',providerReference,requestHash:projection.payloadHash})});
  return providerReference;
 }
 it('authenticates, separates audit reads from writes and creates one audited Sales projection',async()=>{
  const f=await fixture(),path=`${base}/orders/${f.order.orderNo}/sales`;
  expect((await app.inject({url:base})).statusCode).toBe(401);expect((await app.inject({method:'POST',url:path,headers:headers(auditor)})).statusCode).toBe(403);
  const first=await sales(f.order.orderNo.toString()),again=await sales(f.order.orderNo.toString());expect(first.replayed).toBe(false);expect(again).toEqual({...first,replayed:true});
  const read=await app.inject({url:`${base}/${first.projectionReference}`,headers:headers(auditor)});expect(read.statusCode).toBe(200);expect(read.json().data.status).toBe('BLOCKED_EXTERNAL');expect(read.json().data.drillback.verified).toBe(true);
  for(const hidden of [f.person.personId,f.order.orderId,f.order.lines[0].orderLineId,'Private ERP buyer','secret-token','requestedByActor'])expect(read.body).not.toContain(hidden);
  const row=await db.erpBusinessProjection.findUniqueOrThrow({where:{projectionReference:first.projectionReference}});expect(await db.auditEvent.count({where:{entityId:row.projectionId,action:'ERP_SALES_PROJECTION_REQUESTED'}})).toBe(1);
  expect((await app.inject({url:`${base}/${first.projectionReference}/sources?kind=PAYMENT`,headers:headers(finance)})).statusCode).toBe(422);
 });
 it('requires Finance and complete approved-period evidence for compensation preview and approval',async()=>{
  const payload={periodStart:'1899-01-01T00:00:00Z',periodEnd:'1899-02-01T00:00:00Z',ruleVersionCode:'NO_APPROVED_RULE',accountingDate:'1899-02-02',currency:'TWD',currencyBasisReference:'TEST-CURRENCY',groupByPayoutBatch:false},url=`${base}/compensation/preview`;
  expect((await app.inject({method:'POST',url,payload})).statusCode).toBe(401);expect((await app.inject({method:'POST',url,payload,headers:headers(auditor)})).statusCode).toBe(403);
  const result=await app.inject({method:'POST',url,payload,headers:headers(finance)});expect(result.statusCode).toBe(409);expect(result.json().code).toBe('ERP_COMPENSATION_SEALED_PERIOD_REQUIRED');
  expect((await app.inject({method:'POST',url,payload:{...payload,accountCode:'INVENTED'},headers:headers(finance)})).statusCode).toBe(400);
  expect((await app.inject({method:'POST',url:`${base}/compensation/approve`,payload:{...payload,reviewHash:'a'.repeat(64),approvalReference:'TEST-APPROVAL'},headers:headers(auditor)})).statusCode).toBe(403);
 });
 it('keeps compensation reads out of Order Operations while allowing its Sales stream',async()=>{
  const sealed=await db.$transaction(tx=>sealErpBusinessProjection(tx,{stream:'COMPENSATION',sourceIdentity:'TEST-PRIVATE-COMP-'+randomUUID(),body:{amount:'987.6543'},drillback:{private:'TEST-SUBLEDGER'},context:{actorId:randomUUID(),correlationId:randomUUID(),approvalReference:'TEST-APPROVAL'}})),reference=sealed.projection.projectionReference;
  expect((await app.inject({url:`${base}?stream=COMPENSATION`,headers:headers(orderOps)})).statusCode).toBe(403);
  const list=await app.inject({url:base,headers:headers(orderOps)});expect(list.statusCode).toBe(200);expect(list.body).not.toContain(reference);expect(list.body).not.toContain('987.6543');
  expect((await app.inject({url:`${base}/${reference}`,headers:headers(orderOps)})).statusCode).toBe(403);expect((await app.inject({url:`${base}/${reference}/sources`,headers:headers(orderOps)})).statusCode).toBe(403);
  expect((await app.inject({url:`${base}/${reference}`,headers:headers(auditor)})).statusCode).toBe(200);
  const f=await fixture();expect((await app.inject({method:'POST',url:`${base}/orders/${f.order.orderNo}/sales`,headers:headers(orderOps)})).statusCode).toBe(201);
 });
 it('restricts payment preview and approval to Finance while allowing Compliance batch discovery',async()=>{
  const url=`${base}/payment/batches?periodStart=1888-01-01T00:00:00Z&periodEnd=1888-02-01T00:00:00Z`;
  expect((await app.inject({url,headers:headers(orderOps)})).statusCode).toBe(403);expect((await app.inject({url,headers:headers(auditor)})).statusCode).toBe(200);
  const payload={payoutReference:'PAYOUT-'+'a'.repeat(40),periodStart:'1888-01-01T00:00:00Z',periodEnd:'1888-02-01T00:00:00Z',accountingDate:'1888-02-02',currency:'TWD',currencyBasisReference:'TEST-LEDGER-TWD',groupByEconomicCategory:true};
  expect((await app.inject({method:'POST',url:`${base}/payment/preview`,payload,headers:headers(auditor)})).statusCode).toBe(403);expect((await app.inject({method:'POST',url:`${base}/payment/preview`,payload,headers:headers(finance)})).statusCode).toBe(409);
  expect((await app.inject({method:'POST',url:`${base}/payment/approve`,payload:{...payload,reviewHash:'a'.repeat(64),approvalReference:'TEST-APPROVAL'},headers:headers(orderOps)})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:`${base}/payment/supplement-preview`,payload:{...payload,previousProjectionReference:'ERP-PROJECTION-'+'a'.repeat(40)},headers:headers(auditor)})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:`${base}/payment/supplement-approve`,payload:{...payload,previousProjectionReference:'ERP-PROJECTION-'+'a'.repeat(40),reviewHash:'a'.repeat(64),approvalReference:'TEST-APPROVAL',reasonReference:'TEST-SUPPLEMENT'},headers:headers(orderOps)})).statusCode).toBe(403);
 });
 it('requires actual ERP acceptance and keeps partial, mismatched and matched results append-only',async()=>{
  const f=await fixture(),created=await sales(f.order.orderNo.toString()),projection=created.projectionReference;
  const detail=(await app.inject({url:`${base}/${projection}`,headers:headers(finance)})).json().data,source=detail.expected.lines[0];
  const body={resultKey:'TEST-'+randomUUID(),providerReference:'ERP-'+projection.slice(-12),occurredAt:new Date().toISOString(),currency:'TWD',amount:'190',lines:[{lineReference:source.lineReference,amount:'200',quantity:'2'}]},post=(payload:any)=>app.inject({method:'POST',url:`${base}/${projection}/results`,headers:headers(finance),payload});
  expect((await post(body)).statusCode).toBe(409);expect((await post({...body,privateField:'secret'})).statusCode).toBe(400);
  await accept(projection);
  const partial=await post({...body,resultKey:'PARTIAL-'+randomUUID(),amount:'95',lines:[{...body.lines[0],amount:'100',quantity:'1'}]});expect(partial.statusCode).toBe(201);expect(partial.json().data.outcome).toBe('PARTIAL');
  const mismatch=await post({...body,resultKey:'MISMATCH-'+randomUUID(),amount:'210'});expect(mismatch.json().data.outcome).toBe('MISMATCH');
  const matched=await post(body);expect(matched.statusCode).toBe(201);expect(matched.json().data.outcome).toBe('MATCHED');expect((await post(body)).json().data.replayed).toBe(true);expect((await post({...body,amount:'189'})).statusCode).toBe(409);
  const row=await db.erpBusinessProjection.findUniqueOrThrow({where:{projectionReference:projection}});expect(await db.erpProjectionReconciliation.count({where:{projectionId:row.projectionId}})).toBe(3);expect(await db.auditEvent.count({where:{entityId:row.projectionId,action:'ERP_PROJECTION_RECONCILED'}})).toBe(3);
  expect(await db.operationalException.findFirst({where:{sourceType:'ERP_BUSINESS_PROJECTION',sourceId:projection}})).toMatchObject({exceptionCode:'ERP_PROJECTION_RESULT_MISMATCH',status:'OPEN'});
  expect((await db.order.findUniqueOrThrow({where:{orderId:f.order.orderId}})).status).toBe('PAID');expect(await db.shipment.count({where:{fulfillment:{orderId:f.order.orderId}}})).toBe(0);
  expect((await app.inject({url:`${base}/${projection}`,headers:headers(auditor)})).json().data.status).toBe('RECONCILED');
 });
 it('binds Return references to their order and preserves UCell economic authority',async()=>{
  const f=await fixture(),other=await fixture(),ret=await db.returnCase.create({data:{orderId:f.order.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),postedAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:f.order.lines[0].orderLineId,quantity:1,returnAmount:95,gpvReversalAmount:0}}}});
  const read=await app.inject({url:`${base}/orders/${f.order.orderNo}/sources`,headers:headers(auditor)}),reference=read.json().data.returns[0].returnReference;expect(reference).toBe(erpBusinessReference('RETURN',ret.returnCaseId));expect(read.body).not.toContain(ret.returnCaseId);
  expect((await app.inject({method:'POST',url:`${base}/orders/${other.order.orderNo}/returns/${reference}`,headers:headers(finance)})).statusCode).toBe(409);
  const response=await app.inject({method:'POST',url:`${base}/orders/${f.order.orderNo}/returns/${reference}`,headers:headers(finance)});expect(response.statusCode).toBe(201);expect(await db.bonusRecoveryEvent.count({where:{returnCaseId:ret.returnCaseId}})).toBe(0);
 });
 it('rolls back projection and Outbox when request audit fails',async()=>{
  const f=await fixture(),service=new ErpBusinessProjectionService(db as any,{write:async()=>{throw new Error('SYNTHETIC_AUDIT_FAILURE');}} as any),count=await db.outboxEvent.count();
  await expect(service.sales(f.order.orderNo.toString(),{actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()})).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE');
  expect(await db.erpBusinessProjection.count({where:{sourceIdentity:f.order.orderId}})).toBe(0);expect(await db.outboxEvent.count()).toBe(count);
 });
 it('retries a failed immutable projection once per command and preserves attempt evidence',async()=>{
  const f=await fixture(),created=await sales(f.order.orderNo.toString()),projectionReference=created.projectionReference,row=await db.erpBusinessProjection.findUniqueOrThrow({where:{projectionReference}});
  const payload={retryKey:randomUUID(),reasonReference:'CASE-ERP-RECOVERY'},url=`${base}/${projectionReference}/retry`,send=(value=payload)=>app.inject({method:'POST',url,headers:headers(finance),payload:value});
  expect((await send()).statusCode).toBe(409);
  await db.outboxEvent.update({where:{outboxEventId:row.outboxEventId},data:{processStatus:'DEAD',attemptCount:10,lastError:'ERP_PROJECTION_ACCEPTANCE_UNKNOWN'}});
  expect((await app.inject({method:'POST',url,headers:headers(auditor),payload})).statusCode).toBe(403);
  const responses=await Promise.all([send(),send()]);expect(responses.map(result=>result.statusCode)).toEqual([201,201]);expect(responses.map(result=>result.json().data.replayed).sort()).toEqual([false,true]);
  expect(await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:row.outboxEventId}})).toMatchObject({processStatus:'PENDING',attemptCount:10});
  expect((await send({...payload,reasonReference:'OTHER-CASE'})).statusCode).toBe(409);
  await db.outboxEvent.update({where:{outboxEventId:row.outboxEventId},data:{processStatus:'DEAD',attemptCount:11}});
  expect((await send()).json().data.replayed).toBe(true);expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:row.outboxEventId}})).processStatus).toBe('DEAD');
  expect(await db.erpBusinessProjection.findUniqueOrThrow({where:{projectionReference}})).toEqual(row);
  expect(await db.auditEvent.count({where:{entityId:row.projectionId,action:'ERP_PROJECTION_RETRY_REQUESTED'}})).toBe(1);
 });
 it('protects mapping approval and history with financial roles and publishes no private connection fields',async()=>{
  const route='/api/v1/admin/erp-accounting-mappings',groupReference=erpBusinessReference('COMPENSATION-GROUP',randomUUID());
  const projection=(await db.$transaction(tx=>sealErpBusinessProjection(tx,{stream:'COMPENSATION',sourceIdentity:randomUUID(),body:{projectionPurpose:'SUBLEDGER_ACCOUNTING_REVIEW',currency:'TWD',configuration:{accountingDate:'2026-09-30'},aggregates:[{groupReference,metric:'MEMBER_PAYABLE_GROSS',economicCategory:'BINARY',amount:'10'}]},drillback:{private:'SECRET-SOURCE'},context:{actorId:randomUUID(),correlationId:randomUUID(),approvalReference:'SYNTHETIC-REVIEW'}}))).projection;
  const connection=await db.providerConnection.create({data:{domain:'ERP',provider:'EZTOOL',connectionKey:'HTTP-'+randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'SECRET-CREDENTIAL',webhookVerificationRef:'SECRET-WEBHOOK',configHash:'a'.repeat(64),effectiveFrom:new Date(0),approvalReference:'SYNTHETIC-APPROVED',createdByActor:randomUUID()}}},include:{versions:true}});
  const input={connectionKey:connection.connectionKey,connectionVersion:1,policyReference:'SYNTHETIC-POLICY',policyVersion:1,previousMappingReference:null,entries:[{groupReference,treatment:'MAP',mappingCode:'SYNTHETIC-CODE'}]},url=`${route}/${projection.projectionReference}`;
  expect((await app.inject({method:'GET',url,headers:headers(orderOps)})).statusCode).toBe(403);
  for(const token of [auditor,orderOps]){expect((await app.inject({method:'POST',url:url+'/preview',headers:headers(token),payload:input})).statusCode).toBe(403);expect((await app.inject({method:'POST',url:url+'/approve',headers:headers(token),payload:{...input,reviewHash:'a'.repeat(64),approvalReference:'SYNTHETIC-APPROVAL'}})).statusCode).toBe(403);}
  const preview=await app.inject({method:'POST',url:url+'/preview',headers:headers(finance),payload:input});expect(preview.statusCode).toBe(201);
  const approved=await app.inject({method:'POST',url:url+'/approve',headers:headers(finance),payload:{...input,reviewHash:preview.json().data.reviewHash,approvalReference:'SYNTHETIC-APPROVAL'}});expect(approved.statusCode).toBe(201);
  const history=await app.inject({method:'GET',url,headers:headers(auditor)});expect(history.statusCode).toBe(200);expect(history.json().data.items).toHaveLength(1);expect(history.body).not.toContain('SECRET');expect(history.body).not.toContain(connection.versions[0].providerConnectionVersionId);expect(history.body).not.toContain(projection.projectionId);
  expect((await app.inject({method:'GET',url:route+'/connections',headers:headers(auditor)})).body).not.toContain('SECRET');
 });
 it('rolls back a retry if its audit fails and never retries an accepted document',async()=>{
  const f=await fixture(),created=await sales(f.order.orderNo.toString()),projectionReference=created.projectionReference,row=await db.erpBusinessProjection.findUniqueOrThrow({where:{projectionReference}}),input={retryKey:randomUUID(),reasonReference:'CASE-ERP-AUDIT'},context={actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()};
  await db.outboxEvent.update({where:{outboxEventId:row.outboxEventId},data:{processStatus:'DEAD',attemptCount:2}});
  const service=new ErpBusinessProjectionService(db as any,{write:async()=>{throw new Error('SYNTHETIC_RETRY_AUDIT_FAILURE');}} as any);
  await expect(service.retry(projectionReference,input,context)).rejects.toThrow('SYNTHETIC_RETRY_AUDIT_FAILURE');expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:row.outboxEventId}})).processStatus).toBe('DEAD');
  await db.outboxEvent.update({where:{outboxEventId:row.outboxEventId},data:{processStatus:'PENDING'}});await accept(projectionReference);
  expect((await app.inject({method:'POST',url:`${base}/${projectionReference}/retry`,headers:headers(finance),payload:input})).statusCode).toBe(409);
 });
});
