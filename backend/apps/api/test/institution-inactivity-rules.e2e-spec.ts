import { evaluateQualificationInactivity, firstApplicableInactivityMonth, InactivityMonth } from '../src/modules/qualification/qualification-inactivity';

describe('Institution LIFE-01 through LIFE-04 and LIFE-07 evaluation boundaries', () => {
  it.each([
    ['month opening', '2024-01-01T00:00:00+08:00', '2023-01-01T00:00:00+08:00', '2024-01'],
    ['one millisecond after opening', '2024-01-01T00:00:00.001+08:00', '2023-01-01T00:00:00+08:00', '2024-02'],
    ['month end', '2024-01-31T23:59:59.999+08:00', '2023-01-01T00:00:00+08:00', '2024-02'],
    ['leap day', '2024-02-29T12:00:00+08:00', '2023-01-01T00:00:00+08:00', '2024-03'],
    ['year rollover', '2024-12-31T23:59:59.999+08:00', '2023-01-01T00:00:00+08:00', '2025-01'],
    ['old ball prospective adoption', '2020-01-01T00:00:00+08:00', '2024-10-15T12:00:00+08:00', '2024-11'],
    ['rule exactly month opening', '2020-01-01T00:00:00+08:00', '2024-10-01T00:00:00+08:00', '2024-10'],
    ['UTC representation of Taipei opening', '2023-12-31T16:00:00Z', '2023-01-01T00:00:00Z', '2024-01'],
    ['UTC midnight is not Taipei opening', '2024-01-01T00:00:00Z', '2023-01-01T00:00:00Z', '2024-02'],
  ])('LIFE-03 %s', (_name, ball, rule, expected) => expect(firstApplicableInactivityMonth(new Date(ball), new Date(rule))).toBe(expected));
  it.each(['ball', 'rule'])('LIFE-03 rejects missing/invalid %s effective time', field => {
    expect(() => firstApplicableInactivityMonth(new Date(field === 'ball' ? 'invalid' : '2024-01-01Z'), new Date(field === 'rule' ? 'invalid' : '2024-01-01Z'))).toThrow('INACTIVITY_EFFECTIVE_TIME_REQUIRED');
  });
  const months = (count: number): InactivityMonth[] => Array.from({ length: count }, (_, i) => ({ qualificationId: 'ball-a', month: new Date(Date.UTC(2024, i, 1)).toISOString().slice(0, 7), active: false, finalized: true, revision: 'ORIGINAL' }));
  const evaluate = (rows: InactivityMonth[], end = rows.at(-1)!.month) => evaluateQualificationInactivity('ball-a', '2024-01', end, rows, 'SYNTHETIC_APPROVED_RULE');
  it('LIFE-01 another ball cannot reset this ball, and input evidence remains immutable', () => {
    const rows = [...months(12), ...months(12).map(row => ({ ...row, qualificationId: 'ball-b', active: true }))], before = JSON.stringify(rows);
    expect(evaluate(rows, '2024-12')).toMatchObject({ recoveryEligible: true, recoveryMonth: '2024-12' });
    expect(JSON.stringify(rows)).toBe(before);
  });
  it('LIFE-04 eleven inactive months followed by Active resets to zero', () => {
    const rows = months(12); rows[11].active = true;
    expect(evaluate(rows)).toMatchObject({ recoveryEligible: false, streak: 0 });
  });
  it('LIFE-04 twelve nonconsecutive inactive months never count as twelve consecutive', () => {
    const rows = months(24).map((row, i) => ({ ...row, active: i % 2 === 1 }));
    expect(evaluate(rows)).toMatchObject({ recoveryEligible: false, streak: 0 });
  });
  it('LIFE-03 does not count evidence before the explicit applicable month', () => {
    const rows = months(15);
    expect(evaluateQualificationInactivity('ball-a', '2025-01', '2025-03', rows, 'SYNTHETIC_APPROVED_RULE')).toMatchObject({ recoveryEligible: false, streak: 3 });
  });
  it.each(['missing', 'unfinalized', 'unknown', 'unversioned'])('LIFE-04 incomplete %s evidence cannot authorize recovery', mode => {
    const rows = months(12);
    if (mode === 'missing') rows.splice(5, 1);
    else if (mode === 'unfinalized') rows[5].finalized = false;
    else if (mode === 'unknown') rows[5].active = null;
    else rows[5].revision = '';
    expect(evaluate(rows, '2024-12')).toMatchObject({ status: 'PENDING', recoveryEligible: false });
  });
  it('LIFE-07 revised monthly evidence recomputes eligibility without side effects', () => {
    const rows = months(12); rows[5].active = true;
    expect(evaluate(rows)).toMatchObject({ recoveryEligible: false, streak: 6 });
    const replay = rows.map(row => row.month === '2024-06' ? { ...row, active: false, revision: 'POSTED_RETURN_REPLAY' } : row);
    expect(evaluate(replay)).toMatchObject({ recoveryEligible: true, recoveryMonth: '2024-12' });
    expect(rows[5].active).toBe(true);
  });
  it('LIFE-04 rejects ambiguous duplicate monthly evidence', () => {
    const rows = months(12);
    expect(() => evaluate([...rows, rows[5]], '2024-12')).toThrow('AMBIGUOUS_MONTH_EVIDENCE');
  });
  it('LIFE-06 exposes month eleven and twelve notice classifications, not delivery evidence', () => {
    expect(evaluate(months(11)).snapshots.at(-1)?.notificationCode).toBe('INACTIVE_FINAL_WARNING');
    expect(evaluate(months(12)).snapshots.at(-1)?.notificationCode).toBe('INACTIVE_RECOVERY_ELIGIBLE');
  });
});
