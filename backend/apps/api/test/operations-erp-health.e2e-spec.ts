import {OperationsControlService} from '../src/modules/admin-operations/operations-control.service';
import {OperationsControlController} from '../src/modules/admin-operations/operations-control.controller';
const page=(items:any[])=>({items,nextCursor:'next-window',asOf:'2026-09-01T00:00:00Z',dataThrough:'2026-09-30T00:00:00Z',liveTransportStatus:'BLOCKED_EXTERNAL'});
const item=(status:string,extra:any={})=>({projectionReference:'ERP-PROJECTION-'+'a'.repeat(40),status,requestedAt:'2026-09-29T00:00:00Z',acknowledgedAt:null,reconciledAt:null,payloadHash:'a'.repeat(64),expected:{orderNo:'100'},exceptions:[],blockedReason:null,...extra});
describe('Operations bounded ERP health',()=>{
 it('requires an explicit threshold for waiting and keeps page coverage separate from freshness',async()=>{
  const business={list:jest.fn().mockResolvedValue(page([item('QUEUED')]))},service=new OperationsControlService(business as any,{} as any);
  const quiet=await service.erpHealth({stream:'SALES'});expect(quiet.candidateCount).toBe(0);expect(quiet).toMatchObject({coverage:'CURRENT_PAGE_ONLY',observed:1,asOf:'2026-09-01T00:00:00Z',dataThrough:'2026-09-30T00:00:00Z'});
  const first=await service.erpHealth({stream:'SALES',thresholdHours:24,take:1,cursor:'window',asOf:quiet.asOf});expect(first.items[0]).toMatchObject({elapsedHours:24,candidate:{code:'ERP_HANDOFF_OVERDUE'},link:'/erp-reconciliation?stream=SALES&projection=ERP-PROJECTION-'+'a'.repeat(40)});expect(first.nextCursor).toBe('next-window');expect(business.list).toHaveBeenLastCalledWith({stream:'SALES',take:1,cursor:'window',asOf:quiet.asOf});
  await expect(service.erpHealth({stream:'SALES',thresholdHours:0})).rejects.toThrow();await expect(service.erpHealth({stream:'INVALID'})).rejects.toThrow();
 });
 it('keeps matched results with unresolved exceptions actionable and excludes raw candidate source extras',async()=>{
  const service=new OperationsControlService({list:async()=>page([item('RECONCILED',{reconciledAt:'2026-09-29T01:00:00Z',exceptions:[{reference:'ERP-EXCEPTION-test',privateActor:'SECRET'}],privateError:'SECRET'}),item('FAILED',{projectionReference:'ERP-PROJECTION-'+'b'.repeat(40)})])} as any,{} as any);
  const result=await service.erpHealth({stream:'COMPENSATION'});expect(result.candidateCount).toBe(2);expect(result.items.map(row=>row.candidate?.code)).toEqual(['ERP_OPEN_EXCEPTION','ERP_TRANSPORT_FAILED']);expect(result.latestSuccessfulReconciliation).toBe('2026-09-29T01:00:00Z');expect(JSON.stringify(result)).not.toContain('SECRET');expect(result.counts).toEqual({RECONCILED:1,FAILED:1});
 });
 it('routes physical evidence to its order and limits the controller to financial operations readers',async()=>{
  const physical={list:async()=>page([{orderNo:'123',fulfillmentKey:'F123-01',bridgeStatus:'MISMATCH',timestamps:{queuedAt:'2026-09-29Z',acknowledgedAt:null,reconciledAt:null},evidence:{payloadHash:'b'.repeat(64)},erp:{providerReference:null}}])};
  const result=await new OperationsControlService({} as any,physical as any).erpHealth({stream:'FULFILLMENT'});expect(result.items[0]).toMatchObject({link:'/erp-reconciliation?orderNo=123',candidate:{sourceType:'ERP_HANDOFF',code:'ERP_RESULT_MISMATCH'}});expect(result.items[0].reference).toMatch(/^ERP-HANDOFF-[a-f0-9]{40}$/);expect(Reflect.getMetadata('roles',OperationsControlController)).toEqual(['SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT']);
 });
});
