"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.monthEndDate = exports.addMonths = exports.localDate = void 0;
exports.historyRange = historyRange;
exports.cohortRetention = cohortRetention;
const common_1 = require("@nestjs/common");
const analytics_policy_1 = require("./analytics.policy");
const localDate = (at) => new Date(at.getTime() + 8 * 60 * 60_000).toISOString().slice(0, 10);
exports.localDate = localDate;
function parseDate(value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number(value.slice(0, 4)) < 1970)
        throw new common_1.BadRequestException('DATE_YYYY_MM_DD_REQUIRED_FROM_1970');
    const at = new Date(`${value}T00:00:00+08:00`);
    if (!Number.isFinite(at.getTime()) || (0, exports.localDate)(at) !== value)
        throw new common_1.BadRequestException('INVALID_CALENDAR_DATE');
    return at;
}
function historyRange(input = {}, now = new Date()) {
    if (!!input.from !== !!input.to)
        throw new common_1.BadRequestException('FROM_AND_TO_REQUIRED_TOGETHER');
    const tomorrow = new Date(parseDate((0, exports.localDate)(now)).getTime() + analytics_policy_1.DAY);
    const to = input.to ? parseDate(input.to) : tomorrow;
    const from = input.from ? parseDate(input.from) : new Date(to.getTime() - 90 * analytics_policy_1.DAY);
    if (from >= to || to.getTime() - from.getTime() > 366 * analytics_policy_1.DAY)
        throw new common_1.BadRequestException('DATE_RANGE_MUST_BE_1_TO_366_DAYS');
    if (to > tomorrow)
        throw new common_1.BadRequestException('FUTURE_OBSERVATION_RANGE_NOT_ALLOWED');
    const policyVersion = input.policyVersion ?? analytics_policy_1.ANALYTICS_POLICY.version;
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/.test(policyVersion))
        throw new common_1.BadRequestException('INVALID_POLICY_VERSION');
    return { from, to, policyVersion, timezone: 'Asia/Taipei', fromDate: (0, exports.localDate)(from), toDateExclusive: (0, exports.localDate)(to) };
}
const addMonths = (month, offset) => { const [year, m] = month.split('-').map(Number); return new Date(Date.UTC(year, m - 1 + offset, 1)).toISOString().slice(0, 7); };
exports.addMonths = addMonths;
const monthEndDate = (month) => new Date(Date.parse(`${(0, exports.addMonths)(month, 1)}-01T00:00:00Z`) - analytics_policy_1.DAY).toISOString().slice(0, 10);
exports.monthEndDate = monthEndDate;
/** Fixed cohort population captured on the final Taipei calendar day of its join month. */
function cohortRetention(observations, range, now = new Date()) {
    const monthly = new Map();
    for (const row of observations) {
        const time = new Date(row.asOf), date = (0, exports.localDate)(time), month = date.slice(0, 7);
        if (row.policyVersion !== range.policyVersion || time < range.from || time >= range.to || time > now || date !== (0, exports.monthEndDate)(month))
            continue;
        if (!monthly.has(month) || Date.parse(monthly.get(month).asOf) < time.getTime())
            monthly.set(month, row);
    }
    const currentMonth = (0, exports.localDate)(now).slice(0, 7), lastMonth = (0, exports.localDate)(new Date(range.to.getTime() - 1)).slice(0, 7);
    const rows = [];
    for (let month = range.fromDate.slice(0, 7); month <= lastMonth; month = (0, exports.addMonths)(month, 1)) {
        const baseline = month < currentMonth ? monthly.get(month) : undefined;
        const ids = baseline ? Object.keys(baseline.states).filter(id => baseline.states[id].joinedMonth === month && baseline.states[id].state !== 'P') : [];
        const activeIds = ids.filter(id => baseline.states[id].state === 'A');
        const cells = Array.from({ length: 13 }, (_, age) => {
            const observationMonth = (0, exports.addMonths)(month, age), observation = monthly.get(observationMonth);
            const blank = (status) => ({ age, observationMonth, status, asOf: null, observed: 0, missing: ids.length, activeCount: null, activeShare: null, activeRetention: null });
            if (observationMonth >= currentMonth)
                return blank('MONTH_NOT_CLOSED');
            if (observationMonth > lastMonth)
                return blank('OUTSIDE_QUERY_RANGE');
            if (!baseline)
                return blank('BASELINE_NOT_OBSERVED');
            if (!ids.length)
                return blank('EMPTY_COHORT');
            if (!observation)
                return blank('MONTH_END_NOT_OBSERVED');
            const tracked = ids.filter(id => observation.states[id]);
            const activeCount = tracked.filter(id => observation.states[id].state === 'A').length;
            const missing = ids.length - tracked.length;
            // Missing people are neither deleted from the denominator nor declared lost/retained.
            return { age, observationMonth, status: missing ? 'PARTIAL' : 'AVAILABLE', asOf: observation.asOf, observed: tracked.length, missing, activeCount,
                activeShare: missing ? null : activeCount / ids.length,
                activeRetention: missing || !activeIds.length ? null : activeIds.filter(id => observation.states[id]?.state === 'A').length / activeIds.length };
        });
        rows.push({ cohortMonth: month, baselineAsOf: baseline?.asOf ?? null, baselineSize: baseline ? ids.length : null, baselineActive: baseline ? activeIds.length : null, cells });
    }
    return { metricVersion: 'COHORT_FIXED_MONTH_END_V1', policyVersion: range.policyVersion, timezone: range.timezone, from: range.fromDate, toExclusive: range.toDateExclusive,
        basis: 'LAST_CAPTURE_ON_FINAL_LOCAL_DAY_NO_BACKFILL', rows };
}
//# sourceMappingURL=analytics.history.js.map