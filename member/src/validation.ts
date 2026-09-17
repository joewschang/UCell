import type { Binary, Bonus, Dashboard, Ledger, Orders, Organization, Performance, Person, Product, Qualification } from './api';
type Check = (value: unknown) => boolean;
const string: Check = v => typeof v === 'string';
const id: Check = v => typeof v === 'string' && v.trim().length > 0;
const boolean: Check = v => typeof v === 'boolean';
// Only display DTOs use JS numbers; no coercion of decimal strings or null to zero.
const number: Check = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v) <= Number.MAX_SAFE_INTEGER;
const nonnegative: Check = v => number(v) && (v as number) >= 0;
const count: Check = v => nonnegative(v) && Number.isSafeInteger(v);
const nullable = (check: Check): Check => v => v === null || check(v);
const optional = (check: Check): Check => v => v === undefined || check(v);
const list = (check: Check): Check => v => Array.isArray(v) && v.every(check);
const object = (fields: Record<string, Check>): Check => v => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  return Object.entries(fields).every(([key, check]) => check((v as Record<string, unknown>)[key]));
};
const enumOf = (...values: string[]): Check => v => typeof v === 'string' && values.includes(v);
const period: Check = v => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);
const date = (v:unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && Number.isFinite(Date.parse(v+'T00:00:00Z'));
const unique = (check: Check, key: string): Check => v => list(check)(v) && new Set((v as Record<string, unknown>[]).map(x => x[key])).size === (v as unknown[]).length;
const activeInterval=object({activeFrom:string,activeTo:string});
const qualification = object({ id, code: id, rank: id, active: boolean, ballLabel: id,monthReference:optional(period),activeInterval:optional(nullable(activeInterval)) });
const status = enumOf('PENDING', 'CALCULATED', 'PENDING45D', 'EFFECTIVE', 'PAYABLE', 'PAID', 'REVERSED', 'CLAWBACK');
const metric = nullable(number);
const member = object({ code: id, name: string });
const side = object({ count: nullable(count), volume: metric, carry: metric });
const readModelAvailability = object({ status: enumOf('AVAILABLE', 'UNAVAILABLE'), reason: nullable(string) });
const binarySettlementScope = object({ settlementBatchId:id,periodStart:string,periodEnd:string,ruleVersion:id,parameterSnapshotHash:id,calculationHash:id,finalizedAt:string });
function schema<T>(check: Check) {
  return (value: unknown): T => {
    if (!check(value)) throw new Error('資料格式異常，已停止顯示；請重新載入或聯絡客服');
    return value as T;
  };
}
export const parseQualifications = schema<Qualification[]>(unique(qualification, 'id'));
export const parsePerson = schema<Person>(object({ name: string, alias:nullable(string),memberNo: id, email: nullable(string), phone: nullable(string),gender:nullable(string),birthDate:nullable(date),membershipState:nullable(enumOf('NETWORK_MEMBER','FORMAL_PENDING','FORMAL_MEMBER')),mobileVerifiedAt:nullable(string) }));
export const parseDashboard = schema<Dashboard>(object({ memberName: string, memberNo: id, qualification,
  monthlyRepurchaseStatus: enumOf('ACTIVE', 'PENDING', 'INACTIVE'), pv: metric, rpv: metric, epv: metric, bonusAmount: metric, bonusStatus: status,monthReference:optional(period),activeInterval:optional(nullable(activeInterval)) }));
export const parseOrganization = schema<Organization>(object({ qualificationId: id, sponsor: nullable(member), referrals: unique(member, 'code') }));
export const parseBinary = schema<Binary>(object({ qualificationId: id, left: side, right: side, settlementMetrics: readModelAvailability, settlementScope:optional(nullable(binarySettlementScope)), fullTree: readModelAvailability }));
export const parsePerformance = schema<Performance>(object({ qualificationId: id, period, pv: metric, rpv: metric, epv: metric, left: metric, right: metric, asOf: nullable(string) }));
export const parseBonus = schema<Bonus>(object({ qualificationId: id, period, awards: unique(object({ id, name: string, status, amount: metric,theoryAmount:optional(metric),finalAmount:optional(metric),payableAmount:optional(metric),settlementStatus:optional(enumOf('PENDING','FINALIZED')),pendingReason:optional(nullable(string)),settlementDate:optional(nullable(date)),nominalPayoutDate:optional(nullable(date)),adjustedPayoutDate:optional(nullable(date)),businessCalendarVersion:optional(nullable(string)),ruleVersion:optional(nullable(string)),parameterSnapshotHash:optional(nullable(string)) }), 'id') }));
export const parseLedger = schema<Ledger>(object({ qualificationId: id, period, entries: unique(object({ id, label: string, amount: metric, postedAt: string, sourceId: id }), 'id') }));
export const parseProducts = schema<Product[]>(unique(object({ id, name: string, price: nullable(nonnegative), pv: nullable(nonnegative), available: boolean }), 'id'));
export const parseOrders = schema<Orders>(object({ qualificationId: id, orders: unique(object({ id, createdAt: string, total: metric, status: id, paymentStatus: id, shipmentStatus: id }), 'id') }));
