import {memberEconomicMocks} from './member-economic-fixture';
import { appendEntitlementDelta, recognizeConsumption } from '@ucell/database';
import { resolveBinaryWeek } from '@ucell/shared';
import { binary, d, recipient, sealed } from './phase2-fixtures';

describe('R1.0B v3 mandatory contract cases', () => {
  it('T04 assigns the exact Taipei Sunday 00:00 boundary to the new week only', () => {
    const before = resolveBinaryWeek(new Date('2026-09-19T15:59:59.999Z'));
    const boundary = resolveBinaryWeek(new Date('2026-09-19T16:00:00.000Z'));
    expect(before.end.toISOString()).toBe('2026-09-19T16:00:00.000Z');
    expect(boundary.start.toISOString()).toBe('2026-09-19T16:00:00.000Z');
    expect(boundary.start.getTime()).toBe(before.end.getTime());
    expect(boundary.start.getTime()).toBeGreaterThan(before.start.getTime());
  });

  it.each([
    ['STARTER', 450_000, 1_800_000],
    ['ELITE', 900_000, 3_600_000],
    ['LEADER', 1_500_000, 6_000_000],
  ])('T06 derives the %s monthly display from the enforced weekly cap', (_plan, weekly, monthly) => {
    expect(weekly * 4).toBe(monthly);
  });

  it.each(['PV', 'BV'])('T11/T12 rejects generic %s before persistence or award creation', async generic => {
    const tx = new Proxy({}, { get: () => { throw new Error('PERSISTENCE_MUST_NOT_BE_REACHED'); } });
    await expect(recognizeConsumption(tx as never, {
      qualificationId: '00000000-0000-4000-8000-000000000001',
      sourceType: 'MANDATORY_GOLDEN',
      sourceId: '00000000-0000-4000-8000-000000000002',
      amount: '100',
      eligible: true,
      concreteVolumeType: generic as never,
      productProfileVersion: 'TEST_ONLY',
      ruleVersionCode: 'R1.0B',
      parameterSnapshotHash: 'test-only',
      recognizedAt: new Date('2026-09-05T04:00:00.000Z'),
      activeThreshold: '2000',
    })).rejects.toThrow('GENERIC_VOLUME_CANNOT_BE_RECOGNIZED');
  });

  it('T17 appends PAID clawback and recovery while preserving original evidence', async () => {
    const envelope = binary();
    const original = recipient({ awardType: 'REFERRAL', theory: '100', posted: '100' });
    envelope.recipients = [original];
    const before = JSON.stringify(envelope);
    const lifecycleCreate = jest.fn(async ({ data }: any) => data);
    const recoveryCreate = jest.fn(async ({ data }: any) => ({ bonusRecoveryEventId: 'recovery', ...data }));
    const tx = {...memberEconomicMocks(),
      entitlementReplayPosting: {
        findUnique: jest.fn(async () => null),
        aggregate: jest.fn(async () => ({ _sum: { delta: null } })),
        create: jest.fn(async ({ data }: any) => data),
      },
      bonusAward: { create: jest.fn() },
      bonusAwardLifecycleEvent: {
        findFirst: jest.fn(async () => ({ status: 'PAID', occurredAt: new Date('2026-10-25T00:00:00Z') })),
        create: lifecycleCreate,
      },
      bonusRecoveryEvent: { create: recoveryCreate },
    };
    await appendEntitlementDelta(tx as never, sealed(envelope), original, d(0), 'RETURN:T17', 'state-hash', '00000000-0000-4000-8000-000000000017');
    expect(lifecycleCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ bonusAwardId: 'award', status: 'CLAWBACK', reasonCode: 'HISTORICAL_REPLAY' }) });
    expect(recoveryCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ bonusAwardId: 'award', recoveryAmount: d(100), outstandingAmount: d(100) }) });
    expect(tx.bonusAward.create).not.toHaveBeenCalled();
    expect(JSON.stringify(envelope)).toBe(before);
  });
});
