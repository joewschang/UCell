import {
  decideInventoryOperation,
  hashInventoryOperationResult,
  InventoryOperationCommand,
  PersistedInventoryOperationClaim,
} from '../src/modules/inventory-lite/inventory-operation';

const balances = Object.freeze({
  'item-a': Object.freeze({ onHand: 5, reserved: 1, available: 4 }),
  'item-b': Object.freeze({ onHand: 3, reserved: 0, available: 3 }),
});
const command: InventoryOperationCommand = {
  operationType: 'RESERVE', warehouseId: 'warehouse-a', sourceType: 'ORDER', sourceId: 'order-a',
  idempotencyKey: 'reserve-order-a', lines: [
    { inventoryItemId: 'item-b', quantity: 1 },
    { inventoryItemId: 'item-a', quantity: 1 },
    { inventoryItemId: 'item-a', quantity: 2 },
  ],
};

function completeClaim(decision: ReturnType<typeof decideInventoryOperation>): PersistedInventoryOperationClaim {
  const result = { items: decision.items };
  return {
    operationHash: decision.operationHash,
    resultHash: hashInventoryOperationResult(result),
    result,
    movementEvidenceRefs: ['movement-a', 'movement-b'],
    balanceEvidenceRefs: ['balance-a', 'balance-b'],
    outboxIntentRef: 'outbox-a',
  };
}

describe('Inventory Lite canonical operation and idempotency contract', () => {
  it('canonicalizes duplicate and reordered lines to one stable operation hash', () => {
    const first = decideInventoryOperation({ command, balances, existingClaim: null });
    const reordered = decideInventoryOperation({ command: { ...command, warehouseId: ' warehouse-a ', lines: [
      { inventoryItemId: ' item-a ', quantity: 2 },
      { inventoryItemId: 'item-b', quantity: 1 },
      { inventoryItemId: 'item-a', quantity: 1 },
    ] }, balances, existingClaim: null });
    expect(first.action).toBe('APPLY');
    expect(first.operationHash).toMatch(/^[a-f0-9]{64}$/);
    expect(reordered.operationHash).toBe(first.operationHash);
    expect(first.canonicalCommand.lines).toEqual([
      { inventoryItemId: 'item-a', quantity: 3 },
      { inventoryItemId: 'item-b', quantity: 1 },
    ]);
  });

  it('returns a replay only for a complete committed claim with the same hash', () => {
    const first = decideInventoryOperation({ command, balances, existingClaim: null });
    const balancesAfterFirstCommit = Object.fromEntries(first.items.map((item) => [item.inventoryItemId, item.after]));
    const replay = decideInventoryOperation({ command, balances: balancesAfterFirstCommit, existingClaim: completeClaim(first) });
    expect(replay.action).toBe('NOOP_REPLAY');
    expect(replay.items).toEqual(first.items);
  });

  it('rejects idempotency-key reuse with a different operation', () => {
    const first = decideInventoryOperation({ command, balances, existingClaim: null });
    expect(() => decideInventoryOperation({
      command: { ...command, sourceId: 'order-b' }, balances, existingClaim: completeClaim(first),
    })).toThrow(expect.objectContaining({ code: 'INVENTORY_OPERATION_CONFLICT' }));
  });

  it.each(['movementEvidenceRefs', 'balanceEvidenceRefs', 'outboxIntentRef'] as const)(
    'fails closed when a persisted claim has incomplete %s', (field) => {
      const first = decideInventoryOperation({ command, balances, existingClaim: null });
      const claim = { ...completeClaim(first), [field]: field === 'outboxIntentRef' ? '' : [] } as PersistedInventoryOperationClaim;
      expect(() => decideInventoryOperation({ command, balances, existingClaim: claim }))
        .toThrow(expect.objectContaining({ code: 'INVENTORY_OPERATION_CLAIM_INCOMPLETE' }));
    },
  );

  it('rejects a stored result that is tampered or does not match the canonical lines', () => {
    const first = decideInventoryOperation({ command, balances, existingClaim: null });
    const claim = completeClaim(first);
    expect(() => decideInventoryOperation({ command, balances, existingClaim: {
      ...claim, result: { items: [{ ...claim.result.items[0], quantity: 2 }, claim.result.items[1]] },
    } })).toThrow(expect.objectContaining({ code: 'INVENTORY_OPERATION_CLAIM_INCOMPLETE' }));
    const wrongButRehashed = { items: [{ ...claim.result.items[0], inventoryItemId: 'item-z' }, claim.result.items[1]] };
    expect(() => decideInventoryOperation({ command, balances, existingClaim: {
      ...claim, result: wrongButRehashed, resultHash: hashInventoryOperationResult(wrongButRehashed),
    } })).toThrow(expect.objectContaining({ code: 'INVENTORY_OPERATION_CLAIM_INCOMPLETE' }));
    const invalidTransition = { items: [
      { ...claim.result.items[0], after: claim.result.items[0].before },
      claim.result.items[1],
    ] };
    expect(() => decideInventoryOperation({ command, balances, existingClaim: {
      ...claim, result: invalidTransition, resultHash: hashInventoryOperationResult(invalidTransition),
    } })).toThrow(expect.objectContaining({ code: 'INVENTORY_OPERATION_CLAIM_INCOMPLETE' }));
  });

  it('keeps reserve and release identities separate', () => {
    const reserve = decideInventoryOperation({ command, balances, existingClaim: null });
    const releaseBalances = { 'item-a': { onHand: 5, reserved: 3, available: 2 } };
    const release = decideInventoryOperation({ command: { ...command, operationType: 'RELEASE', lines: [{ inventoryItemId: 'item-a', quantity: 1 }] },
      balances: releaseBalances, existingClaim: null });
    expect(release.operationHash).not.toBe(reserve.operationHash);
    expect(release.items[0].movementType).toBe('RELEASE');
  });

  it('rejects missing operation context before producing a decision', () => {
    for (const field of ['warehouseId', 'sourceType', 'sourceId', 'idempotencyKey'] as const) {
      expect(() => decideInventoryOperation({ command: { ...command, [field]: ' ' }, balances, existingClaim: null }))
        .toThrow(expect.objectContaining({ code: 'INVENTORY_OPERATION_CONTEXT_INVALID' }));
    }
    expect(() => decideInventoryOperation({
      command: { ...command, operationType: 'PICK' as never }, balances, existingClaim: null,
    })).toThrow(expect.objectContaining({ code: 'INVENTORY_OPERATION_CONTEXT_INVALID' }));
  });
});
