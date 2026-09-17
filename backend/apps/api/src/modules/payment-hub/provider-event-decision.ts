import {
  assertCanonicalPaymentTransition,
  classifyProviderEvent,
  PaymentTransitionEvidence,
} from './canonical-payment-transition';
import {
  canonicalizeProviderEvent,
  CanonicalizedProviderEvent,
  CanonicalProviderEventInput,
} from './provider-event-canonicalizer';
import { CanonicalPaymentStatus } from './payment-provider.adapter';

export type ProviderEventApplicationDecision =
  | { action: 'APPLY'; event: CanonicalizedProviderEvent; nextStatus: CanonicalPaymentStatus }
  | { action: 'NOOP_REPLAY'; event: CanonicalizedProviderEvent; nextStatus: CanonicalPaymentStatus };

export class ProviderEventDecisionError extends Error {
  constructor(
    readonly code: 'PROVIDER_EVENT_IDENTITY_CONFLICT' | 'PAYMENT_EVIDENCE_SOURCE_MISMATCH',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderEventDecisionError';
  }
}

export function decideProviderEventApplication(input: {
  currentStatus: CanonicalPaymentStatus;
  existingPayloadHash: string | null;
  event: CanonicalProviderEventInput;
  evidence: Omit<PaymentTransitionEvidence, 'source' | 'providerEventIdentity' | 'providerTransactionRef'> & {
    source?: PaymentTransitionEvidence['source'];
  };
}): ProviderEventApplicationDecision {
  if (input.evidence.source && input.evidence.source !== input.event.source) {
    throw new ProviderEventDecisionError(
      'PAYMENT_EVIDENCE_SOURCE_MISMATCH',
      'Transition evidence source must match the canonical provider event source.',
    );
  }

  const event = canonicalizeProviderEvent(input.event);
  const duplicate = classifyProviderEvent(input.existingPayloadHash, event.payloadHash);
  if (duplicate.result === 'CONFLICT') {
    throw new ProviderEventDecisionError(
      'PROVIDER_EVENT_IDENTITY_CONFLICT',
      'Provider event identity was reused with different canonical evidence.',
    );
  }
  if (duplicate.result === 'REPLAY') {
    return { action: 'NOOP_REPLAY', event, nextStatus: input.currentStatus };
  }

  assertCanonicalPaymentTransition(input.currentStatus, event.status, {
    ...input.evidence,
    source: event.source,
    providerEventIdentity: event.providerEventIdentity,
    providerTransactionRef: event.providerTransactionRef,
  });

  return { action: 'APPLY', event, nextStatus: event.status };
}
