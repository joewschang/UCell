import { Prisma } from '@ucell/database';
import { readStructuredExplanation } from '../src/modules/explain/structured-explain-source';
const time={timezone:'Asia/Taipei' as const,periodStart:'2026-01-01T00:00:00.000Z',periodEnd:'2026-02-01T00:00:00.000Z',asOf:'2026-02-01T00:00:00.000Z',knowledgeCutoff:'2026-02-02T00:00:00.000Z'};
const query={qualificationId:'ball',resourceId:'source',time};
const date=new Date('2026-01-15T00:00:00.000Z');
function payout(){
 const line:any={payoutLineId:'source',recipientQualificationId:'ball',createdAt:date,netAmount:new Prisma.Decimal('19.4321'),grossAmount:new Prisma.Decimal(100),recoveryOffset:new Prisma.Decimal(1),
  payoutBatch:{payoutBatchId:'batch',status:'PAID',paidAt:date,paymentReference:'private'},payableEntries:[{sourceType:'BONUS_AWARD',sourceId:'award',qualificationId:'ball',createdAt:date,ruleVersionCode:'R1.0B'}]};
 const audit:any={auditEventId:'audit',occurredAt:date,afterData:{paidAt:date.toISOString(),paymentReference:'secret'}};
 const db:any={payoutLine:{findUnique:jest.fn(async()=>line)},auditEvent:{findMany:jest.fn(async()=>[audit])},bonusAward:{findMany:jest.fn(async()=>[{parameterSnapshotHash:'a'.repeat(64),ruleVersionCode:'R1.0B'}])}};
 return {line,audit,db};
}
describe('Train A persisted payment and return evidence',()=>{
 it('reads stored paid net without recalculating gross minus recovery or exposing payment references',async()=>{const f=payout();const r:any=await readStructuredExplanation(f.db,'explainPayout',query);expect(r.result).toEqual({amount:'19.4321',status:'PAID'});expect(r.finality).toBe('PAID');expect(JSON.stringify(r)).not.toMatch(/private|secret|paymentReference/);});
 it('does not infer PAID from READY status',async()=>{const f=payout();f.line.payoutBatch.status='READY';expect(await readStructuredExplanation(f.db,'explainPayout',query)).toMatchObject({status:'UNAVAILABLE',result:null});});
 it('requires a recorded payment audit, not only backdated paidAt',async()=>{const f=payout();f.db.auditEvent.findMany.mockResolvedValue([]);expect(await readStructuredExplanation(f.db,'explainPayout',query)).toMatchObject({status:'UNAVAILABLE'});expect(f.db.auditEvent.findMany).toHaveBeenCalledWith(expect.objectContaining({where:expect.objectContaining({occurredAt:{lte:new Date(time.knowledgeCutoff)}})}));});
 it('denies foreign payout line',async()=>{const f=payout();f.line.recipientQualificationId='other';expect(await readStructuredExplanation(f.db,'explainPayout',query)).toMatchObject({status:'UNAVAILABLE'});expect(f.db.auditEvent.findMany).not.toHaveBeenCalled();});
 it('mixed or missing parameter snapshots remain unavailable',async()=>{const f=payout();f.db.bonusAward.findMany.mockResolvedValue([{ruleVersionCode:'R1.0B',parameterSnapshotHash:null}]);expect(await readStructuredExplanation(f.db,'explainPayout',query)).toMatchObject({status:'UNAVAILABLE'});});
 function returned(){
  const row:any={returnCaseId:'source',orderId:'order',occurredAt:date,createdAt:date,postedAt:date,status:'POSTED',order:{qualificationId:'ball',ruleVersionCode:'R1.0B',parameterSnapshotHash:'b'.repeat(64)}};
  const audit:any={auditEventId:'audit',occurredAt:date,afterData:{orderId:'order',totalReturn:'20.25',token:'secret'}};
  const db:any={returnCase:{findUnique:jest.fn(async()=>row)},auditEvent:{findMany:jest.fn(async()=>[audit])}};return {row,audit,db};
 }
 it('returns posted amount as partial evidence, without inventing replay completion',async()=>{const f=returned();const r:any=await readStructuredExplanation(f.db,'explainReturnImpact',query);expect(r.result).toEqual({postedAmount:'20.25',replayStatus:'UNAVAILABLE'});expect(r.quality).toBe('PARTIAL');expect(JSON.stringify(r)).not.toContain('secret');});
 it('excludes non-posted return workflow state',async()=>{const f=returned();f.row.status='DRAFT';expect(await readStructuredExplanation(f.db,'explainReturnImpact',query)).toMatchObject({status:'UNAVAILABLE'});});
 it('requires the return audit to reference the exact original order',async()=>{const f=returned();f.audit.afterData.orderId='other';await expect(readStructuredExplanation(f.db,'explainReturnImpact',query)).rejects.toMatchObject({code:'INVALID_EVIDENCE'});});
 it('refuses missing original rule snapshot',async()=>{const f=returned();f.row.order.parameterSnapshotHash=null;expect(await readStructuredExplanation(f.db,'explainReturnImpact',query)).toMatchObject({status:'UNAVAILABLE'});});
});
