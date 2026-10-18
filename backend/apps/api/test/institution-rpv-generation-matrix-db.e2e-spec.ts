import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { RpvService } from '../src/modules/rpv/rpv.service';

const url = process.env.PHASE2_TEST_DATABASE_URL;
// ALIGN-02: every fixed generation has its own result, including the excluded G13.
(url ? describe : describe.skip)('Institution ALIGN-02 RPV fixed-generation matrix', () => {
  let db: PrismaClient;
  const groups = new Map<number, { recognitionId: string; balls: string[] }>();
  const at = new Date('2024-01-01T00:00:00+08:00');
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    const rule = 'TEST_RPV_MATRIX_' + randomUUID();
    await db.runtimeRuleParameter.create({ data: { ruleVersionCode: rule, parameterCode: 'accounting.timezone', valueJson: 'Asia/Taipei', effectiveFrom: new Date('2023-01-01Z') } });
    const person = await db.person.create({ data: { legalName: 'SYNTHETIC RPV MATRIX' } });
    const effectiveFrom = new Date('2023-12-01Z');
    async function ball(statusFrom = effectiveFrom) {
      const q = await db.qualification.create({ data: { currentHolderPersonId: person.personId, planLevelCode: 'STARTER', status: 'EFFECTIVE', effectiveAt: statusFrom } });
      if (statusFrom > effectiveFrom) await db.qualificationStatusHistory.create({ data: { qualificationId: q.qualificationId, status: 'DRAFT', effectiveFrom, effectiveTo: statusFrom, sourceType: 'TEST' } });
      await db.qualificationStatusHistory.create({ data: { qualificationId: q.qualificationId, status: 'EFFECTIVE', effectiveFrom: statusFrom, sourceType: 'TEST' } });
      await db.qualificationPlanHistory.create({ data: { qualificationId: q.qualificationId, planCode: 'STARTER', effectiveFrom, sourceType: 'TEST' } });
      await db.qualificationHolderHistory.create({ data: { qualificationId: q.qualificationId, holderPersonId: person.personId, effectiveFrom, sourceType: 'TEST' } });
      await db.activePeriod.create({ data: { qualificationId: q.qualificationId, activeFrom: statusFrom, sourceType: 'TEST', ruleVersionCode: rule } });
      return q.qualificationId;
    }
    for (const directCount of [0, 1, 2]) {
      const balls: string[] = [];
      for (let g = 0; g <= 13; g++) {
        balls.push(await ball());
        if (g) {
          await db.binaryPlacement.create({ data: { parentQualificationId: balls[g], childQualificationId: balls[g - 1], side: 'LEFT', effectiveFrom } });
          for (let d = 0; d <= directCount; d++) {
            // One extra current-effective direct becomes effective only AFTER recognition.
            // It must not unlock another historical generation.
            const child = await ball(d === directCount ? new Date('2024-02-01Z') : effectiveFrom);
            await db.sponsorRelationship.create({ data: { sponsorQualificationId: balls[g], childQualificationId: child, sponsorSequenceNo: d + 1, effectiveFrom } });
          }
        }
      }
      const plan = await db.subscriptionPlan.create({ data: { planCode: 'TEST_' + randomUUID(), displayName: 'Synthetic RPV matrix', durationMonths: 1, prepaidAmount: 2000, productBoxQty: 1, monthlyRecognizedAmount: 2000, monthlyRpv: 1200 } });
      const subscription = await db.subscription.create({ data: { qualificationId: balls[0], subscriptionPlanId: plan.subscriptionPlanId, status: 'ACTIVE', startMonth: new Date('2024-01-01Z'), endMonth: new Date('2024-01-01Z'), ruleVersionCode: rule } });
      const schedule = await db.monthlyRecognitionSchedule.create({ data: { subscriptionId: subscription.subscriptionId, installmentNo: 1, recognitionMonth: new Date('2024-01-01Z'), dueAt: at, recognizedAmount: 2000, rpvAmount: 1200, ruleVersionCode: rule } });
      await new RpvService(db as any, {} as any).recognize(schedule.recognitionId);
      groups.set(directCount, { recognitionId: schedule.recognitionId, balls });
    }
  }, 120000);
  afterAll(() => db?.$disconnect());
  const cases = [0, 1, 2].flatMap(d => Array.from({ length: 13 }, (_, index) => ({ direct: d, generation: index + 1, depth: [5, 8, 12][d] })));
  it.each(cases)('RPV-D$direct-G$generation: historical directs unlock depth $depth only', async ({ direct, generation, depth }) => {
    const group = groups.get(direct)!;
    const row = await db.rpvUplineAwardEvent.findFirst({ where: { recognitionId: group.recognitionId, binaryGeneration: generation } });
    if (generation === 13) { expect(row).toBeNull(); return; }
    expect(row).not.toBeNull();
    expect(row).toMatchObject({ recipientQualificationId: group.balls[generation], sourceQualificationId: group.balls[0], effectiveDirectCountSnapshot: direct, unlockedDepthSnapshot: depth, activeSnapshot: true });
    expect(row!.theoryAmount.toString()).toBe('100');
    expect(row!.payableAmount.toString()).toBe(generation <= depth ? '100' : '0');
  });
  it.each([0, 1, 2])('RPV-D%s-RETRY: repeated recognition cannot duplicate generation awards', async direct => {
    const { recognitionId } = groups.get(direct)!;
    expect(await new RpvService(db as any, {} as any).recognize(recognitionId)).toMatchObject({ skipped: 'ALREADY_RECOGNIZED' });
    expect(await db.rpvUplineAwardEvent.count({ where: { recognitionId } })).toBe(12);
    expect(await db.pvLedger.count({ where: { sourceLineId: recognitionId, pvType: 'RPV' } })).toBe(1);
  });
});
