import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {mkdtempSync,cpSync,mkdirSync,readdirSync,rmSync} from 'node:fs';
import {join,resolve,dirname} from 'node:path';
import {tmpdir} from 'node:os';

const require=createRequire(new URL('../packages/database/package.json',import.meta.url));
const {PrismaClient}=require('@prisma/client');
const base=new URL(process.env.DATABASE_URL??'postgresql://ucell:ucell_dev@127.0.0.1:5432/ucell');
assert.ok(['localhost','127.0.0.1'].includes(base.hostname),'Upgrade Golden permits local PostgreSQL only');
const database='ucell_erp_upgrade_'+randomUUID().replaceAll('-','');
assert.match(database,/^ucell_erp_upgrade_[a-f0-9]{32}$/);
const control=new URL(base);control.pathname='/postgres';
const target=new URL(base);target.pathname='/'+database;
const admin=new PrismaClient({datasources:{db:{url:control.href}}});
const db=new PrismaClient({datasources:{db:{url:target.href}}});
const cwd=fileURLToPath(new URL('../',import.meta.url)),root=join(cwd,'packages/database/prisma');
const scratch=mkdtempSync(join(tmpdir(),'ucell-erp-upgrade-'));
const dispatchUpgrade=process.argv.includes('--dispatch');
const provenanceUpgrade=process.argv.includes('--serial');
const cutoff=provenanceUpgrade?'20260929070000_shipment_return_serial_provenance':dispatchUpgrade?'20260929060000_fulfillment_erp_dispatch':'20260929050000_fulfillment_erp_reconciliation';
function deploy(schema){const r=spawnSync(process.execPath,[require.resolve('prisma/build/index.js'),'migrate','deploy','--schema',schema],{cwd,env:{...process.env,DATABASE_URL:target.href},stdio:'inherit'});if(r.error)throw r.error;assert.equal(r.status,0);}
let created=false;
try{
 mkdirSync(join(scratch,'migrations'));
 cpSync(join(root,'schema.prisma'),join(scratch,'schema.prisma'));
 for(const entry of readdirSync(join(root,'migrations'),{withFileTypes:true}))if(!entry.isDirectory()||entry.name<cutoff)cpSync(join(root,'migrations',entry.name),join(scratch,'migrations',entry.name),{recursive:true});
 await admin.$executeRawUnsafe('CREATE DATABASE "'+database+'"');created=true;
 deploy(join(scratch,'schema.prisma'));
 const person=await db.person.create({data:{legalName:'Synthetic upgrade purchaser'}});
 const product=await db.productReference.create({data:{sku:'UPGRADE-ERP',displayName:'Upgrade fixture',currentPrice:100}});
 const order=await db.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',grossAmount:100,netAmount:100,ruleVersionCode:'R1',lines:{create:{productId:product.productId,skuSnapshot:product.sku,productNameSnapshot:product.displayName,quantity:1,unitPrice:100,lineAmount:100,gpvRateSnapshot:0,gpvAmountSnapshot:0,ruleProfileSnapshot:{}}}},include:{lines:true}});
 const fulfillment=await db.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:'UPGRADE-ERP-01',allocationSnapshotRef:'historical',fulfillmentPolicySnapshotRef:'historical'}});
 const source=await db.fulfillmentSourceAllocation.create({data:{fulfillmentId:fulfillment.fulfillmentId,orderLineId:order.lines[0].orderLineId,allocatedQuantity:1,skuSnapshot:product.sku,linePurpose:'RETAIL',commercialOfferingSnapshot:{version:1}}});
 const batch=await db.productSerialBatch.create({data:{productId:product.productId,serialPrefix:'A',batchSequence:602,batchCode:'UPGRADE-602'}});
 const unit=await db.serializedUnit.create({data:{productSerialBatchId:batch.productSerialBatchId,serialSequence:1,serialNo:'A6020001',status:'ALLOCATED'}});
 const correlationId=randomUUID();
 const allocation=await db.fulfillmentSerialAllocation.create({data:{fulfillmentId:fulfillment.fulfillmentId,fulfillmentSourceAllocationId:source.fulfillmentSourceAllocationId,serializedUnitId:unit.serializedUnitId,scannedByActor:person.personId,scannedAt:new Date(),correlationId}});
 const payload={schemaVersion:1,format:'UCELL_FULFILLMENT_ERP_V1',fulfillmentKey:fulfillment.fulfillmentKey,orderNo:order.orderNo.toString(),lines:[{sku:product.sku,quantity:'1',serialNos:[unit.serialNo]}]};
 const outbox=await db.outboxEvent.create({data:{eventType:'FULFILLMENT_ERP_HANDOFF_REQUESTED',aggregateType:'FULFILLMENT',aggregateId:fulfillment.fulfillmentId,payload,correlationId}});
 const handoff=await db.fulfillmentErpHandoff.create({data:{fulfillmentId:fulfillment.fulfillmentId,outboxEventId:outbox.outboxEventId,providerCode:'ERP_PENDING',formatVersion:payload.format,payloadHash:createHash('sha256').update(JSON.stringify(payload)).digest('hex'),payloadSnapshot:payload,requestedByActor:person.personId}});
 const result=dispatchUpgrade||provenanceUpgrade?await db.fulfillmentErpReconciliation.create({data:{fulfillmentErpHandoffId:handoff.fulfillmentErpHandoffId,resultKey:'pre-existing-result',resultHash:'b'.repeat(64),outcome:'PARTIAL',reasonCode:'ERP_PHYSICAL_RESULT_INCOMPLETE',resultSnapshot:{schemaVersion:1,lines:[]},occurredAt:new Date(),reportedByActor:person.personId}}):null;
 let priorShipment=null,priorReturn=null;
 if(provenanceUpgrade){
  const connection=await db.providerConnection.create({data:{domain:'LOGISTICS',provider:'OTHER',connectionKey:'UPGRADE',status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'fixture',webhookVerificationRef:'fixture',configHash:'c'.repeat(64),effectiveFrom:new Date(0),createdByActor:'fixture'}}},include:{versions:true}});
  const parcel=await db.fulfillmentParcel.create({data:{fulfillmentId:fulfillment.fulfillmentId,parcelKey:'P1',contentSnapshotRef:'historical',packageSnapshotRef:'historical'}});
  const qc=await db.fulfillmentQcEvidence.create({data:{fulfillmentId:fulfillment.fulfillmentId,policyId:'HISTORICAL',policyVersion:'1',policySnapshotRef:'historical',result:'PASS',checks:{historical:true},inspectorActor:'fixture',reason:'HISTORICAL',occurredAt:new Date(),correlationId:randomUUID()}});
  priorShipment=await db.shipment.create({data:{fulfillmentId:fulfillment.fulfillmentId,fulfillmentParcelId:parcel.fulfillmentParcelId,fulfillmentQcEvidenceId:qc.fulfillmentQcEvidenceId,provider:'OTHER',connectionId:'UPGRADE',providerConnectionVersionId:connection.versions[0].providerConnectionVersionId,carrier:'OTHER',shippingMethod:'HOME_DELIVERY',recipientSnapshotRef:'historical',providerShipmentRef:'UPGRADE-1',status:'PICKED_UP'}});
  priorReturn=await db.returnCase.create({data:{orderId:order.orderId,status:'POSTED',reasonCode:'HISTORICAL',occurredAt:new Date(),postedAt:new Date(),idempotencyKey:randomUUID(),correlationId:randomUUID(),lines:{create:{orderLineId:order.lines[0].orderLineId,quantity:1,returnAmount:100,gpvReversalAmount:0}}},include:{lines:true}});
 }
 deploy(join(root,'schema.prisma'));
 assert.deepEqual(await db.fulfillmentErpHandoff.findUnique({where:{fulfillmentId:fulfillment.fulfillmentId}}),handoff);
 assert.deepEqual(await db.fulfillmentSourceAllocation.findUnique({where:{fulfillmentSourceAllocationId:source.fulfillmentSourceAllocationId}}),source);
 assert.deepEqual(await db.fulfillmentSerialAllocation.findUnique({where:{fulfillmentSerialAllocationId:allocation.fulfillmentSerialAllocationId}}),allocation);
 assert.equal(await db.fulfillmentErpReconciliation.count(),result?1:0,'Upgrade must not invent provider results');
 if(result){assert.deepEqual(await db.fulfillmentErpReconciliation.findUnique({where:{reconciliationId:result.reconciliationId}}),result);assert.equal(await db.fulfillmentErpDispatch.count(),0,'Upgrade must not invent transport acceptance');}
 if(priorShipment&&priorReturn){
  assert.deepEqual(await db.shipment.findUnique({where:{shipmentId:priorShipment.shipmentId}}),priorShipment);
  assert.deepEqual(await db.returnCase.findUnique({where:{returnCaseId:priorReturn.returnCaseId},include:{lines:true}}),priorReturn);
  assert.equal(await db.shipmentSerialBinding.count(),0,'Upgrade must not infer historical serial shipment bindings');
  assert.equal(await db.returnSerialReceipt.count(),0,'Upgrade must not infer historical returned serials');
 }
 await assert.rejects(db.fulfillmentErpHandoff.update({where:{fulfillmentId:fulfillment.fulfillmentId},data:{payloadHash:'0'.repeat(64)}}));
 await assert.rejects(db.fulfillmentSourceAllocation.delete({where:{fulfillmentSourceAllocationId:source.fulfillmentSourceAllocationId}}));
 await assert.rejects(db.fulfillmentSerialAllocation.delete({where:{fulfillmentSerialAllocationId:allocation.fulfillmentSerialAllocationId}}));
 console.log('FULFILLMENT_ERP_UPGRADE_GOLDEN_PASS: historical handoff/source/serial unchanged, append-only protected, no inferred results');
}finally{
 await db.$disconnect();
 if(created)await admin.$executeRawUnsafe('DROP DATABASE "'+database+'" WITH (FORCE)');
 await admin.$disconnect();
 assert.equal(dirname(resolve(scratch)),resolve(tmpdir()));assert.ok(scratch.startsWith(join(tmpdir(),'ucell-erp-upgrade-')));
 rmSync(scratch,{recursive:true});
 console.log('FULFILLMENT_ERP_UPGRADE_CLEANUP_PASS');
}
