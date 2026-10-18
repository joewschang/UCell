import { PrismaClient, Prisma } from '@prisma/client';
import { recognizeConsumption } from '@ucell/database';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import { RpvService } from '../src/modules/rpv/rpv.service';
import { EpvService } from '../src/modules/epv/epv.service';
import { EpvMonthService } from '../src/modules/epv/epv-month.service';
import { BonusQueryService } from '../src/modules/bonus/bonus-query.service';
import { RuntimeRuleService } from '../src/modules/rules/runtime-rule.service';
import {sendRecognitionRequest} from '../../../../shared/recognition-request';

const url = process.env.PHASE2_TEST_DATABASE_URL;
if (!url || !/^ucell_jest_[a-f0-9]{32}$/.test(new URL(url).pathname.slice(1))) throw Error('ISOLATED_DATABASE_REQUIRED');
const monthAt = (m: number, day = 1) => new Date(Date.UTC(2024, m, day) - 8 * 3600000);
const baskets = [0, 1999, 2000, 3000, 4800];
const concurrency = Number(process.env.INSTITUTION_SCALE_WORKERS ?? '1');
const retryMode = process.env.INSTITUTION_SCALE_RETRY_MODE ?? 'HARNESS';
if (!['HARNESS', 'SERVICE_ONLY', 'FORMAL_CLIENT'].includes(retryMode)) throw Error('INVALID_SCALE_RETRY_MODE');
if (![1, 4].includes(concurrency)) throw Error('SCALE_WORKERS_MUST_BE_1_OR_4');
const people = Array.from({ length: 1000 }, (_, i) => {
  const joinMonth = i < 400 ? 0 : i < 750 ? 1 : 2;
  const offset = i - [0, 400, 750][joinMonth], size = [400, 350, 250][joinMonth];
  const parent = i === 0 ? -1 : i < 32 ? i - 1 : 31 + Math.floor((i - 32) / 2);
  return { i, personId: randomUUID(), ballId: randomUUID(), subscriptionId: randomUUID(), joinMonth,
    joinedAt: monthAt(joinMonth, 1 + Math.floor(offset * 20 / size)), parent, sponsor: parent,
    side: (i < 32 || (i - 32) % 2 === 0 ? 'LEFT' : 'RIGHT') as 'LEFT' | 'RIGHT',
    sequence: 0, schedules: Array.from({ length: 3 }, () => randomUUID()) };
});
const sequence = new Map<number, number>();
for (const p of people.slice(1)) {
  const parent = people[p.parent];
  // Move both children of selected left-side parents to their grandparent's
  // Sponsor line. Placement remains within that Sponsor's left subtree.
  if (p.parent >= 32 && p.parent % 3 === 0 && parent.side === 'LEFT') p.sponsor = parent.parent;
  p.sequence = (sequence.get(p.sponsor) ?? 0) + 1; sequence.set(p.sponsor, p.sequence);
}
const ancestors = (i: number, axis: 'parent' | 'sponsor', max: number) => {
  const result: number[] = []; let next = people[i][axis];
  while (next >= 0 && result.length < max) { result.push(next); next = people[next][axis]; }
  return result;
};
const amount = (i: number, m: number) => baskets[(i + m) % baskets.length];
const active = (i: number, m: number) => people[i].joinMonth <= m && amount(i, m) >= 2000;
const cancelled = (i: number, m: number) => i % 20 === 0 && m > people[i].joinMonth;
const directCount = (i: number, m: number) => people.filter(p => p.sponsor === i && p.joinMonth <= m).length;
async function runMembers<T>(rows: T[], work: (row: T) => Promise<void>) {
  let cursor = 0, failedEarly = false;
  const results = await Promise.allSettled(Array.from({ length: concurrency }, async () => {
    while (!failedEarly && cursor < rows.length) {
      const row = rows[cursor++];
      try { await work(row); } catch (error) { failedEarly = true; console.error('SCALE_WORKER_FAILED', error); throw error; }
    }
  }));
  const failed = results.find(r => r.status === 'rejected');
  if (failed?.status === 'rejected') throw failed.reason;
}

describe('1000 members progressively effective over three Taipei months', () => {
  const db = new PrismaClient({ datasources: { db: { url } } });
  const rule = 'TEST_SCALE_1000_' + randomUUID();
  const rpv = new RpvService(db as any, {} as any);
  const epv = new EpvService(db as any, new RuntimeRuleService(db as any), new BonusQueryService(db as any), new EpvMonthService());
  const evidence: any = { scenario: '1000_MEMBERS_3_MONTHS', status: 'RUNNING', seed: 'index-modulo-v1',
    boundaries: ['Fixture membership/plan/holder/trees/orders/subscriptions; no actual signup, KYC, payment or shipping.',
      'Active is derived through recognizeConsumption from separate synthetic GPV inputs. EPV/RPV use production services. This does not certify a single payment-to-all-bonuses pipeline.',
      'Worker count is recorded separately; not a concurrent-user capacity benchmark; no all-eight-bonus settlement or payout claim.',
      'SERVICE_ONLY disables caller retry; FORMAL_CLIENT uses the shipped Admin retry helper with service exceptions adapted to its HTTP error shape. Fixture Active retries are separate. No live HTTP/Worker daemon is exercised.'], concurrency, retryMode, clientRetries: 0, serializableRetries: 0, retryCodes: {}, serviceFailures: [], months: [] };
  async function withRetry<T>(work: () => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt++) {
      try { return await work(); } catch (error) {
        const e = error as any;
        const retryable = e.code === 'P2034' || (e.code === 'P2010' && ['40001', '40P01'].includes(e.meta?.code));
        if (!retryable || attempt >= 12) throw error;
        evidence.serializableRetries++;
        const code = e.code === 'P2010' ? `${e.code}/${e.meta.code}` : e.code;
        evidence.retryCodes[code] = (evidence.retryCodes[code] ?? 0) + 1;
        await new Promise(resolve => setTimeout(resolve, 50 * (attempt + 1) + Math.floor(Math.random() * 150)));
      }
    }
  }
  async function recognize<T>(kind: string, id: string, work: () => Promise<T>): Promise<T> {
    try { return await (retryMode === 'SERVICE_ONLY' ? work() : retryMode === 'FORMAL_CLIENT' ? sendRecognitionRequest(async()=>{
      try{return await work();}catch(error){const e=error as any;if(e.getStatus && e.getResponse)throw {status:e.getStatus(),body:e.getResponse(),message:e.message};throw error;}
    },()=>{evidence.clientRetries++;save();}) : withRetry(work)); }
    catch (error) {
      const e = error as any;
      evidence.serviceFailures.push({ kind, id, code: e.getResponse?.()?.code ?? e.code, message: e.message });
      evidence.status = 'FAILED'; save(); throw error;
    }
  }
  const recognizeRpv = (id: string) => recognize('RPV', id, () => rpv.recognize(id));
  const recognizeEpv = (id: string) => recognize('EPV', id, () => epv.recognizeOrder(id, rule));
  const save = () => { if (process.env.INSTITUTION_SCALE_EVIDENCE_PATH) writeFileSync(process.env.INSTITUTION_SCALE_EVIDENCE_PATH, JSON.stringify(evidence, null, 2)); };
  const orders: string[] = [], recognized: string[] = [];
  let product: { productId: string; sku: string; displayName: string };
  beforeAll(async () => {
    const from = new Date('2023-12-01Z');
    const rows = await db.runtimeRuleParameter.findMany({ where: { ruleVersionCode: 'R1.0B' }, orderBy: { effectiveFrom: 'asc' } });
    for (const row of new Map(rows.map(r => [JSON.stringify([r.parameterCode, r.scopeKey]), r])).values()) await db.runtimeRuleParameter.create({ data: {
      ruleVersionCode: rule, parameterCode: row.parameterCode, scopeKey: row.scopeKey,
      valueJson: ['epv.calendar.timezone', 'accounting.timezone'].includes(row.parameterCode) ? 'Asia/Taipei' : row.valueJson!, effectiveFrom: from,
    } });
    const params = await db.runtimeRuleParameter.findMany({ where: { ruleVersionCode: rule } });
    const param = (code: string, scope = '*') => Number(params.find(p => p.parameterCode === code && p.scopeKey === scope)?.valueJson);
    expect(param('epv.base_amount')).toBe(2000); expect(param('epv.rate')).toBe(0.6); expect(param('epv.self.rate')).toBe(0.5);
    for (let g = 1; g <= 5; g++) expect(param('epv.upline.rate', String(g))).toBe(0.06);
    await db.person.createMany({ data: people.map(p => ({ personId: p.personId, legalName: `SYNTHETIC SCALE ${p.i}`, status: 'EFFECTIVE' })) });
    await db.qualification.createMany({ data: people.map(p => ({ qualificationId: p.ballId, currentHolderPersonId: p.personId,
      planLevelCode: ['STARTER', 'ELITE', 'LEADER'][p.i % 3], status: 'EFFECTIVE', effectiveAt: p.joinedAt })) });
    await db.qualificationStatusHistory.createMany({ data: people.flatMap(p => [
      { qualificationId: p.ballId, status: 'DRAFT' as const, effectiveFrom: from, effectiveTo: p.joinedAt, sourceType: 'TEST' },
      { qualificationId: p.ballId, status: 'EFFECTIVE' as const, effectiveFrom: p.joinedAt, effectiveTo: null, sourceType: 'TEST' },
    ]) });
    await db.qualificationPlanHistory.createMany({ data: people.map(p => ({ qualificationId: p.ballId, planCode: ['STARTER', 'ELITE', 'LEADER'][p.i % 3], effectiveFrom: from, sourceType: 'TEST' })) });
    await db.qualificationHolderHistory.createMany({ data: people.map(p => ({ qualificationId: p.ballId, holderPersonId: p.personId, effectiveFrom: from, sourceType: 'TEST' })) });
    await db.binaryPlacement.createMany({ data: people.slice(1).map(p => ({ parentQualificationId: people[p.parent].ballId, childQualificationId: p.ballId, side: p.side, effectiveFrom: p.joinedAt })) });
    await db.sponsorRelationship.createMany({ data: people.slice(1).map(p => ({ sponsorQualificationId: people[p.sponsor].ballId, childQualificationId: p.ballId, sponsorSequenceNo: p.sequence, effectiveFrom: p.joinedAt })) });
    const plan = await db.subscriptionPlan.create({ data: { planCode: 'SCALE_' + randomUUID(), displayName: 'Synthetic three month schedule', durationMonths: 3, prepaidAmount: 6000, productBoxQty: 2, monthlyRecognizedAmount: 2000, monthlyRpv: 1200 } });
    await db.subscription.createMany({ data: people.map(p => ({ subscriptionId: p.subscriptionId, qualificationId: p.ballId, subscriptionPlanId: plan.subscriptionPlanId,
      status: 'ACTIVE', startMonth: new Date(Date.UTC(2024, p.joinMonth, 1)), endMonth: new Date(Date.UTC(2024, p.joinMonth + 2, 1)), ruleVersionCode: rule })) });
    await db.monthlyRecognitionSchedule.createMany({ data: people.flatMap(p => p.schedules.map((recognitionId, k) => ({ recognitionId, subscriptionId: p.subscriptionId, installmentNo: k + 1,
      recognitionMonth: new Date(Date.UTC(2024, p.joinMonth + k, 1)), dueAt: monthAt(p.joinMonth + k, 24), recognizedAmount: 2000, rpvAmount: 1200, ruleVersionCode: rule }))) });
    product = await db.productReference.create({ data: { sku: 'SCALE_' + randomUUID(), displayName: 'Synthetic repurchase basket', currentPrice: 2000 } });
    evidence.organization = { members: 1000, balls: 1000, binaryEdges: 999, sponsorEdges: 999, maxBinaryDepth: Math.max(...people.map(p => ancestors(p.i, 'parent', 1000).length)),
      arrivals: [400, 350, 250], plans: [334, 333, 333] }; save();
  }, 120000);
  afterAll(async () => { save(); await db.$disconnect(); });

  it('1000 distinct holders, acyclic topology and first/third Sponsor placements stay on the left', async () => {
    expect(await db.person.count({ where: { personId: { in: people.map(p => p.personId) } } })).toBe(1000);
    expect(new Set(people.map(p => p.personId)).size).toBe(1000);
    expect(evidence.organization.maxBinaryDepth).toBeGreaterThan(12);
    for (const p of people.slice(1)) {
      expect(p.parent).toBeLessThan(p.i); expect(p.sponsor).toBeLessThan(p.i);
      if ([1, 3].includes(p.sequence)) {
        let child = p.i; while (people[child].parent !== p.sponsor) child = people[child].parent;
        expect(people[child].side).toBe('LEFT');
      }
    }
  });
  it.each([0, 1, 2])('month %s: every member and award matches an independent oracle', async m => {
    const started = Date.now(), joined = people.filter(p => p.joinMonth <= m), close = monthAt(m + 1);
    const summary: any = { month: `2024-0${m + 1}`, effectiveMembers: joined.length, active: joined.filter(p => active(p.i, m)).length,
      baskets: baskets.map(value => ({ amount: value, members: joined.filter(p => amount(p.i, m) === value).length })), processed: 0 };
    evidence.progress = { month: m + 1, phase: 'ACTIVE', processed: 0 }; save();
    await runMembers(joined, async p => {
      if (p.i % 50 === 0) { evidence.progress = { month: m + 1, phase: 'ACTIVE', processed: p.i, total: joined.length }; save(); }
      const basket = amount(p.i, m);
      if (!basket) return;
      const parts = basket === 2000 ? [1999, 1] : [basket];
      for (const [part, value] of parts.entries()) {
        const input = { qualificationId: p.ballId, amount: value, recognizedAt: new Date(monthAt(m, 21).getTime() + part * 1000), sourceType: 'TEST_SCALE_ACTIVE', sourceId: randomUUID(),
          eligible: true, concreteVolumeType: 'GPV' as const, productProfileVersion: 'SYNTHETIC', ruleVersionCode: rule, parameterSnapshotHash: 'SYNTHETIC_2000', activeThreshold: 2000 };
        await withRetry(() => db.$transaction(async tx => {
          const result = await recognizeConsumption(tx, input);
          expect(Number(result.accumulator!.cumulativeAfter)).toBe(parts.slice(0, part + 1).reduce((a, b) => a + b, 0));
          expect(result.accumulator!.thresholdCrossed).toBe(value >= 2000 || part === 1);
          if (p.i % 100 === 0) expect((await recognizeConsumption(tx, input)).created).toBe(false);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 30000 }));
      }
    });
    const activeRows = await db.activePeriod.findMany({ where: { ruleVersionCode: rule, activeFrom: { gte: monthAt(m), lt: close } } });
    expect(new Set(activeRows.map(r => r.qualificationId))).toEqual(new Set(joined.filter(p => active(p.i, m)).map(p => p.ballId)));
    expect(activeRows.every(r => r.activeTo?.getTime() === close.getTime())).toBe(true);
    let epvTotal = 0, epvPayableCents = 0, epvAwards = 0, rpvPayable = 0, rpvAwards = 0, rpvEvents = 0, cancelCount = 0;
    const depths = new Set<number>(), observedZero = new Set<string>();
    await runMembers(joined, async p => {
      const basket = amount(p.i, m), epvExpected = Math.max(0, basket - 2000) * 0.6;
      if (basket) {
        const order = await db.order.create({ data: { qualificationId: p.ballId, purpose: 'REPURCHASE', status: 'PAID', paidAt: monthAt(m, 23), grossAmount: basket, netAmount: basket, ruleVersionCode: rule,
          lines: { create: { productId: product.productId, skuSnapshot: product.sku, productNameSnapshot: product.displayName, quantity: 1, unitPrice: basket, lineAmount: basket, gpvRateSnapshot: 0, gpvAmountSnapshot: 0, ruleProfileSnapshot: { synthetic: true } } } } });
        expect(await recognizeEpv(order.orderId)).toMatchObject({ epv: String(epvExpected) }); orders.push(order.orderId);
        const event = await db.pvLedger.findFirstOrThrow({ where: { sourceId: order.orderId, pvType: 'EPV' } });
        const awards = await db.bonusAward.findMany({ where: { sourceEventId: event.eventId }, orderBy: { generationNo: 'asc' } });
        const recipients = [p.i, ...ancestors(p.i, 'sponsor', 5)];
        expect(awards.map(a => a.recipientQualificationId)).toEqual(recipients.map(i => people[i].ballId));
        const expected = recipients.map((i, g) => active(i, m) ? epvExpected * (g ? 0.06 : 0.5) : 0);
        expect(awards.map(a => Number(a.payableAmount))).toEqual(expected);
        epvTotal += epvExpected; epvAwards += awards.length;
        // Integer cents keep the independent oracle exact across thousands of awards.
        epvPayableCents += expected.reduce((a, b) => a + Math.round(b * 100), 0);
        if (p.i % 100 === 0) expect(await recognizeEpv(order.orderId)).toMatchObject({ skipped: 'ALREADY_RECOGNIZED' });
      }
      const id = p.schedules[m - p.joinMonth];
      if (cancelled(p.i, m)) {
        await db.monthlyRecognitionSchedule.update({ where: { recognitionId: id }, data: { status: 'CANCELLED' } });
        expect(await recognizeRpv(id)).toMatchObject({ skipped: 'ALREADY_RECOGNIZED' });
        expect(await db.pvLedger.count({ where: { sourceLineId: id } })).toBe(0); cancelCount++;
      } else {
        await recognizeRpv(id); recognized.push(id); rpvEvents++;
        const awards = await db.rpvUplineAwardEvent.findMany({ where: { recognitionId: id }, orderBy: { binaryGeneration: 'asc' } });
        const recipients = ancestors(p.i, 'parent', 12);
        expect(awards.map(a => a.recipientQualificationId)).toEqual(recipients.map(i => people[i].ballId));
        for (const [g, recipient] of recipients.entries()) {
          const directs = directCount(recipient, m), depth = directs === 0 ? 5 : directs === 1 ? 8 : 12;
          const expected = active(recipient, m) && g + 1 <= depth ? 100 : 0; depths.add(depth);
          expect(awards[g]).toMatchObject({ binaryGeneration: g + 1, activeSnapshot: active(recipient, m), effectiveDirectCountSnapshot: directs, unlockedDepthSnapshot: depth });
          expect(Number(awards[g].theoryAmount)).toBe(100); expect(Number(awards[g].payableAmount)).toBe(expected);
          if (!expected) observedZero.add(!active(recipient, m) ? 'INACTIVE' : 'LOCKED');
          rpvPayable += expected;
        }
        rpvAwards += awards.length;
        if (p.i % 100 === 0) expect(await recognizeRpv(id)).toMatchObject({ skipped: 'ALREADY_RECOGNIZED' });
      }
      summary.processed++;
      if (summary.processed % 50 === 0) { evidence.progress = { month: m + 1, phase: 'EPV_RPV', processed: summary.processed, total: joined.length }; save(); }
    });
    const epvRows = await db.pvLedger.aggregate({ where: { ruleVersionCode: rule, pvType: 'EPV', occurredAt: { gte: monthAt(m), lt: close } }, _sum: { amount: true } });
    expect(Number(epvRows._sum.amount)).toBe(epvTotal);
    expect((await db.rpvUplineAwardEvent.aggregate({ where: { ruleVersionCode: rule, occurredAt: { gte: monthAt(m), lt: close } }, _sum: { payableAmount: true } }))._sum.payableAmount!.toString()).toBe(String(rpvPayable));
    const epvPayable = epvPayableCents / 100;
    expect(Number((await db.bonusAward.aggregate({ where: { ruleVersionCode: rule, awardType: 'EPV', occurredAt: { gte: monthAt(m), lt: close } }, _sum: { payableAmount: true } }))._sum.payableAmount)).toBe(epvPayable);
    expect([...depths].sort()).toEqual([12, 5, 8]); expect([...observedZero].sort()).toEqual(['INACTIVE', 'LOCKED']);
    Object.assign(summary, { epvTotal, epvPayable, epvAwards, rpvEvents, rpvTotal: rpvEvents * 1200, rpvPayable, rpvAwards, cancelled: cancelCount, elapsedMs: Date.now() - started, status: 'PASS' });
    evidence.months.push(summary); save();
  }, 3600000);
  it('quarter replay preserves every historical award, message and volume; future installments stay unprocessed', async () => {
    expect(evidence.months).toHaveLength(3);
    const before = { pv: await db.pvLedger.count({ where: { ruleVersionCode: rule } }), epv: await db.bonusAward.count({ where: { ruleVersionCode: rule } }),
      rpv: await db.rpvUplineAwardEvent.count({ where: { ruleVersionCode: rule } }), notifications: await db.memberNotification.count({ where: { messageKey: { in: recognized.map(id => 'repurchase:recognized:' + id) } } }) };
    for (const id of orders.filter((_, i) => i % 10 === 0)) expect(await recognizeEpv(id)).toMatchObject({ skipped: 'ALREADY_RECOGNIZED' });
    for (const id of recognized.filter((_, i) => i % 10 === 0)) expect(await recognizeRpv(id)).toMatchObject({ skipped: 'ALREADY_RECOGNIZED' });
    expect(await db.pvLedger.count({ where: { ruleVersionCode: rule } })).toBe(before.pv);
    expect(await db.bonusAward.count({ where: { ruleVersionCode: rule } })).toBe(before.epv);
    expect(await db.rpvUplineAwardEvent.count({ where: { ruleVersionCode: rule } })).toBe(before.rpv);
    expect(before.notifications).toBe(recognized.length);
    expect(await db.memberNotification.count({ where: { messageKey: { in: recognized.map(id => 'repurchase:recognized:' + id) } } })).toBe(before.notifications);
    expect(await db.monthlyRecognitionSchedule.count({ where: { ruleVersionCode: rule, dueAt: { gte: monthAt(3) }, status: 'SCHEDULED' } })).toBe(850);
    expect(await db.notificationDelivery.count()).toBe(0);
    evidence.status = 'PASS'; evidence.quarter = { ...before, sampleReplayEpv: orders.filter((_, i) => i % 10 === 0).length,
      sampleReplayRpv: recognized.filter((_, i) => i % 10 === 0).length, futureScheduled: 850 }; save();
  }, 120000);
});
