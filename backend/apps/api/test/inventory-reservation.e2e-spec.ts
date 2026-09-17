import {
  assertInventoryBalance,
  decideInventoryRelease,
  decideInventoryReservation,
  InventoryReservationError,
} from '../src/modules/inventory-lite/inventory-reservation';

describe('Inventory Lite reservation contract', () => {
  it('reserves available stock without changing on-hand quantity', () => {
    expect(decideInventoryReservation({ onHand: 10, reserved: 3, available: 7 }, 4)).toEqual({
      movementType: 'RESERVE',
      quantity: 4,
      before: { onHand: 10, reserved: 3, available: 7 },
      after: { onHand: 10, reserved: 7, available: 3 },
    });
  });

  it('allows reserving the final available unit while keeping available at zero', () => {
    expect(decideInventoryReservation({ onHand: 1, reserved: 0, available: 1 }, 1).after).toEqual({
      onHand: 1, reserved: 1, available: 0,
    });
  });

  it('fails closed when requested stock exceeds available', () => {
    expect(() => decideInventoryReservation({ onHand: 1, reserved: 0, available: 1 }, 2)).toThrow(
      expect.objectContaining({ code: 'INVENTORY_INSUFFICIENT_AVAILABLE' }),
    );
  });

  it('releases reservation without changing on-hand quantity', () => {
    expect(decideInventoryRelease({ onHand: 10, reserved: 7, available: 3 }, 4).after).toEqual({
      onHand: 10, reserved: 3, available: 7,
    });
  });

  it('rejects release beyond reserved stock', () => {
    expect(() => decideInventoryRelease({ onHand: 10, reserved: 2, available: 8 }, 3)).toThrow(
      expect.objectContaining({ code: 'INVENTORY_RELEASE_EXCEEDS_RESERVED' }),
    );
  });

  it.each([0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects invalid movement quantity %s',
    (quantity) => {
      expect(() => decideInventoryReservation({ onHand: 10, reserved: 0, available: 10 }, quantity)).toThrow(
        expect.objectContaining({ code: 'INVENTORY_QUANTITY_INVALID' }),
      );
    },
  );

  it.each([
    { onHand: 2, reserved: 3, available: 0 },
    { onHand: 5, reserved: 2, available: 4 },
    { onHand: -1, reserved: 0, available: -1 },
  ])('rejects inconsistent or negative balance snapshot %#', (balance) => {
    expect(() => assertInventoryBalance(balance)).toThrow(
      expect.objectContaining({ code: 'INVENTORY_BALANCE_INVALID' }),
    );
  });

  it('does not mutate the supplied balance snapshot', () => {
    const balance = Object.freeze({ onHand: 5, reserved: 1, available: 4 });
    decideInventoryReservation(balance, 2);
    expect(balance).toEqual({ onHand: 5, reserved: 1, available: 4 });
  });

  it('exposes stable machine-readable inventory errors', () => {
    expect(() => decideInventoryRelease({ onHand: 1, reserved: 0, available: 1 }, 1)).toThrow(
      InventoryReservationError,
    );
  });
});
