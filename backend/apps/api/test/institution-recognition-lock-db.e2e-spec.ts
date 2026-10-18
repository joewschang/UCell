import { PrismaClient, Prisma } from '@prisma/client';
import { appendRecognitionMemberMessage } from '@ucell/database';
import { randomUUID } from 'node:crypto';
import { RpvService } from '../src/modules/rpv/rpv.service';

const url = process.env.PHASE2_TEST_DATABASE_URL;
if (!url || !/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))) throw Error('ISOLATED_DATABASE_REQUIRED');
describe('Recognition message qualification locking', () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const ids: string[] = [], schedules: string[] = [];
  beforeAll(async () => {
    const at = new Date('2024-01-24T00:00:00+08:00'), from = new Date('2023-12-01Z');
    const rule = 'TEST_LOCK_' + randomUUID();
    await db.runtimeRuleParameter.create({ data: { ruleVersionCode: rule, parameterCode: 'accounting.timezone', valueJson: 'Asia/Taipei', effectiveFrom: from } });
    const plan = await db.subscriptionPlan.create({ data: { planCode: rule, displayName: 'Synthetic lock test', durationMonths: 1, prepaidAmount: 2000, productBoxQty: 1, monthlyRecognizedAmount: 2000, monthlyRpv: 1200 } });
    for (let i = 0; i < 2; i++) {
      const person = await db.person.create({ data: { legalName: 'SYNTHETIC LOCK ' + i } });
      const q = await db.qualification.create({ data: { currentHolderPersonId: person.personId, planLevelCode: 'STARTER', status: 'EFFECTIVE', effectiveAt: from } });
      ids.push(q.qualificationId);
      await db.qualificationPlanHistory.create({ data: { qualificationId: q.qualificationId, planCode: 'STARTER', effectiveFrom: from, sourceType: 'TEST' } });
      await db.qualificationStatusHistory.create({ data: { qualificationId: q.qualificationId, status: 'EFFECTIVE', effectiveFrom: from, sourceType: 'TEST' } });
      const sub = await db.subscription.create({ data: { qualificationId: q.qualificationId, subscriptionPlanId: plan.subscriptionPlanId, status: 'ACTIVE', startMonth: new Date('2024-01-01Z'), endMonth: new Date('2024-01-01Z'), ruleVersionCode: rule } });
      const schedule = await db.monthlyRecognitionSchedule.create({ data: { subscriptionId: sub.subscriptionId, installmentNo: 1, recognitionMonth: new Date('2024-01-01Z'), dueAt: at, recognizedAmount: 2000, rpvAmount: 1200, ruleVersionCode: rule } });
      schedules.push(schedule.recognitionId);
      await new RpvService(db as any, {} as any).recognize(schedule.recognitionId);
    }
  }, 30000);
  afterAll(() => db.$disconnect());

  it.each(['existing', 'new'])('two %s messages avoid FK lock deadlock; serializable write conflicts support redelivery', async mode => {
    let arrived = 0, release!: () => void;
    const barrier = new Promise<void>(resolve => { release = resolve; });
    if (mode === 'new') await db.memberNotification.deleteMany({ where: { qualificationId: { in: ids } } });
    const before = await db.memberNotification.findMany({ where: { qualificationId: { in: ids } }, orderBy: { messageKey: 'asc' } });
    const results = await Promise.allSettled(schedules.map((id) => db.$transaction(async tx => {
      // Reproduce the lock mode held by FK references to source/recipient qualifications.
      await tx.$queryRaw`SELECT qualification_id FROM membership.qualification WHERE qualification_id IN (${Prisma.join(ids.map(id => Prisma.sql`${id}::uuid`))}) FOR KEY SHARE`;
      if (++arrived === 2) release();
      await barrier;
      return appendRecognitionMemberMessage(tx, id);
    }, { isolationLevel: 'Serializable', timeout: 10000 })));
    if (mode === 'existing') {
      for (const result of results) if (result.status === 'rejected') console.error('LOCK_REPRO_FAILURE', result.reason);
      expect(results.map(r => r.status)).toEqual(['fulfilled', 'fulfilled']);
    } else {
      // Concurrent inserts can abort under Serializable. Reject explicit 40P01;
      // Prisma P2034 does not distinguish serialization failures from deadlocks.
      // The existing-message case above separately forbids every aborted attempt.
      expect(results.some(r => r.status === 'fulfilled')).toBe(true);
      for (const [i, result] of results.entries()) if (result.status === 'rejected') {
        const error = result.reason;
        expect(error.code === 'P2034' || (error.code === 'P2010' && error.meta?.code === '40001')).toBe(true);
        await db.$transaction(tx => appendRecognitionMemberMessage(tx, schedules[i]), { isolationLevel: 'Serializable' });
      }
    }
    const after = await db.memberNotification.findMany({ where: { qualificationId: { in: ids } }, orderBy: { messageKey: 'asc' } });
    expect(after).toHaveLength(2);
    if (mode === 'existing') expect(after).toEqual(before);
  }, 20000);

  it('message audience lock still excludes a concurrent holder-update lock', async () => {
    await db.$transaction(async tx => {
      await appendRecognitionMemberMessage(tx, schedules[0]);
      await expect(db.$transaction(async other => {
        await other.$executeRawUnsafe("SET LOCAL lock_timeout = '100ms'");
        return other.$executeRaw`UPDATE membership.qualification SET current_holder_person_id=(SELECT current_holder_person_id FROM membership.qualification WHERE qualification_id=${ids[1]}::uuid) WHERE qualification_id=${ids[0]}::uuid`;
      }))
        .rejects.toMatchObject({ code: 'P2010', meta: { code: '55P03' } });
    }, { isolationLevel: 'Serializable', timeout: 10000 });
  });
});
