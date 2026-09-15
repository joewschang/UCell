describe('v0.6.2 economic attribution and carry-chain replay',()=>{
  it.todo('historical week includes later GPV_REVERSAL linked to original event');
  it.todo('return discovers every Binary ancestor impacted by descendant GPV');
  it.todo('period replay recomputes all Binary payable amounts when K1 changes');
  it.todo('period replay recomputes all Matching payable amounts when K2 changes');
  it.todo('next week carry-in uses prior recomputed carry-out');
  it.todo('propagation stops when left/right carry match original snapshots');
  it.todo('propagation respects maxWeeks safety horizon');
  it.todo('each replay period is append-only and replay run is resumable');
  it.todo('positive deltas post compensating awards and negative deltas post recovery');
  it.todo('original BinaryCarry, SettlementBatch and BonusAward remain untouched');
});

describe('v0.6.2 schema convergence',()=>{
  it.todo('migration 0005 references subscription.subscription, not commerce.subscription');
  it.todo('Prisma schema contains adjustment/workflow/replay models');
  it.todo('RPV reversal anchor uses BonusAwardType.RPV, not EPV');
});
