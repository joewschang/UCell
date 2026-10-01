import {PrismaService} from '@ucell/database';
import {randomUUID} from 'node:crypto';
import {AuditService} from '../src/common/audit/audit.service';
import {CompensationPeriodControlService} from '../src/modules/settlement-jobs/compensation-period-control.service';
import {CompensationStageHistoryService} from '../src/modules/settlement-jobs/compensation-stage-history.service';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('COMPENSATION_STAGE_HISTORY_SERVICE_REAL_DB',()=>{
 let db:PrismaService,control:CompensationPeriodControlService,service:CompensationStageHistoryService;
 beforeAll(()=>{db=new PrismaService();control=new CompensationPeriodControlService(db);service=new CompensationStageHistoryService(db,control,new AuditService());});afterAll(()=>db?.$disconnect());
 const input={periodStart:'2026-09-01T00:00:00Z',periodEnd:'2026-10-01T00:00:00Z',ruleVersionCode:'R1.0B'};
 const context=()=>({actorId:randomUUID(),actorRole:'FINANCE',requestId:randomUUID(),correlationId:randomUUID()});
 it('refreshes actual control facts, audits both checks and avoids financial writes or duplicate stage rows',async()=>{
  const facts=await control.read(input),before={payables:await db.payableEntry.count(),settlements:await db.settlementBatch.count(),orders:await db.order.count()};
  const first=await service.refresh(input,context()),again=await service.refresh(input,context());expect(first.item.stage).toBe(facts.lifecycle);expect(first.item.businessEnteredAt).toBeNull();expect(first.item.basis).toBe('AUTHORITATIVE_CONTROL_OBSERVATION');expect(first.item.reference).toMatch(/^PERIOD-STAGE-[a-f0-9]{40}$/);expect(again.item.reference).toBe(first.item.reference);expect(again.checkedThrough>=first.checkedThrough).toBe(true);
  expect(await db.auditEvent.count({where:{action:'COMPENSATION_STAGE_REFRESHED'}})).toBe(2);expect(await service.list(input)).toMatchObject({items:[{reference:first.item.reference}],nextCursor:null});
  expect({payables:await db.payableEntry.count(),settlements:await db.settlementBatch.count(),orders:await db.order.count()}).toEqual(before);
 });
 it('rolls back observation and watermark if audit fails',async()=>{
  const unique={...input,ruleVersionCode:'AUDIT-ROLLBACK-'+randomUUID()},failed=new CompensationStageHistoryService(db,control,{write:async()=>{throw Error('SYNTHETIC_AUDIT_FAILURE');}} as any);
  await expect(failed.refresh(unique,context())).rejects.toThrow('SYNTHETIC_AUDIT_FAILURE');expect((await service.list(unique)).items).toEqual([]);
  const [count]=await db.$queryRaw<Array<{n:bigint}>>`SELECT count(*) n FROM integration.compensation_stage_watermark WHERE rule_version_code=${unique.ruleVersionCode}`;expect(count.n).toBe(0n);
 });
 it('bounds history by recorded cutoff and rejects unsafe pagination parameters',async()=>{
  expect((await service.list({...input,asOf:'2020-01-01T00:00:00Z'})).items).toEqual([]);
  for(const query of [{take:101},{cursor:0},{asOf:'2999-01-01T00:00:00Z'}])await expect(service.list({...input,...query})).rejects.toThrow();
 });
});
