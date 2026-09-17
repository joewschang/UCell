export interface InventoryBalanceSnapshot {
  onHand: number;
  reserved: number;
  available: number;
}

export interface InventoryReservationDecision {
  movementType: 'RESERVE' | 'RELEASE';
  quantity: number;
  before: InventoryBalanceSnapshot;
  after: InventoryBalanceSnapshot;
}

export class InventoryReservationError extends Error {
  constructor(
    readonly code:
      | 'INVENTORY_BALANCE_INVALID'
      | 'INVENTORY_QUANTITY_INVALID'
      | 'INVENTORY_QUANTITY_OVERFLOW'
      | 'INVENTORY_INSUFFICIENT_AVAILABLE'
      | 'INVENTORY_RELEASE_EXCEEDS_RESERVED'
      | 'INVENTORY_ITEM_ID_INVALID'
      | 'INVENTORY_BALANCE_MISSING'
      | 'INVENTORY_BATCH_EMPTY',
    message: string,
  ) {
    super(message);
    this.name = 'InventoryReservationError';
  }
}

export function assertInventoryBalance(balance: InventoryBalanceSnapshot): void {
  const quantities = [balance.onHand, balance.reserved, balance.available];
  if (quantities.some((value) => !Number.isSafeInteger(value) || value < 0)) {
    throw new InventoryReservationError(
      'INVENTORY_BALANCE_INVALID',
      'Inventory balance quantities must be non-negative safe integers.',
    );
  }
  if (balance.reserved > balance.onHand || balance.available !== balance.onHand - balance.reserved) {
    throw new InventoryReservationError(
      'INVENTORY_BALANCE_INVALID',
      'Inventory balance must satisfy available = onHand - reserved.',
    );
  }
}

export function decideInventoryReservation(
  balance: InventoryBalanceSnapshot,
  quantity: number,
): InventoryReservationDecision {
  assertInventoryBalance(balance);
  assertMovementQuantity(quantity);
  if (quantity > balance.available) {
    throw new InventoryReservationError(
      'INVENTORY_INSUFFICIENT_AVAILABLE',
      'Requested inventory quantity exceeds available stock.',
    );
  }
  const reserved = checkedAdd(balance.reserved, quantity);
  return {
    movementType: 'RESERVE',
    quantity,
    before: { ...balance },
    after: { onHand: balance.onHand, reserved, available: balance.available - quantity },
  };
}

export function decideInventoryRelease(
  balance: InventoryBalanceSnapshot,
  quantity: number,
): InventoryReservationDecision {
  assertInventoryBalance(balance);
  assertMovementQuantity(quantity);
  if (quantity > balance.reserved) {
    throw new InventoryReservationError(
      'INVENTORY_RELEASE_EXCEEDS_RESERVED',
      'Released inventory quantity exceeds the current reservation.',
    );
  }
  const available = checkedAdd(balance.available, quantity);
  return {
    movementType: 'RELEASE',
    quantity,
    before: { ...balance },
    after: { onHand: balance.onHand, reserved: balance.reserved - quantity, available },
  };
}

function assertMovementQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new InventoryReservationError(
      'INVENTORY_QUANTITY_INVALID',
      'Inventory movement quantity must be a positive safe integer.',
    );
  }
}

function checkedAdd(left: number, right: number): number {
  const result = left + right;
  if (!Number.isSafeInteger(result)) {
    throw new InventoryReservationError(
      'INVENTORY_QUANTITY_OVERFLOW',
      'Inventory quantity exceeds the supported safe integer range.',
    );
  }
  return result;
}
