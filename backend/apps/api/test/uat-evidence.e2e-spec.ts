import { ForbiddenException, UnprocessableEntityException } from '@nestjs/common';
import { UatEvidenceService } from '../src/modules/uat-evidence/uat-evidence.service';

const base = {
  classification: 'LOCAL_ASSISTIVE_ONLY' as const,
  environment: 'connected_dev', scenarioCode: 'UAT-R6-001', result: 'PASS' as const,
  evidenceHash: 'a'.repeat(64), artifactReference: 'artifact://build/123/result.json',
  executedAt: '2020-01-01T01:00:00.000Z',
};

describe('UAT evidence ingestion foundation', () => {
  const queryRaw = jest.fn();
  const listQueryRaw = jest.fn();
  const auditWrite = jest.fn();
  const execute = jest.fn(async (_scope: string, _key: string, _request: unknown, work: any) => ({ value: await work({ $queryRaw: queryRaw }), replayed: false }));
  const configGet = jest.fn();
  const service = new UatEvidenceService(
    { $queryRaw: listQueryRaw } as any, { execute } as any, { write: auditWrite } as any, { get: configGet } as any,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([{ uatExecutionEvidenceId: '11111111-1111-4111-8111-111111111111', classification: 'LOCAL_ASSISTIVE_ONLY' }]);
    listQueryRaw.mockResolvedValue([]);
  });

  it('records local assistive evidence atomically without claiming formal sign-off', async () => {
    const result = await service.record(base, 'key-1', '22222222-2222-4222-8222-222222222222', 'req', '33333333-3333-4333-8333-333333333333');
    expect(queryRaw).toHaveBeenCalledTimes(1);
    expect(auditWrite).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'UAT_EXECUTION_EVIDENCE_RECORDED' }));
    expect(result.formalSignOff).toBe(false);
  });

  it('fails closed for formal evidence when ingestion is disabled', async () => {
    configGet.mockReturnValue(undefined);
    await expect(service.record({ ...base, classification: 'FORMAL_UAT_EVIDENCE', environment: 'UAT', approvalReference: 'CAB-1' }, 'key-2', '22222222-2222-4222-8222-222222222222', 'req', '33333333-3333-4333-8333-333333333333'))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: 'FORMAL_UAT_EVIDENCE_DISABLED' }) });
    expect(execute).not.toHaveBeenCalled();
  });

  it('requires UAT environment and approval evidence for enabled formal ingestion', async () => {
    configGet.mockImplementation((key: string) => key === 'UAT_FORMAL_EVIDENCE_INGESTION_ENABLED' ? 'true' : 'UAT');
    await expect(service.record({ ...base, classification: 'FORMAL_UAT_EVIDENCE', environment: 'PRODUCTION', approvalReference: 'CAB-1' }, 'key-3', '22222222-2222-4222-8222-222222222222', 'req', '33333333-3333-4333-8333-333333333333')).rejects.toBeInstanceOf(UnprocessableEntityException);
    await expect(service.record({ ...base, classification: 'FORMAL_UAT_EVIDENCE', environment: 'UAT' }, 'key-4', '22222222-2222-4222-8222-222222222222', 'req', '33333333-3333-4333-8333-333333333333')).rejects.toMatchObject({ response: expect.objectContaining({ code: 'UAT_APPROVAL_REFERENCE_REQUIRED' }) });
  });

  it('rejects formal evidence outside the governed UAT deployment', async () => {
    configGet.mockImplementation((key: string) => key === 'UAT_FORMAL_EVIDENCE_INGESTION_ENABLED' ? 'true' : 'CONNECTED_DEV');
    await expect(service.record({ ...base, classification: 'FORMAL_UAT_EVIDENCE', environment: 'UAT', approvalReference: 'CAB-1' }, 'key-6', '22222222-2222-4222-8222-222222222222', 'req', '33333333-3333-4333-8333-333333333333'))
      .rejects.toMatchObject({ response: expect.objectContaining({ code: 'FORMAL_UAT_DEPLOYMENT_REQUIRED' }) });
  });

  it('stores authorized formal evidence while keeping sign-off false', async () => {
    configGet.mockImplementation((key: string) => key === 'UAT_FORMAL_EVIDENCE_INGESTION_ENABLED' ? 'true' : 'UAT');
    queryRaw.mockResolvedValueOnce([{ uatExecutionEvidenceId: '11111111-1111-4111-8111-111111111111', classification: 'FORMAL_UAT_EVIDENCE' }]);
    const result = await service.record({ ...base, classification: 'FORMAL_UAT_EVIDENCE', environment: 'UAT', approvalReference: 'CAB-1' }, 'key-7', '22222222-2222-4222-8222-222222222222', 'req', '33333333-3333-4333-8333-333333333333');
    expect(result.classification).toBe('FORMAL_UAT_EVIDENCE');
    expect(result.formalSignOff).toBe(false);
  });

  it('requires an authenticated governed actor for every persisted record', async () => {
    await expect(service.record(base, 'key-5', undefined, 'req', '33333333-3333-4333-8333-333333333333')).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('marks every read row as evidence only and never as formal sign-off', async () => {
    listQueryRaw.mockResolvedValueOnce([
      { uatExecutionEvidenceId: '1', classification: 'LOCAL_ASSISTIVE_ONLY' },
      { uatExecutionEvidenceId: '2', classification: 'FORMAL_UAT_EVIDENCE' },
    ]);
    await expect(service.list({ environment: 'uat' })).resolves.toEqual([
      expect.objectContaining({ uatExecutionEvidenceId: '1', formalSignOff: false }),
      expect.objectContaining({ uatExecutionEvidenceId: '2', formalSignOff: false }),
    ]);
  });
});
