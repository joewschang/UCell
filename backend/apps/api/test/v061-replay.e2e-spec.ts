describe('v0.6.1 deterministic replay',()=>{
  it.todo('replay uses original carry-in, not current carry');
  it.todo('negative GPV reversal is included in historical period subtree GPV');
  it.todo('recomputed Pair respects original weekly cap');
  it.todo('K1 is recomputed with changed impacted theory and unchanged others');
  it.todo('Matching source uses recomputed Binary Paid');
  it.todo('K2 is recomputed from adjusted matching theory');
  it.todo('original settlement, award and carry rows remain unchanged');
  it.todo('positive delta creates compensating award');
  it.todo('negative delta creates recovery');
});

describe('v0.6.1 subscription cancellation',()=>{
  it.todo('future scheduled rows become CANCELLED');
  it.todo('recognized affected rows enqueue one RPV_REVERSAL_REQUIRED');
  it.todo('worker creates exactly one negative RPV reversal event');
  it.todo('worker creates recovery for previously payable RPV upline awards');
  it.todo('reprocessing event is idempotent');
});

describe('v0.6.1 qualification workflow',()=>{
  it.todo('upgrade creates future plan history and does not alter past awards');
  it.todo('transfer preserves qualificationId and sponsor/binary positions');
  it.todo('exit closes holder interval and status becomes EXITED');
  it.todo('company retransfer opens a new holder interval');
});
