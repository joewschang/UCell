import { PrismaClient, Prisma } from '@prisma/client';
import { recognizeConsumption } from '@ucell/database';
import { randomUUID } from 'node:crypto';

const url = process.env.PHASE2_TEST_DATABASE_URL;
(url ? describe : describe.skip)('15-month qualification Active boundary simulation', () => {
  let db: PrismaClient;
  let ballA: string, ballB: string;
  beforeAll(async () => {
    db = new PrismaClient({ datasources: { db: { url } } });
    const person = await db.person.create({ data: { legalName: 'SYNTHETIC ANNUAL ACTIVE', status: 'EFFECTIVE' } });
    const create = () => db.qualification.create({ data: { currentHolderPersonId: person.personId, planLevelCode: 'STARTER', status: 'EFFECTIVE' } });
    ballA = (await create()).qualificationId;
    ballB = (await create()).qualificationId;
  });
  afterAll(() => db?.$disconnect());
  it.each(Array.from({ length: 15 }, (_, month) => [month, new Date(Date.UTC(2024, month, 1)).toISOString().slice(0, 7)]))(
    'ANNUAL-ACTIVE-%s: month %s independently crosses 2000 and expires at Taipei month end', async (month) => {
      const m = Number(month), start = new Date(Date.UTC(2024, m, 1) - 8 * 3600000), end = new Date(Date.UTC(2024, m + 1, 1) - 8 * 3600000);
      await db.$transaction(async tx => {
        const input = (qualificationId: string, amount: string, recognizedAt: Date) => ({
          qualificationId, amount, recognizedAt, sourceType: 'TEST_ANNUAL_ACTIVE', sourceId: randomUUID(), eligible: true,
          concreteVolumeType: 'GPV' as const, productProfileVersion: 'SYNTHETIC', ruleVersionCode: 'TEST_ANNUAL_ACTIVE',
          parameterSnapshotHash: 'SYNTHETIC_THRESHOLD_2000', activeThreshold: '2000', correlationId: randomUUID(),
        });
        const activeAt = (qualificationId: string, at: Date) => tx.activePeriod.count({ where: { qualificationId, activeFrom: { lte: at }, OR: [{ activeTo: null }, { activeTo: { gt: at } }] } });
        expect(await activeAt(ballA, start)).toBe(0);
        const before = await recognizeConsumption(tx, input(ballA, '1999', start));
        expect(before.accumulator?.cumulativeBefore.toString()).toBe('0');
        expect(before.accumulator?.thresholdCrossed).toBe(false);
        expect(await activeAt(ballA, start)).toBe(0);
        await recognizeConsumption(tx, input(ballB, '1999', start));
        const crossingTime = new Date(start.getTime() + 1000), crossingInput = input(ballA, '1', crossingTime);
        const crossing = await recognizeConsumption(tx, crossingInput);
        expect(crossing.accumulator?.cumulativeAfter.toString()).toBe('2000');
        expect(crossing.accumulator?.thresholdCrossed).toBe(true);
        expect(await activeAt(ballA, new Date(crossingTime.getTime() - 1))).toBe(0);
        expect(await activeAt(ballA, crossingTime)).toBe(1);
        expect(await activeAt(ballB, crossingTime)).toBe(0);
        expect(await activeAt(ballA, new Date(end.getTime() - 1))).toBe(1);
        expect(await activeAt(ballA, end)).toBe(0);
        const replay = await recognizeConsumption(tx, crossingInput);
        expect(replay.created).toBe(false);
        expect(replay.volume?.eventId).toBe(crossing.volume?.eventId);
        expect(await tx.pvLedger.count({ where: { sourceType: crossingInput.sourceType, sourceId: crossingInput.sourceId } })).toBe(1);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 });
    },
  );
});
