import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const peer = new PrismaClient();
let assertions = 0;
const id = () => randomUUID();

async function seed(tx, status, receivedAt, extra = {}) {
  const webhookId = id();
  await tx.$executeRawUnsafe(`
    INSERT INTO commerce.provider_webhook_inbox
      (provider_webhook_inbox_id, domain, provider, connection_id, ingress_key, payload_hash,
       safe_evidence_ref, verification_config_version, correlation_id, status, received_at,
       attempt_count, processed_at, next_attempt_at, lease_owner, lease_expires_at)
    VALUES ($1::uuid, 'PAYMENT', 'WORKER_DB_TEST', $2, $3, $4, $5, 'WORKER_DB_V1', $6::uuid,
      $7::commerce."ProviderWebhookStatus", $8::timestamptz, $9, $10::timestamptz,
      $11::timestamptz, $12, $13::timestamptz)
  `, webhookId, id(), id(), 'a'.repeat(64), `evidence://${id()}`, id(), status, receivedAt.toISOString(),
    extra.attemptCount ?? 0, extra.processedAt?.toISOString() ?? null, extra.nextAttemptAt?.toISOString() ?? null,
    extra.leaseOwner ?? null, extra.leaseExpiresAt?.toISOString() ?? null);
  return { providerWebhookInboxId: webhookId };
}

async function claim(client, owner, now, limit = 1, leaseSeconds = 60) {
  return client.$queryRawUnsafe(`
    WITH candidates AS (
      SELECT provider_webhook_inbox_id
      FROM commerce.provider_webhook_inbox
      WHERE provider = 'WORKER_DB_TEST'
        AND (
          status = 'VERIFIED'
          OR (status = 'RETRY_PENDING' AND (next_attempt_at IS NULL OR next_attempt_at <= $1::timestamptz))
          OR (status = 'PROCESSING' AND lease_expires_at <= $1::timestamptz)
        )
      ORDER BY COALESCE(next_attempt_at, received_at), received_at, provider_webhook_inbox_id
      FOR UPDATE SKIP LOCKED
      LIMIT $2
    )
    UPDATE commerce.provider_webhook_inbox AS inbox
    SET status = 'PROCESSING', attempt_count = attempt_count + 1,
        lease_owner = $3, lease_expires_at = $1::timestamptz + make_interval(secs => $4),
        next_attempt_at = NULL
    FROM candidates
    WHERE inbox.provider_webhook_inbox_id = candidates.provider_webhook_inbox_id
    RETURNING inbox.provider_webhook_inbox_id, inbox.attempt_count, inbox.lease_owner
  `, now.toISOString(), limit, owner, leaseSeconds);
}

async function finalize(client, { webhookId, owner, attemptCount, status, processedAt = null, nextAttemptAt = null, errorCode = null }) {
  return client.$transaction(async tx => {
    await tx.$queryRawUnsafe(`SELECT set_config('ucell.provider_webhook_lease_owner', $1, true)`, owner);
    return tx.$executeRawUnsafe(`
      UPDATE commerce.provider_webhook_inbox
      SET status=$1::commerce."ProviderWebhookStatus", lease_owner=NULL, lease_expires_at=NULL,
          processed_at=$2::timestamptz, next_attempt_at=$3::timestamptz, last_error_code=$4
      WHERE provider_webhook_inbox_id=$5::uuid AND status='PROCESSING'
        AND lease_owner=$6 AND attempt_count=$7 AND lease_expires_at > clock_timestamp()
    `, status, processedAt?.toISOString() ?? null, nextAttemptAt?.toISOString() ?? null,
      errorCode, webhookId, owner, attemptCount);
  });
}

try {
  await db.providerWebhookInbox.deleteMany({ where: { provider: 'WORKER_DB_TEST' } });
  const base = new Date();
  const receivedBase = base.getTime() - 10_000;
  const first = await seed(db, 'VERIFIED', new Date(receivedBase));
  const second = await seed(db, 'VERIFIED', new Date(receivedBase + 1));
  const active = await seed(db, 'PROCESSING', new Date(receivedBase + 2), { attemptCount: 4, leaseOwner: 'active-worker', leaseExpiresAt: new Date(base.getTime() + 120_000) });
  const expired = await seed(db, 'PROCESSING', new Date(receivedBase + 3), { attemptCount: 2, leaseOwner: 'dead-worker', leaseExpiresAt: new Date(base.getTime() - 1) });
  const futureRetry = await seed(db, 'RETRY_PENDING', new Date(receivedBase + 4), { attemptCount: 3, nextAttemptAt: new Date(base.getTime() + 120_000) });
  const dueRetry = await seed(db, 'RETRY_PENDING', new Date(receivedBase + 5), { attemptCount: 3, nextAttemptAt: new Date(base.getTime() - 1) });
  const processed = await seed(db, 'PROCESSED', new Date(receivedBase + 6), { attemptCount: 1, processedAt: base });
  const rejected = await seed(db, 'REJECTED', new Date(receivedBase + 7));

  await db.$transaction(async tx => {
    const rolledBack = await claim(tx, 'rollback-worker', base, 1);
    assert.equal(rolledBack[0].provider_webhook_inbox_id, first.providerWebhookInboxId); assertions++;
    throw new Error('TEST_ROLLBACK');
  }).catch(error => { assert.equal(error.message, 'TEST_ROLLBACK'); assertions++; });
  const [afterRollback] = await db.$queryRawUnsafe(`SELECT status::text, attempt_count, lease_owner FROM commerce.provider_webhook_inbox WHERE provider_webhook_inbox_id=$1::uuid`, first.providerWebhookInboxId);
  assert.deepEqual([afterRollback.status, afterRollback.attempt_count, afterRollback.lease_owner], ['VERIFIED', 0, null]); assertions++;

  await db.$transaction(async tx => {
    await tx.$queryRawUnsafe(`SELECT provider_webhook_inbox_id FROM commerce.provider_webhook_inbox WHERE provider_webhook_inbox_id = $1::uuid FOR UPDATE`, first.providerWebhookInboxId);
    const concurrent = await claim(peer, 'peer-worker', base, 1);
    assert.equal(concurrent.length, 1); assertions++;
    assert.equal(concurrent[0].provider_webhook_inbox_id, second.providerWebhookInboxId); assertions++;
  });

  const reclaimed = await claim(peer, 'recovery-worker', base, 10);
  const reclaimedIds = new Set(reclaimed.map(row => row.provider_webhook_inbox_id));
  assert.equal(reclaimedIds.has(first.providerWebhookInboxId), true); assertions++;
  assert.equal(reclaimedIds.has(expired.providerWebhookInboxId), true); assertions++;
  assert.equal(reclaimedIds.has(dueRetry.providerWebhookInboxId), true); assertions++;
  assert.equal(reclaimed.find(row => row.provider_webhook_inbox_id === expired.providerWebhookInboxId)?.attempt_count, 3); assertions++;
  assert.equal(reclaimed.find(row => row.provider_webhook_inbox_id === dueRetry.providerWebhookInboxId)?.attempt_count, 4); assertions++;
  for (const excluded of [active.providerWebhookInboxId, futureRetry.providerWebhookInboxId, processed.providerWebhookInboxId, rejected.providerWebhookInboxId]) {
    assert.equal(reclaimedIds.has(excluded), false); assertions++;
  }
  const unchanged = await db.$queryRawUnsafe(`SELECT lease_owner FROM commerce.provider_webhook_inbox WHERE provider_webhook_inbox_id = ANY($1::uuid[])`, [active.providerWebhookInboxId, futureRetry.providerWebhookInboxId, processed.providerWebhookInboxId, rejected.providerWebhookInboxId]);
  assert.equal(unchanged.every(row => row.lease_owner !== 'recovery-worker'), true); assertions++;

  const outcomeNow = new Date();
  const activeUntil = new Date(outcomeNow.getTime() + 120_000);
  const success = await seed(db, 'PROCESSING', outcomeNow, { attemptCount: 1, leaseOwner: 'success-worker', leaseExpiresAt: activeUntil });
  const retry = await seed(db, 'PROCESSING', outcomeNow, { attemptCount: 2, leaseOwner: 'retry-worker', leaseExpiresAt: activeUntil });
  const maximum = await seed(db, 'PROCESSING', outcomeNow, { attemptCount: 5, leaseOwner: 'max-worker', leaseExpiresAt: activeUntil });
  const permanent = await seed(db, 'PROCESSING', outcomeNow, { attemptCount: 1, leaseOwner: 'permanent-worker', leaseExpiresAt: activeUntil });
  const staleAttempt = await seed(db, 'PROCESSING', outcomeNow, { attemptCount: 2, leaseOwner: 'attempt-worker', leaseExpiresAt: activeUntil });
  const expiredOutcome = await seed(db, 'PROCESSING', outcomeNow, { attemptCount: 1, leaseOwner: 'expired-worker', leaseExpiresAt: new Date(outcomeNow.getTime() - 1) });
  const retryAt = new Date(outcomeNow.getTime() + 30_000);

  assert.equal(await finalize(db, { webhookId: success.providerWebhookInboxId, owner: 'success-worker', attemptCount: 1, status: 'PROCESSED', processedAt: outcomeNow }), 1); assertions++;
  assert.equal(await finalize(db, { webhookId: retry.providerWebhookInboxId, owner: 'retry-worker', attemptCount: 2, status: 'RETRY_PENDING', nextAttemptAt: retryAt, errorCode: 'PROVIDER_TEMPORARY_FAILURE' }), 1); assertions++;
  assert.equal(await finalize(db, { webhookId: maximum.providerWebhookInboxId, owner: 'max-worker', attemptCount: 5, status: 'MANUAL_REVIEW', errorCode: 'PROVIDER_MAX_ATTEMPTS_EXCEEDED' }), 1); assertions++;
  assert.equal(await finalize(db, { webhookId: permanent.providerWebhookInboxId, owner: 'permanent-worker', attemptCount: 1, status: 'MANUAL_REVIEW', errorCode: 'PROVIDER_PERMANENT_FAILURE' }), 1); assertions++;
  assert.equal(await finalize(db, { webhookId: staleAttempt.providerWebhookInboxId, owner: 'attempt-worker', attemptCount: 1, status: 'PROCESSED', processedAt: outcomeNow }), 0); assertions++;
  assert.equal(await finalize(db, { webhookId: active.providerWebhookInboxId, owner: 'wrong-worker', attemptCount: 4, status: 'PROCESSED', processedAt: outcomeNow }), 0); assertions++;
  assert.equal(await finalize(db, { webhookId: expiredOutcome.providerWebhookInboxId, owner: 'expired-worker', attemptCount: 1, status: 'PROCESSED', processedAt: outcomeNow }), 0); assertions++;

  const outcomes = await db.$queryRawUnsafe(`SELECT provider_webhook_inbox_id::text, status::text, attempt_count, lease_owner, lease_expires_at, processed_at, next_attempt_at, last_error_code FROM commerce.provider_webhook_inbox WHERE provider_webhook_inbox_id = ANY($1::uuid[])`, [success.providerWebhookInboxId, retry.providerWebhookInboxId, maximum.providerWebhookInboxId, permanent.providerWebhookInboxId, staleAttempt.providerWebhookInboxId, expiredOutcome.providerWebhookInboxId]);
  const byId = new Map(outcomes.map(row => [row.provider_webhook_inbox_id, row]));
  assert.deepEqual([byId.get(success.providerWebhookInboxId).status, byId.get(success.providerWebhookInboxId).lease_owner, byId.get(success.providerWebhookInboxId).last_error_code], ['PROCESSED', null, null]); assertions++;
  assert.equal(byId.get(success.providerWebhookInboxId).processed_at.toISOString(), outcomeNow.toISOString()); assertions++;
  assert.deepEqual([byId.get(retry.providerWebhookInboxId).status, byId.get(retry.providerWebhookInboxId).lease_owner, byId.get(retry.providerWebhookInboxId).last_error_code], ['RETRY_PENDING', null, 'PROVIDER_TEMPORARY_FAILURE']); assertions++;
  assert.equal(byId.get(retry.providerWebhookInboxId).next_attempt_at.toISOString(), retryAt.toISOString()); assertions++;
  for (const terminal of [maximum.providerWebhookInboxId, permanent.providerWebhookInboxId]) {
    assert.deepEqual([byId.get(terminal).status, byId.get(terminal).lease_owner, byId.get(terminal).lease_expires_at], ['MANUAL_REVIEW', null, null]); assertions++;
  }
  assert.deepEqual([byId.get(staleAttempt.providerWebhookInboxId).status, byId.get(staleAttempt.providerWebhookInboxId).attempt_count, byId.get(staleAttempt.providerWebhookInboxId).lease_owner], ['PROCESSING', 2, 'attempt-worker']); assertions++;
  assert.deepEqual([byId.get(expiredOutcome.providerWebhookInboxId).status, byId.get(expiredOutcome.providerWebhookInboxId).attempt_count, byId.get(expiredOutcome.providerWebhookInboxId).lease_owner], ['PROCESSING', 1, 'expired-worker']); assertions++;
  console.log(`PROVIDER_WEBHOOK_WORKER_LEASE_DB_PASS: ${assertions} assertions; SKIP LOCKED, reclaim, exclusions, retry increments and rollback verified`);
} finally {
  await db.providerWebhookInbox.deleteMany({ where: { provider: 'WORKER_DB_TEST' } }).catch(() => undefined);
  await Promise.all([db.$disconnect(), peer.$disconnect()]);
}
