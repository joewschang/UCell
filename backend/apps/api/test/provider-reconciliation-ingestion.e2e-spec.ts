import {
  deriveReconciliationHashes,
  IngestProviderReconciliationInput,
  ProviderReconciliationIngestionService,
} from '../src/modules/payment-hub/provider-reconciliation-ingestion';

const input: IngestProviderReconciliationInput = {
  domain: 'PAYMENT', provider: 'PROVIDER_A', connectionId: 'connection-a', runKey: '2026-09-17',
  providerBatchRef: 'batch-a', periodStart: new Date('2026-09-17T00:00:00.000Z'),
  periodEnd: new Date('2026-09-18T00:00:00.000Z'),
  result: { status: 'MATCHED', providerRecordCount: 2, internalRecordCount: 2, discrepancyCount: 0 },
  evidence: { safeEvidenceRef: 'safe://reconciliation/a', verificationConfigVersion: 'config-v1',
    providerConnectionVersionId: '00000000-0000-4000-8000-000000000001' },
  completedAt: new Date('2026-09-18T00:01:00.000Z'), correlationId: '00000000-0000-4000-8000-000000000002',
};

function harness() {
  let stored: any = null;
  const otherMonetaryMutation = jest.fn();
  const providerReconciliationRun = {
    findUnique: jest.fn(async () => stored),
    create: jest.fn(async ({ data }: any) => stored = {
      providerReconciliationRunId: 'run-a', evidenceHash: data.evidenceHash, status: data.status,
    }),
  };
  const service = new ProviderReconciliationIngestionService({ providerReconciliationRun, payment: {
    update: otherMonetaryMutation,
  } } as any);
  return { service, providerReconciliationRun, otherMonetaryMutation, getStored: () => stored };
}

describe('provider-neutral reconciliation ingestion', () => {
  it('derives deterministic input and output hashes independent of object key order', () => {
    const a = deriveReconciliationHashes(input);
    const reordered = { ...input, result: { discrepancyCount: 0, internalRecordCount: 2,
      providerRecordCount: 2, status: 'MATCHED' as const } };
    expect(deriveReconciliationHashes(reordered)).toEqual(a);
    expect(a.inputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.outputHash).toMatch(/^[a-f0-9]{64}$/);
    expect(a.evidenceHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('creates once and treats an exact duplicate as an idempotent replay', async () => {
    const h = harness();
    expect((await h.service.ingest(input)).action).toBe('CREATED');
    expect((await h.service.ingest(input)).action).toBe('REPLAY');
    expect(h.providerReconciliationRun.create).toHaveBeenCalledTimes(1);
  });

  it('rejects a changed payload under the same run identity', async () => {
    const h = harness();
    await h.service.ingest(input);
    await expect(h.service.ingest({ ...input, result: { ...input.result, status: 'DISCREPANCY', discrepancyCount: 1 } }))
      .rejects.toMatchObject({ code: 'RECONCILIATION_RUN_CONFLICT' });
  });

  it.each([
    { evidence: { ...input.evidence, safeEvidenceRef: '' } },
    { evidence: { ...input.evidence, verificationConfigVersion: '' } },
    { evidence: { ...input.evidence, providerConnectionVersionId: '' } },
  ])('fails closed for incomplete evidence %#', async patch => {
    const h = harness();
    await expect(h.service.ingest({ ...input, ...patch })).rejects.toMatchObject({ code: 'RECONCILIATION_EVIDENCE_INCOMPLETE' });
    expect(h.providerReconciliationRun.create).not.toHaveBeenCalled();
  });

  it('fails closed when a legacy duplicate has no evidence hash', async () => {
    const h = harness();
    await h.service.ingest(input);
    h.getStored().evidenceHash = null;
    await expect(h.service.ingest(input)).rejects.toMatchObject({ code: 'RECONCILIATION_EVIDENCE_INCOMPLETE' });
  });

  it('persists reconciliation evidence without invoking a monetary aggregate', async () => {
    const h = harness();
    await h.service.ingest(input);
    expect(h.otherMonetaryMutation).not.toHaveBeenCalled();
    expect(h.providerReconciliationRun.create.mock.calls[0][0].data).not.toHaveProperty('amount');
  });
});
