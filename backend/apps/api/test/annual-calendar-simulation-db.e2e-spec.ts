import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { planDuePeriodJobs } from '@ucell/settlement';

const url = process.env.PHASE2_TEST_DATABASE_URL;
const kinds = ['REFERRAL_K0', 'BINARY_K1', 'MATCHING_K2', 'GLOBAL', 'WELFARE', 'PAYABLE_PREPARATION'];
// Durable admission only: job execution and payouts are deliberately asserted elsewhere.
(url ? describe : describe.skip)('15-month approved-calendar admission simulation', () => {
  let db: PrismaClient;
  beforeAll(() => { db = new PrismaClient({ datasources: { db: { url } } }); });
  afterAll(() => db?.$disconnect());
  async function configuration() {
    const ruleVersionCode = 'TEST_ANNUAL_CALENDAR_' + randomUUID();
    for (const kind of kinds) {
      const unit = ['REFERRAL_K0', 'PAYABLE_PREPARATION'].includes(kind) ? 'SETTLEMENT_10_25' : ['GLOBAL', 'WELFARE'].includes(kind) ? 'MONTH' : 'WEEK';
      for (const [parameterCode, valueJson] of [
        ['settlement.timezone', 'Asia/Taipei'],
        ['settlement.period', { unit, count: 1, anchorLocal: unit === 'MONTH' ? '2024-01-01T00:00:00' : '2024-01-07T00:00:00' }],
        ['settlement.cut_off', { localTime: '00:00:00', daysAfterPeriodEnd: 0, approvalReference: 'SYNTHETIC_ANNUAL_CALENDAR' }],
      ] as Array<[string, Prisma.InputJsonValue]>) await db.runtimeRuleParameter.create({ data: { ruleVersionCode, parameterCode, scopeKey: kind, valueJson, effectiveFrom: new Date('2020-01-01Z') } });
    }
    return { ruleVersionCode, from: new Date('2024-01-09T16:00:00Z'), approvalReference: 'SYNTHETIC_ANNUAL_SIMULATION', maxPeriodsPerKind: 52 };
  }
  async function drain(input: Awaited<ReturnType<typeof configuration>>, through: Date) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const result = await planDuePeriodJobs(db, { ...input, through });
      expect(result.failures).toEqual([]);
      if (result.admitted === 0 && result.replayed === 0) return;
    }
    throw new Error('Annual planner did not drain within the bounded catch-up limit');
  }
  async function normalized(ruleVersionCode: string) {
    const jobs = await db.periodCloseJob.findMany({ where: { ruleVersionCode }, orderBy: [{ kind: 'asc' }, { periodStart: 'asc' }] });
    const identity = (row: typeof jobs[number]) => `${row.kind}:${row.periodStart.toISOString()}:${row.periodEnd.toISOString()}`;
    const prerequisites = (row: typeof jobs[number]): string[] => {
      const value = row.prerequisiteIds;
      if (!Array.isArray(value) || !value.every(id => typeof id === 'string')) throw new Error('Invalid prerequisite manifest');
      return value as string[];
    };
    const byId = new Map(jobs.map(row => [row.periodCloseJobId, identity(row)]));
    expect(new Set(jobs.map(identity)).size).toBe(jobs.length);
    expect(await db.outboxEvent.count({ where: { aggregateId: { in: jobs.map(row => row.periodCloseJobId) } } })).toBe(jobs.length);
    for (const row of jobs) {
      expect(row.periodEnd.getUTCHours()).toBe(16); // Taipei midnight, exclusive end.
      if (row.kind === 'BINARY_K1' || row.kind === 'MATCHING_K2') {
        expect(row.periodEnd.getTime() - row.periodStart.getTime()).toBe(7 * 86400000);
        expect(new Date(row.periodEnd.getTime() + 8 * 3600000).getUTCDay()).toBe(0);
      }
      expect(prerequisites(row).every(id => byId.has(id))).toBe(true);
    }
    return jobs.map(row => ({ identity: identity(row), prerequisites: prerequisites(row).map(id => byId.get(id)).sort() }));
  }
  it('ANNUAL-CALENDAR-01: monthly progression equals catch-up through 15 months without duplicate manifests or outbox events', async () => {
    const incremental = await configuration(), catchup = await configuration();
    for (let m = 0; m < 15; m++) await drain(incremental, new Date(Date.UTC(2024, m, 25) - 8 * 3600000));
    const through = new Date('2025-03-24T16:00:00Z');
    await drain(catchup, through);
    const expected = await normalized(incremental.ruleVersionCode);
    expect(await normalized(catchup.ruleVersionCode)).toEqual(expected);
    // Independently counted boundaries: 29 half-month closes, 63 complete Sunday
    // weeks and 14 month closes between Jan 10 2024 and Mar 25 2025.
    const counts: Record<string, number> = { REFERRAL_K0: 29, BINARY_K1: 63, MATCHING_K2: 63, GLOBAL: 14, WELFARE: 14, PAYABLE_PREPARATION: 29 };
    for (const kind of kinds) expect(expected.filter(row => row.identity.startsWith(kind + ':')).length).toBe(counts[kind]);
    expect(expected).toHaveLength(212);
    // Complete re-entry at the same horizon must not publish another outbox event.
    expect(await planDuePeriodJobs(db, { ...catchup, through })).toMatchObject({ admitted: 0, replayed: 0, failures: [] });
    expect(await normalized(catchup.ruleVersionCode)).toEqual(expected);
  }, 180000);
});
