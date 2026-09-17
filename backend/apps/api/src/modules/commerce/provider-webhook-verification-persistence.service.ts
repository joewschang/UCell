import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import {
  decideProviderWebhookVerification,
  hashProviderWebhookVerificationEvidence,
  ProviderWebhookVerificationDecisionError,
  type PersistedWebhookVerification,
  type ProviderWebhookVerificationEvidence,
} from './provider-webhook-verification-decision';

export type PersistProviderWebhookVerificationInput = Readonly<{
  providerWebhookInboxId: string;
  evidence: ProviderWebhookVerificationEvidence;
  evaluatedAt: string;
  maxSignatureAgeSeconds: number;
  maxFutureSkewSeconds: number;
}>;

export class ProviderWebhookVerificationPersistenceError extends Error {
  constructor(
    readonly code:
      | 'PROVIDER_WEBHOOK_INBOX_NOT_FOUND'
      | 'PROVIDER_WEBHOOK_INGRESS_EVIDENCE_CONFLICT'
      | 'PROVIDER_WEBHOOK_REPLAY_CONFLICT'
      | 'PROVIDER_WEBHOOK_STATUS_CONFLICT',
    message: string,
  ) {
    super(message);
    this.name = 'ProviderWebhookVerificationPersistenceError';
  }
}

/** Atomically binds provider-neutral adapter evidence to a durable inbox row.
 * Provider signature algorithms, callback acknowledgements and domain effects
 * intentionally remain outside this application service. */
@Injectable()
export class ProviderWebhookVerificationPersistenceService {
  constructor(private readonly db: PrismaService) {}

  async persist(input: PersistProviderWebhookVerificationInput) {
    assertUuid(input.providerWebhookInboxId);
    return this.db.$transaction(async (tx) => {
      const inbox = await (tx.providerWebhookInbox as any).findUnique({
        where: { providerWebhookInboxId: input.providerWebhookInboxId },
        select: {
          providerWebhookInboxId: true,
          payloadHash: true,
          safeEvidenceRef: true,
          verificationConfigVersion: true,
          providerEventIdentity: true,
          verificationEvidenceHash: true,
          signatureTimestamp: true,
          verifiedAt: true,
          receivedAt: true,
          status: true,
        },
      });
      if (!inbox) {
        throw new ProviderWebhookVerificationPersistenceError(
          'PROVIDER_WEBHOOK_INBOX_NOT_FOUND',
          'Provider webhook inbox row was not found.',
        );
      }
      const evidenceHash = hashProviderWebhookVerificationEvidence(input.evidence);
      if (inbox.status === 'REJECTED') {
        assertExactTerminalEvidence(inbox, input.evidence, evidenceHash, false);
        return result(inbox.providerWebhookInboxId, 'NOOP_REPLAY', 'REJECTED', evidenceHash);
      }

      if (inbox.status === 'RECEIVED') assertIngressEvidence(inbox, input.evidence);

      const existing = inbox.status === 'RECEIVED' ? null : persistedEvidence(inbox);
      const decision = decideProviderWebhookVerification({
        evidence: input.evidence,
        receivedAt: inbox.receivedAt.toISOString(),
        evaluatedAt: input.evaluatedAt,
        maxSignatureAgeSeconds: input.maxSignatureAgeSeconds,
        maxFutureSkewSeconds: input.maxFutureSkewSeconds,
        existing,
      });
      if (decision.action === 'NOOP_REPLAY') {
        return result(inbox.providerWebhookInboxId, decision.action, 'VERIFIED', evidenceHash);
      }

      const updated = await (tx.providerWebhookInbox as any).updateMany({
        where: { providerWebhookInboxId: inbox.providerWebhookInboxId, status: 'RECEIVED' },
        data: {
          status: 'VERIFIED',
          providerEventIdentity: input.evidence.providerEventIdentity,
          verificationEvidenceHash: evidenceHash,
          signatureTimestamp: new Date(input.evidence.signatureTimestamp),
          verifiedAt: new Date(input.evidence.verifiedAt),
          lastErrorCode: null,
        },
      });
      if (updated.count !== 1) statusConflict();
      return result(inbox.providerWebhookInboxId, 'ACCEPT', 'VERIFIED', evidenceHash);
    }).catch((error) => {
      if (input.evidence?.verdict === 'REJECTED'
        && error instanceof ProviderWebhookVerificationDecisionError
        && error.code === 'PROVIDER_WEBHOOK_VERIFICATION_REJECTED') {
        return this.persistRejection(input);
      }
      if (isUniqueConflict(error)) replayConflict();
      throw error;
    });
  }

  private async persistRejection(input: PersistProviderWebhookVerificationInput) {
    const evidenceHash = hashProviderWebhookVerificationEvidence(input.evidence);
    return this.db.$transaction(async (tx) => {
      const inbox = await (tx.providerWebhookInbox as any).findUnique({
        where: { providerWebhookInboxId: input.providerWebhookInboxId },
        select: {
          providerWebhookInboxId: true, payloadHash: true, safeEvidenceRef: true,
          verificationConfigVersion: true, providerEventIdentity: true,
          verificationEvidenceHash: true, signatureTimestamp: true, verifiedAt: true, status: true,
        },
      });
      if (!inbox) throw new ProviderWebhookVerificationPersistenceError(
        'PROVIDER_WEBHOOK_INBOX_NOT_FOUND', 'Provider webhook inbox row was not found.',
      );
      if (inbox.status === 'REJECTED') {
        assertExactTerminalEvidence(inbox, input.evidence, evidenceHash, false);
        return result(inbox.providerWebhookInboxId, 'NOOP_REPLAY', 'REJECTED', evidenceHash);
      }
      if (inbox.status !== 'RECEIVED') replayConflict();
      assertIngressEvidence(inbox, input.evidence);
      const updated = await (tx.providerWebhookInbox as any).updateMany({
        where: { providerWebhookInboxId: inbox.providerWebhookInboxId, status: 'RECEIVED' },
        data: {
          status: 'REJECTED', providerEventIdentity: null,
          verificationEvidenceHash: evidenceHash,
          signatureTimestamp: new Date(input.evidence.signatureTimestamp),
          verifiedAt: new Date(input.evidence.verifiedAt),
          lastErrorCode: 'PROVIDER_WEBHOOK_VERIFICATION_REJECTED',
        },
      });
      if (updated.count !== 1) statusConflict();
      return result(inbox.providerWebhookInboxId, 'REJECT', 'REJECTED', evidenceHash);
    }).catch((error) => {
      if (isUniqueConflict(error)) replayConflict();
      throw error;
    });
  }
}

function assertIngressEvidence(inbox: any, evidence: ProviderWebhookVerificationEvidence): void {
  if (inbox.payloadHash !== evidence.payloadHash || inbox.safeEvidenceRef !== evidence.safeEvidenceRef
    || inbox.verificationConfigVersion !== evidence.verificationConfigVersion) {
    throw new ProviderWebhookVerificationPersistenceError(
      'PROVIDER_WEBHOOK_INGRESS_EVIDENCE_CONFLICT',
      'Verification evidence does not match the durable ingress metadata.',
    );
  }
}

function persistedEvidence(inbox: any): PersistedWebhookVerification {
  if (!inbox.providerEventIdentity || !inbox.verificationEvidenceHash || !inbox.verifiedAt) {
    return { providerEventIdentity: '', payloadHash: inbox.payloadHash,
      verificationEvidenceHash: '', safeEvidenceRef: inbox.safeEvidenceRef,
      verificationConfigVersion: inbox.verificationConfigVersion, verifiedAt: '' };
  }
  return {
    providerEventIdentity: inbox.providerEventIdentity,
    payloadHash: inbox.payloadHash,
    verificationEvidenceHash: inbox.verificationEvidenceHash,
    safeEvidenceRef: inbox.safeEvidenceRef,
    verificationConfigVersion: inbox.verificationConfigVersion,
    verifiedAt: inbox.verifiedAt.toISOString(),
  };
}

function assertExactTerminalEvidence(
  inbox: any,
  evidence: ProviderWebhookVerificationEvidence,
  hash: string,
  requireCanonicalIdentity = true,
): void {
  if ((requireCanonicalIdentity && inbox.providerEventIdentity !== evidence.providerEventIdentity)
    || inbox.payloadHash !== evidence.payloadHash
    || inbox.safeEvidenceRef !== evidence.safeEvidenceRef
    || inbox.verificationConfigVersion !== evidence.verificationConfigVersion
    || inbox.verificationEvidenceHash !== hash
    || inbox.verifiedAt?.toISOString() !== evidence.verifiedAt
    || inbox.signatureTimestamp?.toISOString() !== evidence.signatureTimestamp) replayConflict();
}

function result(id: string, action: 'ACCEPT' | 'REJECT' | 'NOOP_REPLAY', status: 'VERIFIED' | 'REJECTED', hash: string) {
  return Object.freeze({ providerWebhookInboxId: id, action, status, verificationEvidenceHash: hash });
}

function assertUuid(value: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new ProviderWebhookVerificationPersistenceError('PROVIDER_WEBHOOK_INBOX_NOT_FOUND', 'Invalid inbox identifier.');
  }
}

function isUniqueConflict(error: any): boolean {
  return error?.code === 'P2002';
}

function replayConflict(): never {
  throw new ProviderWebhookVerificationPersistenceError(
    'PROVIDER_WEBHOOK_REPLAY_CONFLICT', 'Provider webhook identity is bound to different evidence.',
  );
}

function statusConflict(): never {
  throw new ProviderWebhookVerificationPersistenceError(
    'PROVIDER_WEBHOOK_STATUS_CONFLICT', 'Provider webhook status changed concurrently or is not verifiable.',
  );
}
