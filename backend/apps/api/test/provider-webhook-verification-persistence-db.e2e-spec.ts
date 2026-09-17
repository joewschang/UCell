import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '@ucell/database';
import {
  ProviderWebhookVerificationPersistenceService,
} from '../src/modules/commerce/provider-webhook-verification-persistence.service';
import type { ProviderWebhookVerificationEvidence } from '../src/modules/commerce/provider-webhook-verification-decision';

const testDatabaseUrl = process.env.PROVIDER_WEBHOOK_VERIFICATION_TEST_DATABASE_URL
  ?? process.env.PHASE2_TEST_DATABASE_URL
  ?? 'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public';
const parsedTestDatabaseUrl = new URL(testDatabaseUrl);
if (!['localhost', '127.0.0.1'].includes(parsedTestDatabaseUrl.hostname)
  || !parsedTestDatabaseUrl.pathname.slice(1).endsWith('_test')) {
  throw new Error('PROVIDER_WEBHOOK_VERIFICATION_TEST_DATABASE_REQUIRED');
}
process.env.DATABASE_URL = testDatabaseUrl;

describe('Provider webhook verification persistence PostgreSQL boundary', () => {
  const db = new PrismaService();
  const service = new ProviderWebhookVerificationPersistenceService(db);

  afterAll(async () => { await db.$disconnect(); });

  function digest(value: string): string {
    return createHash('sha256').update(value).digest('hex');
  }

  async function inbox(options: { payload?: string; connectionId?: string } = {}) {
    const key = randomUUID();
    const payloadHash = digest(options.payload ?? `payload-${key}`);
    return db.providerWebhookInbox.create({ data: {
      domain: 'PAYMENT',
      provider: 'TEST_PROVIDER',
      connectionId: options.connectionId ?? `TEST_CONNECTION_${randomUUID()}`,
      ingressKey: `TEST_INGRESS_${key}`,
      payloadHash,
      safeEvidenceRef: `test-only://provider-webhook/${key}`,
      verificationConfigVersion: 'TEST_ONLY_V1',
      receivedAt: new Date('2026-09-18T12:00:02.000Z'),
      correlationId: randomUUID(),
    } });
  }

  function evidence(row: Awaited<ReturnType<typeof inbox>>, options: {
    verdict?: 'VERIFIED' | 'REJECTED'; providerEventIdentity?: string; payloadHash?: string;
  } = {}): ProviderWebhookVerificationEvidence {
    return {
      verdict: options.verdict ?? 'VERIFIED',
      providerEventIdentity: options.providerEventIdentity ?? `TEST_EVENT_${randomUUID()}`,
      payloadHash: options.payloadHash ?? row.payloadHash,
      signatureTimestamp: '2026-09-18T12:00:00.000Z',
      verifiedAt: '2026-09-18T12:00:01.000Z',
      safeEvidenceRef: row.safeEvidenceRef,
      verificationConfigVersion: row.verificationConfigVersion,
    };
  }

  function input(row: Awaited<ReturnType<typeof inbox>>, proof: ProviderWebhookVerificationEvidence) {
    return {
      providerWebhookInboxId: row.providerWebhookInboxId,
      evidence: proof,
      evaluatedAt: '2026-09-18T12:00:03.000Z',
      maxSignatureAgeSeconds: 300,
      maxFutureSkewSeconds: 30,
    };
  }

  it('commits complete VERIFIED evidence through the compare-and-set boundary', async () => {
    const row = await inbox();
    const proof = evidence(row);
    await expect(service.persist(input(row, proof))).resolves.toMatchObject({
      action: 'ACCEPT', status: 'VERIFIED', providerWebhookInboxId: row.providerWebhookInboxId,
    });
    await expect(db.providerWebhookInbox.findUniqueOrThrow({ where: {
      providerWebhookInboxId: row.providerWebhookInboxId,
    } })).resolves.toMatchObject({
      status: 'VERIFIED', providerEventIdentity: proof.providerEventIdentity,
      signatureTimestamp: new Date(proof.signatureTimestamp), verifiedAt: new Date(proof.verifiedAt),
      lastErrorCode: null,
    });
  });

  it('does not let REJECTED evidence reserve the canonical provider event identity', async () => {
    const connectionId = `TEST_CONNECTION_${randomUUID()}`;
    const rejectedRow = await inbox({ connectionId });
    const acceptedRow = await inbox({ connectionId });
    const providerEventIdentity = `TEST_EVENT_${randomUUID()}`;
    const rejected = evidence(rejectedRow, { verdict: 'REJECTED', providerEventIdentity });
    const accepted = evidence(acceptedRow, { providerEventIdentity });

    await expect(service.persist(input(rejectedRow, rejected))).resolves.toMatchObject({
      action: 'REJECT', status: 'REJECTED',
    });
    await expect(service.persist(input(acceptedRow, accepted))).resolves.toMatchObject({
      action: 'ACCEPT', status: 'VERIFIED',
    });
    const persistedRejected = await db.providerWebhookInbox.findUniqueOrThrow({ where: {
      providerWebhookInboxId: rejectedRow.providerWebhookInboxId,
    } });
    expect(persistedRejected.providerEventIdentity).toBeNull();
    expect(persistedRejected.lastErrorCode).toBe('PROVIDER_WEBHOOK_VERIFICATION_REJECTED');
  });

  it('returns a durable no-op for exact VERIFIED and REJECTED replays', async () => {
    const verifiedRow = await inbox();
    const verified = evidence(verifiedRow);
    await service.persist(input(verifiedRow, verified));
    await expect(service.persist(input(verifiedRow, verified))).resolves.toMatchObject({
      action: 'NOOP_REPLAY', status: 'VERIFIED',
    });

    const rejectedRow = await inbox();
    const rejected = evidence(rejectedRow, { verdict: 'REJECTED' });
    await service.persist(input(rejectedRow, rejected));
    await expect(service.persist(input(rejectedRow, rejected))).resolves.toMatchObject({
      action: 'NOOP_REPLAY', status: 'REJECTED',
    });
  });

  it('rejects changed evidence without changing the committed terminal fact', async () => {
    const row = await inbox();
    const original = evidence(row);
    await service.persist(input(row, original));
    await expect(service.persist(input(row, { ...original, verifiedAt: '2026-09-18T12:00:01.500Z' })))
      .rejects.toMatchObject({ code: 'PROVIDER_WEBHOOK_REPLAY_CONFLICT' });
    const persisted = await db.providerWebhookInbox.findUniqueOrThrow({ where: {
      providerWebhookInboxId: row.providerWebhookInboxId,
    } });
    expect(persisted.status).toBe('VERIFIED');
    expect(persisted.verifiedAt?.toISOString()).toBe(original.verifiedAt);
  });

  it('has exactly one CAS winner under concurrent verification', async () => {
    const row = await inbox();
    const proof = evidence(row);
    const settled = await Promise.allSettled(Array.from({ length: 8 }, () => service.persist(input(row, proof))));
    const accepted = settled.filter(result => result.status === 'fulfilled'
      && result.value.action === 'ACCEPT');
    expect(accepted).toHaveLength(1);
    const noops = settled.filter(result => result.status === 'fulfilled'
      && result.value.action === 'NOOP_REPLAY');
    const conflicts = settled.filter(result => result.status === 'rejected');
    expect(noops.length + conflicts.length).toBe(7);
    for (const result of settled) {
      if (result.status === 'rejected') {
        expect(result.reason).toMatchObject({ code: 'PROVIDER_WEBHOOK_STATUS_CONFLICT' });
      }
    }
    expect(await db.providerWebhookInbox.count({ where: {
      providerWebhookInboxId: row.providerWebhookInboxId,
      status: 'VERIFIED', providerEventIdentity: proof.providerEventIdentity,
    } })).toBe(1);
  }, 30_000);

  it('rolls the verification update back when the transaction fails after the CAS write', async () => {
    const row = await inbox();
    const suffix = row.providerWebhookInboxId.replaceAll('-', '');
    const functionName = `webhook_verify_fail_${suffix}`;
    const triggerName = `webhook_verify_fail_${suffix}`;
    await db.$executeRawUnsafe(`CREATE FUNCTION commerce.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.provider_webhook_inbox_id = '${row.providerWebhookInboxId}'::uuid AND NEW.status = 'VERIFIED' THEN RAISE EXCEPTION 'TEST_ONLY_FORCED_WEBHOOK_VERIFICATION_FAILURE'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER ${triggerName} BEFORE UPDATE ON commerce.provider_webhook_inbox FOR EACH ROW EXECUTE FUNCTION commerce.${functionName}()`);
    try {
      await expect(service.persist(input(row, evidence(row))))
        .rejects.toThrow('TEST_ONLY_FORCED_WEBHOOK_VERIFICATION_FAILURE');
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON commerce.provider_webhook_inbox`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS commerce.${functionName}()`);
    }
    await expect(db.providerWebhookInbox.findUniqueOrThrow({ where: {
      providerWebhookInboxId: row.providerWebhookInboxId,
    } })).resolves.toMatchObject({
      status: 'RECEIVED', providerEventIdentity: null, verificationEvidenceHash: null,
      signatureTimestamp: null, verifiedAt: null,
    });
  });

  it('maps a unique provider event collision to replay conflict and preserves both rows', async () => {
    const connectionId = `TEST_CONNECTION_${randomUUID()}`;
    const firstRow = await inbox({ connectionId });
    const secondRow = await inbox({ connectionId });
    const providerEventIdentity = `TEST_EVENT_${randomUUID()}`;
    await service.persist(input(firstRow, evidence(firstRow, { providerEventIdentity })));

    await expect(service.persist(input(secondRow, evidence(secondRow, { providerEventIdentity }))))
      .rejects.toMatchObject({ code: 'PROVIDER_WEBHOOK_REPLAY_CONFLICT' });
    const [first, second] = await Promise.all([
      db.providerWebhookInbox.findUniqueOrThrow({ where: { providerWebhookInboxId: firstRow.providerWebhookInboxId } }),
      db.providerWebhookInbox.findUniqueOrThrow({ where: { providerWebhookInboxId: secondRow.providerWebhookInboxId } }),
    ]);
    expect(first).toMatchObject({ status: 'VERIFIED', providerEventIdentity });
    expect(second).toMatchObject({ status: 'RECEIVED', providerEventIdentity: null, verificationEvidenceHash: null });
  });
});
