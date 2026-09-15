describe('Vertical Slice 02 - Membership / Active / Subscription / RPV', () => {
  it.todo('creates DRAFT membership application');
  it.todo('SUBMIT requires sponsor and binary placement data');
  it.todo('APPROVE creates Qualification + Holder + Sponsor + Binary atomically');
  it.todo('1st and 3rd direct-left rule is enforced during approval');
  it.todo('Active periods cannot overlap');
  it.todo('historical Active query uses event time, not current flag');
  it.todo('QUARTER creates exactly 3 recognition rows');
  it.todo('HALF_YEAR creates exactly 6 recognition rows');
  it.todo('YEAR creates exactly 12 recognition rows');
  it.todo('each due recognition creates exactly 1,200 RPV once');
  it.todo('0 direct unlocks 5 binary generations');
  it.todo('1 direct unlocks 8 binary generations');
  it.todo('2+ directs unlocks 12 binary generations');
  it.todo('inactive upline receives 0 and is not compressed');
  it.todo('higher generation remains independently evaluated');
  it.todo('re-running a recognition cannot duplicate RPV or awards');
});
