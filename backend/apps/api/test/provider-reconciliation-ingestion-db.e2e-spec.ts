import { randomUUID } from 'node:crypto';
import { PrismaService } from '@ucell/database';
import {
  deriveReconciliationHashes,
  IngestProviderReconciliationInput,
  ProviderReconciliationIngestionService,
} from '../src/modules/payment-hub/provider-reconciliation-ingestion';

const testDatabaseUrl = process.env.PROVIDER_RECONCILIATION_TEST_DATABASE_URL
  ?? process.env.PHASE2_TEST_DATABASE_URL
  ?? 'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public';
const parsedTestDatabaseUrl = new URL(testDatabaseUrl);
if (!['localhost', '127.0.0.1'].includes(parsedTestDatabaseUrl.hostname)
  || !parsedTestDatabaseUrl.pathname.slice(1).endsWith('_test')) {
  throw new Error('PROVIDER_RECONCILIATION_TEST_DATABASE_REQUIRED');
}
process.env.DATABASE_URL = testDatabaseUrl;

describe('Provider reconciliation ingestion PostgreSQL boundary', () => {
  const db = new PrismaService();
  const service = new ProviderReconciliationIngestionService(db);
  let providerConnectionVersionId: string;
  let connectionId: string;

  beforeAll(async () => {
    connectionId = `TEST_RECON_${randomUUID()}`;
    const connection = await db.providerConnection.create({ data: {
      domain: 'PAYMENT', provider: 'TEST_PROVIDER', connectionKey: connectionId, status: 'ACTIVE',
    } });
    const version = await db.providerConnectionVersion.create({ data: {
      providerConnectionId: connection.providerConnectionId,
      version: 1,
      environment: 'TEST',
      credentialSecretRef: 'test-only://provider-reconciliation/credential',
      webhookVerificationRef: 'test-only://provider-reconciliation/webhook',
      configHash: 'a'.repeat(64),
      effectiveFrom: new Date('2026-09-01T00:00:00.000Z'),
      approvalReference: 'TEST_ONLY_PROVIDER_RECONCILIATION',
      createdByActor: 'provider-reconciliation-db-test',
    } });
    providerConnectionVersionId = version.providerConnectionVersionId;
  });

  afterAll(async () => { await db.$disconnect(); });

  function input(runKey = randomUUID()): IngestProviderReconciliationInput {
    return {
      domain: 'PAYMENT',
      provider: 'TEST_PROVIDER',
      connectionId,
      runKey,
      providerBatchRef: `TEST_BATCH_${runKey}`,
      periodStart: new Date('2026-09-17T00:00:00.000Z'),
      periodEnd: new Date('2026-09-18T00:00:00.000Z'),
      result: { status: 'MATCHED', providerRecordCount: 7, internalRecordCount: 7, discrepancyCount: 0 },
      evidence: {
        safeEvidenceRef: `test-only://reconciliation/${runKey}`,
        verificationConfigVersion: 'TEST_ONLY_V1',
        providerConnectionVersionId,
      },
      completedAt: new Date('2026-09-18T00:01:00.000Z'),
      correlationId: randomUUID(),
    };
  }

  async function monetaryCounts() {
    const [payments, bonusAwards, recoveryApplications] = await Promise.all([
      db.payment.count(), db.bonusAward.count(), db.recoveryApplication.count(),
    ]);
    return { payments, bonusAwards, recoveryApplications };
  }

  it('persists complete deterministic evidence and exact replay creates no second row', async () => {
    const request = input();
    const expected = deriveReconciliationHashes(request);
    const monetaryBefore = await monetaryCounts();
    const first = await service.ingest(request);
    const replay = await service.ingest(request);

    expect(first.action).toBe('CREATED');
    expect(replay.action).toBe('REPLAY');
    expect(replay.run.providerReconciliationRunId).toBe(first.run.providerReconciliationRunId);
    expect(replay).toMatchObject(expected);

    const rows = await db.providerReconciliationRun.findMany({ where: {
      domain: request.domain, provider: request.provider, connectionId: request.connectionId, runKey: request.runKey,
    } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      providerBatchRef: request.providerBatchRef,
      status: request.result.status,
      providerRecordCount: 7,
      internalRecordCount: 7,
      discrepancyCount: 0,
      evidenceHash: expected.evidenceHash,
      safeEvidenceRef: request.evidence.safeEvidenceRef,
      verificationConfigVersion: request.evidence.verificationConfigVersion,
      providerConnectionVersionId,
      correlationId: request.correlationId,
    });
    expect(rows[0].periodStart.toISOString()).toBe(request.periodStart.toISOString());
    expect(rows[0].periodEnd.toISOString()).toBe(request.periodEnd.toISOString());
    expect(rows[0].completedAt?.toISOString()).toBe(request.completedAt.toISOString());
    expect(await monetaryCounts()).toEqual(monetaryBefore);
  });

  it('fails closed when a run identity is reused with changed result evidence', async () => {
    const request = input();
    await service.ingest(request);
    await expect(service.ingest({
      ...request,
      result: { status: 'DISCREPANCY', providerRecordCount: 7, internalRecordCount: 6, discrepancyCount: 1 },
    })).rejects.toMatchObject({ code: 'RECONCILIATION_RUN_CONFLICT' });

    const stored = await db.providerReconciliationRun.findUniqueOrThrow({ where: {
      domain_provider_connectionId_runKey: {
        domain: request.domain, provider: request.provider, connectionId: request.connectionId, runKey: request.runKey,
      },
    } });
    expect(stored.status).toBe('MATCHED');
    expect(stored.internalRecordCount).toBe(7);
    expect(stored.discrepancyCount).toBe(0);
    expect(stored.evidenceHash).toBe(deriveReconciliationHashes(request).evidenceHash);
  });

  it('has exactly one database winner under concurrent duplicate ingestion', async () => {
    const request = input();
    const results = await Promise.all(Array.from({ length: 8 }, () => service.ingest(request)));
    expect(results.filter(result => result.action === 'CREATED')).toHaveLength(1);
    expect(results.filter(result => result.action === 'REPLAY')).toHaveLength(7);
    expect(new Set(results.map(result => result.run.providerReconciliationRunId)).size).toBe(1);
    expect(await db.providerReconciliationRun.count({ where: {
      domain: request.domain, provider: request.provider, connectionId: request.connectionId, runKey: request.runKey,
    } })).toBe(1);
  }, 30_000);

  it('rolls back a failed insert and does not mutate monetary tables', async () => {
    const request = input();
    const before = await monetaryCounts();
    const suffix = request.runKey.replaceAll('-', '');
    const functionName = `reconciliation_fail_${suffix}`;
    const triggerName = `reconciliation_fail_${suffix}`;
    await db.$executeRawUnsafe(`CREATE FUNCTION commerce.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.run_key = '${request.runKey}' THEN RAISE EXCEPTION 'TEST_ONLY_FORCED_RECONCILIATION_FAILURE'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON commerce.provider_reconciliation_run FOR EACH ROW EXECUTE FUNCTION commerce.${functionName}()`);
    try {
      await expect(service.ingest(request)).rejects.toThrow('TEST_ONLY_FORCED_RECONCILIATION_FAILURE');
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON commerce.provider_reconciliation_run`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS commerce.${functionName}()`);
    }

    expect(await db.providerReconciliationRun.count({ where: {
      domain: request.domain, provider: request.provider, connectionId: request.connectionId, runKey: request.runKey,
    } })).toBe(0);
    expect(await monetaryCounts()).toEqual(before);
  });
});
