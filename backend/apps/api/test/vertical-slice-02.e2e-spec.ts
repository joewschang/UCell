import { MembershipApplicationService } from '../src/modules/application/membership-application.service';
import { ActiveService } from '../src/modules/active/active.service';

// Execute the real application callback; database atomicity is covered separately
// by the isolated DB transaction regressions, not claimed by these service tests.
function applicationHarness(application: any = {}) {
  const tx = {
    person: { findUnique: jest.fn(async () => ({ personId: 'person-A' })) },
    membershipApplication: {
      findUnique: jest.fn(async () => application),
      create: jest.fn(async ({ data }: any) => ({ applicationId: 'application-A', ...data })),
      update: jest.fn(async ({ data }: any) => ({ ...application, ...data })),
    },
  };
  const idempotency = { execute: jest.fn(async (_scope: string, _key: string, _payload: any, work: any) => ({ value: await work(tx), replayed: false })) };
  const audit = { write: jest.fn(async () => undefined) };
  const service = new MembershipApplicationService({} as any, idempotency as any, audit as any, {} as any);
  return { tx, idempotency, audit, service };
}

describe('Vertical Slice 02 - Membership / Active / Subscription / RPV', () => {
  it('creates DRAFT membership application', async () => {
    const { tx, idempotency, audit, service } = applicationHarness();
    const dto = { personId: 'person-A', requestedPlanLevelCode: 'STARTER' as const, sponsorQualificationId: 'sponsor-A', binaryParentQualificationId: 'parent-B', binarySide: 'LEFT' as const };
    const result = (await service.create(dto, 'create-key', 'request-A', 'admin-A')).value;
    expect(result).toMatchObject({ applicationId: 'application-A', status: 'DRAFT', ...dto });
    expect(tx.person.findUnique).toHaveBeenCalledWith({ where: { personId: 'person-A' } });
    expect(idempotency.execute).toHaveBeenCalledWith('admin:membership-application:create:admin-A', 'create-key', dto, expect.any(Function));
    expect(audit.write).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'MEMBERSHIP_APPLICATION_CREATED', entityId: 'application-A', requestId: 'request-A' }));
    expect(tx.membershipApplication.update).not.toHaveBeenCalled();
  });
  it('SUBMIT requires sponsor and binary placement data', async () => {
    for (const missing of ['sponsorQualificationId', 'binaryParentQualificationId', 'binarySide']) {
      const app = { applicationId: 'application-A', status: 'DRAFT', sponsorQualificationId: 'sponsor-A', binaryParentQualificationId: 'parent-B', binarySide: 'LEFT', [missing]: null };
      const { tx, audit, service } = applicationHarness(app);
      await expect(service.submit('application-A', 'submit-key', 'request-A')).rejects.toMatchObject({ response: { code: 'DOMAIN_RULE_VIOLATION' } });
      expect(tx.membershipApplication.update).not.toHaveBeenCalled();
      expect(audit.write).not.toHaveBeenCalled();
    }
    const { tx, audit, service } = applicationHarness({ applicationId: 'application-A', status: 'DRAFT', sponsorQualificationId: 'sponsor-A', binaryParentQualificationId: 'parent-B', binarySide: 'LEFT' });
    expect((await service.submit('application-A', 'submit-key', 'request-A')).value).toMatchObject({ status: 'SUBMITTED', submittedAt: expect.any(Date) });
    expect(tx.membershipApplication.update).toHaveBeenCalledTimes(1);
    expect(audit.write).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'MEMBERSHIP_APPLICATION_SUBMITTED' }));
  });
  it('APPROVE creates Qualification + Holder + Sponsor + Binary atomically', async () => {
    const app = { applicationId: 'application-A', personId: 'person-A', requestedPlanLevelCode: 'STARTER', status: 'SUBMITTED', sponsorQualificationId: 'sponsor-A', binaryParentQualificationId: 'parent-B', binarySide: 'LEFT' };
    const tx: any = { membershipApplication: { findUnique: jest.fn(async () => app), update: jest.fn(async ({ data }: any) => ({ ...app, ...data })) } };
    for (const model of ['qualification', 'qualificationPlanHistory', 'qualificationHolderHistory', 'qualificationStatusHistory', 'sponsorRelationship', 'binaryPlacement']) {
      tx[model] = { create: jest.fn(async ({ data }: any) => ({ qualificationId: 'ball-new', ...data })) };
    }
    const organization = {
      allocateSponsorSequence: jest.fn(async () => 2), assertBinarySlotAvailable: jest.fn(),
      assertFirstThirdLeftRule: jest.fn(), assertNoBinaryCycle: jest.fn(),
    };
    const execute = jest.fn(async (_scope: string, _key: string, _payload: any, work: any) => ({ value: await work(tx), replayed: false }));
    const audit = { write: jest.fn() };
    const service = new MembershipApplicationService({} as any, { execute } as any, audit as any, organization as any);
    const result = (await service.approve('application-A', 'approval-key', 'request-A')).value;
    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith('admin:membership-application:approve:application-A', 'approval-key', { applicationId: 'application-A' }, expect.any(Function));
    expect(result.application).toMatchObject({ status: 'EFFECTIVE', createdQualificationId: 'ball-new' });
    expect(tx.qualification.create).toHaveBeenCalledWith({ data: expect.objectContaining({ currentHolderPersonId: 'person-A', activeFlag: false, status: 'EFFECTIVE' }) });
    for (const model of ['qualificationPlanHistory', 'qualificationHolderHistory', 'qualificationStatusHistory']) {
      expect(tx[model].create).toHaveBeenCalledWith({ data: expect.objectContaining({ qualificationId: 'ball-new', effectiveFrom: result.qualification.effectiveAt }) });
    }
    expect(tx.qualificationHolderHistory.create).toHaveBeenCalledWith({ data: expect.objectContaining({ holderPersonId: 'person-A' }) });
    expect(tx.sponsorRelationship.create).toHaveBeenCalledWith({ data: expect.objectContaining({ sponsorQualificationId: 'sponsor-A', childQualificationId: 'ball-new', sponsorSequenceNo: 2 }) });
    expect(tx.binaryPlacement.create).toHaveBeenCalledWith({ data: expect.objectContaining({ parentQualificationId: 'parent-B', childQualificationId: 'ball-new', side: 'LEFT' }) });
    expect(audit.write).toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'MEMBERSHIP_APPLICATION_APPROVED_EFFECTIVE' }));
    // All delegates are transaction-local. Real rollback is asserted by phase3-membership-db-test.mjs.
  });
  it('1st and 3rd direct-left rule is enforced during approval', async () => {
    for (const sequence of [1, 3]) {
      const app = { status: 'SUBMITTED', sponsorQualificationId: 'sponsor-A', binaryParentQualificationId: 'sponsor-A', binarySide: 'RIGHT' };
      const tx = { membershipApplication: { findUnique: jest.fn(async () => app), update: jest.fn() }, qualification: { create: jest.fn() } };
      const organization = { allocateSponsorSequence: jest.fn(async () => sequence), assertBinarySlotAvailable: jest.fn(), assertFirstThirdLeftRule: jest.fn(async () => { throw new Error('LEFT_SUBTREE_REJECTED'); }) };
      const audit = { write: jest.fn() };
      const service = new MembershipApplicationService({} as any, { execute: async (_scope: string, _key: string, _payload: any, work: any) => work(tx) } as any, audit as any, organization as any);
      await expect(service.approve('application-A', 'approval-key', 'request-A')).rejects.toThrow('LEFT_SUBTREE_REJECTED');
      expect(organization.assertFirstThirdLeftRule).toHaveBeenCalledWith(tx, 'sponsor-A', sequence, 'sponsor-A', 'RIGHT');
      expect(tx.qualification.create).not.toHaveBeenCalled();
      expect(tx.membershipApplication.update).not.toHaveBeenCalled();
      expect(audit.write).not.toHaveBeenCalled();
    }
  });
  it('Active periods cannot overlap', async () => {
    const tx = {
      qualification: { findUnique: jest.fn(async () => ({ qualificationId: 'ball-A' })), update: jest.fn() },
      activePeriod: { findFirst: jest.fn(async () => ({ activePeriodId: 'existing' })), create: jest.fn() },
    };
    const audit = { write: jest.fn() };
    const service = new ActiveService({ $transaction: async (work: any) => work(tx) } as any, audit as any);
    await expect(service.openPeriod('ball-A', { activeFrom: '2020-01-15T00:00:00Z', activeTo: '2020-02-15T00:00:00Z', sourceType: 'TEST_ONLY' }, 'request-A')).rejects.toMatchObject({ response: { code: 'ACTIVE_PERIOD_OVERLAP' } });
    expect(tx.activePeriod.findFirst).toHaveBeenCalledWith({ where: { qualificationId: 'ball-A', activeFrom: { lt: new Date('2020-02-15T00:00:00Z') }, OR: [{ activeTo: null }, { activeTo: { gt: new Date('2020-01-15T00:00:00Z') } }] } });
    expect(tx.activePeriod.create).not.toHaveBeenCalled();
    expect(tx.qualification.update).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
  });
  it('historical Active query uses event time, not current flag', async () => {
    const from = new Date('2020-01-01T00:00:00Z'), to = new Date('2020-02-01T00:00:00Z');
    const qualification = { findUnique: jest.fn(async () => ({ activeFlag: false })) };
    const findFirst = jest.fn(async ({ where }: any) => {
      const at = where.activeFrom.lte;
      return where.qualificationId === 'ball-A' && from <= at && to > where.OR[1].activeTo.gt ? { activePeriodId: 'historical' } : null;
    });
    const service = new ActiveService({ qualification, activePeriod: { findFirst } } as any, {} as any);
    expect(await service.isActiveAt('ball-A', from)).toBe(true);
    expect(await service.isActiveAt('ball-A', new Date('2020-01-31T23:59:59Z'))).toBe(true);
    expect(await service.isActiveAt('ball-A', to)).toBe(false);
    expect(await service.isActiveAt('ball-A', new Date('2019-12-31T23:59:59Z'))).toBe(false);
    expect(qualification.findUnique).not.toHaveBeenCalled();
  });
  it.todo('QUARTER creates exactly 3 recognition rows');
  it.todo('HALF_YEAR creates exactly 6 recognition rows');
  it.todo('YEAR creates exactly 12 recognition rows');
  it.todo('each due recognition creates exactly 1,200 RPV once');
  it.todo('0 direct unlocks 5 binary generations');
  it.todo('1 direct unlocks 8 binary generations');
  it.todo('2+ directs unlocks 12 binary generations');
  it.todo('inactive upline receives 0 and is not compressed');
  it.todo('higher generation remains independently evaluated');
  it.todo('re-running a recognition cannot duplicate RPV or awards');
});
