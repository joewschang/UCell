import { Injectable } from '@nestjs/common';
import { Prisma, PrismaService } from '@ucell/database';
import {
  decideProviderWorkerOutcome,
  type ProviderWorkerOutcome,
  type ProviderWorkerOutcomeDecision,
} from './provider-worker-outcome-decision';

export type ProviderWebhookWorkerLease = Readonly<{
  providerWebhookInboxId: string;
  domain: 'PAYMENT' | 'INVOICE' | 'LOGISTICS';
  provider: string;
  connectionId: string;
  providerEventIdentity: string | null;
  payloadHash: string;
  safeEvidenceRef: string;
  correlationId: string;
  attemptCount: number;
  leaseOwner: string;
  leaseExpiresAt: Date;
}>;

export type ClaimProviderWebhookBatchInput = Readonly<{
  leaseOwner: string;
  now?: Date;
  leaseMs?: number;
  limit?: number;
}>;

export type ScheduleProviderWebhookRetryInput = Readonly<{
  providerWebhookInboxId: string;
  leaseOwner: string;
  attemptCount: number;
  nextAttemptAt: Date;
  errorCode: string;
  now?: Date;
}>;

export type FinalizeProviderWebhookOutcomeInput = Readonly<{
  providerWebhookInboxId: string;
  leaseOwner: string;
  attemptCount: number;
  outcome: ProviderWorkerOutcome;
  maxAttempts: number;
  retryBackoffSeconds: readonly number[];
  evaluatedAt: string;
}>;

export type FinalizeProviderWebhookOutcomeResult = Readonly<{
  finalized: boolean;
  decision: ProviderWorkerOutcomeDecision;
}>;

type ClaimedRow = Omit<ProviderWebhookWorkerLease, 'leaseExpiresAt'> & { leaseExpiresAt: Date };

/**
 * Provider-neutral worker ownership only. It deliberately does not acknowledge a
 * provider callback, map a provider status, or apply any domain/monetary effect.
 */
@Injectable()
export class ProviderWebhookWorkerLeaseService {
  constructor(private readonly db: PrismaService) {}

  async claimBatch(input: ClaimProviderWebhookBatchInput): Promise<readonly ProviderWebhookWorkerLease[]> {
    const leaseOwner = assertLeaseOwner(input.leaseOwner);
    const now = assertDate(input.now ?? new Date(), 'NOW');
    const leaseMs = assertIntegerInRange(input.leaseMs ?? 120_000, 1_000, 15 * 60_000, 'LEASE_MS');
    const limit = assertIntegerInRange(input.limit ?? 20, 1, 100, 'LIMIT');
    const leaseExpiresAt = new Date(now.getTime() + leaseMs);

    return this.db.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ClaimedRow[]>(Prisma.sql`
        WITH candidates AS (
          SELECT provider_webhook_inbox_id
          FROM commerce.provider_webhook_inbox
          WHERE
            status = 'VERIFIED'::commerce."ProviderWebhookStatus"
            OR (
              status = 'RETRY_PENDING'::commerce."ProviderWebhookStatus"
              AND (next_attempt_at IS NULL OR next_attempt_at <= ${now})
            )
            OR (
              status = 'PROCESSING'::commerce."ProviderWebhookStatus"
              AND lease_expires_at IS NOT NULL
              AND lease_expires_at <= ${now}
            )
          ORDER BY COALESCE(next_attempt_at, received_at), received_at, provider_webhook_inbox_id
          FOR UPDATE SKIP LOCKED
          LIMIT ${limit}
        )
        UPDATE commerce.provider_webhook_inbox AS inbox
        SET status = 'PROCESSING'::commerce."ProviderWebhookStatus",
            attempt_count = inbox.attempt_count + 1,
            lease_owner = ${leaseOwner},
            lease_expires_at = ${leaseExpiresAt},
            next_attempt_at = NULL
        FROM candidates
        WHERE inbox.provider_webhook_inbox_id = candidates.provider_webhook_inbox_id
        RETURNING
          inbox.provider_webhook_inbox_id AS "providerWebhookInboxId",
          inbox.domain::text AS domain,
          inbox.provider,
          inbox.connection_id AS "connectionId",
          inbox.provider_event_identity AS "providerEventIdentity",
          inbox.payload_hash AS "payloadHash",
          inbox.safe_evidence_ref AS "safeEvidenceRef",
          inbox.correlation_id::text AS "correlationId",
          inbox.attempt_count AS "attemptCount",
          inbox.lease_owner AS "leaseOwner",
          inbox.lease_expires_at AS "leaseExpiresAt"
      `);
      return rows.map((row) => Object.freeze(row));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async scheduleRetry(input: ScheduleProviderWebhookRetryInput): Promise<boolean> {
    const providerWebhookInboxId = assertUuid(input.providerWebhookInboxId);
    const leaseOwner = assertLeaseOwner(input.leaseOwner);
    const attemptCount = assertIntegerInRange(input.attemptCount, 1, 2_147_483_647, 'ATTEMPT_COUNT');
    const now = assertDate(input.now ?? new Date(), 'NOW');
    const nextAttemptAt = assertDate(input.nextAttemptAt, 'NEXT_ATTEMPT_AT');
    const errorCode = assertErrorCode(input.errorCode);
    if (nextAttemptAt <= now) throw new Error('PROVIDER_WEBHOOK_NEXT_ATTEMPT_AT_INVALID');

    return this.db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT set_config('ucell.provider_webhook_lease_owner', ${leaseOwner}, true)`);
      const changed = await tx.$executeRaw(Prisma.sql`
        UPDATE commerce.provider_webhook_inbox
        SET status = 'RETRY_PENDING'::commerce."ProviderWebhookStatus",
            lease_owner = NULL,
            lease_expires_at = NULL,
            next_attempt_at = ${nextAttemptAt},
            last_error_code = ${errorCode}
        WHERE provider_webhook_inbox_id = ${providerWebhookInboxId}::uuid
          AND status = 'PROCESSING'::commerce."ProviderWebhookStatus"
          AND lease_owner = ${leaseOwner}
          AND attempt_count = ${attemptCount}
          AND lease_expires_at > clock_timestamp()
      `);
      return changed === 1;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
  }

  async finalizeOutcome(input: FinalizeProviderWebhookOutcomeInput): Promise<FinalizeProviderWebhookOutcomeResult> {
    const providerWebhookInboxId = assertUuid(input.providerWebhookInboxId);
    const leaseOwner = assertLeaseOwner(input.leaseOwner);
    const decision = decideProviderWorkerOutcome({
      outcome: input.outcome,
      attemptCount: input.attemptCount,
      maxAttempts: input.maxAttempts,
      retryBackoffSeconds: input.retryBackoffSeconds,
      evaluatedAt: input.evaluatedAt,
    });
    const evaluatedAt = new Date(input.evaluatedAt);
    const nextAttemptAt = decision.nextAttemptAt === null ? null : new Date(decision.nextAttemptAt);
    const processedAt = decision.status === 'PROCESSED' ? evaluatedAt : null;
    const lastErrorCode = decision.status === 'PROCESSED' ? null : decision.reasonCode;

    const finalized = await this.db.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`SELECT set_config('ucell.provider_webhook_lease_owner', ${leaseOwner}, true)`);
      const changed = await tx.$executeRaw(Prisma.sql`
        UPDATE commerce.provider_webhook_inbox
        SET status = ${decision.status}::commerce."ProviderWebhookStatus",
            lease_owner = NULL,
            lease_expires_at = NULL,
            processed_at = ${processedAt},
            next_attempt_at = ${nextAttemptAt},
            last_error_code = ${lastErrorCode}
        WHERE provider_webhook_inbox_id = ${providerWebhookInboxId}::uuid
          AND status = 'PROCESSING'::commerce."ProviderWebhookStatus"
          AND lease_owner = ${leaseOwner}
          AND attempt_count = ${input.attemptCount}
          AND lease_expires_at > clock_timestamp()
      `);
      return changed === 1;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });

    return Object.freeze({ finalized, decision });
  }
}

function assertLeaseOwner(value: string): string {
  if (typeof value !== 'string' || value !== value.trim() || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) {
    throw new Error('PROVIDER_WEBHOOK_LEASE_OWNER_INVALID');
  }
  return value;
}

function assertUuid(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new Error('PROVIDER_WEBHOOK_INBOX_ID_INVALID');
  }
  return value;
}

function assertDate(value: Date, field: string): Date {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) throw new Error(`PROVIDER_WEBHOOK_${field}_INVALID`);
  return value;
}

function assertIntegerInRange(value: number, min: number, max: number, field: string): number {
  if (!Number.isSafeInteger(value) || value < min || value > max) throw new Error(`PROVIDER_WEBHOOK_${field}_INVALID`);
  return value;
}

function assertErrorCode(value: string): string {
  if (typeof value !== 'string' || value !== value.trim() || !/^[A-Z][A-Z0-9_]{0,127}$/.test(value)) {
    throw new Error('PROVIDER_WEBHOOK_ERROR_CODE_INVALID');
  }
  return value;
}
