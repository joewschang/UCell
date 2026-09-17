import { ProviderWebhookWorkerLeaseService } from '../src/modules/commerce/provider-webhook-worker-lease.service';

describe('Provider webhook worker lease validation', () => {
  const db = { $transaction: jest.fn() };
  const service = new ProviderWebhookWorkerLeaseService(db as any);

  beforeEach(() => jest.clearAllMocks());

  it.each([
    ['', 'PROVIDER_WEBHOOK_LEASE_OWNER_INVALID'],
    [' worker', 'PROVIDER_WEBHOOK_LEASE_OWNER_INVALID'],
    ['worker/unsafe', 'PROVIDER_WEBHOOK_LEASE_OWNER_INVALID'],
  ])('rejects unsafe lease owner %p', async (leaseOwner, message) => {
    await expect(service.claimBatch({ leaseOwner })).rejects.toThrow(message);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('rejects unsafe lease duration and batch limits', async () => {
    await expect(service.claimBatch({ leaseOwner: 'worker-1', leaseMs: 999 })).rejects.toThrow('PROVIDER_WEBHOOK_LEASE_MS_INVALID');
    await expect(service.claimBatch({ leaseOwner: 'worker-1', limit: 101 })).rejects.toThrow('PROVIDER_WEBHOOK_LIMIT_INVALID');
  });

  it('rejects non-future retry scheduling before opening a transaction', async () => {
    const now = new Date('2026-09-19T00:00:00.000Z');
    await expect(service.scheduleRetry({
      providerWebhookInboxId: '11111111-1111-4111-8111-111111111111',
      leaseOwner: 'worker-1', attemptCount: 1, now, nextAttemptAt: now, errorCode: 'TEMPORARY_FAILURE',
    })).rejects.toThrow('PROVIDER_WEBHOOK_NEXT_ATTEMPT_AT_INVALID');
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it('returns false when ownership compare-and-set changes no row', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{}]), $executeRaw: jest.fn().mockResolvedValue(0) };
    db.$transaction.mockImplementation((work: (value: unknown) => unknown) => work(tx));
    await expect(service.scheduleRetry({
      providerWebhookInboxId: '11111111-1111-4111-8111-111111111111',
      leaseOwner: 'worker-1', attemptCount: 2,
      now: new Date('2026-09-19T00:00:00.000Z'),
      nextAttemptAt: new Date('2026-09-19T00:00:30.000Z'), errorCode: 'TEMPORARY_FAILURE',
    })).resolves.toBe(false);
  });

  it.each([
    ['SUCCESS', 1, 1, [] as number[], 'PROCESSED', null],
    ['RETRYABLE_FAILURE', 1, 3, [30, 120], 'RETRY_PENDING', '2026-09-19T00:00:30.000Z'],
    ['RETRYABLE_FAILURE', 3, 3, [30, 120], 'MANUAL_REVIEW', null],
    ['PERMANENT_FAILURE', 1, 3, [30, 120], 'MANUAL_REVIEW', null],
  ] as const)('finalizes %s using the pure outcome decision', async (
    outcome, attemptCount, maxAttempts, retryBackoffSeconds, status, nextAttemptAt,
  ) => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{}]), $executeRaw: jest.fn().mockResolvedValue(1) };
    db.$transaction.mockImplementation((work: (value: unknown) => unknown) => work(tx));

    await expect(service.finalizeOutcome({
      providerWebhookInboxId: '11111111-1111-4111-8111-111111111111',
      leaseOwner: 'worker-1', attemptCount, outcome, maxAttempts, retryBackoffSeconds,
      evaluatedAt: '2026-09-19T00:00:00.000Z',
    })).resolves.toEqual({ finalized: true, decision: expect.objectContaining({ status, nextAttemptAt }) });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('reports lost ownership without changing the outcome decision', async () => {
    const tx = { $queryRaw: jest.fn().mockResolvedValue([{}]), $executeRaw: jest.fn().mockResolvedValue(0) };
    db.$transaction.mockImplementation((work: (value: unknown) => unknown) => work(tx));
    await expect(service.finalizeOutcome({
      providerWebhookInboxId: '11111111-1111-4111-8111-111111111111',
      leaseOwner: 'worker-1', attemptCount: 1, outcome: 'SUCCESS', maxAttempts: 1,
      retryBackoffSeconds: [], evaluatedAt: '2026-09-19T00:00:00.000Z',
    })).resolves.toEqual({
      finalized: false,
      decision: { status: 'PROCESSED', reasonCode: 'SUCCESS', nextAttemptAt: null },
    });
  });
});
