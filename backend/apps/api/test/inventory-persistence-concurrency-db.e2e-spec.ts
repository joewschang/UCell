import { randomUUID } from 'node:crypto';
import { InventoryPersistenceService, PrismaService } from '@ucell/database';

const testDatabaseUrl = process.env.INVENTORY_PERSISTENCE_TEST_DATABASE_URL
  ?? process.env.PHASE2_TEST_DATABASE_URL
  ?? 'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public';
const parsed = new URL(testDatabaseUrl);
if (!['localhost', '127.0.0.1'].includes(parsed.hostname) || !parsed.pathname.slice(1).endsWith('_test')) {
  throw new Error('INVENTORY_PERSISTENCE_TEST_DATABASE_REQUIRED');
}
process.env.DATABASE_URL = testDatabaseUrl;

describe('Inventory persistence serializable concurrency boundary', () => {
  const db = new PrismaService();
  const inventory = new InventoryPersistenceService(db);
  let qualificationId: string;
  let warehouseId: string;

  beforeAll(async () => {
    const person = await db.person.create({ data: { legalName: `INVENTORY CONCURRENCY ${randomUUID()}`, status: 'EFFECTIVE' } });
    qualificationId = (await db.qualification.create({ data: {
      currentHolderPersonId: person.personId, planLevelCode: 'STARTER', status: 'EFFECTIVE', effectiveAt: new Date(),
    } })).qualificationId;
    warehouseId = (await db.warehouse.create({ data: {
      code: `CONCURRENCY-${randomUUID()}`, name: 'Concurrency test', status: 'EFFECTIVE',
    } })).warehouseId;
  });

  afterAll(async () => db.$disconnect());

  async function fixture(onHand: number, quantity: number) {
    const product = await db.productReference.create({ data: {
      sku: `CONCURRENCY-${randomUUID()}`, displayName: 'Concurrency Product', currentPrice: '100.00', isActive: true,
    } });
    const item = await db.inventoryItem.create({ data: {
      productId: product.productId, sku: `INV-${randomUUID()}`, status: 'EFFECTIVE',
    } });
    await db.inventoryBalance.create({ data: { warehouseId, inventoryItemId: item.inventoryItemId, onHand } });
    const order = await db.order.create({ data: {
      qualificationId, purpose: 'RETAIL', status: 'CONFIRMED', currency: 'TWD',
      grossAmount: quantity * 100, netAmount: quantity * 100, ruleVersionCode: 'TEST_ONLY_INVENTORY_CONCURRENCY',
      lines: { create: [{
        productId: product.productId, skuSnapshot: product.sku, productNameSnapshot: product.displayName,
        quantity, unitPrice: 100, lineAmount: quantity * 100, gpvRateSnapshot: 0,
        gpvAmountSnapshot: 0, pvRateSnapshot: 0, ruleProfileSnapshot: { testOnly: true },
      }] },
    }, include: { lines: true } });
    return { item, order, orderLine: order.lines[0] };
  }

  function reserve(row: Awaited<ReturnType<typeof fixture>>, idempotencyKey: string) {
    return inventory.execute({
      operationType: 'RESERVE', warehouseId, orderId: row.order.orderId,
      sourceType: 'ORDER', sourceId: row.order.orderId, idempotencyKey,
      policyVersion: 'TEST_ONLY_CONCURRENCY_V1', occurredAt: new Date('2026-09-17T00:00:00Z'),
      correlationId: randomUUID(), lines: [{
        orderLineId: row.orderLine.orderLineId, inventoryItemId: row.item.inventoryItemId,
        quantity: row.orderLine.quantity.toNumber(),
      }],
    });
  }

  it('collapses concurrent duplicate delivery and lost-response retry to one monetary-neutral stock effect', async () => {
    const row = await fixture(2, 2);
    const key = `reserve-${randomUUID()}`;
    const concurrent = await Promise.all([reserve(row, key), reserve(row, key)]);
    expect(concurrent.map((result) => result.replayed).sort()).toEqual([false, true]);
    expect((await reserve(row, key)).replayed).toBe(true);
    expect(await db.inventoryReservation.count({ where: { orderId: row.order.orderId } })).toBe(1);
    expect(await db.inventoryMovement.count({ where: { sourceType: 'ORDER', sourceId: row.order.orderId } })).toBe(1);
    expect(await db.inventoryOperationClaim.count({ where: { sourceType: 'ORDER', sourceId: row.order.orderId } })).toBe(1);
    const balance = await db.inventoryBalance.findUniqueOrThrow({ where: {
      warehouseId_inventoryItemId: { warehouseId, inventoryItemId: row.item.inventoryItemId },
    } });
    expect(balance.reserved.toString()).toBe('2');
    expect(balance.version).toBe(1);
  }, 30_000);

  it('serializes competing orders so available stock cannot be oversold', async () => {
    const first = await fixture(3, 2);
    const secondOrder = await db.order.create({ data: {
      qualificationId, purpose: 'RETAIL', status: 'CONFIRMED', currency: 'TWD', grossAmount: 200, netAmount: 200,
      ruleVersionCode: 'TEST_ONLY_INVENTORY_CONCURRENCY', lines: { create: [{
        productId: first.orderLine.productId, skuSnapshot: first.orderLine.skuSnapshot,
        productNameSnapshot: first.orderLine.productNameSnapshot, quantity: 2, unitPrice: 100, lineAmount: 200,
        gpvRateSnapshot: 0, gpvAmountSnapshot: 0, pvRateSnapshot: 0, ruleProfileSnapshot: { testOnly: true },
      }] },
    }, include: { lines: true } });
    const second = { item: first.item, order: secondOrder, orderLine: secondOrder.lines[0] };
    const outcomes = await Promise.allSettled([
      reserve(first, `compete-${randomUUID()}`), reserve(second, `compete-${randomUUID()}`),
    ]);
    expect(outcomes.filter((outcome) => outcome.status === 'fulfilled')).toHaveLength(1);
    expect(outcomes.filter((outcome) => outcome.status === 'rejected')).toHaveLength(1);
    expect((outcomes.find((outcome) => outcome.status === 'rejected') as PromiseRejectedResult).reason)
      .toMatchObject({ code: 'INVENTORY_INSUFFICIENT_AVAILABLE' });
    const balance = await db.inventoryBalance.findUniqueOrThrow({ where: {
      warehouseId_inventoryItemId: { warehouseId, inventoryItemId: first.item.inventoryItemId },
    } });
    expect(balance.reserved.toString()).toBe('2');
    expect(balance.onHand.minus(balance.reserved).toString()).toBe('1');
    expect(await db.inventoryReservation.count({ where: { orderId: { in: [first.order.orderId, second.order.orderId] } } })).toBe(1);
  }, 30_000);
});
