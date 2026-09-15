import { QualificationAccessService } from '../src/modules/auth/qualification-access.service';
import { AdminRoleGuard } from '../src/modules/auth/admin-role.guard';
import { UnifiedPayableService } from '../src/modules/payout/unified-payable.service';
import { Prisma } from '@ucell/database';

function materializationHarness(kind: 'BONUS_AWARD' | 'RPV_UPLINE_AWARD') {
  const entries = new Map<string, any>();
  const award = kind === 'BONUS_AWARD'
    ? { bonusAwardId: 'award-A', recipientQualificationId: 'ball-A', awardType: 'REFERRAL', payableAmount: new Prisma.Decimal(100) }
    : { rpvAwardEventId: 'rpv-A', recipientQualificationId: 'ball-B', payableAmount: new Prisma.Decimal(80), ruleVersionCode: 'TEST_ONLY' };
  const tx = {
    bonusAward: { findMany: jest.fn(async () => kind === 'BONUS_AWARD' ? [award] : []) },
    globalPoolAward: { findMany: jest.fn(async () => []) },
    rpvUplineAwardEvent: { findMany: jest.fn(async () => kind === 'RPV_UPLINE_AWARD' ? [award] : []) },
    payableEntry: {
      findUnique: jest.fn(async ({ where }: any) => entries.get(JSON.stringify(where.sourceType_sourceId)) ?? null),
      create: jest.fn(async ({ data }: any) => { entries.set(JSON.stringify({ sourceType: data.sourceType, sourceId: data.sourceId }), data); return data; }),
    },
  };
  const service = new UnifiedPayableService({ $transaction: async (work: any) => work(tx) } as any, {} as any);
  return { service, tx, entries };
}

describe('R1.0B v0.6.3',()=>{
  it.todo('Taiwan local time maps to configured settlement week');
  it('effective BonusAward materializes once', async () => {
    const { service, tx, entries } = materializationHarness('BONUS_AWARD');
    const cutoff = new Date('2020-04-01T00:00:00Z');
    expect(await service.materialize(cutoff, 'TEST_ONLY')).toEqual({ created: 1 });
    expect(await service.materialize(cutoff, 'TEST_ONLY')).toEqual({ created: 0 });
    expect(tx.bonusAward.findMany).toHaveBeenCalledWith({ where: { ruleVersionCode: 'TEST_ONLY', pendingUntil: { lte: cutoff }, lifecycleEvents: { some: { status: 'EFFECTIVE' } } } });
    expect(tx.payableEntry.create).toHaveBeenCalledTimes(1);
    expect([...entries.values()]).toEqual([expect.objectContaining({ qualificationId: 'ball-A', sourceType: 'BONUS_AWARD', sourceId: 'award-A', awardType: 'REFERRAL', grossAmount: new Prisma.Decimal(100), status: 'OPEN' })]);
  });
  it('RPV award materializes once', async () => {
    const { service, tx, entries } = materializationHarness('RPV_UPLINE_AWARD');
    const cutoff = new Date('2020-04-01T00:00:00Z');
    expect(await service.materialize(cutoff, 'TEST_ONLY')).toEqual({ created: 1 });
    expect(await service.materialize(cutoff, 'TEST_ONLY')).toEqual({ created: 0 });
    expect(tx.payableEntry.create).toHaveBeenCalledTimes(1);
    expect([...entries.values()]).toEqual([expect.objectContaining({ qualificationId: 'ball-B', sourceType: 'RPV_UPLINE_AWARD', sourceId: 'rpv-A', awardType: 'RPV', grossAmount: new Prisma.Decimal(80), ruleVersionCode: 'TEST_ONLY' })]);
  });
  it.todo('payout groups by Qualification rather than Person');
  it.todo('Recovery offsets Gross without changing source Award');
  it.todo('Net payout never becomes negative');
  it('temporal holder check denies former holder after transfer', async () => {
    const boundary = new Date('2020-02-01T00:00:00Z');
    const findFirst = jest.fn(async ({ where }: any) => {
      if (where.qualificationId !== 'ball-A') return null;
      const time = where.effectiveFrom.lte;
      if (where.holderPersonId === 'former' && time < boundary && where.OR[1].effectiveTo.gt < boundary) return { holderHistoryId: 'old' };
      if (where.holderPersonId === 'new' && time >= boundary) return { holderHistoryId: 'new' };
      return null;
    });
    const qualification = { findUnique: jest.fn(async () => ({ currentHolderPersonId: 'new' })) };
    const service = new QualificationAccessService({ qualificationHolderHistory: { findFirst }, qualification } as any);
    await expect(service.assertHolder('former', 'ball-A', new Date('2020-01-31T23:59:59Z'))).resolves.toBeUndefined();
    await expect(service.assertHolder('former', 'ball-A', boundary)).rejects.toMatchObject({ status: 403 });
    await expect(service.assertHolder('new', 'ball-A', boundary)).resolves.toBeUndefined();
    await expect(service.assertHolder('new', 'ball-A', new Date('2020-01-31T23:59:59Z'))).rejects.toMatchObject({ status: 403 });
    await expect(service.assertHolder('new', 'ball-B', boundary)).rejects.toMatchObject({ status: 403 });
    expect(findFirst).toHaveBeenCalledWith({ where: { qualificationId: 'ball-A', holderPersonId: 'former', effectiveFrom: { lte: boundary }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: boundary } }] } });
    expect(qualification.findUnique).not.toHaveBeenCalled();
  });
  it('RBAC denies unauthorized admin operation', () => {
    const handler = () => undefined, controller = class TestController {};
    const getAllAndOverride = jest.fn(() => ['FINANCE']);
    const guard = new AdminRoleGuard({ getAllAndOverride } as any);
    const context = (user: any, url = '/api/v1/admin/payout') => ({ switchToHttp: () => ({ getRequest: () => ({ url, user }) }), getHandler: () => handler, getClass: () => controller }) as any;
    expect(() => guard.canActivate(context(undefined))).toThrow('ADMIN_SESSION_REQUIRED');
    expect(() => guard.canActivate(context({ role: 'MEMBER' }))).toThrow('ROLE_DENIED');
    expect(() => guard.canActivate(context({}))).toThrow('ROLE_DENIED');
    expect(guard.canActivate(context({ role: 'FINANCE' }))).toBe(true);
    expect(getAllAndOverride).toHaveBeenCalledWith('roles', [handler, controller]);
    getAllAndOverride.mockReturnValue([]);
    expect(() => guard.canActivate(context({ role: 'FINANCE' }))).toThrow('ROLE_POLICY_MISSING');
    expect(guard.canActivate(context(undefined, '/api/v1/health'))).toBe(true);
    // Guard-level evidence only; no Entra authentication or Production HTTP PASS is claimed.
  });
});
