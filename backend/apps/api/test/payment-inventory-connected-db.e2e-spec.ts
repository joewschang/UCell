import { randomUUID } from 'node:crypto';
import {
  claimOutboxLease,
  PrismaService,
  processPaymentInventoryReservation,
} from '@ucell/database';
import { PaymentPersistenceService } from '../src/modules/payment-hub/payment-persistence.service';
import { canonicalizeProviderEvent, CanonicalProviderEventInput } from '../src/modules/payment-hub/provider-event-canonicalizer';
import { createPaymentVerificationBoundary, VerifiedPaymentFact } from '../src/modules/payment-hub/payment-provider.adapter';

const testDatabaseUrl = process.env.PAYMENT_INVENTORY_TEST_DATABASE_URL
  ?? process.env.PHASE2_TEST_DATABASE_URL
  ?? 'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public';
const parsed = new URL(testDatabaseUrl);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.slice(1).endsWith('_test')) {
  throw new Error('PAYMENT_INVENTORY_TEST_DATABASE_REQUIRED');
}
process.env.DATABASE_URL = testDatabaseUrl;

describe('Connected DEV verified payment to inventory reservation', () => {
  const db = new PrismaService();
  const payments = new PaymentPersistenceService(db);
  let qualificationId: string;
  let warehouseId: string;

  beforeAll(async () => {
    const person = await db.person.create({ data: { legalName: `CONNECTED PAYMENT INVENTORY ${randomUUID()}`, status: 'EFFECTIVE' } });
    qualificationId = (await db.qualification.create({ data: {
      currentHolderPersonId: person.personId, planLevelCode: 'STARTER', status: 'EFFECTIVE', effectiveAt: new Date(),
    } })).qualificationId;
    warehouseId = (await db.warehouse.create({ data: {
      code: `CONNECTED-${randomUUID()}`, name: 'Connected DEV', status: 'EFFECTIVE',
    } })).warehouseId;
  });

  afterAll(async () => db.$disconnect());

  async function fixture(onHand: number) {
    const product = await db.productReference.create({ data: {
      sku: `CONNECTED-${randomUUID()}`, displayName: 'Connected Product', currentPrice: '125.00', isActive: true,
    } });
    const item = await db.inventoryItem.create({ data: {
      productId: product.productId, sku: `INV-${randomUUID()}`, status: 'EFFECTIVE',
    } });
    await db.inventoryBalance.create({ data: { warehouseId, inventoryItemId: item.inventoryItemId, onHand } });
    const order = await db.order.create({ data: {
      qualificationId, purpose: 'RETAIL', status: 'CONFIRMED', currency: 'TWD',
      grossAmount: '250.00', netAmount: '250.00', ruleVersionCode: 'TEST_ONLY_CONNECTED_PAYMENT_INVENTORY',
      parameterSnapshotHash: 'a'.repeat(64), confirmedAt: new Date('2026-09-17T00:00:00Z'),
      lines: { create: [{
        productId: product.productId, skuSnapshot: product.sku, productNameSnapshot: product.displayName,
        quantity: 2, unitPrice: '125.00', lineAmount: '250.00', gpvRateSnapshot: 0,
        gpvAmountSnapshot: 0, pvRateSnapshot: 0, ruleProfileSnapshot: { testOnly: true, serverPriced: true },
      }] },
    }, include: { lines: true } });
    const payment = await db.payment.create({ data: {
      orderId: order.orderId, provider: 'TAISHIN_ECOM', connectionId: `CONNECTED_${randomUUID()}`,
      method: 'TEST_ONLY', amount: order.netAmount, currency: order.currency, status: 'PENDING',
      providerTransactionRef: `TX_${randomUUID()}`,
    } });
    return { product, item, order, payment };
  }

  async function verifiedPaid(payment: Awaited<ReturnType<typeof fixture>>['payment'], orderId: string) {
    const event: CanonicalProviderEventInput = {
      provider: 'TAISHIN_ECOM', source: 'VERIFIED_WEBHOOK', providerEventId: `EV_${randomUUID()}`,
      providerTransactionRef: payment.providerTransactionRef!, status: 'PAID',
      metadata: { amount: payment.amount.toFixed(2), currency: payment.currency },
      occurredAt: new Date('2026-09-17T01:00:00Z'),
    };
    const canonical = canonicalizeProviderEvent(event);
    const verify = createPaymentVerificationBoundary({ verify: async (): Promise<VerifiedPaymentFact> => ({
      provider: 'TAISHIN_ECOM', connectionId: payment.connectionId, paymentId: payment.paymentId, orderId,
      providerTransactionRef: payment.providerTransactionRef!, operationId: 'PAYMENT_ACCEPTED', operationKind: 'PAYMENT',
      amount: payment.amount.toFixed(2), currency: payment.currency, status: 'PAID', source: event.source,
      providerEventIdentity: canonical.providerEventIdentity, payloadHash: canonical.payloadHash,
      safeEvidenceRef: `SAFE_${canonical.payloadHash}`, verifiedAt: '2026-09-17T01:00:01Z',
      verificationConfigVersion: 'TEST_ONLY_CONNECTED_V1',
    }) });
    return payments.persist({ event, receipt: await verify(undefined), correlationId: randomUUID() });
  }

  async function claim(outboxEventId: string) {
    const event = await db.outboxEvent.findUniqueOrThrow({ where: { outboxEventId } });
    const lease = await claimOutboxLease(db, event, new Date());
    if (!lease) throw new Error('TEST_ONLY_OUTBOX_LEASE_NOT_CLAIMED');
    return lease;
  }

  it('persists verified PAID evidence, reserves from server order snapshots, and collapses redelivery', async () => {
    const row = await fixture(10);
    const persisted = await verifiedPaid(row.payment, row.order.orderId);
    expect(persisted.action).toBe('APPLY');
    const first = await processPaymentInventoryReservation(db, await claim(persisted.outboxEventId), {
      warehouseId, policyVersion: 'TEST_ONLY_CONNECTED_POLICY_V1',
    });
    expect(first).toMatchObject({ action: 'RESERVED', paymentId: row.payment.paymentId, orderId: row.order.orderId });

    const paidOrder = await db.order.findUniqueOrThrow({ where: { orderId: row.order.orderId } });
    expect(paidOrder.status).toBe('PAID');
    expect(paidOrder.netAmount.toFixed(2)).toBe('250.00');
    expect(await db.inventoryReservation.count({ where: { orderId: row.order.orderId } })).toBe(1);
    expect(await db.inventoryMovement.count({ where: { sourceType: 'ORDER', sourceId: row.order.orderId } })).toBe(1);

    // Test-only broker redelivery after an acknowledged delivery. The inventory
    // operation claim must return the original result without a second reserve.
    await db.outboxEvent.update({ where: { outboxEventId: persisted.outboxEventId }, data: {
      processStatus: 'PENDING', processedAt: null, availableAt: new Date(),
    } });
    const replay = await processPaymentInventoryReservation(db, await claim(persisted.outboxEventId), {
      warehouseId, policyVersion: 'TEST_ONLY_CONNECTED_POLICY_V1',
    });
    expect(replay).toMatchObject({ action: 'NOOP_REPLAY' });
    expect(await db.inventoryReservation.count({ where: { orderId: row.order.orderId } })).toBe(1);
    expect((await db.inventoryBalance.findUniqueOrThrow({ where: {
      warehouseId_inventoryItemId: { warehouseId, inventoryItemId: row.item.inventoryItemId },
    } })).reserved.toString()).toBe('2');
  }, 30_000);

  it('keeps verified payment and PAID order evidence when allocation fails for insufficient stock', async () => {
    const row = await fixture(1);
    const persisted = await verifiedPaid(row.payment, row.order.orderId);
    await expect(processPaymentInventoryReservation(db, await claim(persisted.outboxEventId), {
      warehouseId, policyVersion: 'TEST_ONLY_CONNECTED_POLICY_V1',
    })).rejects.toMatchObject({ code: 'INVENTORY_INSUFFICIENT_AVAILABLE' });
    expect((await db.payment.findUniqueOrThrow({ where: { paymentId: row.payment.paymentId } })).status).toBe('PAID');
    expect((await db.order.findUniqueOrThrow({ where: { orderId: row.order.orderId } })).status).toBe('PAID');
    expect(await db.inventoryReservation.count({ where: { orderId: row.order.orderId } })).toBe(0);
    expect(await db.inventoryMovement.count({ where: { sourceType: 'ORDER', sourceId: row.order.orderId } })).toBe(0);
    expect((await db.inventoryBalance.findUniqueOrThrow({ where: {
      warehouseId_inventoryItemId: { warehouseId, inventoryItemId: row.item.inventoryItemId },
    } })).reserved.toString()).toBe('0');
  }, 30_000);
});
