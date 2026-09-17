import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';

const require = createRequire(new URL('../packages/database/package.json', import.meta.url));
const { PrismaClient } = require('@prisma/client');
const apiRequire = createRequire(new URL('../apps/api/package.json', import.meta.url));
const { IdempotencyService } = apiRequire('./dist/common/idempotency/idempotency.service.js');
const { AuditService } = apiRequire('./dist/common/audit/audit.service.js');
const { AdminProviderOperationsService } = apiRequire('./dist/modules/admin-provider-operations/admin-provider-operations.service.js');
const db = new PrismaClient();
let assertions = 0;

async function rejected(action, constraint) {
  await assert.rejects(action, error => `${String(error)} ${JSON.stringify(error?.meta ?? {})}`.includes(constraint));
  assertions++;
}

async function seed() {
  const webhookId = randomUUID();
  await db.$executeRawUnsafe(`
    INSERT INTO commerce.provider_webhook_inbox
      (provider_webhook_inbox_id, domain, provider, connection_id, ingress_key, payload_hash,
       safe_evidence_ref, verification_config_version, correlation_id, status, received_at,
       attempt_count, last_error_code)
    VALUES ($1::uuid, 'PAYMENT', 'MANUAL_RETRY_DB_TEST', $2, $3, $4, $5,
      'MANUAL_RETRY_DB_V1', $6::uuid, 'MANUAL_REVIEW', clock_timestamp(), 3,
      'PROVIDER_MAX_ATTEMPTS_EXCEEDED')
  `, webhookId, randomUUID(), randomUUID(), 'b'.repeat(64), `evidence://${randomUUID()}`, randomUUID());
  return webhookId;
}

try {
  await db.providerWebhookInbox.deleteMany({ where: { provider: 'MANUAL_RETRY_DB_TEST' } });

  const idempotency = new IdempotencyService(db);
  const service = new AdminProviderOperationsService(db, idempotency, new AuditService());
  const actorKey = `manual-retry-db-${randomUUID()}`;
  const requestId = `manual-retry-db-${randomUUID()}`;
  const correlationId = randomUUID();

  const serviceRetry = await seed();
  const key = randomUUID();
  const reason = 'Operator reviewed durable evidence and approved a governed retry';
  const first = await service.retryManualReview(serviceRetry, reason, key, actorKey, undefined, requestId, correlationId);
  assert.equal(first.replayed, false); assertions++;
  assert.equal(first.status, 'RETRY_PENDING'); assertions++;
  const replay = await service.retryManualReview(serviceRetry, reason, key, actorKey, undefined, requestId, correlationId);
  assert.equal(replay.replayed, true); assertions++;
  assert.deepEqual({ ...replay, replayed: false }, first); assertions++;
  const [serviceRow, auditCount, idempotencyCount] = await Promise.all([
    db.providerWebhookInbox.findUniqueOrThrow({ where: { providerWebhookInboxId: serviceRetry } }),
    db.auditEvent.count({ where: { action: 'PROVIDER_WEBHOOK_MANUAL_RETRY_REQUESTED', entityId: serviceRetry } }),
    db.idempotencyRecord.count({ where: { actorScope: `admin:provider-webhook:retry:${actorKey}`, idempotencyKey: key } }),
  ]);
  assert.equal(serviceRow.status, 'RETRY_PENDING'); assertions++;
  assert.equal(auditCount, 1); assertions++;
  assert.equal(idempotencyCount, 1); assertions++;
  await assert.rejects(
    () => service.retryManualReview(serviceRetry, `${reason} with changed payload`, key, actorKey, undefined, requestId, correlationId),
    error => error?.response?.code === 'IDEMPOTENCY_CONFLICT',
  ); assertions++;

  const concurrent = await seed();
  const attempts = await Promise.allSettled([
    service.retryManualReview(concurrent, reason, randomUUID(), `${actorKey}-a`, undefined, requestId, randomUUID()),
    service.retryManualReview(concurrent, reason, randomUUID(), `${actorKey}-b`, undefined, requestId, randomUUID()),
  ]);
  assert.equal(attempts.filter(result => result.status === 'fulfilled').length, 1); assertions++;
  assert.equal(attempts.filter(result => result.status === 'rejected').length, 1); assertions++;
  assert.equal(await db.auditEvent.count({ where: { action: 'PROVIDER_WEBHOOK_MANUAL_RETRY_REQUESTED', entityId: concurrent } }), 1); assertions++;

  const rollback = await seed();
  const rollbackKey = randomUUID();
  const rollbackActor = `${actorKey}-rollback`;
  const failingService = new AdminProviderOperationsService(db, idempotency, { write: async () => { throw new Error('forced audit failure'); } });
  await assert.rejects(
    () => failingService.retryManualReview(rollback, reason, rollbackKey, rollbackActor, undefined, requestId, randomUUID()),
    /forced audit failure/,
  ); assertions++;
  assert.equal((await db.providerWebhookInbox.findUniqueOrThrow({ where: { providerWebhookInboxId: rollback } })).status, 'MANUAL_REVIEW'); assertions++;
  assert.equal(await db.idempotencyRecord.count({ where: { actorScope: `admin:provider-webhook:retry:${rollbackActor}`, idempotencyKey: rollbackKey } }), 0); assertions++;

  const direct = await seed();
  await rejected(() => db.$executeRawUnsafe(`
    UPDATE commerce.provider_webhook_inbox
    SET status='PROCESSING', lease_owner='admin', lease_expires_at=clock_timestamp() + interval '1 minute'
    WHERE provider_webhook_inbox_id=$1::uuid
  `, direct), 'invalid provider webhook status transition');

  const unscheduled = await seed();
  await rejected(() => db.$executeRawUnsafe(`
    UPDATE commerce.provider_webhook_inbox SET status='RETRY_PENDING'
    WHERE provider_webhook_inbox_id=$1::uuid
  `, unscheduled), 'manual provider webhook retry requires next_attempt_at');

  const erasedError = await seed();
  await rejected(() => db.$executeRawUnsafe(`
    UPDATE commerce.provider_webhook_inbox
    SET status='RETRY_PENDING', next_attempt_at=clock_timestamp(), last_error_code=NULL
    WHERE provider_webhook_inbox_id=$1::uuid
  `, erasedError), 'manual provider webhook retry must preserve last_error_code');

  const retry = await seed();
  const scheduledAt = new Date(Date.now() - 1_000);
  assert.equal(await db.$executeRawUnsafe(`
    UPDATE commerce.provider_webhook_inbox
    SET status='RETRY_PENDING', next_attempt_at=$2::timestamptz
    WHERE provider_webhook_inbox_id=$1::uuid
  `, retry, scheduledAt.toISOString()), 1); assertions++;

  const [pending] = await db.$queryRawUnsafe(`
    SELECT status::text, attempt_count, next_attempt_at, last_error_code, lease_owner, lease_expires_at
    FROM commerce.provider_webhook_inbox WHERE provider_webhook_inbox_id=$1::uuid
  `, retry);
  assert.deepEqual(
    [pending.status, pending.attempt_count, pending.next_attempt_at.toISOString(), pending.last_error_code,
      pending.lease_owner, pending.lease_expires_at],
    ['RETRY_PENDING', 3, scheduledAt.toISOString(), 'PROVIDER_MAX_ATTEMPTS_EXCEEDED', null, null],
  ); assertions++;

  const owner = 'manual-retry-db-worker';
  const claimed = await db.$queryRawUnsafe(`
    UPDATE commerce.provider_webhook_inbox
    SET status='PROCESSING', attempt_count=attempt_count + 1, next_attempt_at=NULL,
        lease_owner=$2, lease_expires_at=clock_timestamp() + interval '1 minute'
    WHERE provider_webhook_inbox_id=$1::uuid AND status='RETRY_PENDING'
      AND next_attempt_at <= clock_timestamp()
    RETURNING status::text, attempt_count, next_attempt_at, last_error_code, lease_owner, lease_expires_at
  `, retry, owner);
  assert.equal(claimed.length, 1); assertions++;
  assert.deepEqual(
    [claimed[0].status, claimed[0].attempt_count, claimed[0].next_attempt_at,
      claimed[0].last_error_code, claimed[0].lease_owner],
    ['PROCESSING', 4, null, 'PROVIDER_MAX_ATTEMPTS_EXCEEDED', owner],
  ); assertions++;
  assert.ok(claimed[0].lease_expires_at instanceof Date); assertions++;

  console.log(`PROVIDER_WEBHOOK_MANUAL_RETRY_DB_PASS: ${assertions} assertions; governed scheduling and lease claim verified`);
} finally {
  await db.auditEvent.deleteMany({ where: { action: 'PROVIDER_WEBHOOK_MANUAL_RETRY_REQUESTED', entityType: 'ProviderWebhookInbox' } }).catch(() => undefined);
  await db.idempotencyRecord.deleteMany({ where: { actorScope: { startsWith: 'admin:provider-webhook:retry:manual-retry-db-' } } }).catch(() => undefined);
  await db.providerWebhookInbox.deleteMany({ where: { provider: 'MANUAL_RETRY_DB_TEST' } }).catch(() => undefined);
  await db.$disconnect();
}
