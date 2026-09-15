describe('v0.5 EPV', () => {
  it.todo('REPURCHASE 4800 => excess 2800 x 60% = 1680 EPV');
  it.todo('EPV self share = 50% = 840 when Active');
  it.todo('EPV Sponsor G1-G5 each 6% when Active');
  it.todo('EPV does not use Binary tree');
  it.todo('non-REPURCHASE order does not create EPV');
});

describe('v0.5 Global/Welfare', () => {
  it.todo('global pool is 5% of period GPV');
  it.todo('weak thresholds are 300k/600k/1m/2m/4m');
  it.todo('rank achievement never downgrades');
  it.todo('monthly payout requires Active and current-month weak side threshold');
  it.todo('passed levels are cumulative');
  it.todo('empty rank slice rolls upward to next higher rank');
  it.todo('welfare 2% is accrued only; no distribution without a formal rule');
});
