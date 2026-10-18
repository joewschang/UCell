import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
const url = process.env.PHASE2_TEST_DATABASE_URL;
if (!url || !/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))) throw Error('ISOLATED_DATABASE_REQUIRED');
describe('Independent award-source Serializable transactions', () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const sources = ['00000000-0000-4000-8000-000000000001', 'ffffffff-ffff-4fff-bfff-ffffffffffff'];
  let qualificationId: string;
  const row = (sourceEventId: string, generationNo = 0) => ({
    recipientQualificationId: qualificationId, sourceQualificationId: qualificationId,
    sourceEventId, generationNo, awardType: 'EPV' as const, theoryAmount: 1,
    payableAmount: 1, activeSnapshot: true, ruleVersionCode: 'TEST_SOURCE_INDEX',
    occurredAt: new Date('2024-01-24Z'), pendingUntil: new Date('2024-03-10Z'), calculationDetail: {},
  });
  beforeAll(async () => {
    const person = await db.person.create({ data: { legalName: 'SYNTHETIC AWARD SOURCE' } });
    qualificationId = (await db.qualification.create({ data: { currentHolderPersonId: person.personId, planLevelCode: 'STARTER' } })).qualificationId;
    await db.bonusAward.createMany({ data: [...sources, ...Array.from({ length: 5000 }, () => randomUUID())].map(id => row(id)) });
    await db.$executeRawUnsafe('ANALYZE ledger.bonus_award');
  }, 30000);
  afterAll(() => db.$disconnect());
  it('unrelated source-event reads and inserts both commit without whole-table predicate conflicts', async () => {
    let arrived = 0, release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    const results = await Promise.allSettled(sources.map(sourceEventId => db.$transaction(async tx => {
      const awards = await tx.bonusAward.findMany({ where: { sourceEventId, awardType: 'EPV' }, orderBy: { bonusAwardId: 'asc' } });
      expect(awards).toHaveLength(1);
      if (++arrived === 2) release();
      await barrier;
      await tx.bonusAward.create({ data: row(sourceEventId, 1) });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 10000 })));
    for (const result of results) if (result.status === 'rejected') console.error('SOURCE_PREDICATE_CONFLICT', result.reason);
    expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled']);
    expect(await db.bonusAward.count({ where: { sourceEventId: { in: sources } } })).toBe(4);
  }, 20000);
});
