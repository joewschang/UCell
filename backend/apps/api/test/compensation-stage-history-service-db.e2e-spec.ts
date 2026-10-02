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
  expect(first.disposition).toBe('RECORDED');expect(again.disposition).toBe('UNCHANGED');
  expect(await db.auditEvent.count({where:{action:'COMPENSATION_STAGE_REFRESHED'}})).toBe(2);expect(await service.list(input)).toMatchObject({items:[{reference:first.item.reference}],nextCursor:null});
  expect({payables:await db.payableEntry.count(),settlements:await db.settlementBatch.count(),orders:await db.order.count()}).toEqual(before);
 });
 it('reports a delayed real read as superseded after a newer source-driven observation',async()=>{
  const selected={periodStart:'1897-01-01T00:00:00Z',periodEnd:'1897-01-08T00:00:00Z',ruleVersionCode:'STAGE_DELAY_'+randomUUID()};let release!:()=>void,ready!:()=>void;
  const captured=new Promise<void>(resolve=>{ready=resolve;}),wait=new Promise<void>(resolve=>{release=resolve;});
  const delayed=new CompensationStageHistoryService(db,{read:async(value:any)=>{const facts=await control.read(value);ready();await wait;return facts;}} as any,new AuditService());
  const older=delayed.refresh(selected,context());await captured;
  try{
   const person=await db.person.create({data:{legalName:'Synthetic delayed observation'}}),q=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
   await db.pvLedger.create({data:{qualificationId:q.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:randomUUID(),sourceLineId:randomUUID(),eventType:'GPV_CREATED',ruleVersionCode:selected.ruleVersionCode,occurredAt:new Date('1897-01-02Z'),correlationId:randomUUID()}});
   const newer=await service.refresh(selected,context());expect(newer.item.stage).toBe('BLOCKED');release();const stale=await older;expect(stale.disposition).toBe('SUPERSEDED');expect(stale.item.reference).toBe(newer.item.reference);expect((await service.list(selected)).items).toHaveLength(1);
  }finally{release();await older;}
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
 it('captures an actual recognition-evidence failure without manufacturing stages or rewriting its source',async()=>{
  const selected={periodStart:'1896-01-01T00:00:00Z',periodEnd:'1896-01-08T00:00:00Z',ruleVersionCode:'STAGE_VOLUME_'+randomUUID()};
  const before=await service.refresh(selected,context());expect(before.item.stage).toBe('PRECHECK');
  const person=await db.person.create({data:{legalName:'Synthetic stage missing recognition'}}),qualification=await db.qualification.create({data:{currentHolderPersonId:person.personId,planLevelCode:'STARTER'}});
  const volume=await db.pvLedger.create({data:{qualificationId:qualification.qualificationId,pvType:'GPV',amount:100,sourceType:'ORDER',sourceId:randomUUID(),sourceLineId:randomUUID(),eventType:'GPV_CREATED',ruleVersionCode:selected.ruleVersionCode,occurredAt:new Date('1896-01-02Z'),correlationId:randomUUID()}});
  const facts=await control.read(selected);expect(facts.lifecycle).toBe('BLOCKED');expect(facts.blockingExceptions.some(row=>row.code==='COMPENSATION_VOLUME_EVIDENCE_INVALID')).toBe(true);
  const after=await service.refresh(selected,context());expect(after.item).toMatchObject({revision:2,previousStage:'PRECHECK',stage:'BLOCKED',businessEnteredAt:null});expect(after.item.evidenceHash).not.toBe(before.item.evidenceHash);
  const history=await service.list(selected);expect(history.items.map(row=>row.stage)).toEqual(['BLOCKED','PRECHECK']);expect(history.items[1].reference).toBe(before.item.reference);
  for(const privateId of [person.personId,qualification.qualificationId,volume.eventId,volume.sourceId])expect(JSON.stringify(history)).not.toContain(privateId);
  expect(await db.pvLedger.findUnique({where:{eventId:volume.eventId}})).toEqual(volume);
 });
});
