import {PrismaClient} from '@prisma/client';
import {randomUUID} from 'node:crypto';
import {sealErpBusinessProjection,erpBusinessReference,claimOutboxLease,verifyErpAccountingMapping} from '@ucell/database';
import {AuditService} from '../src/common/audit/audit.service';
import {ErpAccountingMappingService} from '../src/modules/commerce/erp-accounting-mapping.service';
import {processErpBusinessProjection,erpBusinessProjectionCandidates} from '../../worker/src/erp-business-runtime';
const url=process.env.PHASE2_TEST_DATABASE_URL;
(url?describe:describe.skip)('ERP_ACCOUNTING_MAPPING_REAL_DB',()=>{
 let db:PrismaClient,service:ErpAccountingMappingService;
 const context=()=>({actorId:randomUUID(),requestId:randomUUID(),correlationId:randomUUID()});
 beforeAll(()=>{db=new PrismaClient({datasources:{db:{url}}});service=new ErpAccountingMappingService(db as any,new AuditService());});afterAll(()=>db?.$disconnect());
 async function fixture(){
  const sourceIdentity=randomUUID(),group=erpBusinessReference('COMPENSATION-GROUP',sourceIdentity),report=erpBusinessReference('COMPENSATION-GROUP',sourceIdentity+'report');
  const projection=(await db.$transaction(tx=>sealErpBusinessProjection(tx,{stream:'COMPENSATION',sourceIdentity,body:{projectionPurpose:'SUBLEDGER_ACCOUNTING_REVIEW',currency:'TWD',configuration:{accountingDate:'2026-09-30'},aggregates:[{groupReference:group,metric:'MEMBER_PAYABLE_GROSS',economicCategory:'BINARY',amount:'100.0000',privateNote:'PRIVATE-MUST-NOT-EXPORT'},{groupReference:report,metric:'RECOVERY_OUTSTANDING',economicCategory:'BINARY',amount:'10.0000'}],privateActorId:randomUUID()},drillback:{privateSource:'PRIVATE-MUST-NOT-EXPORT'},context:{...context(),approvalReference:'SYNTHETIC-REVIEW-APPROVED'}}))).projection;
  const connection=await db.providerConnection.create({data:{domain:'ERP',provider:'EZTOOL',connectionKey:'SYNTHETIC-'+randomUUID(),status:'ACTIVE',versions:{create:{version:1,environment:'TEST',credentialSecretRef:'PRIVATE-CREDENTIAL-REF',webhookVerificationRef:'PRIVATE-VERIFY-REF',configHash:'a'.repeat(64),effectiveFrom:new Date(0),approvalReference:'SYNTHETIC-CONNECTION-APPROVED',createdByActor:randomUUID()}}},include:{versions:true}});
  const input={connectionKey:connection.connectionKey,connectionVersion:1,policyReference:'SYNTHETIC-ACCOUNT-POLICY',policyVersion:1,previousMappingReference:null as string|null,entries:[{groupReference:group,treatment:'MAP' as const,mappingCode:'SYNTHETIC-MAPPING-CODE'},{groupReference:report,treatment:'REPORT_ONLY' as const,mappingCode:null}]};
  return {projection,connection,input,group};
 }
 it('requires complete explicit coverage and exposes no private source or provider configuration',async()=>{
  const f=await fixture(),ref=f.projection.projectionReference;
  await expect(service.preview(ref,{...f.input,entries:f.input.entries.slice(0,1)})).rejects.toMatchObject({response:{code:'ERP_MAPPING_COVERAGE_INVALID'}});
  await expect(service.preview(ref,{...f.input,entries:[f.input.entries[0],f.input.entries[0]]})).rejects.toThrow();
  await expect(service.preview(ref,{...f.input,entries:f.input.entries.map(row=>({...row,mappingCode:null}))})).rejects.toThrow();
  const preview=await service.preview(ref,f.input);expect(JSON.stringify(preview)).not.toContain('PRIVATE');expect(preview.request.aggregates).toHaveLength(2);
  expect(JSON.stringify(await service.connections())).not.toContain('PRIVATE');
  await db.providerConnection.update({where:{providerConnectionId:f.connection.providerConnectionId},data:{status:'SUSPENDED'}});
  await expect(service.approve(ref,{...f.input,reviewHash:preview.reviewHash,approvalReference:'SYNTHETIC-MAPPING-APPROVAL'},context())).rejects.toMatchObject({response:{code:'ERP_CONNECTION_NOT_APPROVED'}});
  expect(await db.erpAccountingMapping.count({where:{projectionId:f.projection.projectionId}})).toBe(0);
 });
 it('approves once under concurrency, rolls back failed audit, and rejects changed review input',async()=>{
  const f=await fixture(),ref=f.projection.projectionReference,preview=await service.preview(ref,f.input),input={...f.input,reviewHash:preview.reviewHash,approvalReference:'SYNTHETIC-MAPPING-APPROVAL'};
  const broken=new ErpAccountingMappingService(db as any,{write:async()=>{throw new Error('audit unavailable');}} as any);
  await expect(broken.approve(ref,input,context())).rejects.toThrow('audit unavailable');expect(await db.erpAccountingMapping.count({where:{projectionId:f.projection.projectionId}})).toBe(0);
  await expect(service.approve(ref,{...input,policyVersion:2},context())).rejects.toMatchObject({response:{code:'ERP_MAPPING_PREVIEW_STALE'}});
  const approved=await Promise.all([service.approve(ref,input,context()),service.approve(ref,input,context())]);expect(approved.map(row=>row.replayed).sort()).toEqual([false,true]);
  expect(await db.auditEvent.count({where:{entityId:f.projection.projectionId,action:'ERP_ACCOUNTING_MAPPING_APPROVED'}})).toBe(1);
  await expect(service.approve(ref,{...input,approvalReference:'SYNTHETIC-CONFLICT'},context())).rejects.toThrow();
  const row=await db.erpAccountingMapping.findFirstOrThrow({where:{projectionId:f.projection.projectionId}});await expect(db.erpAccountingMapping.update({where:{mappingId:row.mappingId},data:{approvalReference:'SYNTHETIC-MUTATION'}})).rejects.toThrow();
  expect(await db.erpBusinessProjection.findUnique({where:{projectionId:f.projection.projectionId}})).toEqual(f.projection);
 });
 it('routes only the latest mapping connection and rejects mapping an obsolete source revision',async()=>{
  const f=await fixture(),ref=f.projection.projectionReference,first=await service.preview(ref,f.input),approved=await service.approve(ref,{...f.input,reviewHash:first.reviewHash,approvalReference:'SYNTHETIC-FIRST-MAPPING'},context());
  const nextVersion=await db.providerConnectionVersion.create({data:{providerConnectionId:f.connection.providerConnectionId,version:2,environment:'TEST',credentialSecretRef:'synthetic',webhookVerificationRef:'synthetic',configHash:'b'.repeat(64),effectiveFrom:new Date(0),approvalReference:'SYNTHETIC-CONNECTION',createdByActor:randomUUID()}});
  const changed={...f.input,connectionVersion:2,previousMappingReference:approved.mappingReference},preview=await service.preview(ref,changed);await service.approve(ref,{...changed,reviewHash:preview.reviewHash,approvalReference:'SYNTHETIC-NEXT-MAPPING'},context());
  expect((await erpBusinessProjectionCandidates(db as any,f.connection.versions[0].providerConnectionVersionId)).map(row=>row.outboxEventId)).not.toContain(f.projection.outboxEventId);
  expect((await erpBusinessProjectionCandidates(db as any,nextVersion.providerConnectionVersionId)).map(row=>row.outboxEventId)).toContain(f.projection.outboxEventId);
  await db.$transaction(tx=>sealErpBusinessProjection(tx,{stream:'COMPENSATION',sourceIdentity:f.projection.sourceIdentity,revision:2,previousProjectionReference:ref,body:{amount:'90'},drillback:{},context:{...context(),approvalReference:'SYNTHETIC-NEW-SOURCE'}}));
  const latest=await db.erpAccountingMapping.findFirstOrThrow({where:{projectionId:f.projection.projectionId},orderBy:{revision:'desc'}});
  await expect(service.preview(ref,{...changed,policyVersion:2,previousMappingReference:latest.mappingReference})).rejects.toMatchObject({response:{code:'ERP_MAPPING_LATEST_PROJECTION_REQUIRED'}});
 });
 it('versions mapping before dispatch, pins its exact request through unknown retry, and forbids later remapping',async()=>{
  const f=await fixture(),ref=f.projection.projectionReference,preview=await service.preview(ref,f.input),input={...f.input,reviewHash:preview.reviewHash,approvalReference:'SYNTHETIC-FIRST-APPROVAL'};
  const first=await service.approve(ref,input,context());
  await expect(service.preview(ref,{...f.input,previousMappingReference:first.mappingReference})).rejects.toMatchObject({response:{code:'ERP_MAPPING_NO_CHANGE'}});
  const revised={...f.input,policyVersion:2,previousMappingReference:first.mappingReference},next=await service.preview(ref,revised),second=await service.approve(ref,{...revised,reviewHash:next.reviewHash,approvalReference:'SYNTHETIC-SECOND-APPROVAL'},context());expect(second.revision).toBe(2);
  const old=await db.erpAccountingMapping.findUniqueOrThrow({where:{mappingReference:first.mappingReference}});
  await expect(db.erpProjectionDispatch.create({data:{projectionId:f.projection.projectionId,providerConnectionVersionId:f.connection.versions[0].providerConnectionVersionId,idempotencyKey:'ucell-erp-projection-'+'a'.repeat(64),requestHash:old.requestHash}})).rejects.toThrow('ERP_MAPPING_DISPATCH_MISMATCH');
  const lookup=jest.fn().mockResolvedValue({kind:'ABSENT'}),submit=jest.fn().mockRejectedValue(new Error('PRIVATE-PROVIDER-ERROR')),adapter={provider:'EZTOOL' as const,providerConnectionVersionId:f.connection.versions[0].providerConnectionVersionId,environment:'TEST' as const,lookup,submit};
  const claim=async()=>{const event=await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.projection.outboxEventId}});return (await claimOutboxLease(db,event))!;};
  await processErpBusinessProjection(db as any,await claim(),adapter);expect(submit.mock.calls[0][0].requestHash).toBe(second.requestHash);expect(submit.mock.calls[0][0].request.mappingRevision).toBe(2);expect(JSON.stringify(submit.mock.calls)).not.toContain('PRIVATE');
  await expect(service.preview(ref,{...revised,policyVersion:3,previousMappingReference:second.mappingReference})).rejects.toMatchObject({response:{code:'ERP_MAPPING_DISPATCH_ALREADY_PINNED'}});
  expect((await service.approve(ref,input,context())).replayed).toBe(true);
  await db.outboxEvent.update({where:{outboxEventId:f.projection.outboxEventId},data:{availableAt:new Date(0)}});lookup.mockResolvedValueOnce({kind:'ACCEPTED',providerReference:'SYNTHETIC-VOUCHER-001',requestHash:second.requestHash});await processErpBusinessProjection(db as any,await claim(),adapter);
  expect(submit).toHaveBeenCalledTimes(1);expect(lookup.mock.calls[1][0].idempotencyKey).toBe(lookup.mock.calls[0][0].idempotencyKey);expect((await db.outboxEvent.findUniqueOrThrow({where:{outboxEventId:f.projection.outboxEventId}})).processStatus).toBe('PROCESSED');
  const history=await service.history(ref);expect(history.items.map(row=>row.revision)).toEqual([2,1]);expect(JSON.stringify(history)).not.toContain('PRIVATE');expect(await service.history(ref,2)).toMatchObject({items:[{revision:1}]});
  const latest=await db.erpAccountingMapping.findUniqueOrThrow({where:{mappingReference:second.mappingReference}});expect(()=>verifyErpAccountingMapping(f.projection,{...latest,requestHash:'0'.repeat(64)})).toThrow('ERP_MAPPING_INTEGRITY_INVALID');
 });
});
