/** Shared contracts only. Verification brands do not replace adapter verification. */
export type Id = string;
export type Timestamp = string;
export type Money = Readonly<{ amount: string; currency: string }>;
export type CommandContext = Readonly<{
  commandId: Id; idempotencyKey: string; correlationId: Id;
  actorRef: string; configVersion: string; requestedAt: Timestamp;
}>;
export type SafeEvidenceRef = Readonly<{
  evidenceId: Id; digest: string; schemaVersion: number;
  privateObjectRef?: string; // Sanitized allowlisted evidence, never secret/card data.
}>;
export type ProviderFailure = Readonly<{
  kind: 'FAILURE'; code: string;
  retryDisposition: 'RETRY_SAME_KEY' | 'RECONCILE_BEFORE_RETRY' | 'MANUAL_REVIEW' | 'PERMANENT';
  evidence?: SafeEvidenceRef;
}>;
export type ProviderResult<T> = Readonly<{ kind: 'SUCCESS'; value: T }> | ProviderFailure;
export type ProviderContext = Readonly<{
  connectionId: Id; environment: 'SANDBOX' | 'PRODUCTION';
  configVersion: string; secretReference: string;
}>;
// Raw bytes exist transiently ONLY at ingress/verifier; not in DB, log, domain event.
export type UntrustedWebhook = Readonly<{
  rawBody: Uint8Array; headers: Readonly<Record<string, string>>; receivedAt: Timestamp;
}>;
declare const verified: unique symbol;
export type Verified<T> = Readonly<{
  [verified]: true; fact: T; evidence: SafeEvidenceRef; verifiedAt: Timestamp;
  connectionId: Id; verificationConfigVersion: string;
}>;
export type Verification<T> = Readonly<{ kind: 'VERIFIED'; value: Verified<T> }>
  | Readonly<{ kind: 'REJECTED'; code: string }>;
export type EventEnvelope<T> = Readonly<{
  eventId: Id; schemaVersion: number; occurredAt: Timestamp;
  aggregateType: string; aggregateId: Id; correlationId: Id;
  source: string; actorRef: string; payload: T;
}>;
