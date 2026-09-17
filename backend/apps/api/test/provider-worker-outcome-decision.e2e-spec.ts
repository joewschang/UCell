import {
  decideProviderWorkerOutcome,
  type ProviderWorkerOutcome,
} from '../src/modules/commerce/provider-worker-outcome-decision';

const base = {
  attemptCount: 1,
  maxAttempts: 4,
  retryBackoffSeconds: [30, 120, 600] as const,
  evaluatedAt: '2026-09-18T12:00:00.000Z',
};

describe('Provider-neutral worker outcome decision', () => {
  it('marks success processed without a retry schedule', () => {
    expect(decideProviderWorkerOutcome({ ...base, outcome: 'SUCCESS' })).toEqual({
      status: 'PROCESSED', reasonCode: 'SUCCESS', nextAttemptAt: null,
    });
  });

  it.each([
    [1, '2026-09-18T12:00:30.000Z'],
    [2, '2026-09-18T12:02:00.000Z'],
    [3, '2026-09-18T12:10:00.000Z'],
  ])('uses the explicitly configured backoff after attempt %i', (attemptCount, nextAttemptAt) => {
    expect(decideProviderWorkerOutcome({ ...base, outcome: 'RETRYABLE_FAILURE', attemptCount })).toEqual({
      status: 'RETRY_PENDING', reasonCode: 'RETRYABLE_FAILURE', nextAttemptAt,
    });
  });

  it('fails closed to manual review when retryable failures reach max attempts', () => {
    expect(decideProviderWorkerOutcome({ ...base, outcome: 'RETRYABLE_FAILURE', attemptCount: 4 })).toEqual({
      status: 'MANUAL_REVIEW', reasonCode: 'MAX_ATTEMPTS_REACHED', nextAttemptAt: null,
    });
  });

  it.each<[ProviderWorkerOutcome, string]>([
    ['PERMANENT_FAILURE', 'PERMANENT_FAILURE'],
    ['UNKNOWN_FAILURE', 'UNKNOWN_FAILURE'],
  ])('fails closed for %s', (outcome, reasonCode) => {
    expect(decideProviderWorkerOutcome({ ...base, outcome })).toEqual({
      status: 'MANUAL_REVIEW', reasonCode, nextAttemptAt: null,
    });
  });

  it.each([
    [{ ...base, outcome: 'SUCCESS' as const, attemptCount: 0 }, 'PROVIDER_WORKER_ATTEMPT_COUNT_INVALID'],
    [{ ...base, outcome: 'SUCCESS' as const, attemptCount: 1.5 }, 'PROVIDER_WORKER_ATTEMPT_COUNT_INVALID'],
    [{ ...base, outcome: 'SUCCESS' as const, maxAttempts: 0, retryBackoffSeconds: [] }, 'PROVIDER_WORKER_MAX_ATTEMPTS_INVALID'],
    [{ ...base, outcome: 'SUCCESS' as const, retryBackoffSeconds: [30] }, 'PROVIDER_WORKER_BACKOFF_CONFIG_INVALID'],
    [{ ...base, outcome: 'SUCCESS' as const, retryBackoffSeconds: [30, 0, 600] }, 'PROVIDER_WORKER_BACKOFF_CONFIG_INVALID'],
    [{ ...base, outcome: 'SUCCESS' as const, evaluatedAt: 'invalid' }, 'PROVIDER_WORKER_EVALUATED_AT_INVALID'],
  ])('rejects invalid configuration with %s', (input, code) => {
    expect(() => decideProviderWorkerOutcome(input)).toThrow(expect.objectContaining({ code }));
  });

  it('requires no backoff slots when only one attempt is configured', () => {
    expect(decideProviderWorkerOutcome({
      outcome: 'RETRYABLE_FAILURE', attemptCount: 1, maxAttempts: 1,
      retryBackoffSeconds: [], evaluatedAt: base.evaluatedAt,
    })).toEqual({ status: 'MANUAL_REVIEW', reasonCode: 'MAX_ATTEMPTS_REACHED', nextAttemptAt: null });
  });
});
