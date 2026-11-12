import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@ucell/database';

export type SortMode = 'placed' | 'waiting' | 'activity';
type PageKey = { qualificationId: string; sortAt: string | null };
const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i;
const instant = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;

function field(mode: SortMode) {
  if (mode === 'placed') return Prisma.sql`s.placed_at`;
  if (mode === 'waiting') return Prisma.sql`s.placement_requested_at`;
  return Prisma.sql`CASE WHEN s.setup_status='PLACED' THEN COALESCE(s.placed_at,s.placement_requested_at) ELSE s.placement_requested_at END`;
}
export function placementCursor(scope: string, row: PageKey) {
  return ['pt1', scope, row.sortAt ?? '-', row.qualificationId].join('~');
}
function cursor(after: string | undefined, scope: string, mode: SortMode) {
  if (!after) return Prisma.sql`SELECT NULL::uuid AS id,NULL::timestamptz AS at`;
  if (uuid.test(after))
    return Prisma.sql`SELECT s.qualification_id AS id,${field(mode)} AS at FROM membership.qualification_setup s WHERE s.qualification_id=${after}::uuid`;
  const parts = after.split('~'),
    stamp = parts[2];
  if (
    parts.length !== 4 ||
    parts[0] !== 'pt1' ||
    parts[1] !== scope ||
    !uuid.test(parts[3]) ||
    (stamp !== '-' &&
      (!instant.test(stamp) ||
        !Number.isFinite(Date.parse(stamp)) ||
        new Date(stamp).toISOString() !== stamp.slice(0, 23) + 'Z'))
  ) {
    throw new UnprocessableEntityException({ code: 'PLACEMENT_FILTER_INVALID' });
  }
  return Prisma.sql`SELECT ${parts[3]}::uuid AS id,${stamp === '-' ? null : stamp}::timestamptz AS at`;
}

export async function placementPageKeys(
  db: any,
  where: Prisma.Sql,
  mode: SortMode,
  scope: string,
  take: number,
  after?: string,
): Promise<PageKey[]> {
  const direction = mode === 'waiting' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
  const beyond = mode === 'waiting' ? Prisma.sql`>` : Prisma.sql`<`;
  const anchor = cursor(after, scope, mode);
  return db.$queryRaw(Prisma.sql`
    WITH candidates AS (
      SELECT s.qualification_id AS id,${field(mode)} AS at FROM membership.qualification_setup s WHERE ${where}
    ), anchor AS (${anchor})
    SELECT c.id AS "qualificationId",to_char(c.at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS "sortAt"
      FROM candidates c CROSS JOIN anchor a
     WHERE a.id IS NULL OR (c.at ${beyond} a.at) OR (c.at IS NULL AND a.at IS NOT NULL)
           OR (c.at IS NOT DISTINCT FROM a.at AND c.id>a.id)
     ORDER BY c.at ${direction} NULLS LAST,c.id ASC LIMIT ${take + 1}`);
}

export async function treePlacementPage(tx: any, pendingWhere: any, after?: string) {
  // Keep the exact eligibility, tree membership, and allocation predicates on every page.
  const scoped = await tx.qualification.findMany({
    where: pendingWhere,
    select: { qualificationId: true },
  });
  const ids = scoped.map((row: { qualificationId: string }) => row.qualificationId);
  if (after && !ids.includes(after)) {
    // An anchor may already be placed. Its allocation continues to identify the same tree.
    const sameTree = uuid.test(after) && await tx.qualification.findFirst({
      where: { qualificationId: after, ballAllocation: pendingWhere.ballAllocation },
      select: { qualificationId: true },
    });
    if (!sameTree) throw new UnprocessableEntityException({code:'PLACEMENT_FILTER_INVALID'});
  }
  const keys = await placementPageKeys(
    tx,
    Prisma.sql`s.qualification_id=ANY(${ids}::uuid[])`,
    'waiting',
    'tree',
    50,
    after,
  );
  const qualified = await tx.qualification.findMany({
    where: { qualificationId: { in: keys.map((row) => row.qualificationId) } },
    select: {
      qualificationId: true,
      ballNo: true,
      planLevelCode: true,
      currentHolder: { select: { memberNo: true } },
      sponsorRelation: { select: { sponsor: { select: { ballNo: true } } } },
    },
  });
  const byId = new Map<string, any>(qualified.map((row: any) => [row.qualificationId, row]));
  return {
    pending: keys.map((key) => ({ ...byId.get(key.qualificationId), requestedAt: key.sortAt })),
    pendingTotal: scoped.length,
  };
}
