export type ProviderWebhookInboxStatus =
  | 'RECEIVED'
  | 'VERIFIED'
  | 'REJECTED'
  | 'PROCESSING'
  | 'PROCESSED'
  | 'RETRY_PENDING'
  | 'MANUAL_REVIEW';

const NEXT_STATUS = {
  RECEIVED: ['VERIFIED', 'REJECTED'],
  VERIFIED: ['PROCESSING', 'MANUAL_REVIEW'],
  REJECTED: [],
  PROCESSING: ['PROCESSED', 'RETRY_PENDING', 'MANUAL_REVIEW'],
  PROCESSED: [],
  RETRY_PENDING: ['PROCESSING', 'MANUAL_REVIEW'],
  MANUAL_REVIEW: ['PROCESSING'],
} as const satisfies Readonly<Record<ProviderWebhookInboxStatus, readonly ProviderWebhookInboxStatus[]>>;

export class ProviderWebhookInboxStateError extends Error {
  constructor(readonly code: 'PROVIDER_WEBHOOK_STATUS_TRANSITION_INVALID' | 'PROVIDER_WEBHOOK_ATTEMPT_COUNT_INVALID') {
    super(code);
    this.name = 'ProviderWebhookInboxStateError';
  }
}

/** Pure provider-neutral lifecycle guard. It does not decide callback acknowledgements,
 * provider mappings, or domain effects. Keeping same-status writes legal permits
 * compare-and-set lease metadata updates without weakening lifecycle transitions. */
export function assertProviderWebhookInboxTransition(
  from: ProviderWebhookInboxStatus,
  to: ProviderWebhookInboxStatus,
  attemptCount: number,
): void {
  if (!Number.isSafeInteger(attemptCount) || attemptCount < 0) {
    throw new ProviderWebhookInboxStateError('PROVIDER_WEBHOOK_ATTEMPT_COUNT_INVALID');
  }
  const permitted = NEXT_STATUS[from] as readonly ProviderWebhookInboxStatus[];
  if (from !== to && !permitted.includes(to)) {
    throw new ProviderWebhookInboxStateError('PROVIDER_WEBHOOK_STATUS_TRANSITION_INVALID');
  }
}
