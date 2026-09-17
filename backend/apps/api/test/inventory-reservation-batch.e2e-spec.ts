import {
  decideInventoryReservationBatch,
} from '../src/modules/inventory-lite/inventory-reservation-batch';

const balances = Object.freeze({
  'item-a': Object.freeze({ onHand: 5, reserved: 1, available: 4 }),
  'item-b': Object.freeze({ onHand: 3, reserved: 0, available: 3 }),
});

describe('Inventory Lite reservation batch contract', () => {
  it('decides every item reservation in deterministic item order', () => {
    const decision = decideInventoryReservationBatch(balances, [
      { inventoryItemId: 'item-b', quantity: 2 },
      { inventoryItemId: 'item-a', quantity: 3 },
    ]);
    expect(decision.items.map((item) => item.inventoryItemId)).toEqual(['item-a', 'item-b']);
    expect(decision.items.map((item) => item.after)).toEqual([
      { onHand: 5, reserved: 4, available: 1 },
      { onHand: 3, reserved: 2, available: 1 },
    ]);
  });

  it('aggregates duplicate order lines before checking availability', () => {
    const decision = decideInventoryReservationBatch(balances, [
      { inventoryItemId: 'item-a', quantity: 1 },
      { inventoryItemId: 'item-a', quantity: 2 },
    ]);
    expect(decision.items).toHaveLength(1);
    expect(decision.items[0]).toMatchObject({ inventoryItemId: 'item-a', quantity: 3 });
  });

  it('fails the entire decision when any item is insufficient', () => {
    expect(() => decideInventoryReservationBatch(balances, [
      { inventoryItemId: 'item-a', quantity: 1 },
      { inventoryItemId: 'item-b', quantity: 4 },
    ])).toThrow(expect.objectContaining({ code: 'INVENTORY_INSUFFICIENT_AVAILABLE' }));
    expect(balances).toEqual({
      'item-a': { onHand: 5, reserved: 1, available: 4 },
      'item-b': { onHand: 3, reserved: 0, available: 3 },
    });
  });

  it('fails closed when an inventory balance is missing', () => {
    expect(() => decideInventoryReservationBatch(balances, [
      { inventoryItemId: 'item-c', quantity: 1 },
    ])).toThrow(expect.objectContaining({ code: 'INVENTORY_BALANCE_MISSING' }));
  });

  it('rejects empty batch and blank inventory item ID', () => {
    expect(() => decideInventoryReservationBatch(balances, [])).toThrow(
      expect.objectContaining({ code: 'INVENTORY_BATCH_EMPTY' }),
    );
    expect(() => decideInventoryReservationBatch(balances, [
      { inventoryItemId: ' ', quantity: 1 },
    ])).toThrow(expect.objectContaining({ code: 'INVENTORY_ITEM_ID_INVALID' }));
  });

  it('rejects duplicate-line aggregate overflow', () => {
    expect(() => decideInventoryReservationBatch(
      { huge: { onHand: Number.MAX_SAFE_INTEGER, reserved: 0, available: Number.MAX_SAFE_INTEGER } },
      [
        { inventoryItemId: 'huge', quantity: Number.MAX_SAFE_INTEGER },
        { inventoryItemId: 'huge', quantity: 1 },
      ],
    )).toThrow(expect.objectContaining({ code: 'INVENTORY_QUANTITY_OVERFLOW' }));
  });
});
