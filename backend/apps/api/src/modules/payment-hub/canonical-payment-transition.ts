import { CanonicalPaymentStatus } from './payment-provider.adapter';

export type PaymentEvidenceSource =
  | 'BROWSER_RETURN'
  | 'VERIFIED_WEBHOOK'
  | 'PROVIDER_QUERY'
  | 'RECONCILIATION'
  | 'CONTROLLED_POS_EVIDENCE';

export interface PaymentTransitionEvidence {
  source: PaymentEvidenceSource;
  signatureVerified?: boolean;
  providerEventIdentity?: string;
  providerTransactionRef?: string;
  terminalRef?: string;
  batchRef?: string;
  recordedBy?: string;
}

export type ProviderEventDecision =
  | { result: 'NEW' }
  | { result: 'REPLAY' }
  | { result: 'CONFLICT'; code: 'PROVIDER_EVENT_IDENTITY_CONFLICT' };

const allowedTransitions: Readonly<Record<CanonicalPaymentStatus, ReadonlySet<CanonicalPaymentStatus>>> = {
  CREATED: new Set(['PENDING', 'AUTHORIZED', 'CAPTURED', 'PAID', 'FAILED', 'CANCELLED']),
  PENDING: new Set(['AUTHORIZED', 'CAPTURED', 'PAID', 'FAILED', 'CANCELLED']),
  AUTHORIZED: new Set(['CAPTURED', 'PAID', 'FAILED', 'CANCELLED']),
  CAPTURED: new Set(['PAID', 'REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED']),
  PAID: new Set(['REFUND_PENDING', 'PARTIALLY_REFUNDED', 'REFUNDED']),
  FAILED: new Set(),
  CANCELLED: new Set(),
  REFUND_PENDING: new Set(['PARTIALLY_REFUNDED', 'REFUNDED']),
  PARTIALLY_REFUNDED: new Set(['REFUND_PENDING', 'REFUNDED']),
  REFUNDED: new Set(),
};

const providerOutcomeStatuses = new Set<CanonicalPaymentStatus>([
  'AUTHORIZED',
  'CAPTURED',
  'PAID',
  'FAILED',
  'CANCELLED',
  'REFUND_PENDING',
  'PARTIALLY_REFUNDED',
  'REFUNDED',
]);

export class PaymentTransitionError extends Error {
  constructor(
    readonly code:
      | 'PAYMENT_EVIDENCE_UNTRUSTED'
      | 'PAYMENT_EVIDENCE_INCOMPLETE'
      | 'PAYMENT_TRANSITION_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'PaymentTransitionError';
  }
}

export function assertCanonicalPaymentTransition(
  current: CanonicalPaymentStatus,
  next: CanonicalPaymentStatus,
  evidence: PaymentTransitionEvidence,
): void {
  if (current !== next && !allowedTransitions[current].has(next)) {
    throw new PaymentTransitionError(
      'PAYMENT_TRANSITION_INVALID',
      `Payment cannot transition from ${current} to ${next}.`,
    );
  }

  if (providerOutcomeStatuses.has(next)) assertTrustedProviderEvidence(evidence);
}

function assertTrustedProviderEvidence(evidence: PaymentTransitionEvidence): void {
  if (evidence.source === 'BROWSER_RETURN') {
    throw new PaymentTransitionError(
      'PAYMENT_EVIDENCE_UNTRUSTED',
      'Browser return is navigation evidence and cannot establish a provider payment outcome.',
    );
  }

  if (evidence.source === 'VERIFIED_WEBHOOK') {
    if (!evidence.signatureVerified || !evidence.providerEventIdentity || !evidence.providerTransactionRef) {
      throw new PaymentTransitionError(
        'PAYMENT_EVIDENCE_INCOMPLETE',
        'Verified webhook evidence requires signature, provider event identity and transaction reference.',
      );
    }
    return;
  }

  if (evidence.source === 'PROVIDER_QUERY') {
    if (!evidence.providerTransactionRef) {
      throw new PaymentTransitionError(
        'PAYMENT_EVIDENCE_INCOMPLETE',
        'Provider query evidence requires a provider transaction reference.',
      );
    }
    return;
  }

  if (evidence.source === 'RECONCILIATION') {
    if (!evidence.providerTransactionRef || !evidence.batchRef) {
      throw new PaymentTransitionError(
        'PAYMENT_EVIDENCE_INCOMPLETE',
        'Reconciliation evidence requires transaction and batch references.',
      );
    }
    return;
  }

  if (!evidence.providerTransactionRef || !evidence.recordedBy || (!evidence.terminalRef && !evidence.batchRef)) {
    throw new PaymentTransitionError(
      'PAYMENT_EVIDENCE_INCOMPLETE',
      'Controlled POS evidence requires transaction, operator and terminal or batch reference.',
    );
  }
}

export function classifyProviderEvent(
  existingPayloadHash: string | null,
  incomingPayloadHash: string,
): ProviderEventDecision {
  if (existingPayloadHash === null) return { result: 'NEW' };
  if (existingPayloadHash === incomingPayloadHash) return { result: 'REPLAY' };
  return { result: 'CONFLICT', code: 'PROVIDER_EVENT_IDENTITY_CONFLICT' };
}
