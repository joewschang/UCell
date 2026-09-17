import { requestHash } from '../../common/utils/hash';
import { assertCanonicalPaymentTransition, classifyProviderEvent, PaymentTransitionEvidence } from './canonical-payment-transition';
import { canonicalizeProviderEvent, CanonicalizedProviderEvent, CanonicalProviderEventInput } from './provider-event-canonicalizer';
import { CanonicalPaymentStatus, assertIssuedPaymentReceipt, VerifiedPaymentReceipt, PAYMENT_STATUSES } from './payment-provider.adapter';

/** Core-loaded operation binding. For refunds, amount is the approved refund amount,
 * not a new Commerce allocation of the original Order total. */
export type PaymentBinding = Readonly<{ paymentId: string; orderId: string; provider: string;
  connectionId: string; providerTransactionRef: string; amount: string; currency: string }>;
/** Loaded and cross-checked by Core under the same DB transaction as the payment.
 * References prove the intended persistence contract, not runtime DB verification here. */
export type PersistedPaymentOperationClaim = Readonly<{
  integrity: 'COMMITTED'; businessEffectIdentity: string; operationHash: string;
  committedEffectRef: string; paymentStateEvidenceRef: string; outboxIntentRef: string;
}> | Readonly<{
  integrity: 'INCOMPLETE'; businessEffectIdentity: string; operationHash: string; reasonCode: string;
}>;
export type ProviderEventApplicationDecision = Readonly<{
  action: 'APPLY' | 'NOOP_REPLAY' | 'NOOP_OPERATION'; event: CanonicalizedProviderEvent;
  nextStatus: CanonicalPaymentStatus; businessEffectIdentity: string; operationHash: string;
}>;
export class ProviderEventDecisionError extends Error {
  constructor(readonly code: 'PROVIDER_EVENT_IDENTITY_CONFLICT' | 'PAYMENT_EVIDENCE_SOURCE_MISMATCH'
    | 'PAYMENT_RECEIPT_BINDING_MISMATCH' | 'PAYMENT_OPERATION_CONFLICT' | 'PAYMENT_OPERATION_INCOMPLETE', message: string) { super(message); }
}

/** DB owner must obtain binding, delivery hash and a complete operation claim under one transaction,
 * enforce unique claims and write state/outbox atomically. This function does no I/O. */
export function decideProviderEventApplication(input: {
  currentStatus: CanonicalPaymentStatus; binding: PaymentBinding;
  existingPayloadHash: string | null; existingOperationClaim: PersistedPaymentOperationClaim | null;
  event: CanonicalProviderEventInput;
  evidence: Omit<PaymentTransitionEvidence, 'source' | 'providerEventIdentity' | 'providerTransactionRef'> & {
    source?: PaymentTransitionEvidence['source']; receipt: VerifiedPaymentReceipt;
  };
}): ProviderEventApplicationDecision {
  const receipt = input.evidence.receipt;
  if (!PAYMENT_STATUSES.includes(input.currentStatus)) throw new ProviderEventDecisionError('PAYMENT_RECEIPT_BINDING_MISMATCH', 'Unknown current payment status.');
  assertIssuedPaymentReceipt(receipt); // Replays also require verified ingress.
  if (input.evidence.source !== undefined && input.evidence.source !== input.event.source) {
    throw new ProviderEventDecisionError('PAYMENT_EVIDENCE_SOURCE_MISMATCH', 'Evidence source mismatch.');
  }
  const event = canonicalizeProviderEvent(input.event);
  const bindingKeys = ['paymentId', 'orderId', 'provider', 'connectionId', 'providerTransactionRef', 'amount', 'currency'] as const;
  if (!input.binding || bindingKeys.some(key => receipt[key] !== input.binding[key])
    || receipt.provider !== event.provider || receipt.source !== event.source
    || receipt.status !== event.status || receipt.providerTransactionRef !== event.providerTransactionRef
    || receipt.providerEventIdentity !== event.providerEventIdentity || receipt.payloadHash !== event.payloadHash
    || event.safeMetadata.amount !== receipt.amount || event.safeMetadata.currency !== receipt.currency) {
    throw new ProviderEventDecisionError('PAYMENT_RECEIPT_BINDING_MISMATCH', 'Receipt, canonical evidence and stored payment binding must agree.');
  }
  const businessEffectIdentity = requestHash([receipt.provider, receipt.connectionId, receipt.paymentId, receipt.operationKind, receipt.operationId]);
  const operationHash = requestHash({ provider: receipt.provider, connectionId: receipt.connectionId,
    paymentId: receipt.paymentId, orderId: receipt.orderId, transaction: receipt.providerTransactionRef,
    operationKind: receipt.operationKind, operationId: receipt.operationId,
    amount: receipt.amount, currency: receipt.currency, status: receipt.status });
  const duplicate = classifyProviderEvent(input.existingPayloadHash, event.payloadHash);
  if (duplicate.result === 'CONFLICT') throw new ProviderEventDecisionError('PROVIDER_EVENT_IDENTITY_CONFLICT', 'Event identity conflict.');
  const claim = input.existingOperationClaim;
  if (claim !== null) {
    if (!claim || claim.integrity !== 'COMMITTED'
      || [claim.committedEffectRef, claim.paymentStateEvidenceRef, claim.outboxIntentRef]
        .some(ref => typeof ref !== 'string' || !ref.trim())) {
      throw new ProviderEventDecisionError('PAYMENT_OPERATION_INCOMPLETE', 'Operation claim is missing committed state, effect or outbox evidence.');
    }
    if (claim.operationHash !== operationHash || claim.businessEffectIdentity !== businessEffectIdentity) {
      throw new ProviderEventDecisionError('PAYMENT_OPERATION_CONFLICT', 'Business operation evidence conflict.');
    }
  }
  const result = { event, businessEffectIdentity, operationHash };
  if (duplicate.result === 'REPLAY' && claim === null) {
    throw new ProviderEventDecisionError('PAYMENT_OPERATION_CONFLICT', 'Persisted delivery is missing its atomic operation claim.');
  }
  if (duplicate.result === 'REPLAY') return Object.freeze({ ...result, action: 'NOOP_REPLAY', nextStatus: input.currentStatus });
  if (claim !== null) return Object.freeze({ ...result, action: 'NOOP_OPERATION', nextStatus: input.currentStatus });
  assertCanonicalPaymentTransition(input.currentStatus, event.status, {
    ...input.evidence, source: event.source, providerEventIdentity: event.providerEventIdentity, providerTransactionRef: event.providerTransactionRef,
  });
  return Object.freeze({ ...result, action: 'APPLY', nextStatus: event.status });
}
