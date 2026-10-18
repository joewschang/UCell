import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { EpvService } from '../src/modules/epv/epv.service';
import { EpvMonthService } from '../src/modules/epv/epv-month.service';
import { BonusQueryService } from '../src/modules/bonus/bonus-query.service';
import { RuntimeRuleService } from '../src/modules/rules/runtime-rule.service';

const url = process.env.PHASE2_TEST_DATABASE_URL;
// Historical synthetic dates exercise production recognition without changing the host clock.
// This is service/DB coverage, not a claim of API/Worker/bank or cash/points coverage.
(url ? describe : describe.skip)('15-month production EPV recognition simulation', () => {
  let db: PrismaClient;
  beforeAll(() => { db = new PrismaClient({ datasources: { db: { url } } }); });
  afterAll(() => db?.$disconnect());

  it('ANNUAL-EPV-01: resets 15 months, isolates two balls, respects five historical Active snapshots and replays once', async () => {
    const rule = 'TEST_ANNUAL_EPV_' + randomUUID();
    const from = new Date('2023-12-31T16:00:00Z');
    const rows = await db.runtimeRuleParameter.findMany({ where: { ruleVersionCode: 'R1.0B' }, orderBy: { effectiveFrom: 'asc' } });
    for (const row of new Map(rows.map(row => [JSON.stringify([row.parameterCode, row.scopeKey]), row])).values()) {
      await db.runtimeRuleParameter.create({ data: {
        ruleVersionCode: rule, parameterCode: row.parameterCode, scopeKey: row.scopeKey,
        valueJson: ['epv.calendar.timezone', 'accounting.timezone'].includes(row.parameterCode) ? 'Asia/Taipei' : row.valueJson!,
        effectiveFrom: new Date('2023-01-01Z'),
      } });
    }
    const params = await db.runtimeRuleParameter.findMany({ where: { ruleVersionCode: rule } });
    const parameter = (code: string, scope = '*') => params.find(row => row.parameterCode === code && row.scopeKey === scope)?.valueJson;
    // Explicit expectations prevent seeded rates silently defining their own expected result.
    expect(Number(parameter('epv.base_amount'))).toBe(2000);
    expect(Number(parameter('epv.rate'))).toBe(0.6);
    expect(Number(parameter('epv.self.rate'))).toBe(0.5);
    for (let g = 1; g <= 5; g++) expect(Number(parameter('epv.upline.rate', String(g)))).toBe(0.06);
    const person = await db.person.create({ data: { legalName: 'SYNTHETIC ANNUAL EPV' } });
    const qualifications = [];
    for (let i = 0; i < 7; i++) {
      const q = await db.qualification.create({ data: { currentHolderPersonId: person.personId, planLevelCode: 'STARTER', status: 'EFFECTIVE', effectiveAt: from } });
      qualifications.push(q);
      await db.qualificationPlanHistory.create({ data: { qualificationId: q.qualificationId, planCode: 'STARTER', effectiveFrom: from, sourceType: 'TEST' } });
      await db.qualificationStatusHistory.create({ data: { qualificationId: q.qualificationId, status: 'EFFECTIVE', effectiveFrom: from, sourceType: 'TEST' } });
      // G3 is inactive in July 2024 only; current qualification snapshots remain identical.
      const intervals = i === 3
        ? [[from, new Date('2024-06-30T16:00:00Z')], [new Date('2024-07-31T16:00:00Z'), new Date('2025-03-31T16:00:00Z')]]
        : [[from, new Date('2025-03-31T16:00:00Z')]];
      for (const [activeFrom, activeTo] of intervals) await db.activePeriod.create({ data: { qualificationId: q.qualificationId, activeFrom, activeTo, sourceType: 'TEST', ruleVersionCode: rule } });
      if (i > 0 && i <= 5) await db.sponsorRelationship.create({ data: { childQualificationId: qualifications[i - 1].qualificationId, sponsorQualificationId: q.qualificationId, sponsorSequenceNo: 1, effectiveFrom: from } });
    }
    const self = qualifications[0], otherBall = qualifications[6];
    const product = await db.productReference.create({ data: { sku: randomUUID(), displayName: 'Synthetic cash repurchase', currentPrice: 1500 } });
    const service = new EpvService(db as any, new RuntimeRuleService(db as any), new BonusQueryService(db as any), new EpvMonthService());
    const recognized: string[] = [];
    for (let m = 0; m < 15; m++) {
      // First payment exactly at Taipei month opening, including leap February and year rollover.
      const opening = new Date(Date.UTC(2024, m, 1) - 8 * 3600000);
      for (const [q, day, expected] of [[self, 0, '0'], [otherBall, 1, '0'], [self, 2, '600']] as const) {
        const paidAt = new Date(opening.getTime() + day * 86400000);
        const order = await db.order.create({ data: {
          qualificationId: q.qualificationId, purpose: 'REPURCHASE', status: 'PAID', paidAt, grossAmount: 1500, netAmount: 1500, ruleVersionCode: rule,
          lines: { create: { productId: product.productId, skuSnapshot: product.sku, productNameSnapshot: product.displayName, quantity: 1, unitPrice: 1500, lineAmount: 1500, gpvRateSnapshot: 0, gpvAmountSnapshot: 0, ruleProfileSnapshot: { testOnly: true } } },
        } });
        expect(await service.recognizeOrder(order.orderId, rule)).toMatchObject({ epv: expected });
        recognized.push(order.orderId);
        const event = await db.pvLedger.findFirstOrThrow({ where: { sourceId: order.orderId, pvType: 'EPV' } });
        const awards = await db.bonusAward.findMany({ where: { sourceEventId: event.eventId }, orderBy: { generationNo: 'asc' } });
        const expectedAmounts = q === otherBall ? ['0'] : expected === '0' ? ['0', '0', '0', '0', '0', '0'] : ['300', '36', '36', m === 6 ? '0' : '36', '36', '36'];
        expect(awards.map(a => a.payableAmount.toString())).toEqual(expectedAmounts);
        expect(awards.map(a => a.recipientQualificationId)).toEqual(q === otherBall ? [otherBall.qualificationId] : qualifications.slice(0, 6).map(a => a.qualificationId));
        if (q === self) expect(awards[3].activeSnapshot).toBe(m !== 6);
        expect(await service.recognizeOrder(order.orderId, rule)).toMatchObject({ skipped: 'ALREADY_RECOGNIZED' });
      }
    }
    const sourceWhere = { sourceType: 'ORDER', sourceId: { in: recognized }, pvType: 'EPV' as const };
    expect(await db.pvLedger.count({ where: sourceWhere })).toBe(45);
    expect((await db.pvLedger.aggregate({ where: sourceWhere, _sum: { amount: true } }))._sum.amount!.toString()).toBe('9000');
    const awardWhere = { ruleVersionCode: rule, awardType: 'EPV' as const };
    expect(await db.bonusAward.count({ where: awardWhere })).toBe(195);
    expect((await db.bonusAward.aggregate({ where: awardWhere, _sum: { payableAmount: true } }))._sum.payableAmount!.toString()).toBe('7164');
    // Replaying the complete historical year after all future months must be a no-op.
    for (const id of recognized) expect(await service.recognizeOrder(id, rule)).toMatchObject({ skipped: 'ALREADY_RECOGNIZED' });
    expect(await db.pvLedger.count({ where: sourceWhere })).toBe(45);
    expect(await db.bonusAward.count({ where: awardWhere })).toBe(195);
  }, 120000);
});
