import { binaryPath, COMPANY_PROFILE, Prisma } from '@ucell/database';

/**
 * Bounded, administrative presentation data for one Qualification.  This is a
 * read projection: it does not replace the Core facts returned by the existing
 * endpoints, and it deliberately omits relationship UUIDs, evidence hashes and
 * parameter snapshots.
 */
export const ADMIN_QUALIFICATION_360_SCHEMA_VERSION = 'ADMIN_QUALIFICATION_360_V1';

const GLOBAL_RANK_ORDER = ['NEW_STAR', 'EXCELLENCE', 'GLORY', 'DIAMOND', 'CROWN'] as const;

type OwnerInterval = {
  ownerType: 'MEMBER' | 'COMPANY';
  person: { memberNo: string | null } | null;
  companyPrincipal: { code: string } | null;
};

type CompanyProfileBinding = {
  binaryTreeId: string;
  companyPosition: number;
  profileVersion: string;
  planCode: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

type PlanHistory = {
  qualificationId: string;
  planCode: string;
  effectiveFrom: Date;
  effectiveTo: Date | null;
};

export type AdminQualification360Source = {
  qualificationId: string;
  kind: 'MEMBER_ORIGIN' | 'COMPANY_BOOTSTRAP';
  planLevelCode: string | null;
  binaryTreeMembership: {
    binaryTreeId: string;
    binaryPositionNo: bigint;
    binaryTree: { treeCode: string };
  } | null;
  canonicalPosition: {
    binaryTreeId: string;
    positionNo: number;
    side: 'LEFT' | 'RIGHT' | null;
  } | null;
  ownerIntervals: OwnerInterval[];
  companyProfileBindings: CompanyProfileBinding[];
  globalRankHistory: Array<{
    rankCode: string;
    achievedAt: Date;
    sourcePeriodEnd: Date;
  }>;
};

const unavailableOrganization = (reasonCode: string) => ({
  status: 'UNAVAILABLE' as const,
  reasonCode,
  treeCode: null,
  binaryPositionNo: null,
  binaryPath: null,
  canonicalPositionNo: null,
  canonicalSide: null,
});

const unavailableOwner = () => ({
  status: 'UNAVAILABLE' as const,
  reasonCode: 'OWNER_EVIDENCE_UNAVAILABLE',
  ownerType: null,
  memberNo: null,
  companyCode: null,
});

const unavailablePlan = (reasonCode: string) => ({
  status: 'UNAVAILABLE' as const,
  reasonCode,
  planCode: null,
  source: null,
  profileVersion: null,
  effectiveFrom: null,
  effectiveTo: null,
});

function toIso(value: Date | null): string | null {
  return value?.toISOString() ?? null;
}

function organization(source: AdminQualification360Source) {
  const membership = source.binaryTreeMembership;
  if (!membership || !membership.binaryTree?.treeCode) {
    return unavailableOrganization('BINARY_TREE_MEMBERSHIP_UNAVAILABLE');
  }
  if (membership.binaryPositionNo < 1n) {
    return unavailableOrganization('BINARY_POSITION_INVALID');
  }

  const canonical = source.canonicalPosition;
  if (canonical) {
    const expectedSide = membership.binaryPositionNo === 1n
      ? null
      : membership.binaryPositionNo % 2n === 0n ? 'LEFT' : 'RIGHT';
    if (
      canonical.binaryTreeId !== membership.binaryTreeId
      || BigInt(canonical.positionNo) !== membership.binaryPositionNo
      || canonical.side !== expectedSide
    ) {
      return unavailableOrganization('CANONICAL_POSITION_EVIDENCE_CONFLICT');
    }
  }

  try {
    return {
      status: 'AVAILABLE' as const,
      reasonCode: null,
      treeCode: membership.binaryTree.treeCode,
      binaryPositionNo: membership.binaryPositionNo.toString(),
      binaryPath: binaryPath(membership.binaryPositionNo),
      canonicalPositionNo: canonical?.positionNo ?? null,
      canonicalSide: canonical?.side ?? null,
    };
  } catch {
    return unavailableOrganization('BINARY_POSITION_INVALID');
  }
}

function owner(source: AdminQualification360Source) {
  if (source.ownerIntervals.length !== 1) return unavailableOwner();
  const interval = source.ownerIntervals[0];
  if (interval.ownerType === 'MEMBER' && interval.person?.memberNo && !interval.companyPrincipal) {
    return {
      status: 'AVAILABLE' as const,
      reasonCode: null,
      ownerType: 'MEMBER' as const,
      memberNo: interval.person.memberNo,
      companyCode: null,
    };
  }
  if (interval.ownerType === 'COMPANY' && interval.companyPrincipal?.code && !interval.person) {
    return {
      status: 'AVAILABLE' as const,
      reasonCode: null,
      ownerType: 'COMPANY' as const,
      memberNo: null,
      companyCode: interval.companyPrincipal.code,
    };
  }
  return unavailableOwner();
}

function plan(source: AdminQualification360Source, planHistory: PlanHistory[]) {
  if (source.kind === 'COMPANY_BOOTSTRAP') {
    const membership = source.binaryTreeMembership;
    const binding = source.companyProfileBindings.length === 1 ? source.companyProfileBindings[0] : null;
    const companyPosition = membership && membership.binaryPositionNo >= 1n && membership.binaryPositionNo <= 3n
      ? Number(membership.binaryPositionNo)
      : null;
    if (
      !membership
      || !binding
      || companyPosition === null
      || binding.profileVersion !== COMPANY_PROFILE
      || binding.binaryTreeId !== membership.binaryTreeId
      || binding.companyPosition !== companyPosition
      || binding.companyPosition < 1
      || binding.companyPosition > 3
      || !binding.planCode
    ) {
      return unavailablePlan('COMPANY_BOOTSTRAP_PROFILE_UNAVAILABLE');
    }
    return {
      status: 'AVAILABLE' as const,
      reasonCode: null,
      planCode: binding.planCode,
      source: 'COMPANY_BOOTSTRAP_PROFILE_BINDING' as const,
      profileVersion: binding.profileVersion,
      effectiveFrom: toIso(binding.effectiveFrom),
      effectiveTo: toIso(binding.effectiveTo),
    };
  }

  if (source.kind !== 'MEMBER_ORIGIN' || planHistory.length !== 1) {
    return unavailablePlan('QUALIFICATION_PLAN_EVIDENCE_UNAVAILABLE');
  }
  const current = planHistory[0];
  if (!current.planCode || source.planLevelCode !== current.planCode) {
    return unavailablePlan('QUALIFICATION_PLAN_EVIDENCE_CONFLICT');
  }
  return {
    status: 'AVAILABLE' as const,
    reasonCode: null,
    planCode: current.planCode,
    source: 'QUALIFICATION_PLAN_HISTORY' as const,
    profileVersion: null,
    effectiveFrom: toIso(current.effectiveFrom),
    effectiveTo: toIso(current.effectiveTo),
  };
}

function globalRank(source: AdminQualification360Source) {
  const rows = source.globalRankHistory;
  const known = rows.every(row => GLOBAL_RANK_ORDER.includes(row.rankCode as typeof GLOBAL_RANK_ORDER[number]));
  const unique = new Set(rows.map(row => row.rankCode)).size === rows.length;
  if (!known || !unique) {
    return {
      status: 'UNAVAILABLE' as const,
      reasonCode: 'GLOBAL_RANK_EVIDENCE_CONFLICT',
      scope: 'GLOBAL_CUMULATIVE' as const,
      highestRank: null,
      achievements: [],
    };
  }
  const highestRank = rows.reduce<string | null>((highest, row) => {
    if (!highest || GLOBAL_RANK_ORDER.indexOf(row.rankCode as typeof GLOBAL_RANK_ORDER[number]) > GLOBAL_RANK_ORDER.indexOf(highest as typeof GLOBAL_RANK_ORDER[number])) {
      return row.rankCode;
    }
    return highest;
  }, null);
  return {
    status: 'AVAILABLE' as const,
    reasonCode: null,
    scope: 'GLOBAL_CUMULATIVE' as const,
    highestRank,
    achievements: rows.map(row => ({
      rankCode: row.rankCode,
      achievedAt: row.achievedAt.toISOString(),
      sourcePeriodEnd: row.sourcePeriodEnd.toISOString(),
    })),
  };
}

export function toAdminQualification360(source: AdminQualification360Source, planHistory: PlanHistory[]) {
  return {
    schemaVersion: ADMIN_QUALIFICATION_360_SCHEMA_VERSION,
    organization: organization(source),
    owner: owner(source),
    plan: plan(source, planHistory),
    globalRank: globalRank(source),
  };
}

/**
 * The relation selection is intentionally narrow.  The mapper below removes
 * these relation records and projects only operational identifiers suitable for
 * the Admin UI.
 */
export function adminQualification360Include(at: Date) {
  return {
    binaryTreeMembership: {
      select: {
        binaryTreeId: true,
        binaryPositionNo: true,
        binaryTree: { select: { treeCode: true } },
      },
    },
    canonicalPosition: {
      select: {
        binaryTreeId: true,
        positionNo: true,
        side: true,
      },
    },
    ownerIntervals: {
      where: {
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { recordedAt: 'desc' }],
      take: 2,
      select: {
        ownerType: true,
        person: { select: { memberNo: true } },
        companyPrincipal: { select: { code: true } },
      },
    },
    companyProfileBindings: {
      where: {
        effectiveAt: { lte: at },
        effectiveFrom: { lte: at },
        OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
      },
      orderBy: [{ effectiveFrom: 'desc' }, { recordedAt: 'desc' }],
      take: 2,
      select: {
        binaryTreeId: true,
        companyPosition: true,
        profileVersion: true,
        planCode: true,
        effectiveFrom: true,
        effectiveTo: true,
      },
    },
    globalRankHistory: {
      orderBy: [{ achievedAt: 'asc' }, { rankCode: 'asc' }],
      take: GLOBAL_RANK_ORDER.length,
      select: {
        rankCode: true,
        achievedAt: true,
        sourcePeriodEnd: true,
      },
    },
  } satisfies Prisma.QualificationInclude;
}

export async function projectAdminQualification360(
  tx: Pick<Prisma.TransactionClient, 'qualificationPlanHistory'>,
  rows: AdminQualification360Source[],
  at: Date,
) {
  const ids = rows.map(row => row.qualificationId);
  if (!ids.length) return new Map<string, ReturnType<typeof toAdminQualification360>>();

  // Read every effective row for the requested page, then let the mapper prove
  // uniqueness per Qualification. A global take would slice one Qualification's
  // conflicts into another Qualification's evidence and could make the latter
  // appear uniquely bound when it is not.
  const histories = await tx.qualificationPlanHistory.findMany({
    where: {
      qualificationId: { in: ids },
      effectiveFrom: { lte: at },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }],
    },
    select: {
      qualificationId: true,
      planCode: true,
      effectiveFrom: true,
      effectiveTo: true,
    },
    orderBy: [{ qualificationId: 'asc' }, { effectiveFrom: 'desc' }, { createdAt: 'desc' }],
  });
  const plansByQualification = new Map<string, PlanHistory[]>();
  for (const history of histories) {
    const records = plansByQualification.get(history.qualificationId) ?? [];
    records.push(history);
    plansByQualification.set(history.qualificationId, records);
  }

  return new Map(rows.map(row => [
    row.qualificationId,
    toAdminQualification360(row, plansByQualification.get(row.qualificationId) ?? []),
  ]));
}

/** OpenAPI fragment shared by the two existing Admin read operations. */
export const adminQualification360Schema: any = {
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'organization', 'owner', 'plan', 'globalRank'],
  properties: {
    schemaVersion: { type: 'string', enum: [ADMIN_QUALIFICATION_360_SCHEMA_VERSION] },
    organization: {
      type: 'object', additionalProperties: false,
      required: ['status', 'reasonCode', 'treeCode', 'binaryPositionNo', 'binaryPath', 'canonicalPositionNo', 'canonicalSide'],
      properties: {
        status: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE'] },
        reasonCode: { type: 'string', nullable: true },
        treeCode: { type: 'string', nullable: true },
        binaryPositionNo: { type: 'string', nullable: true, description: 'Binary position serialized as a decimal string.' },
        binaryPath: { type: 'string', nullable: true, description: 'Server-calculated binary path.' },
        canonicalPositionNo: { type: 'integer', nullable: true },
        canonicalSide: { type: 'string', enum: ['LEFT', 'RIGHT'], nullable: true },
      },
    },
    owner: {
      type: 'object', additionalProperties: false,
      required: ['status', 'reasonCode', 'ownerType', 'memberNo', 'companyCode'],
      properties: {
        status: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE'] },
        reasonCode: { type: 'string', nullable: true },
        ownerType: { type: 'string', enum: ['MEMBER', 'COMPANY'], nullable: true },
        memberNo: { type: 'string', nullable: true },
        companyCode: { type: 'string', nullable: true },
      },
    },
    plan: {
      type: 'object', additionalProperties: false,
      required: ['status', 'reasonCode', 'planCode', 'source', 'profileVersion', 'effectiveFrom', 'effectiveTo'],
      properties: {
        status: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE'] },
        reasonCode: { type: 'string', nullable: true },
        planCode: { type: 'string', nullable: true },
        source: { type: 'string', enum: ['COMPANY_BOOTSTRAP_PROFILE_BINDING', 'QUALIFICATION_PLAN_HISTORY'], nullable: true },
        profileVersion: { type: 'string', nullable: true },
        effectiveFrom: { type: 'string', format: 'date-time', nullable: true },
        effectiveTo: { type: 'string', format: 'date-time', nullable: true },
      },
    },
    globalRank: {
      type: 'object', additionalProperties: false,
      required: ['status', 'reasonCode', 'scope', 'highestRank', 'achievements'],
      properties: {
        status: { type: 'string', enum: ['AVAILABLE', 'UNAVAILABLE'] },
        reasonCode: { type: 'string', nullable: true },
        scope: { type: 'string', enum: ['GLOBAL_CUMULATIVE'] },
        highestRank: { type: 'string', enum: [...GLOBAL_RANK_ORDER], nullable: true },
        achievements: {
          type: 'array', maxItems: GLOBAL_RANK_ORDER.length,
          items: {
            type: 'object', additionalProperties: false,
            required: ['rankCode', 'achievedAt', 'sourcePeriodEnd'],
            properties: {
              rankCode: { type: 'string', enum: [...GLOBAL_RANK_ORDER] },
              achievedAt: { type: 'string', format: 'date-time' },
              sourcePeriodEnd: { type: 'string', format: 'date-time' },
            },
          },
        },
      },
    },
  },
};
