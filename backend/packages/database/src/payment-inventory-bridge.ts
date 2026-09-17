import { Prisma, PrismaClient } from '@prisma/client';
import { InventoryPersistenceService } from './inventory/inventory-persistence.service';
import { OutboxLease, withOutboxLease } from './outbox-lease';

export interface PaymentInventoryBridgeConfig {
  warehouseId: string;
  policyVersion: string;
}

export type PaymentInventoryBridgeResult =
  | { action: 'NOOP_STATUS'; paymentId: string; orderId: string }
  | { action: 'RESERVED' | 'NOOP_REPLAY'; paymentId: string; orderId: string; reservationId: string; inventoryOperationClaimId: string };

export class PaymentInventoryBridgeError extends Error {
  constructor(readonly code:
    | 'PAYMENT_INVENTORY_EVENT_INVALID'
    | 'PAYMENT_INVENTORY_EVIDENCE_INCOMPLETE'
    | 'INVENTORY_ALLOCATION_CONFIGURATION_PENDING'
    | 'INVENTORY_ITEM_MAPPING_AMBIGUOUS', message: string) {
    super(message);
    this.name = 'PaymentInventoryBridgeError';
  }
}

interface PaymentInventorySource {
  paymentId: string;
  orderId: string;
  paymentStateTransitionId: string;
  toStatus: string;
  occurredAt: Date;
  correlationId: string;
  lines: Array<{ orderLineId: string; inventoryItemId: string; quantity: number }>;
}

/**
 * Connected DEV bridge from a verified payment transition to a durable stock
 * reservation. It deliberately does not implement provider verification,
 * fulfillment, PICK/SHIP, or monetary recognition.
 */
export async function processPaymentInventoryReservation(
  db: PrismaClient,
  lease: OutboxLease,
  config: PaymentInventoryBridgeConfig,
): Promise<PaymentInventoryBridgeResult | { lostLease: true }> {
  const source = await readAndProjectVerifiedPayment(db, lease);
  if ('lostLease' in source) return source;

  if (source.toStatus !== 'PAID') {
    const acknowledged = await acknowledge(db, lease);
    return 'lostLease' in acknowledged
      ? acknowledged
      : { action: 'NOOP_STATUS', paymentId: source.paymentId, orderId: source.orderId };
  }

  assertConfig(config);
  const inventory = new InventoryPersistenceService(db as unknown as ConstructorParameters<typeof InventoryPersistenceService>[0]);
  const result = await inventory.execute({
    operationType: 'RESERVE',
    warehouseId: config.warehouseId,
    orderId: source.orderId,
    sourceType: 'ORDER',
    sourceId: source.orderId,
    idempotencyKey: `payment-transition:${source.paymentStateTransitionId}:inventory-reserve`,
    policyVersion: config.policyVersion,
    lines: source.lines,
    occurredAt: source.occurredAt,
    correlationId: source.correlationId,
  });
  const acknowledged = await acknowledge(db, lease);
  if ('lostLease' in acknowledged) return acknowledged;
  return {
    action: result.replayed ? 'NOOP_REPLAY' : 'RESERVED',
    paymentId: source.paymentId,
    orderId: source.orderId,
    reservationId: result.reservationId,
    inventoryOperationClaimId: result.claimId,
  };
}

async function readAndProjectVerifiedPayment(
  db: PrismaClient,
  lease: OutboxLease,
): Promise<PaymentInventorySource | { lostLease: true }> {
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT outbox_event_id FROM integration.outbox_event WHERE outbox_event_id=${lease.outboxEventId}::uuid FOR UPDATE`;
    const event = await tx.outboxEvent.findUnique({ where: { outboxEventId: lease.outboxEventId } });
    if (!event || event.processStatus !== 'PROCESSING' || event.attemptCount !== lease.attemptCount
      || event.availableAt.getTime() !== lease.availableAt.getTime() || event.availableAt <= new Date()) return { lostLease: true } as const;
    if (event.eventType !== 'PAYMENT_STATE_TRANSITIONED') {
      throw new PaymentInventoryBridgeError('PAYMENT_INVENTORY_EVENT_INVALID', 'Worker bridge only accepts PAYMENT_STATE_TRANSITIONED.');
    }
    const payload = asPayload(event.payload);
    const transition = await tx.paymentStateTransition.findUnique({
      where: { paymentStateTransitionId: payload.paymentStateTransitionId },
      include: { providerEvidence: true, payment: { include: { order: { include: { lines: true } } } } },
    });
    if (!transition || transition.paymentId !== payload.paymentId
      || transition.paymentProviderEventEvidenceId !== payload.providerEventEvidenceId
      || transition.businessEffectIdentity !== payload.businessEffectIdentity
      || transition.operationHash !== payload.operationHash
      || transition.payment.orderId !== payload.orderId
      || transition.providerEvidence.paymentId !== transition.paymentId) {
      throw new PaymentInventoryBridgeError('PAYMENT_INVENTORY_EVIDENCE_INCOMPLETE', 'Payment transition and provider evidence do not match the outbox intent.');
    }
    const payment = transition.payment;
    const order = payment.order;
    if (!payment.amount.equals(order.netAmount) || payment.currency !== order.currency
      || !transition.amount.equals(payment.amount) || transition.currency !== payment.currency) {
      throw new PaymentInventoryBridgeError('PAYMENT_INVENTORY_EVIDENCE_INCOMPLETE', 'Payment amount/currency is not bound to the authoritative order snapshot.');
    }
    if (transition.toStatus === 'PAID') {
      if (!['CONFIRMED', 'PAID'].includes(order.status)) {
        throw new PaymentInventoryBridgeError('PAYMENT_INVENTORY_EVIDENCE_INCOMPLETE', `Order status ${order.status} cannot accept a PAID transition.`);
      }
      if (order.status === 'CONFIRMED') {
        await tx.order.update({ where: { orderId: order.orderId }, data: { status: 'PAID', paidAt: transition.occurredAt } });
      }
    }
    const productIds = [...new Set(order.lines.map(line => line.productId))];
    const items = transition.toStatus === 'PAID'
      ? await tx.inventoryItem.findMany({ where: { productId: { in: productIds }, status: 'EFFECTIVE' } })
      : [];
    const byProduct = new Map<string, typeof items>();
    for (const item of items) byProduct.set(item.productId, [...(byProduct.get(item.productId) ?? []), item]);
    const lines = transition.toStatus === 'PAID' ? order.lines.map(line => {
      const matches = byProduct.get(line.productId) ?? [];
      const quantity = line.quantity.toNumber();
      if (matches.length !== 1 || !Number.isSafeInteger(quantity) || quantity <= 0) {
        throw new PaymentInventoryBridgeError('INVENTORY_ITEM_MAPPING_AMBIGUOUS', 'Each paid order line requires one effective inventory item and a positive integer quantity.');
      }
      return { orderLineId: line.orderLineId, inventoryItemId: matches[0].inventoryItemId, quantity };
    }) : [];
    return {
      paymentId: payment.paymentId,
      orderId: order.orderId,
      paymentStateTransitionId: transition.paymentStateTransitionId,
      toStatus: transition.toStatus,
      occurredAt: transition.occurredAt,
      correlationId: event.correlationId,
      lines,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

async function acknowledge(db: PrismaClient, lease: OutboxLease) {
  return withOutboxLease(db, lease, async tx => {
    await tx.outboxEvent.update({ where: { outboxEventId: lease.outboxEventId }, data: { processStatus: 'PROCESSED', processedAt: new Date(), lastError: null } });
    return { acknowledged: true } as const;
  });
}

function assertConfig(config: PaymentInventoryBridgeConfig): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(config.warehouseId)
    || !config.policyVersion?.trim()) {
    throw new PaymentInventoryBridgeError('INVENTORY_ALLOCATION_CONFIGURATION_PENDING', 'An explicit warehouse and versioned allocation policy are required.');
  }
}

function asPayload(value: Prisma.JsonValue): {
  paymentId: string; orderId: string; paymentStateTransitionId: string; providerEventEvidenceId: string;
  businessEffectIdentity: string; operationHash: string;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new PaymentInventoryBridgeError('PAYMENT_INVENTORY_EVENT_INVALID', 'Payment outbox payload must be an object.');
  }
  const payload = value as Record<string, unknown>;
  for (const key of ['paymentId', 'orderId', 'paymentStateTransitionId', 'providerEventEvidenceId', 'businessEffectIdentity', 'operationHash']) {
    if (typeof payload[key] !== 'string' || !payload[key]) {
      throw new PaymentInventoryBridgeError('PAYMENT_INVENTORY_EVENT_INVALID', `Payment outbox payload is missing ${key}.`);
    }
  }
  return payload as ReturnType<typeof asPayload>;
}
