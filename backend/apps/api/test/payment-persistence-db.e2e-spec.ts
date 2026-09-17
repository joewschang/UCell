import { randomUUID } from 'node:crypto';
import { PrismaService } from '@ucell/database';
import { PaymentPersistenceService } from '../src/modules/payment-hub/payment-persistence.service';
import { canonicalizeProviderEvent, CanonicalProviderEventInput } from '../src/modules/payment-hub/provider-event-canonicalizer';
import { createPaymentVerificationBoundary, VerifiedPaymentFact } from '../src/modules/payment-hub/payment-provider.adapter';

const testDatabaseUrl = process.env.PAYMENT_PERSISTENCE_TEST_DATABASE_URL
  ?? process.env.PHASE2_TEST_DATABASE_URL
  ?? 'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public';
const parsedTestDatabaseUrl = new URL(testDatabaseUrl);
if (!['localhost', '127.0.0.1'].includes(parsedTestDatabaseUrl.hostname)
  || !parsedTestDatabaseUrl.pathname.slice(1).endsWith('_test')) {
  throw new Error('PAYMENT_PERSISTENCE_TEST_DATABASE_REQUIRED');
}
process.env.DATABASE_URL = testDatabaseUrl;

describe('Payment persistence PostgreSQL boundary', () => {
  const db = new PrismaService();
  const service = new PaymentPersistenceService(db);
  let qualificationId: string;
  let orderId: string;

  beforeAll(async () => {
    const person = await db.person.create({ data: { legalName: `PAYMENT DB ${randomUUID()}`, status: 'EFFECTIVE' } });
    const qualification = await db.qualification.create({ data: {
      currentHolderPersonId: person.personId, planLevelCode: 'STARTER', status: 'EFFECTIVE', effectiveAt: new Date(),
    } });
    qualificationId = qualification.qualificationId;
    const order = await db.order.create({ data: {
      qualificationId, purpose: 'RETAIL', status: 'CONFIRMED', currency: 'TWD',
      grossAmount: '100.00', netAmount: '100.00', ruleVersionCode: 'TEST_ONLY_PAYMENT_PERSISTENCE',
    } });
    orderId = order.orderId;
  });

  afterAll(async () => { await db.$disconnect(); });

  async function payment(status: 'PENDING' | 'CAPTURED' = 'PENDING') {
    return db.payment.create({ data: {
      orderId, provider: 'TAISHIN_ECOM', connectionId: `TEST_${randomUUID()}`,
      method: 'TEST_ONLY', amount: '100.00', currency: 'TWD', status,
      providerTransactionRef: `TX_${randomUUID()}`,
    } });
  }

  async function verifiedInput(row: Awaited<ReturnType<typeof payment>>, options: {
    eventId?: string; source?: 'VERIFIED_WEBHOOK' | 'PROVIDER_QUERY'; status?: 'CAPTURED' | 'PAID'; operationId?: string; amount?: string;
  } = {}) {
    const event: CanonicalProviderEventInput = {
      provider: 'TAISHIN_ECOM', source: options.source ?? 'VERIFIED_WEBHOOK',
      providerEventId: options.eventId ?? `EV_${randomUUID()}`,
      providerTransactionRef: row.providerTransactionRef!, status: options.status ?? 'PAID',
      metadata: { amount: options.amount ?? '100.00', currency: 'TWD' },
      occurredAt: new Date('2026-09-17T00:00:00Z'),
    };
    const canonical = canonicalizeProviderEvent(event);
    const verify = createPaymentVerificationBoundary({ verify: async (): Promise<VerifiedPaymentFact> => ({
      provider: 'TAISHIN_ECOM', connectionId: row.connectionId, paymentId: row.paymentId, orderId,
      providerTransactionRef: row.providerTransactionRef!, operationId: options.operationId ?? 'CAPTURE_1', operationKind: 'PAYMENT',
      amount: options.amount ?? '100.00', currency: 'TWD', status: event.status, source: event.source,
      providerEventIdentity: canonical.providerEventIdentity, payloadHash: canonical.payloadHash,
      safeEvidenceRef: `SAFE_${canonical.payloadHash}`, verifiedAt: '2026-09-17T00:00:01Z',
      verificationConfigVersion: 'TEST_ONLY_V1',
    }) });
    return { event, receipt: await verify(undefined), correlationId: randomUUID() };
  }

  it('commits exactly one complete operation under concurrent duplicate delivery and lost-response retry', async () => {
    const row = await payment();
    const input = await verifiedInput(row);
    const concurrent = await Promise.all([service.persist(input), service.persist(input)]);
    expect(concurrent.map(item => item.action).sort()).toEqual(['APPLY', 'NOOP_REPLAY']);
    expect((await service.persist(input)).action).toBe('NOOP_REPLAY');
    expect(await db.paymentProviderEventEvidence.count({ where: { paymentId: row.paymentId } })).toBe(1);
    expect(await db.paymentStateTransition.count({ where: { paymentId: row.paymentId } })).toBe(1);
    expect(await db.paymentOperationClaim.count({ where: { paymentId: row.paymentId } })).toBe(1);
    expect(await db.outboxEvent.count({ where: { aggregateId: row.paymentId, eventType: 'PAYMENT_STATE_TRANSITIONED' } })).toBe(1);
    const projected = await db.payment.findUniqueOrThrow({ where: { paymentId: row.paymentId } });
    expect(projected.status).toBe('PAID');
    expect(projected.paidAt?.toISOString()).toBe('2026-09-17T00:00:01.000Z');
  }, 30_000);

  it('rejects an explicit event identity payload conflict without changing the committed facts', async () => {
    const row = await payment();
    const eventId = `EV_CONFLICT_${randomUUID()}`;
    await service.persist(await verifiedInput(row, { eventId, status: 'CAPTURED' }));
    await expect(service.persist(await verifiedInput(row, { eventId, status: 'PAID' }))).rejects.toMatchObject({
      code: 'PROVIDER_EVENT_IDENTITY_CONFLICT',
    });
    expect(await db.paymentProviderEventEvidence.count({ where: { paymentId: row.paymentId } })).toBe(1);
    expect((await db.payment.findUniqueOrThrow({ where: { paymentId: row.paymentId } })).status).toBe('CAPTURED');
    expect((await db.payment.findUniqueOrThrow({ where: { paymentId: row.paymentId } })).paidAt).toBeNull();
  });

  it('deduplicates the same verified operation observed by another provider source', async () => {
    const row = await payment();
    await service.persist(await verifiedInput(row, { source: 'VERIFIED_WEBHOOK', operationId: 'SAME_OPERATION' }));
    const second = await service.persist(await verifiedInput(row, { source: 'PROVIDER_QUERY', operationId: 'SAME_OPERATION' }));
    expect(second.action).toBe('NOOP_OPERATION');
    expect(await db.paymentProviderEventEvidence.count({ where: { paymentId: row.paymentId } })).toBe(1);
    expect(await db.paymentStateTransition.count({ where: { paymentId: row.paymentId } })).toBe(1);
  });

  it('fails closed for persisted delivery evidence without its atomic operation claim', async () => {
    const row = await payment();
    const input = await verifiedInput(row);
    const canonical = canonicalizeProviderEvent(input.event);
    await db.paymentProviderEventEvidence.create({ data: {
      paymentId: row.paymentId, provider: canonical.provider, connectionId: row.connectionId,
      providerEventIdentity: canonical.providerEventIdentity, providerTransactionRef: canonical.providerTransactionRef,
      source: canonical.source, payloadHash: canonical.payloadHash, safeEvidenceRef: input.receipt.safeEvidenceRef,
      verificationConfigVersion: input.receipt.verificationConfigVersion, verifiedAt: new Date(input.receipt.verifiedAt),
      correlationId: input.correlationId,
    } });
    await expect(service.persist(input)).rejects.toMatchObject({ code: 'PAYMENT_OPERATION_CONFLICT' });
    expect((await db.payment.findUniqueOrThrow({ where: { paymentId: row.paymentId } })).status).toBe('PENDING');
    expect(await db.paymentStateTransition.count({ where: { paymentId: row.paymentId } })).toBe(0);
  });

  it('fails closed when replay references do not match the committed outbox intent', async () => {
    const row = await payment();
    const input = await verifiedInput(row);
    const first = await service.persist(input);
    await db.outboxEvent.update({ where: { outboxEventId: first.outboxEventId }, data: {
      payload: { schemaVersion: 1, paymentId: row.paymentId, paymentStateTransitionId: 'tampered' },
    } });
    await expect(service.persist(input)).rejects.toMatchObject({ code: 'PAYMENT_OPERATION_INCOMPLETE' });
    expect(await db.paymentStateTransition.count({ where: { paymentId: row.paymentId } })).toBe(1);
    expect(await db.paymentOperationClaim.count({ where: { paymentId: row.paymentId } })).toBe(1);
  });

  it('rolls back evidence, transition and outbox when the final claim write fails', async () => {
    const row = await payment();
    const triggerSuffix = row.paymentId.replaceAll('-', '');
    const functionName = `payment_claim_fail_${triggerSuffix}`;
    const triggerName = `payment_claim_fail_${triggerSuffix}`;
    await db.$executeRawUnsafe(`CREATE FUNCTION commerce.${functionName}() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.payment_id = '${row.paymentId}'::uuid THEN RAISE EXCEPTION 'TEST_ONLY_FORCED_CLAIM_FAILURE'; END IF; RETURN NEW; END $$`);
    await db.$executeRawUnsafe(`CREATE TRIGGER ${triggerName} BEFORE INSERT ON commerce.payment_operation_claim FOR EACH ROW EXECUTE FUNCTION commerce.${functionName}()`);
    try {
      await expect(service.persist(await verifiedInput(row))).rejects.toThrow('TEST_ONLY_FORCED_CLAIM_FAILURE');
    } finally {
      await db.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${triggerName} ON commerce.payment_operation_claim`);
      await db.$executeRawUnsafe(`DROP FUNCTION IF EXISTS commerce.${functionName}()`);
    }
    expect((await db.payment.findUniqueOrThrow({ where: { paymentId: row.paymentId } })).status).toBe('PENDING');
    expect(await db.paymentProviderEventEvidence.count({ where: { paymentId: row.paymentId } })).toBe(0);
    expect(await db.paymentStateTransition.count({ where: { paymentId: row.paymentId } })).toBe(0);
    expect(await db.outboxEvent.count({ where: { aggregateId: row.paymentId, eventType: 'PAYMENT_STATE_TRANSITIONED' } })).toBe(0);
  });
});
