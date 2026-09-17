import { createHash } from 'node:crypto';

export type ProviderWebhookVerificationEvidence = Readonly<{
  verdict: 'VERIFIED' | 'REJECTED';
  providerEventIdentity: string;
  payloadHash: string;
  signatureTimestamp: string;
  verifiedAt: string;
  safeEvidenceRef: string;
  verificationConfigVersion: string;
}>;

export type PersistedWebhookVerification = Readonly<{
  providerEventIdentity: string;
  payloadHash: string;
  verificationEvidenceHash: string;
  safeEvidenceRef: string;
  verificationConfigVersion: string;
  verifiedAt: string;
}>;

export type ProviderWebhookVerificationDecision = Readonly<{
  action: 'ACCEPT' | 'NOOP_REPLAY';
  providerEventIdentity: string;
  payloadHash: string;
  verificationEvidenceHash: string;
}>;

export class ProviderWebhookVerificationDecisionError extends Error {
  constructor(
    readonly code:
      | 'PROVIDER_WEBHOOK_VERIFICATION_REJECTED'
      | 'PROVIDER_WEBHOOK_EVIDENCE_INCOMPLETE'
      | 'PROVIDER_WEBHOOK_TIMESTAMP_INVALID'
      | 'PROVIDER_WEBHOOK_TIMESTAMP_EXPIRED'
      | 'PROVIDER_WEBHOOK_TIMESTAMP_IN_FUTURE'
      | 'PROVIDER_WEBHOOK_REPLAY_CONFLICT'
      | 'PROVIDER_WEBHOOK_REPLAY_EVIDENCE_INCOMPLETE',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderWebhookVerificationDecisionError';
  }
}

/** Provider-neutral boundary after an official adapter has verified a callback.
 * It does not define signature canonicalization, cryptography or callback ACKs.
 * Callers must persist accepted evidence atomically before applying domain effects. */
export function decideProviderWebhookVerification(input: Readonly<{
  evidence: ProviderWebhookVerificationEvidence;
  receivedAt: string;
  evaluatedAt: string;
  maxSignatureAgeSeconds: number;
  maxFutureSkewSeconds: number;
  existing: PersistedWebhookVerification | null;
}>): ProviderWebhookVerificationDecision {
  const evidence = canonicalEvidence(input.evidence);
  if (evidence.verdict !== 'VERIFIED') {
    throw new ProviderWebhookVerificationDecisionError(
      'PROVIDER_WEBHOOK_VERIFICATION_REJECTED',
      'The provider adapter did not verify the webhook signature.',
    );
  }

  const verificationEvidenceHash = hashProviderWebhookVerificationEvidence(evidence);
  if (input.existing !== null) {
    assertPersistedEvidence(input.existing);
    if (input.existing.providerEventIdentity !== evidence.providerEventIdentity
      || input.existing.payloadHash !== evidence.payloadHash
      || input.existing.safeEvidenceRef !== evidence.safeEvidenceRef
      || input.existing.verificationConfigVersion !== evidence.verificationConfigVersion
      || input.existing.verifiedAt !== evidence.verifiedAt
      || input.existing.verificationEvidenceHash !== verificationEvidenceHash) {
      throw new ProviderWebhookVerificationDecisionError(
        'PROVIDER_WEBHOOK_REPLAY_CONFLICT',
        'The provider event identity is already bound to different payload or verification evidence.',
      );
    }
    // An exact replay is already durably bound to the original verified evidence.
    // It remains an idempotent no-op even when redelivered after the live
    // signature-acceptance window; no domain effect is applied again.
    return Object.freeze({ action: 'NOOP_REPLAY', providerEventIdentity: evidence.providerEventIdentity,
      payloadHash: evidence.payloadHash, verificationEvidenceHash });
  }

  const signatureTime = parseTime(evidence.signatureTimestamp);
  const receivedTime = parseTime(input.receivedAt);
  const evaluatedTime = parseTime(input.evaluatedAt);
  assertWindow(input.maxSignatureAgeSeconds, input.maxFutureSkewSeconds);
  const maxAgeMs = input.maxSignatureAgeSeconds * 1000;
  const maxFutureMs = input.maxFutureSkewSeconds * 1000;
  if (signatureTime > receivedTime + maxFutureMs || signatureTime > evaluatedTime + maxFutureMs) {
    throw new ProviderWebhookVerificationDecisionError(
      'PROVIDER_WEBHOOK_TIMESTAMP_IN_FUTURE',
      'The signed timestamp exceeds the configured future clock skew.',
    );
  }
  if (receivedTime - signatureTime > maxAgeMs || evaluatedTime - signatureTime > maxAgeMs) {
    throw new ProviderWebhookVerificationDecisionError(
      'PROVIDER_WEBHOOK_TIMESTAMP_EXPIRED',
      'The signed timestamp is outside the configured acceptance window.',
    );
  }

  return Object.freeze({ action: 'ACCEPT', providerEventIdentity: evidence.providerEventIdentity,
    payloadHash: evidence.payloadHash, verificationEvidenceHash });
}

/** Produces the provider-neutral audit digest for complete adapter evidence.
 * This deliberately does not verify a provider signature. */
export function hashProviderWebhookVerificationEvidence(
  value: ProviderWebhookVerificationEvidence,
): string {
  return sha256(stableJson(canonicalEvidence(value)));
}

function canonicalEvidence(evidence: ProviderWebhookVerificationEvidence): ProviderWebhookVerificationEvidence {
  if (!evidence || !['VERIFIED', 'REJECTED'].includes(evidence.verdict)) incomplete();
  return Object.freeze({
    verdict: evidence.verdict,
    providerEventIdentity: required(evidence.providerEventIdentity),
    payloadHash: digest(evidence.payloadHash),
    signatureTimestamp: isoTime(evidence.signatureTimestamp),
    verifiedAt: isoTime(evidence.verifiedAt),
    safeEvidenceRef: required(evidence.safeEvidenceRef),
    verificationConfigVersion: required(evidence.verificationConfigVersion),
  });
}

function assertPersistedEvidence(value: PersistedWebhookVerification): void {
  if (!value || !isRequired(value.providerEventIdentity) || !isDigest(value.payloadHash)
    || !isDigest(value.verificationEvidenceHash) || !isRequired(value.safeEvidenceRef)
    || !isRequired(value.verificationConfigVersion) || !isCanonicalTime(value.verifiedAt)) {
    throw new ProviderWebhookVerificationDecisionError(
      'PROVIDER_WEBHOOK_REPLAY_EVIDENCE_INCOMPLETE',
      'Persisted webhook replay evidence is incomplete.',
    );
  }
}

function isRequired(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && value === value.trim();
}

function isDigest(value: unknown): value is string {
  return typeof value === 'string' && /^[a-f0-9]{64}$/.test(value);
}

function isCanonicalTime(value: unknown): value is string {
  return typeof value === 'string'
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)
    && Number.isFinite(Date.parse(value));
}

function assertWindow(maxAge: number, maxFuture: number): void {
  if (!Number.isSafeInteger(maxAge) || maxAge < 0 || !Number.isSafeInteger(maxFuture) || maxFuture < 0) {
    throw new ProviderWebhookVerificationDecisionError(
      'PROVIDER_WEBHOOK_EVIDENCE_INCOMPLETE',
      'Webhook verification time-window configuration is invalid.',
    );
  }
}

function required(value: string): string {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()) incomplete();
  return value;
}

function digest(value: string): string {
  if (typeof value !== 'string' || !/^[a-f0-9]{64}$/.test(value)) incomplete();
  return value;
}

function isoTime(value: string): string {
  parseTime(value);
  return value;
}

function parseTime(value: string): number {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value)) {
    throw new ProviderWebhookVerificationDecisionError(
      'PROVIDER_WEBHOOK_TIMESTAMP_INVALID',
      'Webhook verification timestamps must be canonical UTC ISO-8601 values.',
    );
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    throw new ProviderWebhookVerificationDecisionError('PROVIDER_WEBHOOK_TIMESTAMP_INVALID', 'Webhook timestamp is invalid.');
  }
  return parsed;
}

function incomplete(): never {
  throw new ProviderWebhookVerificationDecisionError(
    'PROVIDER_WEBHOOK_EVIDENCE_INCOMPLETE',
    'Webhook verification evidence is incomplete or invalid.',
  );
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableJson(entry)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}
