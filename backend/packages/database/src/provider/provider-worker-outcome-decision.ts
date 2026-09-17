export type ProviderWorkerOutcome = 'SUCCESS' | 'RETRYABLE_FAILURE' | 'PERMANENT_FAILURE' | 'UNKNOWN_FAILURE';

export type ProviderWorkerOutcomeDecision = Readonly<{
  status: 'PROCESSED' | 'RETRY_PENDING' | 'MANUAL_REVIEW';
  reasonCode: 'SUCCESS' | 'RETRYABLE_FAILURE' | 'MAX_ATTEMPTS_REACHED' | 'PERMANENT_FAILURE' | 'UNKNOWN_FAILURE';
  nextAttemptAt: string | null;
}>;

export class ProviderWorkerOutcomeDecisionError extends Error {
  constructor(readonly code:
    | 'PROVIDER_WORKER_ATTEMPT_COUNT_INVALID'
    | 'PROVIDER_WORKER_MAX_ATTEMPTS_INVALID'
    | 'PROVIDER_WORKER_BACKOFF_CONFIG_INVALID'
    | 'PROVIDER_WORKER_EVALUATED_AT_INVALID') {
    super(code);
    this.name = 'ProviderWorkerOutcomeDecisionError';
  }
}

/** Provider-neutral worker disposition. The caller supplies an explicit retry
 * schedule; this boundary does not infer provider acknowledgements, raw status
 * mappings, or any domain/monetary effect. `attemptCount` includes the attempt
 * whose outcome is being evaluated. */
export function decideProviderWorkerOutcome(input: Readonly<{
  outcome: ProviderWorkerOutcome;
  attemptCount: number;
  maxAttempts: number;
  retryBackoffSeconds: readonly number[];
  evaluatedAt: string;
}>): ProviderWorkerOutcomeDecision {
  assertPositiveSafeInteger(input.attemptCount, 'PROVIDER_WORKER_ATTEMPT_COUNT_INVALID');
  assertPositiveSafeInteger(input.maxAttempts, 'PROVIDER_WORKER_MAX_ATTEMPTS_INVALID');
  const evaluatedAt = new Date(input.evaluatedAt);
  if (!Number.isFinite(evaluatedAt.getTime())) {
    throw new ProviderWorkerOutcomeDecisionError('PROVIDER_WORKER_EVALUATED_AT_INVALID');
  }
  assertBackoff(input.retryBackoffSeconds, input.maxAttempts);

  if (input.outcome === 'SUCCESS') {
    return Object.freeze({ status: 'PROCESSED', reasonCode: 'SUCCESS', nextAttemptAt: null });
  }
  if (input.outcome !== 'RETRYABLE_FAILURE') {
    return Object.freeze({
      status: 'MANUAL_REVIEW',
      reasonCode: input.outcome,
      nextAttemptAt: null,
    });
  }
  if (input.attemptCount >= input.maxAttempts) {
    return Object.freeze({ status: 'MANUAL_REVIEW', reasonCode: 'MAX_ATTEMPTS_REACHED', nextAttemptAt: null });
  }

  const delaySeconds = input.retryBackoffSeconds[input.attemptCount - 1];
  return Object.freeze({
    status: 'RETRY_PENDING',
    reasonCode: 'RETRYABLE_FAILURE',
    nextAttemptAt: new Date(evaluatedAt.getTime() + delaySeconds * 1000).toISOString(),
  });
}

function assertPositiveSafeInteger(value: number, code: ProviderWorkerOutcomeDecisionError['code']): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new ProviderWorkerOutcomeDecisionError(code);
  }
}

function assertBackoff(backoff: readonly number[], maxAttempts: number): void {
  const requiredRetrySlots = Math.max(0, maxAttempts - 1);
  if (backoff.length !== requiredRetrySlots
    || backoff.some(value => !Number.isSafeInteger(value) || value < 1)) {
    throw new ProviderWorkerOutcomeDecisionError('PROVIDER_WORKER_BACKOFF_CONFIG_INVALID');
  }
}
