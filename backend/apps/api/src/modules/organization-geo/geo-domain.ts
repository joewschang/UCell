/** R1.1 read-model vocabulary. Monetary calculations stay in the frozen Core. */
export const GEO_DEFINITION_VERSION = 'R1.1-GEO-V1';
export const GEO_METRICS = ['BALLS', 'MEMBERS', 'ACTIVE_BALLS', 'NEW_BALLS', 'GPV'] as const;
export type GeoMetric = typeof GEO_METRICS[number];
export type GeoSide = 'ALL' | 'LEFT' | 'RIGHT';
export type GeoContext = {
  rootQualificationId: string;
  side: GeoSide;
  periodStart: string;
  periodEnd: string;
  asOf: string;
  knowledgeCutoff: string;
};
/** Facts must come from authorized historical Binary/ownership/Active evidence. */
export type GeoBallFact = {
  qualificationId: string;
  holderPersonId: string | null;
  ownerType: 'MEMBER' | 'COMPANY';
  firstSide: 'LEFT' | 'RIGHT';
  firstPlacedAt: string;
  active: 'ACTIVE' | 'INACTIVE' | 'UNKNOWN';
  cityCode: string | null;
  districtCode: string | null;
};
/** One authoritative, signed net source fact; propagated ledger rows are forbidden. */
export type GeoGpvFact = { sourceEventId: string; qualificationId: string; occurredAt: string; netGpv: string };

export function parseGpv(value: string): bigint {
  if (!/^-?\d+(?:\.\d{1,4})?$/.test(value)) throw new Error('INVALID_GPV_PRECISION');
  const negative = value.startsWith('-');
  const [whole, fraction = ''] = (negative ? value.slice(1) : value).split('.');
  const scaled = BigInt(whole) * 10000n + BigInt(fraction.padEnd(4, '0'));
  return negative ? -scaled : scaled;
}
export function formatGpv(value: bigint): string {
  const sign = value < 0n ? '-' : '';
  const abs = value < 0n ? -value : value;
  return `${sign}${abs / 10000n}.${String(abs % 10000n).padStart(4, '0')}`;
}
function instant(value: string): number {
  if (!/(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) throw new Error('INVALID_GEO_TIME');
  return Date.parse(value);
}
export function validateGeoContext(context: GeoContext) {
  const start = instant(context.periodStart), end = instant(context.periodEnd), at = instant(context.asOf);
  instant(context.knowledgeCutoff);
  if (start >= end || start > at || !['ALL', 'LEFT', 'RIGHT'].includes(context.side)) throw new Error('INVALID_GEO_CONTEXT');
}
function measures(balls: GeoBallFact[], gpv: Map<string, bigint>, context: GeoContext) {
  const members = balls.filter(b => b.ownerType === 'MEMBER');
  const unknown = members.filter(b => b.active === 'UNKNOWN').length;
  const active = members.filter(b => b.active === 'ACTIVE').length;
  return {
    balls: balls.length,
    members: new Set(members.map(b => b.holderPersonId)).size,
    eligibleMemberBalls: members.length,
    activeBalls: unknown ? null : active,
    activeRate: unknown || !members.length ? null : active / members.length,
    activeStatus: unknown ? 'UNAVAILABLE' : 'AVAILABLE',
    unknownActiveBalls: unknown,
    newBalls: balls.filter(b => instant(b.firstPlacedAt) >= instant(context.periodStart) && instant(b.firstPlacedAt) < Math.min(instant(context.periodEnd), instant(context.asOf))).length,
    gpv: formatGpv(balls.reduce((sum, b) => sum + (gpv.get(b.qualificationId) ?? 0n), 0n)),
    unlocatedBalls: balls.filter(b => !b.cityCode).length,
  };
}
/** Shared reducer for summary/distribution/export. No PII fields enter the response. */
export function aggregateGeo(context: GeoContext, population: GeoBallFact[], sources: GeoGpvFact[], level: 'CITY' | 'DISTRICT' = 'CITY', parentAreaCode?: string) {
  validateGeoContext(context);
  const byId = new Map<string, GeoBallFact>();
  for (const ball of population) {
    if (ball.qualificationId === context.rootQualificationId) continue;
    if (byId.has(ball.qualificationId)) throw new Error('AMBIGUOUS_BINARY_DESCENDANT');
    if (!['LEFT', 'RIGHT'].includes(ball.firstSide)) throw new Error('INVALID_HISTORICAL_FIRST_SIDE');
    if (ball.ownerType === 'MEMBER' && !ball.holderPersonId) throw new Error('OWNER_EVIDENCE_UNAVAILABLE');
    if (ball.ownerType === 'COMPANY' && ball.holderPersonId) throw new Error('OWNER_EVIDENCE_MISMATCH');
    if (instant(ball.firstPlacedAt) > instant(context.asOf)) throw new Error('PLACEMENT_AFTER_CHECKPOINT');
    byId.set(ball.qualificationId, ball);
  }
  const gpv = new Map<string, bigint>(), sourceIds = new Set<string>();
  for (const source of sources) {
    if (sourceIds.has(source.sourceEventId)) throw new Error('DUPLICATE_GPV_SOURCE');
    sourceIds.add(source.sourceEventId);
    if (!byId.has(source.qualificationId)) throw new Error('GPV_OUTSIDE_AUTHORIZED_SUBTREE');
    const at = instant(source.occurredAt);
    if (at < instant(context.periodStart) || at >= Math.min(instant(context.periodEnd), instant(context.asOf))) continue;
    gpv.set(source.qualificationId, (gpv.get(source.qualificationId) ?? 0n) + parseGpv(source.netGpv));
  }
  const balls = [...byId.values()].filter(b => context.side === 'ALL' || b.firstSide === context.side);
  const groups = new Map<string, GeoBallFact[]>();
  for (const ball of balls) {
    if (parentAreaCode && ball.cityCode !== parentAreaCode) continue;
    const areaCode = (level === 'CITY' ? ball.cityCode : ball.districtCode) ?? 'UNLOCATED';
    const group = groups.get(areaCode) ?? []; group.push(ball); groups.set(areaCode, group);
  }
  return {
    definitionVersion: GEO_DEFINITION_VERSION,
    unit: 'GPV_POINT',
    sourceWatermark: context.knowledgeCutoff,
    context,
    summary: measures(balls, gpv, context),
    branches: ['LEFT', 'RIGHT'].map(side => ({ side, ...measures(balls.filter(b => b.firstSide === side), gpv, context) })),
    distribution: [...groups.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([areaCode, group]) => ({ areaCode, ...measures(group, gpv, context) })),
  };
}
