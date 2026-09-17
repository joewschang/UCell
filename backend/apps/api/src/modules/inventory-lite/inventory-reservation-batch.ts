import {
  decideInventoryReservation,
  InventoryBalanceSnapshot,
  InventoryReservationDecision,
  InventoryReservationError,
} from './inventory-reservation';

export interface InventoryReservationLine {
  inventoryItemId: string;
  quantity: number;
}

export interface InventoryReservationBatchDecision {
  items: ReadonlyArray<InventoryReservationDecision & { inventoryItemId: string }>;
}

export function decideInventoryReservationBatch(
  balances: Readonly<Record<string, InventoryBalanceSnapshot>>,
  lines: ReadonlyArray<InventoryReservationLine>,
): InventoryReservationBatchDecision {
  if (lines.length === 0) {
    throw new InventoryReservationError(
      'INVENTORY_BATCH_EMPTY',
      'Inventory reservation batch must contain at least one line.',
    );
  }

  const requestedByItem = new Map<string, number>();
  for (const line of lines) {
    const inventoryItemId = line.inventoryItemId.trim();
    if (!inventoryItemId) {
      throw new InventoryReservationError(
        'INVENTORY_ITEM_ID_INVALID',
        'Inventory reservation line requires an inventory item ID.',
      );
    }
    const current = requestedByItem.get(inventoryItemId) ?? 0;
    const aggregate = current + line.quantity;
    if (!Number.isSafeInteger(aggregate)) {
      throw new InventoryReservationError(
        'INVENTORY_QUANTITY_OVERFLOW',
        `Aggregated reservation quantity overflowed for inventory item ${inventoryItemId}.`,
      );
    }
    requestedByItem.set(inventoryItemId, aggregate);
  }

  const items = [...requestedByItem.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([inventoryItemId, quantity]) => {
      const balance = balances[inventoryItemId];
      if (!balance) {
        throw new InventoryReservationError(
          'INVENTORY_BALANCE_MISSING',
          `Inventory balance is missing for inventory item ${inventoryItemId}.`,
        );
      }
      return { inventoryItemId, ...decideInventoryReservation(balance, quantity) };
    });

  return { items };
}
