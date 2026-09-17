import { decideInventoryReleaseBatch } from '../src/modules/inventory-lite/inventory-reservation-batch';

const balances = Object.freeze({
  'item-a': Object.freeze({ onHand: 5, reserved: 4, available: 1 }),
  'item-b': Object.freeze({ onHand: 3, reserved: 2, available: 1 }),
});

describe('Inventory Lite release batch contract', () => {
  it('releases multiple items in deterministic item order', () => {
    const decision = decideInventoryReleaseBatch(balances, [
      { inventoryItemId: 'item-b', quantity: 1 },
      { inventoryItemId: 'item-a', quantity: 2 },
    ]);
    expect(decision.items.map((item) => item.inventoryItemId)).toEqual(['item-a', 'item-b']);
    expect(decision.items.map((item) => item.after)).toEqual([
      { onHand: 5, reserved: 2, available: 3 },
      { onHand: 3, reserved: 1, available: 2 },
    ]);
    expect(decision.items.every((item) => item.movementType === 'RELEASE')).toBe(true);
  });

  it('aggregates duplicate release lines before checking reserved stock', () => {
    const decision = decideInventoryReleaseBatch(balances, [
      { inventoryItemId: 'item-a', quantity: 1 },
      { inventoryItemId: 'item-a', quantity: 2 },
    ]);
    expect(decision.items).toHaveLength(1);
    expect(decision.items[0]).toMatchObject({ inventoryItemId: 'item-a', quantity: 3 });
  });

  it('fails the entire decision when one item exceeds reserved stock', () => {
    expect(() => decideInventoryReleaseBatch(balances, [
      { inventoryItemId: 'item-a', quantity: 1 },
      { inventoryItemId: 'item-b', quantity: 3 },
    ])).toThrow(expect.objectContaining({ code: 'INVENTORY_RELEASE_EXCEEDS_RESERVED' }));
    expect(balances).toEqual({
      'item-a': { onHand: 5, reserved: 4, available: 1 },
      'item-b': { onHand: 3, reserved: 2, available: 1 },
    });
  });

  it('fails closed for an empty release batch or a missing balance', () => {
    expect(() => decideInventoryReleaseBatch(balances, [])).toThrow(
      expect.objectContaining({ code: 'INVENTORY_BATCH_EMPTY' }),
    );
    expect(() => decideInventoryReleaseBatch(balances, [
      { inventoryItemId: 'item-c', quantity: 1 },
    ])).toThrow(expect.objectContaining({ code: 'INVENTORY_BALANCE_MISSING' }));
  });
});
