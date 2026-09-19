import { projectAdminQualification360, toAdminQualification360 } from '../src/modules/qualification/admin-qualification-360';
import { QualificationService } from '../src/modules/qualification/qualification.service';

const at = new Date('2026-09-19T00:00:00.000Z');
const later = new Date('2026-10-01T00:00:00.000Z');

function source(overrides: Record<string, unknown> = {}) {
  return {
    qualificationId: 'qualification-internal-id',
    kind: 'MEMBER_ORIGIN' as const,
    planLevelCode: 'STARTER',
    binaryTreeMembership: {
      binaryTreeId: 'binary-tree-internal-id',
      binaryPositionNo: 4n,
      binaryTree: { treeCode: 'TREE-A' },
    },
    canonicalPosition: {
      binaryTreeId: 'binary-tree-internal-id',
      positionNo: 4,
      side: 'LEFT' as const,
    },
    ownerIntervals: [{
      ownerType: 'MEMBER' as const,
      person: { memberNo: '0000000001' },
      companyPrincipal: null,
    }],
    companyProfileBindings: [],
    globalRankHistory: [],
    ...overrides,
  };
}

const starterPlan = [{
  qualificationId: 'qualification-internal-id',
  planCode: 'STARTER',
  effectiveFrom: at,
  effectiveTo: null,
}];

describe('Admin Qualification 360 projection', () => {
  it('projects a bounded server-calculated organization context without leaking source IDs', () => {
    const view = toAdminQualification360(source(), starterPlan);

    expect(view.organization).toEqual({
      status: 'AVAILABLE',
      reasonCode: null,
      treeCode: 'TREE-A',
      binaryPositionNo: '4',
      binaryPath: 'RLL',
      canonicalPositionNo: 4,
      canonicalSide: 'LEFT',
    });
    expect(view.owner).toMatchObject({ status: 'AVAILABLE', ownerType: 'MEMBER', memberNo: '0000000001' });
    expect(view.plan).toMatchObject({ status: 'AVAILABLE', planCode: 'STARTER', source: 'QUALIFICATION_PLAN_HISTORY' });
    const serialized = JSON.stringify(view);
    expect(serialized).not.toContain('qualification-internal-id');
    expect(serialized).not.toContain('binary-tree-internal-id');
  });

  it('uses an effective bootstrap binding for the Company LEADER plan, but never invents a Global rank', () => {
    const company = source({
      kind: 'COMPANY_BOOTSTRAP',
      planLevelCode: null,
      binaryTreeMembership: {
        binaryTreeId: 'binary-tree-internal-id',
        binaryPositionNo: 1n,
        binaryTree: { treeCode: 'TREE-A' },
      },
      canonicalPosition: {
        binaryTreeId: 'binary-tree-internal-id',
        positionNo: 1,
        side: null,
      },
      ownerIntervals: [{
        ownerType: 'COMPANY',
        person: null,
        companyPrincipal: { code: 'UCELL_COMPANY' },
      }],
      companyProfileBindings: [{
        binaryTreeId: 'binary-tree-internal-id',
        companyPosition: 1,
        profileVersion: 'COMPANY_BOOTSTRAP_PROFILE_V1',
        planCode: 'LEADER',
        effectiveFrom: at,
        effectiveTo: null,
      }],
    });
    const view = toAdminQualification360(company, []);

    expect(view.plan).toMatchObject({
      status: 'AVAILABLE',
      planCode: 'LEADER',
      source: 'COMPANY_BOOTSTRAP_PROFILE_BINDING',
    });
    expect(view.globalRank).toEqual({
      status: 'AVAILABLE',
      reasonCode: null,
      scope: 'GLOBAL_CUMULATIVE',
      highestRank: null,
      achievements: [],
    });
  });

  it('fails closed for missing or ambiguous bootstrap profiles', () => {
    const bootstrap = source({
      kind: 'COMPANY_BOOTSTRAP',
      planLevelCode: null,
      binaryTreeMembership: {
        binaryTreeId: 'binary-tree-internal-id',
        binaryPositionNo: 2n,
        binaryTree: { treeCode: 'TREE-A' },
      },
      canonicalPosition: {
        binaryTreeId: 'binary-tree-internal-id',
        positionNo: 2,
        side: 'LEFT',
      },
      companyProfileBindings: [],
    });
    expect(toAdminQualification360(bootstrap, []).plan).toMatchObject({
      status: 'UNAVAILABLE', reasonCode: 'COMPANY_BOOTSTRAP_PROFILE_UNAVAILABLE', planCode: null,
    });

    const binding = {
      binaryTreeId: 'binary-tree-internal-id', companyPosition: 2,
      profileVersion: 'COMPANY_BOOTSTRAP_PROFILE_V1', planCode: 'LEADER', effectiveFrom: at, effectiveTo: null,
    };
    expect(toAdminQualification360(source({ ...bootstrap, companyProfileBindings: [binding, binding] }), []).plan).toMatchObject({
      status: 'UNAVAILABLE', reasonCode: 'COMPANY_BOOTSTRAP_PROFILE_UNAVAILABLE', planCode: null,
    });
  });

  it('preserves a member-origin plan even while the current owner is Company', () => {
    const memberOriginCompanyHeld = source({
      ownerIntervals: [{
        ownerType: 'COMPANY', person: null, companyPrincipal: { code: 'UCELL_COMPANY' },
      }],
      companyProfileBindings: [{
        binaryTreeId: 'binary-tree-internal-id', companyPosition: 4,
        profileVersion: 'COMPANY_BOOTSTRAP_PROFILE_V1', planCode: 'LEADER', effectiveFrom: at, effectiveTo: null,
      }],
    });
    const view = toAdminQualification360(memberOriginCompanyHeld, starterPlan);

    expect(view.owner).toMatchObject({ status: 'AVAILABLE', ownerType: 'COMPANY', companyCode: 'UCELL_COMPANY' });
    expect(view.plan).toMatchObject({ status: 'AVAILABLE', planCode: 'STARTER', source: 'QUALIFICATION_PLAN_HISTORY' });
  });

  it('fails closed for no or more than one effective owner interval', () => {
    expect(toAdminQualification360(source({ ownerIntervals: [] }), starterPlan).owner).toMatchObject({
      status: 'UNAVAILABLE', reasonCode: 'OWNER_EVIDENCE_UNAVAILABLE', ownerType: null,
    });
    expect(toAdminQualification360(source({ ownerIntervals: [
      { ownerType: 'MEMBER', person: { memberNo: '0000000001' }, companyPrincipal: null },
      { ownerType: 'COMPANY', person: null, companyPrincipal: { code: 'UCELL_COMPANY' } },
    ] }), starterPlan).owner).toMatchObject({
      status: 'UNAVAILABLE', reasonCode: 'OWNER_EVIDENCE_UNAVAILABLE', ownerType: null,
    });
  });

  it('reports cumulative Global rank only from rank-history records', () => {
    const view = toAdminQualification360(source({
      globalRankHistory: [
        { rankCode: 'NEW_STAR', achievedAt: at, sourcePeriodEnd: at },
        { rankCode: 'GLORY', achievedAt: later, sourcePeriodEnd: later },
      ],
    }), starterPlan);

    expect(view.globalRank).toEqual({
      status: 'AVAILABLE',
      reasonCode: null,
      scope: 'GLOBAL_CUMULATIVE',
      highestRank: 'GLORY',
      achievements: [
        { rankCode: 'NEW_STAR', achievedAt: at.toISOString(), sourcePeriodEnd: at.toISOString() },
        { rankCode: 'GLORY', achievedAt: later.toISOString(), sourcePeriodEnd: later.toISOString() },
      ],
    });
  });

  it('fails closed for every Ball with ambiguous effective plan evidence in one page', async () => {
    const first = source({ qualificationId: 'first-ball' });
    const second = source({ qualificationId: 'second-ball' });
    const ambiguous = ['first-ball', 'second-ball'].flatMap(qualificationId => [
      { qualificationId, planCode: 'STARTER', effectiveFrom: at, effectiveTo: null },
      { qualificationId, planCode: 'STARTER', effectiveFrom: at, effectiveTo: null },
      { qualificationId, planCode: 'STARTER', effectiveFrom: at, effectiveTo: null },
    ]);
    const findMany = jest.fn(async (args: { take?: number }) => args.take ? ambiguous.slice(0, args.take) : ambiguous);

    const views = await projectAdminQualification360({ qualificationPlanHistory: { findMany } } as any, [first, second], at);

    expect(views.get('first-ball')?.plan).toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'QUALIFICATION_PLAN_EVIDENCE_UNAVAILABLE' });
    expect(views.get('second-ball')?.plan).toMatchObject({ status: 'UNAVAILABLE', reasonCode: 'QUALIFICATION_PLAN_EVIDENCE_UNAVAILABLE' });
    expect(findMany).toHaveBeenCalledWith(expect.not.objectContaining({ take: expect.anything() }));
  });

  it('adds the projection to Ball detail while removing its internal relation inputs', async () => {
    const row = source();
    const tx = {
      qualification: { findUniqueOrThrow: jest.fn(async () => row) },
      qualificationPlanHistory: { findMany: jest.fn(async () => starterPlan) },
    };
    const prisma = { $transaction: jest.fn(async (work: any) => work(tx)) };
    const service = new QualificationService(prisma as any, {} as any, {} as any, {} as any);

    const result = await service.get('qualification-internal-id');

    expect(result).toMatchObject({
      qualificationId: 'qualification-internal-id',
      admin360: {
        organization: { treeCode: 'TREE-A', binaryPositionNo: '4' },
        plan: { planCode: 'STARTER' },
      },
    });
    expect(result).not.toHaveProperty('binaryTreeMembership');
    expect(result).not.toHaveProperty('ownerIntervals');
    expect(result).not.toHaveProperty('companyProfileBindings');
    expect(result).not.toHaveProperty('globalRankHistory');
    expect(tx.qualification.findUniqueOrThrow).toHaveBeenCalledWith(expect.objectContaining({
      where: { qualificationId: 'qualification-internal-id' },
      include: expect.objectContaining({ canonicalPosition: expect.any(Object) }),
    }));
  });
});
