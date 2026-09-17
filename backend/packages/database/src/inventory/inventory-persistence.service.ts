import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { randomUUID } from 'node:crypto';
import {
  decideInventoryOperation,
  hashInventoryOperationResult,
  InventoryOperationDecision,
  InventoryOperationError,
  PersistedInventoryOperationClaim,
} from './inventory-operation';

type DbClient = Prisma.TransactionClient;

interface ReserveLine {
  orderLineId: string;
  inventoryItemId: string;
  quantity: number;
}

interface ReleaseLine {
  inventoryReservationLineId: string;
  inventoryItemId: string;
  quantity: number;
}

export interface ReserveInventoryCommand {
  operationType: 'RESERVE';
  warehouseId: string;
  orderId: string;
  sourceType: 'ORDER';
  sourceId: string;
  idempotencyKey: string;
  policyVersion: string;
  lines: readonly ReserveLine[];
  occurredAt: Date;
  correlationId: string;
}

export interface ReleaseInventoryCommand {
  operationType: 'RELEASE';
  warehouseId: string;
  reservationId: string;
  sourceType: 'INVENTORY_RESERVATION';
  sourceId: string;
  idempotencyKey: string;
  lines: readonly ReleaseLine[];
  occurredAt: Date;
  correlationId: string;
}

export type PersistInventoryCommand = ReserveInventoryCommand | ReleaseInventoryCommand;

export interface PersistInventoryResult {
  replayed: boolean;
  claimId: string;
  reservationId: string;
  outboxEventId: string;
  decision: InventoryOperationDecision;
}

export class InventoryPersistenceError extends Error {
  constructor(
    readonly code:
      | 'INVENTORY_REFERENCE_INVALID'
      | 'INVENTORY_RESERVATION_MISSING'
      | 'INVENTORY_RESERVATION_EVIDENCE_INCOMPLETE'
      | 'INVENTORY_RETRY_EXHAUSTED',
    message: string,
  ) {
    super(message);
    this.name = 'InventoryPersistenceError';
  }
}

/**
 * Durable RESERVE/RELEASE boundary. PICK, SHIP, reservation TTL and warehouse
 * allocation deliberately remain outside this service because their semantics
 * are not approved.
 */
@Injectable()
export class InventoryPersistenceService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: PersistInventoryCommand): Promise<PersistInventoryResult> {
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(
          (tx) => this.executeTransaction(tx, command),
          { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
        );
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2034' || attempt === 3) {
          if ((error as { code?: string }).code === 'P2034') {
            throw new InventoryPersistenceError(
              'INVENTORY_RETRY_EXHAUSTED',
              'Inventory transaction could not be serialized after three attempts.',
            );
          }
          throw error;
        }
      }
    }
    throw new InventoryPersistenceError('INVENTORY_RETRY_EXHAUSTED', 'Inventory retry loop ended unexpectedly.');
  }

  private async executeTransaction(tx: DbClient, command: PersistInventoryCommand): Promise<PersistInventoryResult> {
    this.assertCommandReferences(command);
    await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`inventory-operation:${command.idempotencyKey}`}, 0))) lock_row`;

    const replay = await this.readCommittedClaim(tx, command.idempotencyKey);
    if (replay) return this.replayResult(command, replay);

    const canonicalItemIds = [...new Set(command.lines.map((line) => line.inventoryItemId.trim()))].sort();
    for (const inventoryItemId of canonicalItemIds) {
      await tx.$queryRaw`SELECT true AS locked FROM (SELECT pg_advisory_xact_lock(hashtextextended(${`inventory-balance:${command.warehouseId}:${inventoryItemId}`}, 0))) lock_row`;
    }

    // The claim must be checked again after acquiring balance locks. This makes
    // a lost-response retry deterministic even when it waited behind the first writer.
    const claimAfterLock = await this.readCommittedClaim(tx, command.idempotencyKey);
    if (claimAfterLock) return this.replayResult(command, claimAfterLock);

    const reservationId = command.operationType === 'RESERVE'
      ? await this.validateReserveReferences(tx, command)
      : await this.validateReleaseReferences(tx, command);

    const balanceRows = await tx.inventoryBalance.findMany({
      where: { warehouseId: command.warehouseId, inventoryItemId: { in: canonicalItemIds } },
      orderBy: { inventoryItemId: 'asc' },
    });
    const balances = Object.fromEntries(balanceRows.map((row) => [row.inventoryItemId, {
      onHand: this.asSafeInteger(row.onHand, 'onHand'),
      reserved: this.asSafeInteger(row.reserved, 'reserved'),
      available: this.asSafeInteger(row.onHand.minus(row.reserved), 'available'),
    }]));
    const decision = decideInventoryOperation({
      command: {
        operationType: command.operationType,
        warehouseId: command.warehouseId,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        idempotencyKey: command.idempotencyKey,
        lines: command.lines.map(({ inventoryItemId, quantity }) => ({ inventoryItemId, quantity })),
      },
      balances,
      existingClaim: null,
    });

    const outbox = await tx.outboxEvent.create({ data: {
      eventType: command.operationType === 'RESERVE' ? 'INVENTORY_RESERVED' : 'INVENTORY_RELEASED',
      aggregateType: 'INVENTORY_RESERVATION',
      aggregateId: reservationId,
      correlationId: command.correlationId,
      payload: {
        schemaVersion: 1,
        reservationId,
        warehouseId: command.warehouseId,
        operationType: command.operationType,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        operationHash: decision.operationHash,
        items: decision.items,
      } as unknown as Prisma.InputJsonValue,
    } });
    const resultSnapshot = { items: decision.items };
    const claim = await tx.inventoryOperationClaim.create({ data: {
      warehouseId: command.warehouseId,
      operationType: command.operationType,
      sourceType: command.sourceType,
      sourceId: command.sourceId,
      idempotencyKey: command.idempotencyKey,
      operationHash: decision.operationHash,
      resultHash: hashInventoryOperationResult(resultSnapshot),
      resultSnapshot: resultSnapshot as unknown as Prisma.InputJsonValue,
      outboxEventId: outbox.outboxEventId,
    } });

    for (const item of decision.items) {
      await tx.inventoryBalance.update({
        where: { warehouseId_inventoryItemId: { warehouseId: command.warehouseId, inventoryItemId: item.inventoryItemId } },
        data: { reserved: item.after.reserved, version: { increment: 1 } },
      });
      await tx.inventoryMovement.create({ data: {
        warehouseId: command.warehouseId,
        inventoryItemId: item.inventoryItemId,
        operationClaimId: claim.inventoryOperationClaimId,
        movementType: command.operationType,
        quantity: item.quantity,
        onHandDelta: 0,
        reservedDelta: command.operationType === 'RESERVE' ? item.quantity : -item.quantity,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        sourceLineId: this.sourceLineReference(command, item.inventoryItemId),
        idempotencyKey: `${command.idempotencyKey}:${item.inventoryItemId}`,
        occurredAt: command.occurredAt,
        correlationId: command.correlationId,
      } });
      await tx.inventoryBalanceEvidence.create({ data: {
        operationClaimId: claim.inventoryOperationClaimId,
        warehouseId: command.warehouseId,
        inventoryItemId: item.inventoryItemId,
        beforeOnHand: item.before.onHand,
        beforeReserved: item.before.reserved,
        afterOnHand: item.after.onHand,
        afterReserved: item.after.reserved,
      } });
    }

    if (command.operationType === 'RESERVE') {
      await tx.inventoryReservation.create({ data: {
        inventoryReservationId: reservationId,
        orderId: command.orderId,
        warehouseId: command.warehouseId,
        sourceEffectKey: command.idempotencyKey,
        policyVersion: command.policyVersion,
        lines: { create: command.lines.map((line) => ({
          orderLineId: line.orderLineId,
          inventoryItemId: line.inventoryItemId,
          quantity: line.quantity,
        })) },
      } });
    } else {
      for (const line of command.lines) {
        await tx.inventoryReservationLine.update({
          where: { inventoryReservationLineId: line.inventoryReservationLineId },
          data: { releasedQuantity: { increment: line.quantity } },
        });
      }
      const releasedLines = await tx.inventoryReservationLine.findMany({
        where: { inventoryReservationId: command.reservationId },
        select: { quantity: true, releasedQuantity: true },
      });
      const remaining = releasedLines.filter((line) => line.releasedQuantity.lessThan(line.quantity)).length;
      await tx.inventoryReservation.update({
        where: { inventoryReservationId: command.reservationId },
        data: { status: remaining === 0 ? 'RELEASED' : 'PARTIALLY_RELEASED' },
      });
    }

    return { replayed: false, claimId: claim.inventoryOperationClaimId, reservationId, outboxEventId: outbox.outboxEventId, decision };
  }

  private async validateReserveReferences(tx: DbClient, command: ReserveInventoryCommand): Promise<string> {
    const order = await tx.order.findUnique({ where: { orderId: command.orderId }, include: { lines: true } });
    if (!order || command.sourceId !== command.orderId || command.lines.length === 0 || !command.policyVersion.trim()) {
      throw new InventoryPersistenceError('INVENTORY_REFERENCE_INVALID', 'Reserve must reference one existing order and policy version.');
    }
    const itemIds = [...new Set(command.lines.map((line) => line.inventoryItemId))];
    const items = await tx.inventoryItem.findMany({ where: { inventoryItemId: { in: itemIds }, status: 'EFFECTIVE' } });
    const productsByItem = new Map(items.map((item) => [item.inventoryItemId, item.productId]));
    const orderLines = new Map(order.lines.map((line) => [line.orderLineId, line]));
    const requestedByOrderLine = new Map<string, Prisma.Decimal>();
    for (const line of command.lines) {
      requestedByOrderLine.set(
        line.orderLineId,
        (requestedByOrderLine.get(line.orderLineId) ?? new Prisma.Decimal(0)).plus(line.quantity),
      );
    }
    if (items.length !== itemIds.length || command.lines.some((line) => {
      const orderLine = orderLines.get(line.orderLineId);
      return !orderLine || orderLine.productId !== productsByItem.get(line.inventoryItemId)
        || requestedByOrderLine.get(line.orderLineId)!.greaterThan(orderLine.quantity);
    })) {
      throw new InventoryPersistenceError('INVENTORY_REFERENCE_INVALID', 'Reserve line is not backed by the referenced order line and inventory item.');
    }
    return randomUUID();
  }

  private async validateReleaseReferences(tx: DbClient, command: ReleaseInventoryCommand): Promise<string> {
    if (command.sourceId !== command.reservationId || command.lines.length === 0) {
      throw new InventoryPersistenceError('INVENTORY_REFERENCE_INVALID', 'Release must use the original reservation as its source.');
    }
    const reservation = await tx.inventoryReservation.findUnique({
      where: { inventoryReservationId: command.reservationId }, include: { lines: true },
    });
    if (!reservation || reservation.warehouseId !== command.warehouseId) {
      throw new InventoryPersistenceError('INVENTORY_RESERVATION_MISSING', 'Original inventory reservation was not found in the requested warehouse.');
    }
    const byId = new Map(reservation.lines.map((line) => [line.inventoryReservationLineId, line]));
    const seen = new Set<string>();
    for (const requested of command.lines) {
      const original = byId.get(requested.inventoryReservationLineId);
      if (!original || original.inventoryItemId !== requested.inventoryItemId || seen.has(requested.inventoryReservationLineId)
        || !Number.isSafeInteger(requested.quantity) || requested.quantity <= 0
        || new Prisma.Decimal(requested.quantity).greaterThan(original.quantity.minus(original.releasedQuantity))) {
        throw new InventoryPersistenceError(
          'INVENTORY_RESERVATION_EVIDENCE_INCOMPLETE',
          'Release exceeds or does not match the remaining quantity of its original reservation line.',
        );
      }
      seen.add(requested.inventoryReservationLineId);
    }
    return reservation.inventoryReservationId;
  }

  private async readCommittedClaim(tx: DbClient, idempotencyKey: string) {
    return tx.inventoryOperationClaim.findUnique({
      where: { idempotencyKey },
      include: {
        outboxEvent: true,
        movements: { orderBy: { inventoryItemId: 'asc' } },
        balanceEvidence: { orderBy: { inventoryItemId: 'asc' } },
      },
    });
  }

  private replayResult(command: PersistInventoryCommand, claim: NonNullable<Awaited<ReturnType<InventoryPersistenceService['readCommittedClaim']>>>): PersistInventoryResult {
    const persisted: PersistedInventoryOperationClaim = {
      operationHash: claim.operationHash,
      resultHash: claim.resultHash,
      result: claim.resultSnapshot as unknown as PersistedInventoryOperationClaim['result'],
      movementEvidenceRefs: claim.movements.map((row) => row.inventoryMovementId),
      balanceEvidenceRefs: claim.balanceEvidence.map((row) => row.inventoryBalanceEvidenceId),
      outboxIntentRef: claim.outboxEventId,
    };
    const decision = decideInventoryOperation({
      command: {
        operationType: command.operationType,
        warehouseId: command.warehouseId,
        sourceType: command.sourceType,
        sourceId: command.sourceId,
        idempotencyKey: command.idempotencyKey,
        lines: command.lines.map(({ inventoryItemId, quantity }) => ({ inventoryItemId, quantity })),
      },
      balances: {},
      existingClaim: persisted,
    });
    const reservationId = command.operationType === 'RESERVE'
      ? claim.outboxEvent.aggregateId
      : command.reservationId;
    return { replayed: true, claimId: claim.inventoryOperationClaimId, reservationId, outboxEventId: claim.outboxEventId, decision };
  }

  private sourceLineReference(command: PersistInventoryCommand, inventoryItemId: string): string | null {
    if (command.operationType === 'RESERVE') {
      const matching = command.lines.filter((line) => line.inventoryItemId === inventoryItemId);
      return matching.length === 1 ? matching[0].orderLineId : null;
    }
    const matching = command.lines.filter((line) => line.inventoryItemId === inventoryItemId);
    return matching.length === 1 ? matching[0].inventoryReservationLineId : null;
  }

  private assertCommandReferences(command: PersistInventoryCommand): void {
    if (!command.correlationId.trim() || Number.isNaN(command.occurredAt.getTime())) {
      throw new InventoryPersistenceError('INVENTORY_REFERENCE_INVALID', 'Correlation ID and occurredAt are required.');
    }
  }

  private asSafeInteger(value: Prisma.Decimal, field: string): number {
    const number = value.toNumber();
    if (!Number.isSafeInteger(number)) {
      throw new InventoryPersistenceError('INVENTORY_REFERENCE_INVALID', `${field} must be an integer within the safe range.`);
    }
    return number;
  }
}
