import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {ErpReconciliationBridgeService} from '../src/modules/commerce/erp-reconciliation-bridge.service';

const url=process.env.PHASE2_TEST_DATABASE_URL;
const describeDb=url?describe:describe.skip;
const ROLLBACK='ERP_BRIDGE_DB_ROLLBACK';

describeDb('ERP_RECONCILIATION_BRIDGE_REAL_DB',()=>{
 let db:PrismaClient;
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});});
 afterAll(()=>db?.$disconnect());
 it('reads immutable handoff and mismatch evidence without inferring shipment or exposing internal identity',async()=>{
  await expect(db.$transaction(async tx=>{
   const privateName=`Private ERP bridge ${randomUUID()}`,person=await tx.person.create({data:{legalName:privateName}});
   const order=await tx.order.create({data:{purchaserPersonId:person.personId,purpose:'RETAIL',status:'PAID',grossAmount:100,netAmount:100,ruleVersionCode:'R1.0B',paidAt:new Date()}});
   const fulfillment=await tx.fulfillment.create({data:{orderId:order.orderId,fulfillmentKey:`F${order.orderNo}-01`,status:'PACKED',allocationSnapshotRef:'bridge-test',fulfillmentPolicySnapshotRef:'bridge-test'}});
   const payload={schemaVersion:1,format:'UCELL_FULFILLMENT_ERP_V1',orderNo:order.orderNo.toString(),fulfillmentKey:fulfillment.fulfillmentKey,lines:[{sku:'BRIDGE-SKU',quantity:'1',serialNos:['A9010001']}]};
   const event=await tx.outboxEvent.create({data:{eventType:'FULFILLMENT_ERP_HANDOFF_REQUESTED',aggregateType:'FULFILLMENT',aggregateId:fulfillment.fulfillmentId,payload,correlationId:randomUUID()}});
   const handoff=await tx.fulfillmentErpHandoff.create({data:{fulfillmentId:fulfillment.fulfillmentId,outboxEventId:event.outboxEventId,providerCode:'EZTOOL',formatVersion:'UCELL_FULFILLMENT_ERP_V1',payloadHash:'a'.repeat(64),payloadSnapshot:payload,requestedByActor:randomUUID()}});
   await tx.fulfillmentErpReconciliation.create({data:{fulfillmentErpHandoffId:handoff.fulfillmentErpHandoffId,resultKey:'bridge-result',resultHash:'b'.repeat(64),outcome:'MISMATCH',reasonCode:'ERP_SERIAL_MISMATCH',resultSnapshot:{schemaVersion:1,lines:[{sku:'BRIDGE-SKU',quantity:'1',serialNos:['A9010002']}]},occurredAt:new Date(),reportedByActor:randomUUID()}});
   await tx.operationalException.create({data:{sourceType:'ERP_RECONCILIATION',sourceId:`${order.orderNo}:${fulfillment.fulfillmentKey}:${'b'.repeat(64)}`,exceptionCode:'FULFILLMENT_ERP_MISMATCH',severity:'CRITICAL',summary:'Synthetic stored mismatch evidence',evidenceHash:'b'.repeat(64)}});
   const result=await new ErpReconciliationBridgeService(tx as any).list({orderNo:order.orderNo.toString(),status:'MISMATCH',asOf:new Date(Date.now()+1000).toISOString()}),serialized=JSON.stringify(result);
   expect(result.items).toHaveLength(1);expect(result.items[0]).toMatchObject({orderNo:order.orderNo.toString(),bridgeStatus:'MISMATCH',ucell:{orderStatus:'PAID',fulfillmentStatus:'PACKED'},erp:{expected:[{sku:'BRIDGE-SKU',quantity:'1',serialCount:1}],actual:[{sku:'BRIDGE-SKU',quantity:'1',serialCount:1}]},shipment:{status:'NOT_CREATED',count:0},evidence:{exceptionCode:'FULFILLMENT_ERP_MISMATCH',exceptionSeverity:'CRITICAL',exceptionStatus:'OPEN'}});
   for(const hidden of [person.personId,fulfillment.fulfillmentId,handoff.fulfillmentErpHandoffId,event.outboxEventId,privateName])expect(serialized).not.toContain(hidden);
   expect(serialized).not.toContain('credentialSecretRef');expect(serialized).not.toContain('requestedByActor');
   throw new Error(ROLLBACK);
  })).rejects.toThrow(ROLLBACK);
 });
});
