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
const cutoff='20260929050000_fulfillment_erp_reconciliation';
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
 deploy(join(root,'schema.prisma'));
 assert.deepEqual(await db.fulfillmentErpHandoff.findUnique({where:{fulfillmentId:fulfillment.fulfillmentId}}),handoff);
 assert.deepEqual(await db.fulfillmentSourceAllocation.findUnique({where:{fulfillmentSourceAllocationId:source.fulfillmentSourceAllocationId}}),source);
 assert.deepEqual(await db.fulfillmentSerialAllocation.findUnique({where:{fulfillmentSerialAllocationId:allocation.fulfillmentSerialAllocationId}}),allocation);
 assert.equal(await db.fulfillmentErpReconciliation.count(),0,'Upgrade must not invent provider results');
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
