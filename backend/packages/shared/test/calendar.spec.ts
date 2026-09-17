import {
  CalendarResolutionError,
  LocalDate,
  VersionedBusinessCalendar,
  nextBusinessDay,
  createK0WindowEvidence,
  resolveBinaryWeekBatch,
  resolveBinaryWeek,
  resolvePayoutSchedule,
  resolveSettlementWindow,
} from '../src/calendar/calendar';

function calendar(
  days: Record<string, boolean>,
  version = 'TW-BIZ-2026-v1',
): VersionedBusinessCalendar {
  return {
    version,
    get(date) {
      const businessDay = days[date];
      return businessDay === undefined ? undefined : {date, businessDay};
    },
  };
}

describe('binary weekly calendar', () => {
  it('uses Taipei Sunday 00:00 as a half-open boundary', () => {
    const before = resolveBinaryWeek(new Date('2026-09-19T15:59:59.999Z'));
    const exact = resolveBinaryWeek(new Date('2026-09-19T16:00:00.000Z'));

    expect(before.start.toISOString()).toBe('2026-09-12T16:00:00.000Z');
    expect(before.end.toISOString()).toBe('2026-09-19T16:00:00.000Z');
    expect(exact.start.toISOString()).toBe('2026-09-19T16:00:00.000Z');
    expect(exact.end.toISOString()).toBe('2026-09-26T16:00:00.000Z');
  });

  it('crosses month and year boundaries without changing the Taipei anchor', () => {
    const week = resolveBinaryWeek(new Date('2027-01-01T00:00:00.000Z'));
    expect(week.start.toISOString()).toBe('2026-12-26T16:00:00.000Z');
    expect(week.end.toISOString()).toBe('2027-01-02T16:00:00.000Z');
  });
});

describe('10th/25th settlement boundary closure', () => {
  it('B01 assigns 10th minus one second to the prior window and exact cutoff to the new window', () => {
    const before = resolveSettlementWindow(new Date('2026-09-09T15:59:59.000Z'));
    const exact = resolveSettlementWindow(new Date('2026-09-09T16:00:00.000Z'));
    expect([before.start.toISOString(), before.end.toISOString()]).toEqual([
      '2026-08-24T16:00:00.000Z', '2026-09-09T16:00:00.000Z',
    ]);
    expect([exact.start.toISOString(), exact.end.toISOString()]).toEqual([
      '2026-09-09T16:00:00.000Z', '2026-09-24T16:00:00.000Z',
    ]);
  });

  it('B02 assigns 25th minus one second to the prior window and exact cutoff to the new window', () => {
    const before = resolveSettlementWindow(new Date('2026-09-24T15:59:59.000Z'));
    const exact = resolveSettlementWindow(new Date('2026-09-24T16:00:00.000Z'));
    expect([before.start.toISOString(), before.end.toISOString()]).toEqual([
      '2026-09-09T16:00:00.000Z', '2026-09-24T16:00:00.000Z',
    ]);
    expect([exact.start.toISOString(), exact.end.toISOString()]).toEqual([
      '2026-09-24T16:00:00.000Z', '2026-10-09T16:00:00.000Z',
    ]);
  });

  it('B03 gives the K0 numerator and denominator the identical half-open window', () => {
    const evidence = createK0WindowEvidence(resolveSettlementWindow(new Date('2026-09-20T00:00:00Z')));
    expect(evidence.numerator).toBe(evidence.denominator);
    expect(evidence).toEqual({
      numerator: {gte: '2026-09-09T16:00:00.000Z', lt: '2026-09-24T16:00:00.000Z'},
      denominator: {gte: '2026-09-09T16:00:00.000Z', lt: '2026-09-24T16:00:00.000Z'},
    });
  });

  it('B04 keeps a Binary week crossing the 10th whole and maps its close to the next batch', () => {
    const week = resolveBinaryWeek(new Date('2026-09-10T00:00:00Z'));
    expect([week.start.toISOString(), week.end.toISOString()]).toEqual([
      '2026-09-05T16:00:00.000Z', '2026-09-12T16:00:00.000Z',
    ]);
    expect(resolveBinaryWeekBatch(week.end).toISOString()).toBe('2026-09-24T16:00:00.000Z');
  });

  it('B05 keeps a Binary week crossing the 25th whole and maps its close to the next batch', () => {
    const week = resolveBinaryWeek(new Date('2026-09-25T00:00:00Z'));
    expect([week.start.toISOString(), week.end.toISOString()]).toEqual([
      '2026-09-19T16:00:00.000Z', '2026-09-26T16:00:00.000Z',
    ]);
    expect(resolveBinaryWeekBatch(week.end).toISOString()).toBe('2026-10-09T16:00:00.000Z');
  });
});

describe('payout calendar', () => {
  it('maps a 10th settlement to the following month 25th', () => {
    expect(resolvePayoutSchedule('2026-09-10', calendar({'2026-10-25': true}))).toEqual({
      settlementDate: '2026-09-10',
      nominalPayoutDate: '2026-10-25',
      adjustedPayoutDate: '2026-10-25',
      businessCalendarVersion: 'TW-BIZ-2026-v1',
    });
  });

  it('maps a 25th settlement to the month-after-next 10th across a year boundary', () => {
    expect(resolvePayoutSchedule('2026-11-25', calendar({'2027-01-10': true}))).toMatchObject({
      nominalPayoutDate: '2027-01-10',
      adjustedPayoutDate: '2027-01-10',
    });
  });

  it('advances through holidays using the supplied versioned provider', () => {
    const schedule = resolvePayoutSchedule(
      '2026-09-10',
      calendar({'2026-10-25': false, '2026-10-26': false, '2026-10-27': true}, 'TW-2026-approved-2'),
    );
    expect(schedule.nominalPayoutDate).toBe('2026-10-25');
    expect(schedule.adjustedPayoutDate).toBe('2026-10-27');
    expect(schedule.businessCalendarVersion).toBe('TW-2026-approved-2');
  });

  it('fails closed when any required calendar date is missing', () => {
    expect(() => nextBusinessDay('2026-10-25', calendar({'2026-10-25': false}))).toThrow(
      expect.objectContaining<Partial<CalendarResolutionError>>({code: 'BUSINESS_CALENDAR_DATE_MISSING'}),
    );
  });

  it('rejects dates outside the canonical 10th/25th slots', () => {
    expect(() => resolvePayoutSchedule('2026-09-11', calendar({}))).toThrow(
      expect.objectContaining<Partial<CalendarResolutionError>>({code: 'NON_CANONICAL_SETTLEMENT_DATE'}),
    );
  });

  it('keeps the original settlement anchor when execution is delayed', () => {
    const authoritativeSettlement: LocalDate = '2026-09-25';
    const delayedExecutionAt = new Date('2027-03-01T09:00:00.000Z');
    expect(delayedExecutionAt.getTime()).toBeGreaterThan(Date.parse('2026-09-25T00:00:00Z'));

    const schedule = resolvePayoutSchedule(
      authoritativeSettlement,
      calendar({'2026-11-10': true}),
    );
    expect(schedule.settlementDate).toBe('2026-09-25');
    expect(schedule.nominalPayoutDate).toBe('2026-11-10');
  });
});
