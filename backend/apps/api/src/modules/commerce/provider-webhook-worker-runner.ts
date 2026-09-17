import type {
  FinalizeProviderWebhookOutcomeResult,
  ProviderWebhookWorkerLease,
  ProviderWebhookWorkerLeaseService,
} from './provider-webhook-worker-lease.service';
import type { ProviderWorkerOutcome } from './provider-worker-outcome-decision';

export type ProviderWebhookHandler = Readonly<{
  process(lease: ProviderWebhookWorkerLease): Promise<ProviderWorkerOutcome>;
}>;

export type ProviderWebhookHandlerResolver = (
  lease: ProviderWebhookWorkerLease,
) => ProviderWebhookHandler | null;

export type ProviderWebhookWorkerRunConfig = Readonly<{
  leaseOwner: string;
  leaseMs: number;
  batchSize: number;
  maxAttempts: number;
  retryBackoffSeconds: readonly number[];
}>;

export type ProviderWebhookWorkerRunResult = Readonly<{
  claimed: number;
  finalized: number;
  stale: number;
  processed: number;
  retryPending: number;
  manualReview: number;
}>;

/**
 * Provider-neutral orchestration only. Handlers must return an explicit outcome;
 * this runner never maps provider status, acknowledges callbacks, or applies a
 * domain/monetary effect. Missing handlers and unclassified exceptions fail
 * closed to MANUAL_REVIEW through the lease service.
 */
export async function runProviderWebhookBatch(
  leases: Pick<ProviderWebhookWorkerLeaseService, 'claimBatch' | 'finalizeOutcome'>,
  resolveHandler: ProviderWebhookHandlerResolver,
  config: ProviderWebhookWorkerRunConfig,
  now: Date = new Date(),
): Promise<ProviderWebhookWorkerRunResult> {
  assertConfig(config);
  if (!(now instanceof Date) || Number.isNaN(now.getTime())) throw new Error('PROVIDER_WORKER_NOW_INVALID');
  const claimed = await leases.claimBatch({
    leaseOwner: config.leaseOwner,
    leaseMs: config.leaseMs,
    limit: config.batchSize,
    now,
  });
  const results: FinalizeProviderWebhookOutcomeResult[] = [];
  for (const lease of claimed) {
    const handler = resolveHandler(lease);
    let outcome: ProviderWorkerOutcome;
    if (!handler) {
      outcome = 'PERMANENT_FAILURE';
    } else {
      try {
        outcome = await handler.process(lease);
      } catch {
        outcome = 'UNKNOWN_FAILURE';
      }
    }
    results.push(await leases.finalizeOutcome({
      providerWebhookInboxId: lease.providerWebhookInboxId,
      leaseOwner: lease.leaseOwner,
      attemptCount: lease.attemptCount,
      outcome,
      maxAttempts: config.maxAttempts,
      retryBackoffSeconds: config.retryBackoffSeconds,
      evaluatedAt: now.toISOString(),
    }));
  }
  return Object.freeze({
    claimed: claimed.length,
    finalized: results.filter(row => row.finalized).length,
    stale: results.filter(row => !row.finalized).length,
    processed: results.filter(row => row.finalized && row.decision.status === 'PROCESSED').length,
    retryPending: results.filter(row => row.finalized && row.decision.status === 'RETRY_PENDING').length,
    manualReview: results.filter(row => row.finalized && row.decision.status === 'MANUAL_REVIEW').length,
  });
}

function assertConfig(config: ProviderWebhookWorkerRunConfig): void {
  if (!config || !Number.isSafeInteger(config.batchSize) || config.batchSize < 1 || config.batchSize > 100
    || !Number.isSafeInteger(config.leaseMs) || config.leaseMs < 1_000 || config.leaseMs > 900_000
    || !Number.isSafeInteger(config.maxAttempts) || config.maxAttempts < 1 || config.maxAttempts > 100
    || !Array.isArray(config.retryBackoffSeconds)) {
    throw new Error('PROVIDER_WORKER_CONFIG_INVALID');
  }
}
