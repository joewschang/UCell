import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname,basename} from 'node:path';
import {tmpdir} from 'node:os';
const require=createRequire(new URL('../packages/database/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const {requestErpSalesProjection,requestErpReturnProjection,verifyErpBusinessProjection,sealErpBusinessProjection}=require(fileURLToPath(new URL('../packages/database/dist/index.js',import.meta.url)));
const referenceMode=process.argv.includes('--external-reference');
const revisionMode=process.argv.includes('--revision');
const firstNew=revisionMode?'20260930070000_erp_projection_revision':referenceMode?'20260930060000_erp_external_reference':'20260930050000_erp_business_projection',base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['localhost','127.0.0.1'].includes(base.hostname));
const database='ucell_erp_upgrade_'+randomUUID().replaceAll('-','');assert.match(database,/^ucell_erp_upgrade_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';const target=new URL(base);target.pathname='/'+database;
const cwd=fileURLToPath(new URL('../',import.meta.url)),root=join(cwd,'packages/database/prisma'),scratch=mkdtempSync(join(tmpdir(),'ucell-erp-upgrade-'));
const admin=new PrismaClient({datasources:{db:{url:control.href}}}),db=new PrismaClient({datasources:{db:{url:target.href}}});let created=false;
function deploy(schema){const child=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],{cwd,env:{...process.env,DATABASE_URL:target.href},stdio:'inherit'});if(child.error)throw child.error;assert.equal(child.status,0);}
try{
 mkdirSync(join(scratch,'migrations'));cpSync(join(root,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(root,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<firstNew)cpSync(join(root,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;deploy(join(scratch,'schema.prisma'));
 const product=await db.productReference.create({data:{sku:'UPGRADE-SKU',displayName:'Synthetic upgrade',currentPrice:100}});
 const person=await db.person.create({data:{legalName:'Synthetic upgrade purchaser'}});
 const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',status:'PAID',paidAt:new Date('2020-01-01Z'),grossAmount:100,netAmount:100,ruleVersionCode:'TEST_UPGRADE',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{version:'historical'}}}},include:{lines:true}});
 const ret=await db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'TEST_UPGRADE',occurredAt:new Date('2020-01-02Z'),postedAt:new Date('2020-01-02Z'),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:order.lines[0].orderLineId,quantity:1,returnAmount:100,gpvReversalAmount:0}}},include:{lines:true}});
 const fulfillment=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:'UPGRADE-F1',status:'PACKED',allocationSnapshotRef:'historical',fulfillmentPolicySnapshotRef:'historical'}});
 const event=await db.outboxEvent.create({data:{eventType:'FULFILLMENT_ERP_HANDOFF_REQUESTED',aggregateType:'FULFILLMENT',aggregateId:fulfillment.fulfillmentId,payload:{historical:true},correlationId:randomUUID()}});
 const handoff=await db.fulfillmentErpHandoff.create({data:{fulfillmentId:fulfillment.fulfillmentId,outboxEventId:event.outboxEventId,providerCode:'ERP_PENDING',formatVersion:'UCELL_FULFILLMENT_ERP_V1',payloadHash:'a'.repeat(64),payloadSnapshot:{historical:true},requestedByActor:'TEST'}});
 const context={actorId:'TEST',correlationId:randomUUID()},legacy=[];
 let originalReview;
 if(revisionMode)originalReview=(await db.$transaction(tx=>sealErpBusinessProjection(tx,{stream:'COMPENSATION',sourceIdentity:'SYNTHETIC-UPGRADE-COMP',body:{amount:'100'},drillback:{source:'historical'},context:{...context,approvalReference:'TEST-APPROVAL'}}))).projection;
 if(referenceMode||revisionMode){
  const sale=await db.$transaction(tx=>requestErpSalesProjection(tx,order.orderNo.toString(),context)),returned=await db.$transaction(tx=>requestErpReturnProjection(tx,ret.returnCaseId,context));
  const extraOrder=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',status:'PAID',paidAt:new Date('2020-01-01Z'),grossAmount:100,netAmount:100,ruleVersionCode:'TEST_UPGRADE',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{}}}}});
  const extra=await db.$transaction(tx=>requestErpSalesProjection(tx,extraOrder.orderNo.toString(),context));
  const connection=await db.providerConnection.create({data:{domain:'ERP',provider:'EZTOOL',connectionKey:'SYNTHETIC-UPGRADE',status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'synthetic',webhookVerificationRef:'synthetic',configHash:'a'.repeat(64),effectiveFrom:new Date(0),approvalReference:'TEST',createdByActor:'TEST'}}},include:{versions:true}});
  for(const [index,{projection}] of [sale,returned,extra].entries()){
   const dispatch=await db.erpProjectionDispatch.create({data:{projectionId:projection.projectionId,providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,idempotencyKey:'ucell-erp-projection-'+String(index).repeat(64),requestHash:projection.payloadHash}});
   const providerReference=revisionMode?'ERP-REV-'+index:index===0?'ERP-UNIQUE':'ERP-DUPLICATE';
   const claim=revisionMode?await db.erpProjectionExternalReference.create({data:{projectionId:projection.projectionId,providerConnectionId:connection.providerConnectionId,providerReference}}):null;
   const attempt=await db.erpProjectionDispatchAttempt.create({data:{dispatchId:dispatch.dispatchId,attemptNumber:1,outcome:'ACCEPTED',providerReference,evidenceHash:'b'.repeat(64)}});
   legacy.push({projection,dispatch,claim,attempt});
  }
 }
 deploy(join(root,'schema.prisma'));
 if(revisionMode){
  for(const {projection,dispatch,claim,attempt} of legacy){assert.deepEqual(await db.erpBusinessProjection.findUnique({where:{projectionId:projection.projectionId}}),projection);assert.deepEqual(await db.erpProjectionDispatch.findUnique({where:{dispatchId:dispatch.dispatchId}}),dispatch);assert.deepEqual(await db.erpProjectionExternalReference.findUnique({where:{projectionId:projection.projectionId}}),claim);assert.deepEqual(await db.erpProjectionDispatchAttempt.findUnique({where:{attemptId:attempt.attemptId}}),attempt);}
  const supplement=await db.$transaction(tx=>sealErpBusinessProjection(tx,{stream:'COMPENSATION',sourceIdentity:originalReview.sourceIdentity,revision:2,previousProjectionReference:originalReview.projectionReference,body:{amount:'90'},drillback:{source:'supplemental'},context:{...context,approvalReference:'TEST-SUPPLEMENT'}}));
  assert.equal(supplement.projection.revision,2);verifyErpBusinessProjection(supplement.projection);assert.deepEqual(await db.erpBusinessProjection.findUnique({where:{projectionId:originalReview.projectionId}}),originalReview);
  await assert.rejects(db.$transaction(tx=>sealErpBusinessProjection(tx,{stream:'COMPENSATION',sourceIdentity:originalReview.sourceIdentity,revision:4,previousProjectionReference:supplement.projection.projectionReference,body:{amount:'80'},drillback:{},context:{...context,approvalReference:'TEST-INVALID'}})));
 }
 if(referenceMode){
  for(const {projection,attempt} of legacy){assert.deepEqual(await db.erpProjectionDispatchAttempt.findUnique({where:{attemptId:attempt.attemptId}}),attempt);const claim=await db.erpProjectionExternalReference.findUnique({where:{projectionId:projection.projectionId}});if(attempt.providerReference==='ERP-UNIQUE')assert.equal(claim?.providerReference,'ERP-UNIQUE');else assert.equal(claim,null);}
  assert.equal(await db.erpProjectionExternalReference.count(),1);
 }
 assert.deepEqual(await db.order.findUnique({where:{orderId:order.orderId},include:{lines:true}}),order);
 assert.deepEqual(await db.returnCase.findUnique({where:{returnCaseId:ret.returnCaseId},include:{lines:true}}),ret);
 assert.deepEqual(await db.fulfillment.findUnique({where:{fulfillmentId:fulfillment.fulfillmentId}}),fulfillment);
 assert.deepEqual(await db.fulfillmentErpHandoff.findUnique({where:{fulfillmentErpHandoffId:handoff.fulfillmentErpHandoffId}}),handoff);
 assert.deepEqual(await db.outboxEvent.findUnique({where:{outboxEventId:event.outboxEventId}}),event);
 const sales=await db.$transaction(tx=>requestErpSalesProjection(tx,order.orderNo.toString(),context)),returned=await db.$transaction(tx=>requestErpReturnProjection(tx,ret.returnCaseId,context));
 for(const row of [sales.projection,returned.projection]){verifyErpBusinessProjection(row);await assert.rejects(db.erpBusinessProjection.update({where:{projectionId:row.projectionId},data:{payloadHash:'b'.repeat(64)}}));}
 assert.equal((await db.$transaction(tx=>requestErpSalesProjection(tx,order.orderNo.toString(),context))).replayed,true);
 const [{count}]=await db.$queryRawUnsafe('SELECT count(*)::int AS count FROM public._prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL');
 console.log(`ERP_PROJECTION_UPGRADE_${revisionMode?119:referenceMode?118:117}_TO_${count}_PRESERVATION_AND_GUARDS_PASS`);
}finally{
 await db.$disconnect();if(created){await admin.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');console.log('ERP_PROJECTION_UPGRADE_CLEANUP_PASS');}await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(basename(scratch).startsWith('ucell-erp-upgrade-'));rmSync(scratch,{recursive:true,force:true});
}
