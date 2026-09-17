import { Injectable } from '@nestjs/common';
import { PrismaService } from '@ucell/database';
import { requestHash } from '../../common/utils/hash';

export type ReconciliationDomain = 'PAYMENT' | 'INVOICE' | 'LOGISTICS';
export type ReconciliationResult = Readonly<{
  status: 'MATCHED' | 'DISCREPANCY' | 'FAILED';
  providerRecordCount: number;
  internalRecordCount: number;
  discrepancyCount: number;
}>;
export type ReconciliationEvidence = Readonly<{
  safeEvidenceRef: string;
  verificationConfigVersion: string;
  providerConnectionVersionId: string;
}>;
export type IngestProviderReconciliationInput = Readonly<{
  domain: ReconciliationDomain;
  provider: string;
  connectionId: string;
  runKey: string;
  providerBatchRef?: string;
  periodStart: Date;
  periodEnd: Date;
  result: ReconciliationResult;
  evidence: ReconciliationEvidence;
  completedAt: Date;
  correlationId: string;
}>;

export type ReconciliationHashes = Readonly<{
  inputHash: string;
  outputHash: string;
  evidenceHash: string;
}>;

export class ProviderReconciliationIngestionError extends Error {
  constructor(readonly code: 'RECONCILIATION_EVIDENCE_INCOMPLETE' | 'RECONCILIATION_INPUT_INVALID'
    | 'RECONCILIATION_RUN_CONFLICT', message: string) {
    super(message);
    this.name = 'ProviderReconciliationIngestionError';
  }
}

/** Hashes provider-neutral facts only. Provider status or field mapping must be
 * completed by a verified adapter before this boundary is called. */
export function deriveReconciliationHashes(input: IngestProviderReconciliationInput): ReconciliationHashes {
  assertComplete(input);
  const inputHash = requestHash({
    domain: input.domain,
    provider: input.provider,
    connectionId: input.connectionId,
    runKey: input.runKey,
    providerBatchRef: input.providerBatchRef ?? null,
    periodStart: input.periodStart.toISOString(),
    periodEnd: input.periodEnd.toISOString(),
    safeEvidenceRef: input.evidence.safeEvidenceRef,
    verificationConfigVersion: input.evidence.verificationConfigVersion,
    providerConnectionVersionId: input.evidence.providerConnectionVersionId,
  });
  const outputHash = requestHash({
    status: input.result.status,
    providerRecordCount: input.result.providerRecordCount,
    internalRecordCount: input.result.internalRecordCount,
    discrepancyCount: input.result.discrepancyCount,
    completedAt: input.completedAt.toISOString(),
  });
  return Object.freeze({ inputHash, outputHash, evidenceHash: requestHash({ inputHash, outputHash }) });
}

type StoredRun = Readonly<{
  providerReconciliationRunId: string;
  evidenceHash: string | null;
  status: string;
}>;
type ReconciliationRunStore = Readonly<{
  findUnique(args: unknown): Promise<StoredRun | null>;
  create(args: unknown): Promise<StoredRun>;
}>;

/** Evidence ingestion only: its deliberately narrow store has no monetary aggregate API. */
@Injectable()
export class ProviderReconciliationIngestionService {
  private readonly runs: ReconciliationRunStore;
  constructor(db: PrismaService) { this.runs = db.providerReconciliationRun as unknown as ReconciliationRunStore; }

  async ingest(input: IngestProviderReconciliationInput) {
    const hashes = deriveReconciliationHashes(input);
    const where = { domain_provider_connectionId_runKey: {
      domain: input.domain, provider: input.provider, connectionId: input.connectionId, runKey: input.runKey,
    } };
    const existing = await this.runs.findUnique({ where, select: selection });
    if (existing) return replayOrConflict(existing, hashes);
    try {
      const run = await this.runs.create({
        data: {
          domain: input.domain,
          provider: input.provider,
          connectionId: input.connectionId,
          runKey: input.runKey,
          providerBatchRef: input.providerBatchRef ?? null,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          status: input.result.status,
          providerRecordCount: input.result.providerRecordCount,
          internalRecordCount: input.result.internalRecordCount,
          discrepancyCount: input.result.discrepancyCount,
          evidenceHash: hashes.evidenceHash,
          safeEvidenceRef: input.evidence.safeEvidenceRef,
          verificationConfigVersion: input.evidence.verificationConfigVersion,
          providerConnectionVersionId: input.evidence.providerConnectionVersionId,
          completedAt: input.completedAt,
          correlationId: input.correlationId,
        },
        select: selection,
      });
      return Object.freeze({ action: 'CREATED' as const, run, ...hashes });
    } catch (error) {
      // A concurrent insert can win the schema unique key. Re-read and apply the
      // same hash decision; never turn uniqueness into a second side effect.
      if (!isUniqueConflict(error)) throw error;
      const winner = await this.runs.findUnique({ where, select: selection });
      if (!winner) throw error;
      return replayOrConflict(winner, hashes);
    }
  }
}

const selection = { providerReconciliationRunId: true, evidenceHash: true, status: true };

function replayOrConflict(existing: StoredRun, hashes: ReconciliationHashes) {
  if (!existing.evidenceHash) {
    throw new ProviderReconciliationIngestionError('RECONCILIATION_EVIDENCE_INCOMPLETE', 'Existing run has no complete evidence hash.');
  }
  if (existing.evidenceHash !== hashes.evidenceHash) {
    throw new ProviderReconciliationIngestionError('RECONCILIATION_RUN_CONFLICT', 'Run identity was reused with changed input or output evidence.');
  }
  return Object.freeze({ action: 'REPLAY' as const, run: existing, ...hashes });
}

function assertComplete(input: IngestProviderReconciliationInput): void {
  const tokens: Array<[unknown, string]> = [
    [input.provider, 'provider'], [input.connectionId, 'connectionId'], [input.runKey, 'runKey'],
    [input.evidence?.safeEvidenceRef, 'safeEvidenceRef'],
    [input.evidence?.verificationConfigVersion, 'verificationConfigVersion'],
    [input.evidence?.providerConnectionVersionId, 'providerConnectionVersionId'],
    [input.correlationId, 'correlationId'],
  ];
  if (tokens.some(([value]) => typeof value !== 'string' || !value.trim() || value !== value.trim())) {
    throw new ProviderReconciliationIngestionError('RECONCILIATION_EVIDENCE_INCOMPLETE', 'Complete, trimmed evidence identity is required.');
  }
  if (!(input.periodStart instanceof Date) || !Number.isFinite(input.periodStart.getTime())
    || !(input.periodEnd instanceof Date) || !Number.isFinite(input.periodEnd.getTime())
    || input.periodStart >= input.periodEnd
    || !(input.completedAt instanceof Date) || !Number.isFinite(input.completedAt.getTime())) {
    throw new ProviderReconciliationIngestionError('RECONCILIATION_INPUT_INVALID', 'Valid period and completion timestamps are required.');
  }
  const counts = [input.result?.providerRecordCount, input.result?.internalRecordCount, input.result?.discrepancyCount];
  if (counts.some(value => !Number.isSafeInteger(value) || (value as number) < 0)) {
    throw new ProviderReconciliationIngestionError('RECONCILIATION_INPUT_INVALID', 'Counts must be non-negative safe integers.');
  }
  if (!['MATCHED', 'DISCREPANCY', 'FAILED'].includes(input.result?.status)) {
    throw new ProviderReconciliationIngestionError('RECONCILIATION_INPUT_INVALID', 'A terminal reconciliation result is required.');
  }
  if (input.result.status === 'MATCHED' && input.result.discrepancyCount !== 0) {
    throw new ProviderReconciliationIngestionError('RECONCILIATION_INPUT_INVALID', 'MATCHED cannot contain discrepancies.');
  }
  if (input.result.status === 'DISCREPANCY' && input.result.discrepancyCount === 0) {
    throw new ProviderReconciliationIngestionError('RECONCILIATION_INPUT_INVALID', 'DISCREPANCY requires at least one discrepancy.');
  }
}

function isUniqueConflict(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'code' in error && (error as { code?: unknown }).code === 'P2002';
}
