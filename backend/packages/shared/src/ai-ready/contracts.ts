import { DataClassification } from './catalog';
import { ReadContractError } from './read-gateway';
import { ExplainCode, METRIC_DEFINITIONS } from './semantic';

export const contractFail = (code: 'INVALID_QUERY' | 'INVALID_EVIDENCE' | 'DENIED' | 'HISTORICAL_UNAVAILABLE'): never => { throw new ReadContractError(code); };
export const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype;
export const isId = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9_.:-]{0,127}$/.test(v);
export const isInstant = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v) && Number.isFinite(Date.parse(v)) && new Date(v).toISOString() === v;
export function strictObject(raw: unknown, keys: readonly string[]): Record<string, unknown> {
  if (!isObject(raw) || Object.keys(raw).some(k => !keys.includes(k))) return contractFail('INVALID_QUERY');
  return raw;
}
export interface AsOfContext {
  readonly timezone: 'Asia/Taipei'; readonly asOf: string; readonly periodStart: string; readonly periodEnd: string;
  readonly knowledgeCutoff: string; readonly settlementId?: string; readonly ruleVersion?: string;
}
/** Event accumulation is exclusive at asOf; interval state is inclusive at its start. */
export function parseAsOfContext(raw: unknown): Readonly<AsOfContext> {
  const v = strictObject(raw, ['timezone','asOf','periodStart','periodEnd','knowledgeCutoff','settlementId','ruleVersion']);
  if (v.timezone !== 'Asia/Taipei' || !isInstant(v.asOf) || !isInstant(v.periodStart) || !isInstant(v.periodEnd)
    || !isInstant(v.knowledgeCutoff) || v.periodStart >= v.periodEnd || v.asOf < v.periodStart
    || (v.settlementId !== undefined && !isId(v.settlementId)) || (v.ruleVersion !== undefined && !isId(v.ruleVersion))) return contractFail('INVALID_QUERY');
  return Object.freeze({ timezone: 'Asia/Taipei', asOf: v.asOf, periodStart: v.periodStart, periodEnd: v.periodEnd,
    knowledgeCutoff: v.knowledgeCutoff, ...(v.settlementId ? { settlementId: v.settlementId as string } : {}), ...(v.ruleVersion ? { ruleVersion: v.ruleVersion as string } : {}) });
}
export function eventVisible(effectiveAt: string, recordedAt: string, context: AsOfContext): boolean {
  if (!isInstant(effectiveAt) || !isInstant(recordedAt)) return contractFail('INVALID_EVIDENCE');
  return effectiveAt >= context.periodStart && effectiveAt < context.periodEnd && effectiveAt < context.asOf && recordedAt <= context.knowledgeCutoff;
}
export interface UCellRequestContext {
  readonly actorId: string; readonly actorType: 'MEMBER' | 'ADMIN'; readonly roles: readonly string[];
  readonly personId?: string; readonly selectedQualificationId?: string; readonly binaryTreeId?: string;
  readonly permissions: readonly string[]; readonly scopes: readonly string[];
  readonly locale: 'zh-TW' | 'en'; readonly timezone: 'Asia/Taipei'; readonly correlationId: string; readonly contextVersion: string;
}
export interface EvidenceEnvelope<T> {
  result: T | null; status: 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE'; finality: 'PROVISIONAL' | 'FINALIZED' | 'PAID' | 'NOT_APPLICABLE';
  quality: 'VERIFIED' | 'PARTIAL' | 'KNOWLEDGE_ONLY' | 'UNAVAILABLE';
  scope: { qualificationId?: string; binaryTreeId?: string; personId?: string; resourceId?: string };
  time: AsOfContext; updatedAt: string | null; dataThrough: string | null;
  metricKey: string; definitionVersion: string; ruleVersion: string | null; parameterVersion: string | null;
  evidenceRefs: readonly { type: string; id: string; revision: string }[];
  explainCode: ExplainCode; canonicalDeepLink: string | null; dataClassification: DataClassification;
}
export const NEVER_AI_FIELDS = Object.freeze(['password','token','lineToken','entraToken','providerSecret','dbSecret','apiKey','accessToken','refreshToken','clientSecret','authorization']);
export function classifyField(name: string): DataClassification {
  const key = name.replace(/[^a-z0-9]/gi, '').toLowerCase();
  if (/password|token|secret|apikey|privatekey|signingkey|encryptionkey|authorization|credential|databaseurl/.test(key)) return 'SECRET_NEVER_AI';
  if (/bank|payment|accountnumber|phone|mobile|email|address|application|identitynumber|idnumber|legalname|preferredname|birthdate|dateofbirth/.test(key)) return 'MEMBER_SENSITIVE';
  return 'ADMIN_OPERATIONAL';
}
/** Project only reviewed fields. Unknown fields are omitted; sensitive fields are masked, secrets can never be opted in. */
export function projectClassifiedFields(raw: unknown, fields: readonly string[], permitted: readonly DataClassification[]): Readonly<Record<string, string | boolean | null>> {
  if (!isObject(raw)) return contractFail('INVALID_EVIDENCE');
  const output: Record<string, string | boolean | null> = {};
  for (const key of fields) {
    const classification = classifyField(key);
    if (classification === 'SECRET_NEVER_AI' || !permitted.includes(classification) || !Object.prototype.hasOwnProperty.call(raw, key)) continue;
    const value = raw[key];
    if (classification === 'MEMBER_SENSITIVE') { output[key] = value === null ? null : '[MASKED]'; continue; }
    if (typeof value === 'string' || typeof value === 'boolean' || value === null) output[key] = value;
  }
  return Object.freeze(output);
}
export const CANONICAL_ROUTES = Object.freeze({
  Person: '/admin/members/people/', Qualification: '/member/balls/', BinaryTree: '/admin/organization/trees/',
  Award: '/member/awards/', Settlement: '/admin/finance/settlements/', Order: '/member/orders/', Return: '/member/returns/',
  ReservoirEntry: '/admin/finance/reservoirs/', AnalyticsView: '/admin/analytics/views/', Metric: '/admin/analytics/metrics/', Knowledge: '/knowledge/',
});
export type CanonicalEntity = keyof typeof CANONICAL_ROUTES;
/** Logical route contract, not an authorization grant or assertion every alias is deployed. */
export function canonicalRoute(kind: CanonicalEntity, id: string): string {
  if (!Object.prototype.hasOwnProperty.call(CANONICAL_ROUTES, kind) || !isId(id)) return contractFail('INVALID_QUERY');
  return CANONICAL_ROUTES[kind] + encodeURIComponent(id);
}
export interface AnalyticsQuery {
  metrics: readonly string[]; time: AsOfContext; dimensions: readonly string[]; groupBy: readonly string[];
  filters: Readonly<Record<string, string>>; limit: number;
  pagination?: { cursor: string }; comparison?: AsOfContext;
}
export function parseAnalyticsQuery(raw: unknown, context: UCellRequestContext): Readonly<AnalyticsQuery> {
  const v = strictObject(raw, ['metrics','time','dimensions','groupBy','filters','limit','pagination','comparison']);
  if (context.actorType !== 'ADMIN') return contractFail('DENIED');
  if (!Array.isArray(v.metrics) || v.metrics.length < 1 || v.metrics.length > 10 || new Set(v.metrics).size !== v.metrics.length) return contractFail('INVALID_QUERY');
  const metrics = v.metrics.map(key => {
    if (typeof key !== 'string' || !Object.prototype.hasOwnProperty.call(METRIC_DEFINITIONS, key)) return contractFail('INVALID_QUERY');
    const metric = METRIC_DEFINITIONS[key];
    if (!context.permissions.includes(metric.requiredPermission)) return contractFail('DENIED');
    return metric;
  });
  if (new Set(metrics.map(m => m.grain)).size !== 1) return contractFail('INVALID_QUERY');
  const dimensions = v.dimensions ?? [], groupBy = v.groupBy ?? [], filters = v.filters ?? {};
  if (!Array.isArray(dimensions) || !Array.isArray(groupBy) || !isObject(filters)
    || [...dimensions,...groupBy,...Object.keys(filters)].some(key => typeof key !== 'string' || metrics.some(m => !m.dimensions.includes(key)))
    || Object.values(filters).some(value => !isId(value))) return contractFail('INVALID_QUERY');
  const limit = v.limit ?? 50;
  if (!Number.isInteger(limit) || (limit as number) < 1 || (limit as number) > 200) return contractFail('INVALID_QUERY');
  let pagination: AnalyticsQuery['pagination'];
  if (v.pagination !== undefined) { const p = strictObject(v.pagination, ['cursor']); if (!isId(p.cursor)) return contractFail('INVALID_QUERY'); pagination = Object.freeze({ cursor: p.cursor }); }
  return Object.freeze({ metrics: Object.freeze(metrics.map(m => m.key)), time: parseAsOfContext(v.time),
    dimensions: Object.freeze([...dimensions]), groupBy: Object.freeze([...groupBy]), filters: Object.freeze({ ...filters }) as Record<string,string>,
    limit: limit as number, ...(pagination ? {pagination} : {}), ...(v.comparison ? { comparison: parseAsOfContext(v.comparison) } : {}) });
}
