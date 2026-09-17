import { requestHash } from '../../common/utils/hash';
import { PaymentEvidenceSource } from './canonical-payment-transition';
import { sanitizePaymentEvidenceMetadata, SafePaymentEvidenceValue } from './payment-evidence-sanitizer';
import { CanonicalPaymentStatus, PaymentProvider, VerifiedProviderEvent } from './payment-provider.adapter';

export interface CanonicalProviderEventInput {
  provider: PaymentProvider;
  source: Exclude<PaymentEvidenceSource, 'BROWSER_RETURN'>;
  providerEventId?: string;
  providerTransactionRef: string;
  status: CanonicalPaymentStatus;
  metadata: Readonly<Record<string, unknown>>;
  occurredAt?: Date;
}

export interface CanonicalizedProviderEvent extends VerifiedProviderEvent {
  source: CanonicalProviderEventInput['source'];
  safeMetadata: { [key: string]: SafePaymentEvidenceValue };
}

export class ProviderEventCanonicalizationError extends Error {
  constructor(
    readonly code: 'PROVIDER_TRANSACTION_REF_REQUIRED' | 'PROVIDER_EVENT_ID_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderEventCanonicalizationError';
  }
}

export function canonicalizeProviderEvent(input: CanonicalProviderEventInput): CanonicalizedProviderEvent {
  const providerTransactionRef = input.providerTransactionRef.trim();
  if (!providerTransactionRef) {
    throw new ProviderEventCanonicalizationError(
      'PROVIDER_TRANSACTION_REF_REQUIRED',
      'Provider transaction reference is required for canonical payment evidence.',
    );
  }

  const explicitEventId = input.providerEventId?.trim();
  if (input.providerEventId !== undefined && !explicitEventId) {
    throw new ProviderEventCanonicalizationError(
      'PROVIDER_EVENT_ID_INVALID',
      'Provider event ID must not be blank when supplied.',
    );
  }

  const safeMetadata = sanitizePaymentEvidenceMetadata(input.metadata);
  const canonicalEvidence = {
    provider: input.provider,
    source: input.source,
    providerTransactionRef,
    status: input.status,
    safeMetadata,
    occurredAt: input.occurredAt?.toISOString() ?? null,
  };
  const payloadHash = requestHash(canonicalEvidence);
  const providerEventIdentity = explicitEventId
    ? `${input.provider}:EVENT:${explicitEventId}`
    : `${input.provider}:HASH:${payloadHash}`;

  return {
    provider: input.provider,
    source: input.source,
    providerEventIdentity,
    providerTransactionRef,
    status: input.status,
    payloadHash,
    safeMetadata,
    occurredAt: input.occurredAt,
  };
}
