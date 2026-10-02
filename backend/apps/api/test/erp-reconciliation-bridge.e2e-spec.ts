import {BadRequestException} from '@nestjs/common';
import {ErpReconciliationBridgeController} from '../src/modules/commerce/erp-reconciliation-bridge.controller';
import {ErpReconciliationBridgeService} from '../src/modules/commerce/erp-reconciliation-bridge.service';

const snapshotDb=(db:any)=>({$transaction:jest.fn((work:any)=>work({...db,$queryRaw:async()=>((await db.operationalException.findMany())??[]).map((row:any)=>({...row,handoffId:uuid}))}))});
const uuid='11111111-1111-4111-8111-111111111111';
const base=(overrides:any={})=>({
 fulfillmentErpHandoffId:uuid,providerCode:'EZTOOL',formatVersion:'UCELL_FULFILLMENT_ERP_V1',payloadHash:'a'.repeat(64),payloadSnapshot:{format:'UCELL_FULFILLMENT_ERP_V1',lines:[{sku:'SKU-1',quantity:'1',serialNos:['A0010001']}]},requestedAt:new Date('2026-09-29T01:00:00Z'),
 outboxEvent:{processStatus:'PROCESSED',attemptCount:1,createdAt:new Date('2026-09-29T01:00:00Z'),processedAt:new Date('2026-09-29T01:01:00Z'),lastError:null},
 dispatch:{createdAt:new Date('2026-09-29T01:00:30Z'),providerConnectionVersion:{connection:{provider:'EZTOOL',connectionKey:'STAGE-ERP'}},attempts:[{outcome:'ACCEPTED',providerReference:'ERP-100',recordedAt:new Date('2026-09-29T01:01:00Z')}]},
 reconciliations:[],fulfillment:{fulfillmentKey:'F100-01',status:'PACKED',order:{orderNo:100n,status:'PAID'},shipments:[]},...overrides,
});

describe('ERP_RECONCILIATION_BRIDGE',()=>{
 it('does not present dispatch preparation or an unknown response as actual sending or acknowledgement',async()=>{
  const row=base();row.dispatch.attempts[0].outcome='UNKNOWN';row.outboxEvent.processStatus='PENDING';
  const db={fulfillmentErpHandoff:{findMany:jest.fn().mockResolvedValue([row])},operationalException:{findMany:jest.fn().mockResolvedValue([])}};
  const result=await new ErpReconciliationBridgeService(snapshotDb(db) as any).list({});expect(result.items[0].timestamps).toMatchObject({sentAt:null,dispatchPreparedAt:row.dispatch.createdAt.toISOString(),acknowledgedAt:null});
 });
 it('never exposes raw worker errors in the operational reason',async()=>{
  const row=base();row.outboxEvent.lastError='password secret-token member@example.test' as any;row.outboxEvent.processStatus='DEAD';
  const db={fulfillmentErpHandoff:{findMany:jest.fn().mockResolvedValue([row])},operationalException:{findMany:jest.fn().mockResolvedValue([])}};
  const result=await new ErpReconciliationBridgeService(snapshotDb(db) as any).list({});expect(result.items[0].erp.reasonCode).toBe('ERP_BRIDGE_REQUIRES_ATTENTION');expect(JSON.stringify(result)).not.toContain('secret-token');
 });
 it('does not return the lookahead row before its cursor boundary when filtering',async()=>{
  const first=base(),second=base({requestedAt:new Date('2026-09-29T00:59:00Z'),outboxEvent:{...firstOutbox(),processStatus:'DEAD'},dispatch:null});
  function firstOutbox(){return base().outboxEvent;}
  const db={fulfillmentErpHandoff:{findMany:jest.fn().mockResolvedValue([first,second])},operationalException:{findMany:jest.fn().mockResolvedValue([])}};
  const result=await new ErpReconciliationBridgeService(snapshotDb(db) as any).list({take:1,status:'FAILED'});expect(result.items).toEqual([]);expect(result.nextCursor).toBeTruthy();
 });
 it('labels the current repeatable-read time independently of the handoff creation cutoff',async()=>{
  const db=snapshotDb({fulfillmentErpHandoff:{findMany:jest.fn().mockResolvedValue([base()])},operationalException:{findMany:jest.fn()}}),before=Date.now();
  const result=await new ErpReconciliationBridgeService(db as any).list({asOf:'2026-09-01Z'});
  expect(result.asOf).toBe('2026-09-01T00:00:00.000Z');expect(Date.parse(result.dataThrough)).toBeGreaterThanOrEqual(before);expect(result.items[0].timestamps.dataThrough).toBe(result.dataThrough);
  expect(db.$transaction).toHaveBeenCalledWith(expect.any(Function),{isolationLevel:'RepeatableRead',timeout:15000});
 });
 it('has governed read roles and no member access',()=>{expect(Reflect.getMetadata('roles',ErpReconciliationBridgeController)).toEqual(['SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT']);});
 it('separates UCell, ERP and shipment authority and excludes internal or secret values',async()=>{
  const db={fulfillmentErpHandoff:{findMany:jest.fn().mockResolvedValue([base()])},operationalException:{findMany:jest.fn()}},service=new ErpReconciliationBridgeService(snapshotDb(db) as any),result=await service.list({asOf:'2026-09-29T02:00:00Z'}),body=JSON.stringify(result);
  expect(result.items[0]).toMatchObject({orderNo:'100',fulfillmentKey:'F100-01',bridgeStatus:'ACKNOWLEDGED',ucell:{orderStatus:'PAID',fulfillmentStatus:'PACKED'},erp:{latestAttemptOutcome:'ACCEPTED',reconciliationOutcome:null},shipment:{status:'NOT_CREATED',count:0}});
  expect(result.authority).toEqual({ucell:'Order/Fulfillment facts in UCell',erp:'Stored handoff, dispatch and reconciliation evidence',shipment:'Shipment facts remain independent from ERP acceptance'});
  expect(body).not.toContain(uuid);expect(body).not.toContain('credentialSecretRef');expect(body).not.toContain('recipientName');
 });
 it('reads stored mismatch snapshots and creates only a safe exception reference',async()=>{
  const reconciliation={outcome:'MISMATCH',reasonCode:'ERP_SERIAL_MISMATCH',resultHash:'b'.repeat(64),resultSnapshot:{lines:[{sku:'SKU-1',quantity:'1',serialNos:['A0010002']}]},occurredAt:new Date('2026-09-29T01:02:00Z'),recordedAt:new Date('2026-09-29T01:03:00Z')};
  const db={fulfillmentErpHandoff:{findMany:jest.fn().mockResolvedValue([base({reconciliations:[reconciliation],fulfillment:{fulfillmentKey:'F100-01',status:'PACKED',order:{orderNo:100n,status:'PAID'},shipments:[{status:'IN_TRANSIT'}]}})])},operationalException:{findMany:jest.fn().mockResolvedValue([{operationalExceptionId:uuid,sourceType:'ERP_RECONCILIATION',sourceId:`100:F100-01:${'b'.repeat(64)}`,exceptionCode:'FULFILLMENT_ERP_MISMATCH',severity:'CRITICAL',status:'OPEN'}])}},result=await new ErpReconciliationBridgeService(snapshotDb(db) as any).list({status:'MISMATCH',asOf:'2026-09-29T02:00:00Z'});
  expect(result.items[0]).toMatchObject({bridgeStatus:'MISMATCH',erp:{reasonCode:'ERP_SERIAL_MISMATCH',actual:[{sku:'SKU-1',quantity:'1',serialCount:1}]},shipment:{status:'IN_TRANSIT'},evidence:{resultHash:'b'.repeat(64),exceptionCode:'FULFILLMENT_ERP_MISMATCH',exceptionSeverity:'CRITICAL',exceptionStatus:'OPEN'}});expect(result.items[0].evidence.exceptionReference).toMatch(/^ERP-EXCEPTION-[a-f0-9]{20}$/);
 });
 it('rejects invalid filters and preserves the first-page cutoff in database reads',async()=>{
  const db={fulfillmentErpHandoff:{findMany:jest.fn().mockResolvedValue([base(),base({requestedAt:new Date('2026-09-29T00:59:00Z'),fulfillment:{fulfillmentKey:'F099-01',status:'PACKED',order:{orderNo:99n,status:'PAID'},shipments:[]}})])},operationalException:{findMany:jest.fn()}},service=new ErpReconciliationBridgeService(snapshotDb(db) as any),first=await service.list({take:1,asOf:'2026-09-29T02:00:00Z'});
  expect(first.nextCursor).toBeTruthy();await service.list({take:1,asOf:first.asOf,cursor:first.nextCursor!});expect(db.fulfillmentErpHandoff.findMany.mock.calls[1][0].where.requestedAt.lte).toEqual(new Date(first.asOf));
  await expect(service.list({take:201})).rejects.toBeInstanceOf(BadRequestException);await expect(service.list({status:'MADE_UP'})).rejects.toBeInstanceOf(BadRequestException);await expect(service.list({cursor:'not-a-cursor'})).rejects.toBeInstanceOf(BadRequestException);
 });
});
