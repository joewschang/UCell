import { createHash } from 'node:crypto';
import {
  decideInventoryReleaseBatch,
  decideInventoryReservationBatch,
  InventoryReservationBatchDecision,
  InventoryReservationLine,
} from './inventory-reservation-batch';
import { InventoryBalanceSnapshot } from './inventory-reservation';

export type InventoryOperationType = 'RESERVE' | 'RELEASE';

export interface InventoryOperationCommand {
  operationType: InventoryOperationType;
  warehouseId: string;
  sourceType: string;
  sourceId: string;
  idempotencyKey: string;
  lines: ReadonlyArray<InventoryReservationLine>;
}

export interface PersistedInventoryOperationClaim {
  operationHash: string;
  movementEvidenceRefs: readonly string[];
  balanceEvidenceRefs: readonly string[];
  outboxIntentRef: string;
}

export interface InventoryOperationDecision extends InventoryReservationBatchDecision {
  action: 'APPLY' | 'NOOP_REPLAY';
  operationHash: string;
  canonicalCommand: Readonly<{
    schemaVersion: 1;
    operationType: InventoryOperationType;
    warehouseId: string;
    sourceType: string;
    sourceId: string;
    idempotencyKey: string;
    lines: ReadonlyArray<Readonly<{ inventoryItemId: string; quantity: number }>>;
  }>;
}

export class InventoryOperationError extends Error {
  constructor(
    readonly code:
      | 'INVENTORY_OPERATION_CONTEXT_INVALID'
      | 'INVENTORY_OPERATION_CONFLICT'
      | 'INVENTORY_OPERATION_CLAIM_INCOMPLETE',
    message: string,
  ) {
    super(message);
    this.name = 'InventoryOperationError';
  }
}

/** Pure decision boundary. The caller must lock all balances in canonical item order and
 * persist movements, balances, the operation claim and outbox intent in one transaction. */
export function decideInventoryOperation(input: {
  command: InventoryOperationCommand;
  balances: Readonly<Record<string, InventoryBalanceSnapshot>>;
  existingClaim: PersistedInventoryOperationClaim | null;
}): InventoryOperationDecision {
  const canonicalCommand = canonicalizeCommand(input.command);
  const operationHash = createHash('sha256')
    .update(JSON.stringify(canonicalCommand))
    .digest('hex');
  const batch = canonicalCommand.operationType === 'RESERVE'
    ? decideInventoryReservationBatch(input.balances, canonicalCommand.lines)
    : decideInventoryReleaseBatch(input.balances, canonicalCommand.lines);

  if (input.existingClaim !== null) {
    assertCompleteClaim(input.existingClaim, batch.items.length);
    if (input.existingClaim.operationHash !== operationHash) {
      throw new InventoryOperationError(
        'INVENTORY_OPERATION_CONFLICT',
        'The idempotency key is already bound to a different inventory operation.',
      );
    }
    return { action: 'NOOP_REPLAY', operationHash, canonicalCommand, items: batch.items };
  }

  return { action: 'APPLY', operationHash, canonicalCommand, items: batch.items };
}

function canonicalizeCommand(command: InventoryOperationCommand): InventoryOperationDecision['canonicalCommand'] {
  if (command.operationType !== 'RESERVE' && command.operationType !== 'RELEASE') {
    throw new InventoryOperationError(
      'INVENTORY_OPERATION_CONTEXT_INVALID',
      'Inventory operation type must be RESERVE or RELEASE.',
    );
  }
  const warehouseId = required(command.warehouseId);
  const sourceType = required(command.sourceType);
  const sourceId = required(command.sourceId);
  const idempotencyKey = required(command.idempotencyKey);
  const aggregated = new Map<string, number>();
  for (const line of command.lines) {
    const inventoryItemId = line.inventoryItemId.trim();
    const quantity = (aggregated.get(inventoryItemId) ?? 0) + line.quantity;
    aggregated.set(inventoryItemId, quantity);
  }
  const lines = [...aggregated.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([inventoryItemId, quantity]) => ({ inventoryItemId, quantity }));
  return { schemaVersion: 1, operationType: command.operationType, warehouseId, sourceType, sourceId, idempotencyKey, lines };
}

function required(value: string): string {
  const normalized = value?.trim();
  if (!normalized) {
    throw new InventoryOperationError(
      'INVENTORY_OPERATION_CONTEXT_INVALID',
      'Inventory operation context fields must be non-empty.',
    );
  }
  return normalized;
}

function assertCompleteClaim(claim: PersistedInventoryOperationClaim, expectedMovements: number): void {
  if (!claim || typeof claim.operationHash !== 'string' || !claim.operationHash.trim()
    || !Array.isArray(claim.movementEvidenceRefs)
    || claim.movementEvidenceRefs.length !== expectedMovements
    || claim.movementEvidenceRefs.some((ref) => typeof ref !== 'string' || !ref.trim())
    || new Set(claim.movementEvidenceRefs).size !== claim.movementEvidenceRefs.length
    || !Array.isArray(claim.balanceEvidenceRefs)
    || claim.balanceEvidenceRefs.length !== expectedMovements
    || claim.balanceEvidenceRefs.some((ref) => typeof ref !== 'string' || !ref.trim())
    || new Set(claim.balanceEvidenceRefs).size !== claim.balanceEvidenceRefs.length
    || typeof claim.outboxIntentRef !== 'string' || !claim.outboxIntentRef.trim()) {
    throw new InventoryOperationError(
      'INVENTORY_OPERATION_CLAIM_INCOMPLETE',
      'Persisted inventory operation claim is missing movement, balance or outbox evidence.',
    );
  }
}
