import {memberEconomicMocks} from './member-economic-fixture';
import { QualificationAccessService } from '../src/modules/auth/qualification-access.service';
import { AdminRoleGuard } from '../src/modules/auth/admin-role.guard';
import { UnifiedPayableService } from '../src/modules/payout/unified-payable.service';
import { Prisma } from '@ucell/database';
import { RecoveryBalanceService } from '../src/modules/payout/recovery-balance.service';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

function recoveryHarness(outstanding: number) {
  const award = { bonusAwardId: 'source-award', recipientQualificationId: 'ball-A', payableAmount: new Prisma.Decimal(outstanding) };
  const recovery = { bonusRecoveryEventId: 'recovery-A', recoveredAmount: new Prisma.Decimal(0), outstandingAmount: new Prisma.Decimal(outstanding), bonusAward: award };
  const applications: any[] = [];
  const tx = {...memberEconomicMocks(),
    $executeRaw: jest.fn(async () => 1),
    payoutLine: { findUnique: jest.fn(async () => ({ recipientQualificationId: 'ball-A', grossAmount: new Prisma.Decimal(100) })) },
    recoveryApplication: {
      aggregate: jest.fn(async () => ({ _sum: { amount: applications.length ? applications.reduce((sum, row) => sum.add(row.amount), new Prisma.Decimal(0)) : null } })),
      create: jest.fn(async ({ data }: any) => { applications.push(data); return data; }),
    },
    bonusRecoveryEvent: { findMany: jest.fn(async () => [recovery]), update: jest.fn(async ({ data }: any) => Object.assign(recovery, data)) },
    bonusAward: { update: jest.fn() },
  };
  const service = new RecoveryBalanceService({} as any);
  const input = { qualificationId: 'ball-A', payoutLineId: 'line-A', maxAmount: new Prisma.Decimal(100) };
  return { service, tx, input, award, recovery, applications };
}

function materializationHarness(kind: 'BONUS_AWARD' | 'RPV_UPLINE_AWARD') {
  const entries = new Map<string, any>();
  const award = kind === 'BONUS_AWARD'
    ? { bonusAwardId: 'award-A', recipientQualificationId: 'ball-A', awardType: 'REFERRAL', payableAmount: new Prisma.Decimal(100) }
    : { rpvAwardEventId: 'rpv-A', recipientQualificationId: 'ball-B', payableAmount: new Prisma.Decimal(80), ruleVersionCode: 'TEST_ONLY' };
  const tx = {...memberEconomicMocks(),
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
  it('Taiwan local time maps to configured settlement week',()=>{
    const root=resolve(__dirname,'../../../..'),directory=mkdtempSync(join(tmpdir(),'ucell-v063-'));
    try{
      const file=join(directory,'evidence.json');
      execFileSync(process.execPath,[resolve(root,'backend/scripts/settlement-timezone-db-test.mjs')],{cwd:root,env:{...process.env,DATABASE_URL:process.env.PHASE2_TEST_DATABASE_URL??'postgresql://ucell:ucell_dev@localhost:5432/ucell_admin_test?schema=public',SETTLEMENT_TIMEZONE_EVIDENCE_PATH:file},timeout:30000});
      const run=JSON.parse(readFileSync(file,'utf8'));expect(run.result).toBe('PASS');
      expect(run.results.find((item:any)=>item.label==='Taipei configured settlement week bounds')?.actual).toEqual(['2019-12-31T16:00:00.000Z','2020-01-14T16:00:00.000Z','Asia/Taipei']);
      expect(run.results.find((item:any)=>item.label==='Taipei local-midnight boundary is deterministic')?.actual).toEqual(['2019-12-31T16:00:00.000Z','2019-12-31T16:00:00.000Z']);
    } finally {rmSync(directory,{recursive:true,force:true});}
  },30000);
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
  it('payout groups by Qualification rather than Person', async () => {
    const entries = [
      { payableEntryId: 'entry-A1', qualificationId: 'ball-A', personId: 'same-person', grossAmount: new Prisma.Decimal(11) },
      { payableEntryId: 'entry-B', qualificationId: 'ball-B', personId: 'same-person', grossAmount: new Prisma.Decimal(23) },
      { payableEntryId: 'entry-A2', qualificationId: 'ball-A', personId: 'same-person', grossAmount: new Prisma.Decimal(7) },
    ];
    const lines: any[] = [];
    const tx = {...memberEconomicMocks(),
      payableEntry: { findMany: jest.fn(async () => entries), update: jest.fn(async () => undefined) },
      payoutBatch: { create: jest.fn(async () => ({ payoutBatchId: 'batch-A' })), update: jest.fn(async ({ data }: any) => data) },
      payoutLine: {
        create: jest.fn(async ({ data }: any) => { const line = { payoutLineId: 'line-' + lines.length, ...data }; lines.push(line); return line; }),
        update: jest.fn(async () => undefined),
      },
    };
    const apply = jest.fn(async () => ({ applied: new Prisma.Decimal(0) }));
    const transaction = jest.fn(async (work: any) => work(tx));
    const service = new UnifiedPayableService({ $transaction: transaction } as any, { apply } as any);
    const start = new Date('2020-01-01'), end = new Date('2020-02-01');
    const batch = await service.createPayoutBatch(start, end, 'TEST_ONLY');
    expect(lines.map(line => [line.recipientQualificationId, line.grossAmount.toString(), line.detailJson.payableEntryIds])).toEqual([
      ['ball-A', '18', ['entry-A1', 'entry-A2']], ['ball-B', '23', ['entry-B']],
    ]);
    expect(apply).toHaveBeenCalledWith(tx, { qualificationId: 'ball-A', payoutLineId: 'line-0', maxAmount: new Prisma.Decimal(18) });
    expect(apply).toHaveBeenCalledWith(tx, { qualificationId: 'ball-B', payoutLineId: 'line-1', maxAmount: new Prisma.Decimal(23) });
    expect(tx.payableEntry.update).toHaveBeenCalledWith({ where: { payableEntryId: 'entry-A2' }, data: { status: 'ALLOCATED', payoutLineId: 'line-0' } });
    expect(tx.payableEntry.update).toHaveBeenCalledWith({ where: { payableEntryId: 'entry-B' }, data: { status: 'ALLOCATED', payoutLineId: 'line-1' } });
    expect(batch).toMatchObject({ status: 'READY', totalGross: new Prisma.Decimal(41), totalNet: new Prisma.Decimal(41) });
    expect(transaction).toHaveBeenCalledWith(expect.any(Function), { isolationLevel: 'Serializable' });
  });
  it('Recovery offsets Gross without changing source Award', async () => {
    const { service, tx, input, award, recovery, applications } = recoveryHarness(30);
    const original = JSON.stringify(award);
    const result = await service.apply(tx as any, input);
    expect(result.applied.toString()).toBe('30');
    expect(result.remaining.toString()).toBe('70');
    expect(applications).toEqual([{ payoutLineId: 'line-A', bonusRecoveryEventId: 'recovery-A', amount: new Prisma.Decimal(30) }]);
    expect(recovery.outstandingAmount.toString()).toBe('0');
    expect(JSON.stringify(award)).toBe(original);
    expect(tx.bonusAward.update).not.toHaveBeenCalled();
    expect(tx.bonusRecoveryEvent.findMany).toHaveBeenCalledWith({ where: { status: { in: ['OPEN', 'OFFSETTING'] }, outstandingAmount: { gt: 0 }, bonusAward: { recipientQualificationId: 'ball-A' } }, orderBy: [{ occurredAt: 'asc' }, { createdAt: 'asc' }] });
    expect((await service.apply(tx as any, input)).applied.toString()).toBe('30');
    expect(tx.recoveryApplication.create).toHaveBeenCalledTimes(1);
  });
  it('Net payout never becomes negative', async () => {
    const { service, tx, input, recovery } = recoveryHarness(120);
    const result = await service.apply(tx as any, input);
    expect(result.applied.toString()).toBe('100');
    expect(input.maxAmount.sub(result.applied).toString()).toBe('0');
    expect(result.remaining.toString()).toBe('0');
    expect(recovery.outstandingAmount.toString()).toBe('20');
    expect(recovery.recoveredAmount.toString()).toBe('100');
    expect((await service.apply(tx as any, input)).applied.toString()).toBe('100');
    expect(tx.bonusRecoveryEvent.update).toHaveBeenCalledTimes(1);
  });
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
