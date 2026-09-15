describe('v0.5 Return / Reversal / Clawback', () => {
  it.todo('partial return creates proportional negative GPV event');
  it.todo('GPV reversal references original GPV event');
  it.todo('returned quantity cannot exceed ordered quantity across multiple returns');
  it.todo('PENDING_45D direct referral/equalization becomes REVERSED');
  it.todo('EFFECTIVE/PAYABLE/PAID direct award creates CLAWBACK and recovery ledger');
  it.todo('original bonus award is never updated/deleted');
  it.todo('Binary and Matching create settlement recalculation requests instead of rewriting history');
  it.todo('reprocessing RETURN_CONFIRMED is idempotent');
});

describe('v0.5 payout lifecycle', () => {
  it.todo('EFFECTIVE awards become PAYABLE via payout batch');
  it.todo('open clawback recovery offsets next payout');
  it.todo('net payout cannot go below zero');
  it.todo('mark-paid writes PAID lifecycle events');
});
