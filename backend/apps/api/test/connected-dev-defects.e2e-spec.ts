import { Prisma, PrismaService } from '@ucell/database';
import { UnifiedPayableService } from '../src/modules/payout/unified-payable.service';
import { AdminObservabilityService } from '../src/modules/admin-observability/admin-observability.service';
import { EpvService } from '../src/modules/epv/epv.service';
import { BonusQueryService } from '../src/modules/bonus/bonus-query.service';
import { RuntimeRuleService } from '../src/modules/rules/runtime-rule.service';
import { EpvMonthService } from '../src/modules/epv/epv-month.service';

// Isolated engineering regression tests. No connection to a monetary ledger.
describe('Connected DEV implementation regressions', () => {
  it('uses the actual RPV primary key and retains duplicate protection', async () => {
    const event = { rpvAwardEventId: 'rpv-event', recipientQualificationId: 'ball',
      payableAmount: new Prisma.Decimal(1), ruleVersionCode: 'R1.0B' };
    let entry: unknown;
    const tx = {
      bonusAward: { findMany: jest.fn().mockResolvedValue([]) },
      globalPoolAward: { findMany: jest.fn().mockResolvedValue([]) },
      rpvUplineAwardEvent: { findMany: jest.fn().mockResolvedValue([event]) },
      payableEntry: {
        findUnique: jest.fn().mockImplementation(async () => entry),
        create: jest.fn().mockImplementation(async ({ data }) => { entry = data; return data; }),
      },
    };
    const prisma = { $transaction: async (fn: (client: unknown) => unknown) => fn(tx) };
    const service = new UnifiedPayableService(prisma as unknown as PrismaService, {} as never);
    const cutoff = new Date('2026-09-15T00:00:00Z');
    expect(await service.materialize(cutoff)).toEqual({ created: 1 });
    expect(await service.materialize(cutoff)).toEqual({ created: 0 });
    expect(tx.payableEntry.create).toHaveBeenCalledTimes(1);
    expect(entry).toMatchObject({ sourceType: 'RPV_UPLINE_AWARD', sourceId: 'rpv-event' });
  });

  it('loads award payables through the polymorphic source key', async () => {
    const prisma = {
      bonusAward: { findUniqueOrThrow: jest.fn().mockResolvedValue({ bonusAwardId: 'award' }) },
      payableEntry: { findMany: jest.fn().mockResolvedValue([{ payableEntryId: 'payable' }]) },
    };
    const service = new AdminObservabilityService(prisma as unknown as PrismaService);
    expect(await service.awardDetail('award')).toMatchObject({ payableEntries: [{ payableEntryId: 'payable' }] });
    expect(prisma.payableEntry.findMany).toHaveBeenCalledWith({ where: { sourceType: 'BONUS_AWARD', sourceId: 'award' } });
    expect(prisma.bonusAward.findUniqueOrThrow.mock.calls[0][0].include).not.toHaveProperty('payableEntries');
  });

  it('reads EPV recipient plans at the payment timestamp', async () => {
    const at = new Date('2026-09-01T00:00:00Z');
    const tx = {
      order: { findUnique: jest.fn().mockResolvedValue({ orderId: 'order', status: 'PAID',
        purpose: 'REPURCHASE', ruleVersionCode:'R1.0B', qualificationId: 'self', paidAt: at, netAmount: new Prisma.Decimal(4800) }) },
      pvLedger: { findFirst: jest.fn().mockResolvedValue(null), create: jest.fn().mockResolvedValue({ eventId: 'event' }) },
      bonusAward: { create: jest.fn().mockResolvedValue({ bonusAwardId: 'award' }) },
      bonusAwardLifecycleEvent: { createMany: jest.fn().mockResolvedValue({ count: 2 }) },
      auditEvent:{create:jest.fn().mockResolvedValue({})},
      runtimeRuleParameter:{findMany:jest.fn().mockResolvedValue([
        ['epv.base_amount','*',2000],['epv.rate','*','.6'],['epv.self.rate','*','.5'],['epv.upline.rate','1','.06'],['award.pending.days','*',45]
      ].map(([parameterCode,scopeKey,valueJson],i)=>({runtimeRuleParameterId:String(i),parameterCode,scopeKey,valueJson,effectiveFrom:at,effectiveTo:null})))},
    };
    const prisma = { $transaction: async (fn: (client: unknown) => unknown) => fn(tx) };
    const rules = { decimal: jest.fn().mockResolvedValue(new Prisma.Decimal(1)), integer: jest.fn().mockResolvedValue(45) };
    const query = {
      isActiveAt: jest.fn().mockResolvedValue(true), qualificationPlanAt: jest.fn().mockResolvedValue('STARTER'),
      pendingUntil: jest.fn().mockReturnValue(at), effectiveDirectCountAt: jest.fn().mockResolvedValue(1),
      sponsorAncestors: jest.fn().mockResolvedValue([{ qualification_id: 'upline', generation: 1 }]),
    };
    const month={recognition:jest.fn().mockResolvedValue({start:at,end:new Date('2026-10-01'),timezone:'Asia/Taipei',base:new Prisma.Decimal(2000),rate:new Prisma.Decimal('.6'),cumulative:new Prisma.Decimal(4800),epv:new Prisma.Decimal(1680)})};
    await new EpvService(prisma as unknown as PrismaService, rules as unknown as RuntimeRuleService,
      query as unknown as BonusQueryService,month as unknown as EpvMonthService).recognizeOrder('order');
    expect(query.qualificationPlanAt.mock.calls).toEqual([[tx, 'self', at], [tx, 'upline', at]]);
  });
});
