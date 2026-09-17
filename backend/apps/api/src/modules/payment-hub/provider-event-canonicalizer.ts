import { requestHash } from '../../common/utils/hash';
import { projectCanonicalPaymentMetadata } from './payment-evidence-sanitizer';
import { CanonicalPaymentStatus, PaymentProvider, VerifiedProviderEvent, VerifiedPaymentSource, PAYMENT_PROVIDERS, PAYMENT_STATUSES, VERIFIED_PAYMENT_SOURCES } from './payment-provider.adapter';

export interface CanonicalProviderEventInput {
  provider: PaymentProvider;
  source: VerifiedPaymentSource;
  providerEventId?: string;
  providerTransactionRef: string;
  status: CanonicalPaymentStatus;
  metadata: Readonly<Record<string, unknown>>;
  occurredAt?: Date;
}

export interface CanonicalizedProviderEvent extends VerifiedProviderEvent {
  source: CanonicalProviderEventInput['source'];
  safeMetadata: Readonly<Record<string, string>>;
}

export class ProviderEventCanonicalizationError extends Error {
  constructor(
    readonly code: 'PROVIDER_TRANSACTION_REF_REQUIRED' | 'PROVIDER_EVENT_ID_INVALID' | 'PROVIDER_EVENT_INPUT_INVALID',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderEventCanonicalizationError';
  }
}

export function canonicalizeProviderEvent(input: CanonicalProviderEventInput): CanonicalizedProviderEvent {
  if (!input || !PAYMENT_PROVIDERS.includes(input.provider) || !PAYMENT_STATUSES.includes(input.status)
    || !(VERIFIED_PAYMENT_SOURCES as readonly string[]).includes(input.source)
    || (input.occurredAt !== undefined && (!(input.occurredAt instanceof Date) || !Number.isFinite(input.occurredAt.getTime())))) {
    throw new ProviderEventCanonicalizationError('PROVIDER_EVENT_INPUT_INVALID', 'Unsupported provider event input.');
  }
  if (typeof input.providerTransactionRef !== 'string') throw new ProviderEventCanonicalizationError('PROVIDER_TRANSACTION_REF_REQUIRED', 'Transaction reference required.');
  if (input.providerEventId !== undefined && typeof input.providerEventId !== 'string') throw new ProviderEventCanonicalizationError('PROVIDER_EVENT_ID_INVALID', 'Invalid event ID.');
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

  const safeMetadata = projectCanonicalPaymentMetadata(input.metadata);
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

  return Object.freeze({
    provider: input.provider,
    source: input.source,
    providerEventIdentity,
    providerTransactionRef,
    status: input.status,
    payloadHash,
    safeMetadata,
    occurredAt: canonicalEvidence.occurredAt ?? undefined,
  });
}
