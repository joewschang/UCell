import {FulfillmentShipmentService} from '../src/modules/commerce/fulfillment-shipment.service';
import {PiiCryptoService} from '@ucell/database';
import {FulfillmentDeliveryService} from '../src/modules/commerce/fulfillment-delivery.service';
import {FulfillmentSerialProvenanceService} from '../src/modules/commerce/fulfillment-serial-provenance.service';
import {Test} from '@nestjs/testing';
import {ValidationPipe} from '@nestjs/common';
import {ConfigService} from '@nestjs/config';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {PrismaClient} from '@prisma/client';
import {PrismaService} from '@ucell/database';
import {randomBytes,randomUUID} from 'node:crypto';
import {FulfillmentOperationsController} from '../src/modules/commerce/fulfillment-operations.controller';
import {FulfillmentOperationsService} from '../src/modules/commerce/fulfillment-operations.service';
import {FulfillmentSerialScanService} from '../src/modules/commerce/fulfillment-serial-scan.service';
import {FulfillmentPackVerificationService} from '../src/modules/commerce/fulfillment-pack-verification.service';
import {FulfillmentErpHandoffService} from '../src/modules/commerce/fulfillment-erp-handoff.service';
import {FulfillmentSourceAllocationService} from '../src/modules/commerce/fulfillment-source-allocation.service';
import {FulfillmentErpReconciliationService} from '../src/modules/commerce/fulfillment-erp-reconciliation.service';
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
  process.env.PII_ENCRYPTION_KEY=randomBytes(32).toString('base64');process.env.PII_ENCRYPTION_KEY_VERSION='warehouse-http-test';
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
   {provide:PrismaService,useValue:db},AuditService,FulfillmentOperationsService,FulfillmentSerialScanService,FulfillmentPackVerificationService,FulfillmentErpHandoffService,FulfillmentSourceAllocationService,FulfillmentErpReconciliationService,FulfillmentSerialProvenanceService,FulfillmentDeliveryService,PiiCryptoService,FulfillmentShipmentService,
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
 it('records ERP evidence idempotently, detects differences and never invents shipment',async()=>{
  const read=await app.inject({url:`${base}/${orderNo}`,headers:headers(ops)}),source=read.json().data.fulfillments[0].sources[0];
  const endpoint=`${base}/${orderNo}/${key}/erp-results`;
  const payload={resultKey:'erp-result-exact',providerReference:'ERP-TEST-601',occurredAt:'2026-09-29T00:00:00.000Z',lines:[{sku:source.sku,quantity:'1',serialNos:['C6010001']}]};
  expect((await app.inject({method:'POST',url:endpoint,headers:headers(auditor),payload})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:endpoint,headers:headers(ops),payload:{...payload,lines:[{...payload.lines[0],serialNos:['bad']}]}})).statusCode).toBe(400);
  const concurrent=await Promise.all([1,2].map(()=>app.inject({method:'POST',url:endpoint,headers:headers(ops),payload})));
  expect(concurrent.map(r=>r.statusCode)).toEqual([201,201]);
  expect(concurrent.map(r=>r.json().data.replayed).sort()).toEqual([false,true]);
  expect(concurrent[0].json().data.outcome).toBe('MATCHED');
  expect((await app.inject({method:'POST',url:endpoint,headers:headers(ops),payload:{...payload,lines:[]}})).statusCode).toBe(409);
  for(const [resultKey,lines,outcome] of [
   ['erp-result-partial',[],'PARTIAL'],
   ['erp-result-mismatch',[{sku:source.sku,quantity:'1',serialNos:['C6019999']}],'MISMATCH'],
  ] as const){
   const response=await app.inject({method:'POST',url:endpoint,headers:headers(ops),payload:{...payload,resultKey,lines}});
   expect(response.statusCode).toBe(201);expect(response.json().data.outcome).toBe(outcome);
   expect(response.body).not.toContain(personId);
  }
  const f=await db.fulfillment.findFirstOrThrow({where:{fulfillmentKey:key,order:{orderNo:BigInt(orderNo)}},include:{erpHandoffs:{include:{reconciliations:true}},shipments:true}});
  expect(f.status).toBe('PACKED');expect(f.shipments).toHaveLength(0);
  expect(f.erpHandoffs[0].reconciliations).toHaveLength(3);
  expect(await db.serializedUnit.findUnique({where:{serialNo:'C6010001'}})).toMatchObject({status:'ALLOCATED'});
  expect(await db.operationalException.count({where:{sourceType:'ERP_RECONCILIATION',sourceId:{startsWith:`${orderNo}:${key}:`}}})).toBe(2);
  expect(await db.auditEvent.count({where:{entityId:f.fulfillmentId,action:'FULFILLMENT_ERP_RECONCILED'}})).toBe(3);
  const evidence=f.erpHandoffs[0].reconciliations[0];
  await expect(db.fulfillmentErpReconciliation.update({where:{reconciliationId:evidence.reconciliationId},data:{outcome:'MATCHED'}})).rejects.toThrow();
  await expect(db.fulfillmentErpReconciliation.delete({where:{reconciliationId:evidence.reconciliationId}})).rejects.toThrow();
  await expect(db.fulfillmentErpHandoff.update({where:{fulfillmentId:f.fulfillmentId},data:{payloadHash:'0'.repeat(64)}})).rejects.toThrow();
  await expect(db.fulfillmentSourceAllocation.update({where:{fulfillmentSourceAllocationId:sourceId},data:{allocatedQuantity:2}})).rejects.toThrow();
  const allocation=await db.fulfillmentSerialAllocation.findFirstOrThrow({where:{fulfillmentSourceAllocationId:sourceId}});
  await expect(db.fulfillmentSerialAllocation.delete({where:{fulfillmentSerialAllocationId:allocation.fulfillmentSerialAllocationId}})).rejects.toThrow();
 });
 it('allows warehouse retry of stopped dispatch once, retaining the original request',async()=>{
  const handoff=await db.fulfillmentErpHandoff.findFirstOrThrow({where:{fulfillment:{fulfillmentKey:key,order:{orderNo:BigInt(orderNo)}}}});
  await db.outboxEvent.update({where:{outboxEventId:handoff.outboxEventId},data:{processStatus:'DEAD',attemptCount:10,lastError:'ERP_ACCEPTANCE_UNKNOWN'}});
  const endpoint=`${base}/${orderNo}/${key}/erp-retry`;
  expect((await app.inject({method:'POST',url:endpoint,headers:headers(auditor)})).statusCode).toBe(403);
  const results=await Promise.all([1,2].map(()=>app.inject({method:'POST',url:endpoint,headers:headers(ops)})));
  expect(results.map(r=>r.statusCode)).toEqual([201,201]);expect(results.map(r=>r.json().data.replayed).sort()).toEqual([false,true]);
  expect(await db.outboxEvent.findUnique({where:{outboxEventId:handoff.outboxEventId}})).toMatchObject({processStatus:'PENDING',attemptCount:10,lastError:null});
  expect(await db.fulfillmentErpHandoff.findUnique({where:{fulfillmentId:handoff.fulfillmentId}})).toEqual(handoff);
  expect(await db.auditEvent.count({where:{entityId:handoff.fulfillmentId,action:'FULFILLMENT_ERP_RETRY_REQUESTED'}})).toBe(1);
  const read=await app.inject({url:`${base}/${orderNo}`,headers:headers(auditor)});expect(read.json().data.fulfillments[0].erpHandoff.deliveryState).toBe('PENDING');
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
 it('exposes safe shipment/return references and enforces physical receipt authorization',async()=>{
  const f=await db.fulfillment.findFirstOrThrow({where:{fulfillmentKey:key,order:{orderNo:BigInt(orderNo)}},include:{qcEvidence:true,sourceAllocations:true}});
  const connection=await db.providerConnection.create({data:{domain:'LOGISTICS',provider:'OTHER',connectionKey:randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'fixture',webhookVerificationRef:'fixture',configHash:'c'.repeat(64),effectiveFrom:new Date(0),createdByActor:'fixture'}}},include:{versions:true}});
  const parcel=await db.fulfillmentParcel.create({data:{fulfillmentId:f.fulfillmentId,parcelKey:'HTTP-P1',contentSnapshotRef:f.qcEvidence[0].policySnapshotRef,packageSnapshotRef:'fixture'}});
  const shipment=await db.shipment.create({data:{fulfillmentId:f.fulfillmentId,fulfillmentParcelId:parcel.fulfillmentParcelId,fulfillmentQcEvidenceId:f.qcEvidence[0].fulfillmentQcEvidenceId,provider:'OTHER',connectionId:connection.connectionKey,providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,carrier:'OTHER',shippingMethod:'HOME_DELIVERY',recipientSnapshotRef:'fixture',providerShipmentRef:'HTTP-'+randomUUID(),status:'LABEL_CREATED'}});
  const ret=await db.returnCase.create({data:{orderId:f.orderId,status:'POSTED',reasonCode:'TEST',occurredAt:new Date(),postedAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:f.sourceAllocations[0].orderLineId,quantity:1,returnAmount:100,gpvReversalAmount:0}}}});
  const read=await app.inject({url:`${base}/${orderNo}`,headers:headers(auditor)}),data=read.json().data;
  for(const id of [shipment.shipmentId,ret.returnCaseId,personId])expect(read.body).not.toContain(id);
  const body={shipmentReference:data.fulfillments[0].shipments[0].shipmentReference},endpoint=`${base}/${orderNo}/${key}/shipment-serials`;
  expect((await app.inject({method:'POST',url:endpoint,headers:headers(auditor),payload:body})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:endpoint,headers:headers(ops),payload:{shipmentReference:'0'.repeat(64)}})).statusCode).toBe(409);
  expect((await app.inject({method:'POST',url:endpoint,headers:headers(ops),payload:body})).statusCode).toBe(201);
  const receipt={returnReference:data.returns[0].returnReference,serialNos:['C6010001']},returnUrl=`${base}/${orderNo}/${key}/return-serials`;
  expect((await app.inject({method:'POST',url:returnUrl,headers:headers(auditor),payload:receipt})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:returnUrl,headers:headers(ops),payload:receipt})).statusCode).toBe(409);
  const now=new Date(),correlationId=randomUUID();
  const proof=await db.shipmentTrackingEventEvidence.create({data:{shipmentId:shipment.shipmentId,providerConnectionVersionId:shipment.providerConnectionVersionId,providerEventIdentity:randomUUID(),providerShipmentRef:shipment.providerShipmentRef!,rawStatusCode:'TEST_PICKED_UP',normalizedStatus:'PICKED_UP',mappingSnapshotRef:'fixture',payloadHash:'d'.repeat(64),safeEvidenceRef:'evidence://fixture',eventTime:now,verifiedAt:now,correlationId}});
  await db.shipmentStateTransition.create({data:{shipmentId:shipment.shipmentId,shipmentTrackingEventEvidenceId:proof.shipmentTrackingEventEvidenceId,fromStatus:'LABEL_CREATED',toStatus:'PICKED_UP',businessEffectIdentity:randomUUID(),operationHash:'e'.repeat(64),occurredAt:now,correlationId}});
  await db.shipment.update({where:{shipmentId:shipment.shipmentId},data:{status:'PICKED_UP'}});
  expect((await app.inject({method:'POST',url:endpoint,headers:headers(ops),payload:body})).statusCode).toBe(201);
  const result=await app.inject({method:'POST',url:returnUrl,headers:headers(ops),payload:receipt});expect(result.statusCode).toBe(201);expect(result.json().data).toMatchObject({serialCount:1,substitutedCount:0,replayed:false,results:[{serialNo:'C6010001',receiptType:'EXACT_SOURCE',replayed:false}]});
 });
 it('captures encrypted delivery versions and registers a labeled shipment atomically',async()=>{
  const product=await db.productReference.create({data:{sku:'SHIPMENT-HTTP-'+randomUUID(),displayName:'Shipment HTTP fixture',currentPrice:100}});
  const order=await db.order.create({data:{purchaserPersonId:personId,purpose:'RETAIL',status:'PAID',paidAt:new Date(),grossAmount:100,netAmount:100,ruleVersionCode:'R1',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{}}}}});
  const root=`${base}/${order.orderNo}`,prepared=await app.inject({method:'POST',url:`${root}/prepare`,headers:headers(ops)}),fKey=prepared.json().data.fulfillmentKey,path=`${root}/${fKey}`;
  const source=(await app.inject({url:root,headers:headers(ops)})).json().data.fulfillments[0].sources[0];
  const batch=await db.productSerialBatch.create({data:{productId:product.productId,serialPrefix:'C',batchSequence:604,batchCode:randomUUID()}});
  await db.serializedUnit.create({data:{productSerialBatchId:batch.productSerialBatchId,serialSequence:1,serialNo:'C6040001'}});
  expect((await app.inject({method:'POST',url:`${path}/scans`,headers:headers(ops),payload:{sourceReference:source.sourceReference,sku:product.sku,serialNo:'C6040001'}})).statusCode).toBe(201);
  expect((await app.inject({method:'POST',url:`${path}/pack-verification`,headers:headers(ops)})).statusCode).toBe(201);
  const connection=await db.providerConnection.create({data:{domain:'LOGISTICS',provider:'OTHER',connectionKey:'WAREHOUSE-'+randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'secret://DO-NOT-EXPOSE',webhookVerificationRef:'secret://DO-NOT-EXPOSE',configHash:'f'.repeat(64),effectiveFrom:new Date(0),createdByActor:'fixture',approvalReference:'TEST-APPROVAL'}}},include:{versions:true}});
  const options=await app.inject({url:`${base}/logistics/connections`,headers:headers(ops)});expect(options.statusCode).toBe(200);expect(options.body).not.toContain('secret://');expect(options.body).not.toContain(connection.versions[0].providerConnectionVersionId);
  const selected=options.json().data.find((c:any)=>c.connectionKey===connection.connectionKey),command={connectionReference:selected.connectionReference,providerShipmentReference:'REG-'+randomUUID(),trackingNo:'TRACK-604',packageIntegrityConfirmed:true,labelVerified:true};
  expect((await app.inject({method:'POST',url:`${path}/shipments`,headers:headers(ops),payload:command})).statusCode).toBe(409);
  const delivery={expectedVersion:0,recipientName:'Synthetic private recipient',phone:'0900000000',countryCode:'TW',postalCode:'100',address:'Synthetic private delivery address'};
  expect((await app.inject({method:'POST',url:`${path}/delivery-snapshot`,headers:headers(auditor),payload:delivery})).statusCode).toBe(403);
  const captures=await Promise.all([1,2].map(()=>app.inject({method:'POST',url:`${path}/delivery-snapshot`,headers:headers(ops),payload:delivery})));
  expect(captures.map(r=>r.statusCode)).toEqual([201,201]);expect(captures.map(r=>r.json().data.replayed).sort()).toEqual([false,true]);
  const revised={...delivery,expectedVersion:1,address:'Synthetic revised private address'};
  expect((await app.inject({method:'POST',url:`${path}/delivery-snapshot`,headers:headers(ops),payload:revised})).json().data.version).toBe(2);
  const delayed=await app.inject({method:'POST',url:`${path}/delivery-snapshot`,headers:headers(ops),payload:delivery});
  expect(delayed.json().data).toMatchObject({version:1,currentVersion:2,replayed:true});
  expect((await app.inject({method:'POST',url:`${path}/delivery-snapshot`,headers:headers(ops),payload:{...delivery,address:'Different stale delivery address'}})).statusCode).toBe(409);
  expect((await app.inject({method:'POST',url:`${path}/shipments`,headers:headers(auditor),payload:command})).statusCode).toBe(403);
  expect((await app.inject({method:'POST',url:`${path}/shipments`,headers:headers(ops),payload:{...command,labelVerified:false}})).statusCode).toBe(400);
  const registrations=await Promise.all([1,2].map(()=>app.inject({method:'POST',url:`${path}/shipments`,headers:headers(ops),payload:command})));
  expect(registrations.map(r=>r.statusCode)).toEqual([201,201]);expect(registrations.map(r=>r.json().data.replayed).sort()).toEqual([false,true]);
  const f=await db.fulfillment.findFirstOrThrow({where:{orderId:order.orderId},include:{deliverySnapshots:{orderBy:{version:'asc'}},shipments:{include:{serialBindings:true}}}});
  expect(f.shipments).toHaveLength(1);expect(f.shipments[0].serialBindings).toHaveLength(1);expect(f.shipments[0].deliverySnapshotId).toBe(f.deliverySnapshots[1].deliverySnapshotId);expect(f.shipments[0].status).toBe('LABEL_CREATED');
  expect(await db.serializedUnit.findUnique({where:{serialNo:'C6040001'}})).toMatchObject({status:'ALLOCATED'});
  for(const snapshot of f.deliverySnapshots){expect(snapshot.encryptedPayload).not.toContain(delivery.phone);expect(snapshot.encryptedPayload).not.toContain('Synthetic');}
  const read=await app.inject({url:root,headers:headers(auditor)});for(const value of [delivery.recipientName,delivery.phone,delivery.address,revised.address,f.deliverySnapshots[0].encryptedPayload])expect(read.body).not.toContain(value);
  const audit=await db.auditEvent.findMany({where:{entityId:f.fulfillmentId}}),outbox=await db.outboxEvent.findMany({where:{aggregateId:f.fulfillmentId}});
  expect(JSON.stringify({audit,outbox})).not.toContain('Synthetic private');expect(JSON.stringify({audit,outbox})).not.toContain(delivery.phone);
  expect(audit.filter(a=>a.action==='FULFILLMENT_SHIPMENT_REGISTERED')).toHaveLength(1);
  expect((await app.inject({method:'POST',url:`${path}/delivery-snapshot`,headers:headers(ops),payload:{...delivery,expectedVersion:2}})).statusCode).toBe(409);
  expect((await app.inject({method:'POST',url:`${path}/delivery-snapshot`,headers:headers(ops),payload:revised})).json().data.replayed).toBe(true);
  await expect(db.fulfillmentDeliverySnapshot.update({where:{deliverySnapshotId:f.deliverySnapshots[0].deliverySnapshotId},data:{encryptedPayload:'rewrite'}})).rejects.toThrow();
 });
});
