export const UCELL_TIME_ZONE = 'Asia/Taipei' as const;

const TAIPEI_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export type LocalDate = `${number}-${number}-${number}`;

export interface BinaryWeek {
  readonly timeZone: typeof UCELL_TIME_ZONE;
  /** Inclusive Sunday 00:00 in Asia/Taipei. */
  readonly start: Date;
  /** Exclusive following Sunday 00:00 in Asia/Taipei. */
  readonly end: Date;
}

export interface SettlementWindow {
  readonly timeZone: typeof UCELL_TIME_ZONE;
  readonly start: Date;
  readonly end: Date;
}

export interface K0WindowEvidence {
  readonly numerator: {readonly gte: string; readonly lt: string};
  readonly denominator: {readonly gte: string; readonly lt: string};
}

export interface BusinessCalendarDay {
  readonly date: LocalDate;
  readonly businessDay: boolean;
  readonly holidayReason?: string;
  readonly source?: string;
}

export interface VersionedBusinessCalendar {
  readonly version: string;
  get(date: LocalDate): BusinessCalendarDay | undefined;
}

export interface PayoutSchedule {
  readonly settlementDate: LocalDate;
  readonly nominalPayoutDate: LocalDate;
  readonly adjustedPayoutDate: LocalDate;
  readonly businessCalendarVersion: string;
}

export class CalendarResolutionError extends Error {
  constructor(
    readonly code:
      | 'INVALID_DATE'
      | 'NON_CANONICAL_SETTLEMENT_DATE'
      | 'BUSINESS_CALENDAR_VERSION_MISSING'
      | 'BUSINESS_CALENDAR_DATE_MISSING'
      | 'BUSINESS_CALENDAR_DATE_MISMATCH'
      | 'BUSINESS_DAY_NOT_FOUND'
      | 'NON_CANONICAL_BINARY_WEEK_CLOSE',
    message: string,
  ) {
    super(message);
    this.name = 'CalendarResolutionError';
  }
}

/** Resolves the half-open [Sunday 00:00, next Sunday 00:00) Taipei week. */
export function resolveBinaryWeek(at: Date): BinaryWeek {
  if (!(at instanceof Date) || !Number.isFinite(at.getTime())) {
    throw new CalendarResolutionError('INVALID_DATE', 'A finite event timestamp is required');
  }
  const taipeiWallClock = new Date(at.getTime() + TAIPEI_OFFSET_MS);
  const localMidnightAsUtc = Date.UTC(
    taipeiWallClock.getUTCFullYear(),
    taipeiWallClock.getUTCMonth(),
    taipeiWallClock.getUTCDate(),
  );
  const startAsLocalUtc = localMidnightAsUtc - taipeiWallClock.getUTCDay() * DAY_MS;
  const start = new Date(startAsLocalUtc - TAIPEI_OFFSET_MS);
  return {timeZone: UCELL_TIME_ZONE, start, end: new Date(start.getTime() + 7 * DAY_MS)};
}

/** Resolves the approved half-open 10th/25th Asia/Taipei settlement window. */
export function resolveSettlementWindow(at: Date): SettlementWindow {
  assertFiniteDate(at);
  const local = new Date(at.getTime() + TAIPEI_OFFSET_MS);
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  let startLocal: Date;
  let endLocal: Date;
  if (day >= 25) {
    startLocal = new Date(Date.UTC(year, month, 25));
    endLocal = new Date(Date.UTC(year, month + 1, 10));
  } else if (day >= 10) {
    startLocal = new Date(Date.UTC(year, month, 10));
    endLocal = new Date(Date.UTC(year, month, 25));
  } else {
    startLocal = new Date(Date.UTC(year, month - 1, 25));
    endLocal = new Date(Date.UTC(year, month, 10));
  }
  return {
    timeZone: UCELL_TIME_ZONE,
    start: new Date(startLocal.getTime() - TAIPEI_OFFSET_MS),
    end: new Date(endLocal.getTime() - TAIPEI_OFFSET_MS),
  };
}

/** Assigns an atomic completed Binary week to the first 10th/25th batch after its close. */
export function resolveBinaryWeekBatch(binaryWeekEnd: Date): Date {
  assertFiniteDate(binaryWeekEnd);
  const local = new Date(binaryWeekEnd.getTime() + TAIPEI_OFFSET_MS);
  if (local.getUTCDay() !== 0 || local.getUTCHours() !== 0 || local.getUTCMinutes() !== 0 ||
      local.getUTCSeconds() !== 0 || local.getUTCMilliseconds() !== 0) {
    throw new CalendarResolutionError(
      'NON_CANONICAL_BINARY_WEEK_CLOSE',
      'Binary week close must be Sunday 00:00:00 Asia/Taipei',
    );
  }
  const year = local.getUTCFullYear();
  const month = local.getUTCMonth();
  const day = local.getUTCDate();
  const cutoffLocal = day < 10
    ? new Date(Date.UTC(year, month, 10))
    : day < 25
      ? new Date(Date.UTC(year, month, 25))
      : new Date(Date.UTC(year, month + 1, 10));
  return new Date(cutoffLocal.getTime() - TAIPEI_OFFSET_MS);
}

/** Produces auditable proof that both sides of K0 use one exact window. */
export function createK0WindowEvidence(window: Pick<SettlementWindow, 'start' | 'end'>): K0WindowEvidence {
  assertFiniteDate(window.start);
  assertFiniteDate(window.end);
  if (window.start >= window.end) {
    throw new CalendarResolutionError('INVALID_DATE', 'K0 settlement window must be increasing');
  }
  const range = Object.freeze({gte: window.start.toISOString(), lt: window.end.toISOString()});
  return Object.freeze({numerator: range, denominator: range});
}

function assertFiniteDate(value: Date): void {
  if (!(value instanceof Date) || !Number.isFinite(value.getTime())) {
    throw new CalendarResolutionError('INVALID_DATE', 'A finite timestamp is required');
  }
}

/** Maps an authoritative 10th/25th settlement anchor to its frozen payout batch. */
export function resolvePayoutSchedule(
  settlementDate: LocalDate,
  calendar: VersionedBusinessCalendar,
): PayoutSchedule {
  const {year, month, day} = parseLocalDate(settlementDate);
  if (day !== 10 && day !== 25) {
    throw new CalendarResolutionError(
      'NON_CANONICAL_SETTLEMENT_DATE',
      `Settlement date ${settlementDate} is not a canonical 10th/25th slot`,
    );
  }
  if (!calendar.version.trim()) {
    throw new CalendarResolutionError(
      'BUSINESS_CALENDAR_VERSION_MISSING',
      'An approved business calendar version is required',
    );
  }

  // The supplied settlement date remains the anchor regardless of execution time.
  const monthDelta = day === 10 ? 1 : 2;
  const payoutDay = day === 10 ? 25 : 10;
  const nominalPayoutDate = formatLocalDate(new Date(Date.UTC(year, month - 1 + monthDelta, payoutDay)));
  const adjustedPayoutDate = nextBusinessDay(nominalPayoutDate, calendar);
  return {
    settlementDate,
    nominalPayoutDate,
    adjustedPayoutDate,
    businessCalendarVersion: calendar.version,
  };
}

/** Returns the supplied date when it is a business day, otherwise the next one. */
export function nextBusinessDay(
  date: LocalDate,
  calendar: VersionedBusinessCalendar,
  maximumLookaheadDays = 31,
): LocalDate {
  let cursor = parseLocalDateUtc(date);
  for (let offset = 0; offset <= maximumLookaheadDays; offset += 1) {
    const candidate = formatLocalDate(cursor);
    const entry = calendar.get(candidate);
    if (!entry) {
      throw new CalendarResolutionError(
        'BUSINESS_CALENDAR_DATE_MISSING',
        `Business calendar ${calendar.version || '<missing>'} has no entry for ${candidate}`,
      );
    }
    if (entry.date !== candidate) {
      throw new CalendarResolutionError(
        'BUSINESS_CALENDAR_DATE_MISMATCH',
        `Business calendar returned ${entry.date} for requested date ${candidate}`,
      );
    }
    if (entry.businessDay) return candidate;
    cursor = new Date(cursor.getTime() + DAY_MS);
  }
  throw new CalendarResolutionError(
    'BUSINESS_DAY_NOT_FOUND',
    `No business day found within ${maximumLookaheadDays} days after ${date}`,
  );
}

function parseLocalDate(value: string): {year: number; month: number; day: number} {
  const match = LOCAL_DATE.exec(value);
  if (!match) throw new CalendarResolutionError('INVALID_DATE', `Invalid local date: ${value}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new CalendarResolutionError('INVALID_DATE', `Invalid local date: ${value}`);
  }
  return {year, month, day};
}

function parseLocalDateUtc(value: string): Date {
  const {year, month, day} = parseLocalDate(value);
  return new Date(Date.UTC(year, month - 1, day));
}

function formatLocalDate(value: Date): LocalDate {
  const year = String(value.getUTCFullYear()).padStart(4, '0');
  const month = String(value.getUTCMonth() + 1).padStart(2, '0');
  const day = String(value.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}` as LocalDate;
}
