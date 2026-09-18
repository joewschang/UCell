import {BadRequestException} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {AdminProviderOperationsService} from '../src/modules/admin-provider-operations/admin-provider-operations.service';
import {AdminProviderReconciliationController} from '../src/modules/admin-provider-operations/admin-provider-reconciliation.controller';

describe('Admin provider reconciliation read model',()=>{
  const now=new Date('2026-09-19T00:00:00.000Z');
  it('reports authoritative failed/discrepancy health without monetary inference',async()=>{
    const runs={count:jest.fn().mockResolvedValueOnce(8).mockResolvedValueOnce(3),groupBy:jest.fn().mockResolvedValueOnce([{status:'FAILED',_count:{_all:1}},{status:'DISCREPANCY',_count:{_all:2}},{status:'MATCHED',_count:{_all:5}}]).mockResolvedValueOnce([{domain:'PAYMENT',_count:{_all:8}}]),findFirst:jest.fn().mockResolvedValue({startedAt:new Date('2026-09-18T20:00:00Z')})};
    const result=await new AdminProviderOperationsService({providerReconciliationRun:runs} as unknown as PrismaService,{} as never,{} as never).reconciliationHealth(now);
    expect(result).toEqual({generatedAt:now.toISOString(),state:'CRITICAL',total:8,exceptions:3,oldestExceptionAt:'2026-09-18T20:00:00.000Z',counts:{byStatus:{FAILED:1,DISCREPANCY:2,MATCHED:5},byDomain:{PAYMENT:8}}});
  });
  it('returns bounded safe exception rows and excludes stored provider evidence',async()=>{
    const row={providerReconciliationRunId:'run-1',domain:'PAYMENT',provider:'ACME',connectionId:'primary',runKey:'daily-1',periodStart:new Date('2026-09-18T00:00:00Z'),periodEnd:new Date('2026-09-19T00:00:00Z'),status:'DISCREPANCY',providerRecordCount:3,internalRecordCount:2,discrepancyCount:1,verificationConfigVersion:'v1',startedAt:new Date('2026-09-19T00:01:00Z'),completedAt:new Date('2026-09-19T00:02:00Z'),correlationId:'correlation'};
    const runs={findMany:jest.fn().mockResolvedValue([row,{...row,providerReconciliationRunId:'overflow'}])};
    const result=await new AdminProviderOperationsService({providerReconciliationRun:runs} as unknown as PrismaService,{} as never,{} as never).reconciliationExceptions({domain:'PAYMENT',provider:'ACME',status:'DISCREPANCY',take:1},now);
    expect(result).toMatchObject({limit:1,truncated:true,items:[{providerReconciliationRunId:'run-1',status:'DISCREPANCY',discrepancyCount:1}]});
    expect(JSON.stringify(result)).not.toMatch(/evidenceHash|safeEvidenceRef|providerBatchRef|providerConnectionVersionId/);
    expect(runs.findMany).toHaveBeenCalledWith(expect.objectContaining({take:2,where:{domain:'PAYMENT',provider:'ACME',status:'DISCREPANCY'}}));
  });
  it.each([{domain:'UNKNOWN'},{status:'MATCHED'},{take:0},{take:201},{provider:' '}])('rejects invalid exception filter before querying (%p)',async input=>{
    const runs={findMany:jest.fn()};const service=new AdminProviderOperationsService({providerReconciliationRun:runs} as unknown as PrismaService,{} as never,{} as never);
    await expect(service.reconciliationExceptions(input)).rejects.toBeInstanceOf(BadRequestException);expect(runs.findMany).not.toHaveBeenCalled();
  });
  it('wraps reconciliation reads in the admin data envelope and preserves RBAC roles',async()=>{
    const service={reconciliationHealth:jest.fn().mockResolvedValue({state:'HEALTHY'}),reconciliationExceptions:jest.fn().mockResolvedValue({items:[]})};const controller=new AdminProviderReconciliationController(service as never);
    await expect(controller.health()).resolves.toEqual({data:{state:'HEALTHY'}});await expect(controller.exceptions('PAYMENT','ACME','FAILED','25')).resolves.toEqual({data:{items:[]}});
    expect(Reflect.getMetadata('roles',AdminProviderReconciliationController)).toEqual(['SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT']);
  });
});