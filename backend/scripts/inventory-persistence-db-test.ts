import * as assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import {
  InventoryPersistenceService,
  InventoryPersistenceError,
  ReserveInventoryCommand,
} from '../apps/api/src/modules/inventory-lite/inventory-persistence.service';
import { hashInventoryOperationResult, InventoryOperationError } from '../apps/api/src/modules/inventory-lite/inventory-operation';

const url = new URL(process.env.DATABASE_URL ?? '');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'DB regression must run on local PostgreSQL');
const db = new PrismaClient();
const inventory = new InventoryPersistenceService(
  db as unknown as ConstructorParameters<typeof InventoryPersistenceService>[0],
);
const suffix = randomUUID().slice(0, 8);
let assertions = 0;
const eq = (actual: unknown, expected: unknown, message: string) => {
  assert.deepEqual(actual, expected, message);
  assertions += 1;
};

type FixtureItem = { inventoryItemId: string; productId: string };

async function createQualification() {
  const person = await db.person.create({ data: { legalName: `INVENTORY DB ${suffix}`, status: 'EFFECTIVE' } });
  return db.qualification.create({ data: {
    currentHolderPersonId: person.personId,
    planLevelCode: 'STARTER',
    status: 'EFFECTIVE',
    effectiveAt: new Date('2026-09-17T00:00:00Z'),
  } });
}

async function createItem(sku: string, warehouseId: string, onHand: number, reserved = 0): Promise<FixtureItem> {
  const product = await db.productReference.create({ data: {
    sku: `${sku}-${suffix}`, displayName: sku, currentPrice: 100,
  } });
  const item = await db.inventoryItem.create({ data: {
    productId: product.productId, sku: `INV-${sku}-${suffix}`, status: 'EFFECTIVE',
  } });
  await db.inventoryBalance.create({ data: { warehouseId, inventoryItemId: item.inventoryItemId, onHand, reserved } });
  return item;
}

async function createOrder(qualificationId: string, items: readonly FixtureItem[], quantities: readonly number[]) {
  return db.order.create({ data: {
    qualificationId,
    status: 'CONFIRMED',
    grossAmount: quantities.reduce((sum, quantity) => sum + quantity * 100, 0),
    netAmount: quantities.reduce((sum, quantity) => sum + quantity * 100, 0),
    ruleVersionCode: 'TEST_ONLY_INVENTORY_PERSISTENCE',
    lines: { create: items.map((item, index) => ({
      productId: item.productId,
      skuSnapshot: `SKU-${index}`,
      productNameSnapshot: `Inventory ${index}`,
      quantity: quantities[index],
      unitPrice: 100,
      lineAmount: quantities[index] * 100,
      gpvRateSnapshot: 0,
      gpvAmountSnapshot: 0,
      ruleProfileSnapshot: { testOnly: true },
    })) },
  }, include: { lines: { orderBy: { orderLineId: 'asc' } } } });
}

function reserveCommand(
  warehouseId: string,
  order: Awaited<ReturnType<typeof createOrder>>,
  items: readonly FixtureItem[],
  quantities: readonly number[],
  key: string,
): ReserveInventoryCommand {
  return {
    operationType: 'RESERVE', warehouseId, orderId: order.orderId,
    sourceType: 'ORDER', sourceId: order.orderId, idempotencyKey: key,
    policyVersion: 'TEST_ONLY_INVENTORY_POLICY_V1',
    lines: items.map((item, index) => ({
      orderLineId: order.lines.find((line) => line.productId === item.productId)!.orderLineId,
      inventoryItemId: item.inventoryItemId,
      quantity: quantities[index],
    })),
    occurredAt: new Date('2026-09-17T01:00:00Z'), correlationId: randomUUID(),
  };
}

async function main() {
  const qualification = await createQualification();
  const warehouse = await db.warehouse.create({ data: { code: `WH-${suffix}`, name: 'Inventory DB Test', status: 'EFFECTIVE' } });

  // Final available unit: exactly one competing transaction may commit.
  const finalItem = await createItem('FINAL', warehouse.warehouseId, 1);
  const finalOrderA = await createOrder(qualification.qualificationId, [finalItem], [1]);
  const finalOrderB = await createOrder(qualification.qualificationId, [finalItem], [1]);
  const finalCompetition = await Promise.allSettled([
    inventory.execute(reserveCommand(warehouse.warehouseId, finalOrderA, [finalItem], [1], `final-a-${suffix}`)),
    inventory.execute(reserveCommand(warehouse.warehouseId, finalOrderB, [finalItem], [1], `final-b-${suffix}`)),
  ]);
  if (finalCompetition.every((result) => result.status === 'rejected')) {
    throw new AggregateError(finalCompetition.map((result) => (result as PromiseRejectedResult).reason), 'both final-unit reservations failed');
  }
  eq(finalCompetition.filter((result) => result.status === 'fulfilled').length, 1, 'one final-unit reservation commits');
  eq(finalCompetition.filter((result) => result.status === 'rejected').length, 1, 'one final-unit reservation fails closed');
  const finalBalance = await db.inventoryBalance.findUniqueOrThrow({ where: {
    warehouseId_inventoryItemId: { warehouseId: warehouse.warehouseId, inventoryItemId: finalItem.inventoryItemId },
  } });
  eq(finalBalance.reserved.toString(), '1', 'final unit cannot be over-reserved');

  // Twenty simultaneous deliveries collapse to one durable operation.
  const retryItem = await createItem('RETRY', warehouse.warehouseId, 10);
  const retryOrder = await createOrder(qualification.qualificationId, [retryItem], [2]);
  const retryCommand = reserveCommand(warehouse.warehouseId, retryOrder, [retryItem], [2], `retry-20-${suffix}`);
  const retries = await Promise.all(Array.from({ length: 20 }, () => inventory.execute(retryCommand)));
  eq(new Set(retries.map((result) => result.claimId)).size, 1, '20 deliveries read one committed claim');
  eq(retries.filter((result) => !result.replayed).length, 1, 'only one of 20 deliveries applies');
  eq(await db.inventoryMovement.count({ where: { idempotencyKey: { startsWith: retryCommand.idempotencyKey } } }), 1, 'one movement persists');
  eq(await db.outboxEvent.count({ where: { outboxEventId: retries[0].outboxEventId } }), 1, 'one outbox intent persists');

  // Opposite caller line order is canonicalized before locks, avoiding deadlock.
  const itemA = await createItem('ORDER-A', warehouse.warehouseId, 10);
  const itemB = await createItem('ORDER-B', warehouse.warehouseId, 10);
  const reverseOrderA = await createOrder(qualification.qualificationId, [itemA, itemB], [1, 1]);
  const reverseOrderB = await createOrder(qualification.qualificationId, [itemB, itemA], [1, 1]);
  const reverse = await Promise.all([
    inventory.execute(reserveCommand(warehouse.warehouseId, reverseOrderA, [itemA, itemB], [1, 1], `reverse-a-${suffix}`)),
    inventory.execute(reserveCommand(warehouse.warehouseId, reverseOrderB, [itemB, itemA], [1, 1], `reverse-b-${suffix}`)),
  ]);
  eq(reverse.every((result) => !result.replayed), true, 'reverse-order transactions both commit without deadlock');

  // A failure after balance/movement writes rolls the entire transaction back.
  const rollbackItem = await createItem('ROLLBACK', warehouse.warehouseId, 5);
  const rollbackOrder = await createOrder(qualification.qualificationId, [rollbackItem], [1]);
  const rollbackKey = `rollback-${suffix}`;
  await db.$executeRawUnsafe(`CREATE OR REPLACE FUNCTION commerce.inventory_test_reject_reservation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.source_effect_key = '${rollbackKey}' THEN RAISE EXCEPTION 'TEST_ONLY_INJECTED_RESERVATION_FAILURE'; END IF; RETURN NEW; END $$`);
  await db.$executeRawUnsafe(`CREATE TRIGGER inventory_test_reject_reservation BEFORE INSERT ON commerce.inventory_reservation FOR EACH ROW EXECUTE FUNCTION commerce.inventory_test_reject_reservation()`);
  try {
    await assert.rejects(inventory.execute(reserveCommand(warehouse.warehouseId, rollbackOrder, [rollbackItem], [1], rollbackKey)));
  } finally {
    await db.$executeRawUnsafe('DROP TRIGGER IF EXISTS inventory_test_reject_reservation ON commerce.inventory_reservation');
    await db.$executeRawUnsafe('DROP FUNCTION IF EXISTS commerce.inventory_test_reject_reservation()');
  }
  const rollbackBalance = await db.inventoryBalance.findUniqueOrThrow({ where: {
    warehouseId_inventoryItemId: { warehouseId: warehouse.warehouseId, inventoryItemId: rollbackItem.inventoryItemId },
  } });
  eq(rollbackBalance.reserved.toString(), '0', 'injected failure rolls back balance');
  eq(await db.inventoryOperationClaim.count({ where: { idempotencyKey: rollbackKey } }), 0, 'injected failure rolls back claim');
  eq(await db.inventoryMovement.count({ where: { idempotencyKey: { startsWith: rollbackKey } } }), 0, 'injected failure rolls back movement');
  const retryAfterRollback = await inventory.execute(reserveCommand(warehouse.warehouseId, rollbackOrder, [rollbackItem], [1], rollbackKey));
  eq(retryAfterRollback.replayed, false, 'retry after rollback applies cleanly');

  // Release must bind to original reservation evidence and remaining quantity.
  const releaseItem = await createItem('RELEASE', warehouse.warehouseId, 6);
  const releaseOrder = await createOrder(qualification.qualificationId, [releaseItem], [4]);
  const reserved = await inventory.execute(reserveCommand(warehouse.warehouseId, releaseOrder, [releaseItem], [4], `reserve-release-${suffix}`));
  const reservation = await db.inventoryReservation.findUniqueOrThrow({
    where: { inventoryReservationId: reserved.reservationId }, include: { lines: true },
  });
  const releaseBase = {
    operationType: 'RELEASE' as const,
    warehouseId: warehouse.warehouseId,
    reservationId: reservation.inventoryReservationId,
    sourceType: 'INVENTORY_RESERVATION' as const,
    sourceId: reservation.inventoryReservationId,
    lines: [{
      inventoryReservationLineId: reservation.lines[0].inventoryReservationLineId,
      inventoryItemId: releaseItem.inventoryItemId,
      quantity: 2,
    }],
    occurredAt: new Date('2026-09-17T02:00:00Z'),
    correlationId: randomUUID(),
  };
  const firstRelease = await inventory.execute({ ...releaseBase, idempotencyKey: `release-one-${suffix}` });
  const duplicateRelease = await inventory.execute({ ...releaseBase, idempotencyKey: `release-one-${suffix}` });
  eq(duplicateRelease.replayed, true, 'duplicate release returns persisted result');
  eq(duplicateRelease.claimId, firstRelease.claimId, 'duplicate release cannot create a second claim');
  await assert.rejects(
    inventory.execute({ ...releaseBase, idempotencyKey: `release-excess-${suffix}`, lines: [{ ...releaseBase.lines[0], quantity: 3 }] }),
    (error: unknown) => error instanceof InventoryPersistenceError && error.code === 'INVENTORY_RESERVATION_EVIDENCE_INCOMPLETE',
  );
  assertions += 1;
  const secondRelease = await inventory.execute({ ...releaseBase, idempotencyKey: `release-two-${suffix}` });
  const releasedReservation = await db.inventoryReservation.findUniqueOrThrow({ where: { inventoryReservationId: reservation.inventoryReservationId } });
  eq(releasedReservation.status, 'RELEASED', 'cumulative exact release closes reservation');
  eq(firstRelease.reservationId, secondRelease.reservationId, 'all releases retain original reservation reference');

  // A syntactically present claim without its append-only evidence must fail closed.
  const incompleteItem = await createItem('INCOMPLETE', warehouse.warehouseId, 2);
  const incompleteOrder = await createOrder(qualification.qualificationId, [incompleteItem], [1]);
  const incompleteCommand = reserveCommand(warehouse.warehouseId, incompleteOrder, [incompleteItem], [1], `incomplete-${suffix}`);
  const canonicalPayload = {
    schemaVersion: 1, operationType: 'RESERVE', warehouseId: warehouse.warehouseId,
    sourceType: 'ORDER', sourceId: incompleteOrder.orderId, idempotencyKey: incompleteCommand.idempotencyKey,
    lines: [{ inventoryItemId: incompleteItem.inventoryItemId, quantity: 1 }],
  };
  const operationHash = createHash('sha256').update(JSON.stringify(canonicalPayload)).digest('hex');
  const result = { items: [{
    inventoryItemId: incompleteItem.inventoryItemId, movementType: 'RESERVE' as const, quantity: 1,
    before: { onHand: 2, reserved: 0, available: 2 }, after: { onHand: 2, reserved: 1, available: 1 },
  }] };
  const outbox = await db.outboxEvent.create({ data: {
    eventType: 'TEST_ONLY_INCOMPLETE_INVENTORY', aggregateType: 'INVENTORY_RESERVATION', aggregateId: randomUUID(),
    correlationId: randomUUID(), payload: { testOnly: true },
  } });
  await db.inventoryOperationClaim.create({ data: {
    warehouseId: warehouse.warehouseId, operationType: 'RESERVE', sourceType: 'ORDER', sourceId: incompleteOrder.orderId,
    idempotencyKey: incompleteCommand.idempotencyKey, operationHash,
    resultHash: hashInventoryOperationResult(result), resultSnapshot: result,
    outboxEventId: outbox.outboxEventId,
  } });
  await assert.rejects(
    inventory.execute(incompleteCommand),
    (error: unknown) => error instanceof Error && (error as InventoryOperationError).code === 'INVENTORY_OPERATION_CLAIM_INCOMPLETE',
  );
  assertions += 1;

  console.log(`INVENTORY_PERSISTENCE_DB_PASS: ${assertions} assertions; final-unit concurrency, 20-delivery replay, canonical lock order, rollback, release cap and incomplete evidence fail-closed`);
}

main().finally(() => db.$disconnect());
