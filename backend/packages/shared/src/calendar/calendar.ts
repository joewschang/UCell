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
      | 'BUSINESS_DAY_NOT_FOUND',
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
