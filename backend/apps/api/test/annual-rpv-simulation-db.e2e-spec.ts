import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { SubscriptionService } from '../src/modules/subscription/subscription.service';
import { IdempotencyService } from '../src/common/idempotency/idempotency.service';
import { AuditService } from '../src/common/audit/audit.service';
import { RpvService } from '../src/modules/rpv/rpv.service';
import { processRecognition } from '../../worker/src/main';

const url = process.env.PHASE2_TEST_DATABASE_URL;
(url ? describe : describe.skip)('annual prepaid RPV plus next-quarter service/Worker simulation', () => {
  let db: PrismaClient;
  beforeAll(() => { db = new PrismaClient({ datasources: { db: { url } } }); });
  afterAll(() => db?.$disconnect());
  it('ANNUAL-RPV-01: creates 12+3 schedules, recognizes 1200 per month, keeps fixed generations and deduplicates both writers', async () => {
    const rule = 'TEST_ANNUAL_RPV_' + randomUUID(), from = new Date('2023-12-01Z');
    for (const [parameterCode, valueJson] of [
      ['accounting.timezone', 'Asia/Taipei'],
      ['subscription.calendar.timezone', 'Asia/Taipei'],
      ['subscription.calendar.period', { unit: 'MONTH', count: 1, anchorLocal: '2024-01-01T00:00:00' }],
      ['subscription.calendar.cutoff', { localTime: '00:00:00', daysAfterPeriodStart: 0, approvalReference: 'SYNTHETIC_MONTH_OPENING' }],
    ] as Array<[string, Prisma.InputJsonValue]>) await db.runtimeRuleParameter.create({ data: { ruleVersionCode: rule, parameterCode, valueJson, effectiveFrom: from } });
    const person = await db.person.create({ data: { legalName: 'SYNTHETIC ANNUAL RPV' } }), balls = [];
    for (let i = 0; i <= 13; i++) {
      const q = await db.qualification.create({ data: { currentHolderPersonId: person.personId, planLevelCode: 'STARTER', status: 'EFFECTIVE', effectiveAt: from } });
      balls.push(q);
      await db.qualificationPlanHistory.create({ data: { qualificationId: q.qualificationId, planCode: 'STARTER', effectiveFrom: from, sourceType: 'TEST' } });
      await db.qualificationStatusHistory.create({ data: { qualificationId: q.qualificationId, status: 'EFFECTIVE', effectiveFrom: from, sourceType: 'TEST' } });
      await db.qualificationHolderHistory.create({ data: { qualificationId: q.qualificationId, holderPersonId: person.personId, effectiveFrom: from, sourceType: 'TEST' } });
      const intervals = i === 3 ? [[from, new Date('2024-06-30T16:00:00Z')], [new Date('2024-07-31T16:00:00Z'), new Date('2025-03-31T16:00:00Z')]] : [[from, new Date('2025-03-31T16:00:00Z')]];
      for (const [activeFrom, activeTo] of intervals) await db.activePeriod.create({ data: { qualificationId: q.qualificationId, activeFrom, activeTo, sourceType: 'TEST', ruleVersionCode: rule } });
      if (i) await db.binaryPlacement.create({ data: { parentQualificationId: q.qualificationId, childQualificationId: balls[i - 1].qualificationId, side: 'LEFT', effectiveFrom: from } });
    }
    const subscriptions = new SubscriptionService(db as any, new IdempotencyService(db as any), new AuditService());
    const api = new RpvService(db as any, {} as any), ids: string[] = [];
    for (const [months, amount, boxes, startMonth] of [[12, 24000, 8, '2024-01-01'], [3, 6000, 2, '2025-01-01']] as const) {
      const plan = await db.subscriptionPlan.create({ data: { planCode: 'TEST_' + randomUUID(), displayName: 'Synthetic prepaid ' + months, durationMonths: months, prepaidAmount: amount, productBoxQty: boxes, monthlyRecognizedAmount: 2000, monthlyRpv: 1200 } });
      const { value: sub } = await subscriptions.create({ qualificationId: balls[0].qualificationId, planCode: plan.planCode as any, startMonth }, randomUUID(), randomUUID(), undefined, rule);
      expect(sub.schedules).toHaveLength(months);
      expect(sub.schedules.every(row => row.status === 'SCHEDULED' && row.rpvAmount.toString() === '1200' && row.recognizedAmount.toString() === '2000')).toBe(true);
      expect(await db.pvLedger.count({ where: { sourceId: sub.subscriptionId, pvType: 'RPV' } })).toBe(0);
      for (const row of sub.schedules) {
        const m = ids.length, expectedDate = new Date(Date.UTC(2024, m, 1) - 8 * 3600000);
        expect(row.dueAt).toEqual(expectedDate);
        if (m % 2) await processRecognition(row.recognitionId, db as any); else await api.recognize(row.recognitionId);
        ids.push(row.recognitionId);
        const awards = await db.rpvUplineAwardEvent.findMany({ where: { recognitionId: row.recognitionId }, orderBy: { binaryGeneration: 'asc' } });
        expect(awards).toHaveLength(12); // G13 is beyond the hard maximum.
        expect(awards.map(a => a.recipientQualificationId)).toEqual(balls.slice(1, 13).map(q => q.qualificationId));
        expect(awards.map(a => a.payableAmount.toString())).toEqual(Array.from({ length: 12 }, (_, g) => g < 5 && !(g === 2 && m === 6) ? '100' : '0'));
        expect(awards.every(a => a.unlockedDepthSnapshot === 5 && a.effectiveDirectCountSnapshot === 0)).toBe(true);
        // Cross-writer retries must preserve one volume and one in-app message per installment.
        await processRecognition(row.recognitionId, db as any);
        expect(await api.recognize(row.recognitionId)).toMatchObject({ skipped: 'ALREADY_RECOGNIZED' });
        expect(await db.pvLedger.count({ where: { sourceLineId: row.recognitionId, pvType: 'RPV' } })).toBe(1);
        expect(await db.memberNotification.count({ where: { messageKey: 'repurchase:recognized:' + row.recognitionId } })).toBe(1);
        expect((await db.pvLedger.aggregate({ where: { sourceLineId: { in: ids }, pvType: 'RPV' }, _sum: { amount: true } }))._sum.amount!.toString()).toBe(String(ids.length * 1200));
      }
    }
    expect(ids).toHaveLength(15);
    expect(await db.rpvUplineAwardEvent.count({ where: { recognitionId: { in: ids } } })).toBe(180);
    expect((await db.rpvUplineAwardEvent.aggregate({ where: { recognitionId: { in: ids } }, _sum: { payableAmount: true } }))._sum.payableAmount!.toString()).toBe('7400');
    expect(await db.notificationDelivery.count()).toBe(0);
  }, 120000);
});
