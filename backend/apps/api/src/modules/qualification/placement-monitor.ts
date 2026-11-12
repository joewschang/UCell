import { UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@ucell/database';
import { placementReadyIds } from '../../common/utils/placement-ready';
import { attachPlacementOrders } from '../../common/utils/placement-order-number';
import { placementPageKeys, placementCursor, type SortMode } from './placement-time-page';

type Input = { status?: string; aging?: string; after?: string; take?: number };
const periods: Record<string, [number, number]> = {
  '0_24H': [0, 24],
  '24_48H': [24, 48],
  '48_72H': [48, 72],
};
const statuses = ['PLACEMENT_PENDING', 'PLACEMENT_OVERDUE', 'PLACED'];
export async function placementMonitor(db: any, input: Input = {}, now = new Date()) {
  return db.$transaction((tx: Prisma.TransactionClient) => readMonitor(tx, input, now), {
    isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
    timeout: 15000,
  });
}
async function readMonitor(db: any, input: Input, now: Date) {
  if (
    (input.status && !statuses.includes(input.status)) ||
    (input.aging && input.aging !== 'OVERDUE' && !Object.hasOwn(periods, input.aging))
  )
    throw new UnprocessableEntityException({ code: 'PLACEMENT_FILTER_INVALID' });
  const take = Math.min(
    Math.max(Number.isFinite(input.take) ? Math.trunc(input.take!) : 50, 1),
    100,
  );
  const mode: SortMode =
    input.status === 'PLACED' ? 'placed' : input.status ? 'waiting' : 'activity';
  const scope = (input.status || 'ALL') + '_' + (input.aging || 'ALL');
  const eligible = await placementReadyIds(db);
  const ready = Prisma.sql`s.qualification_id=ANY(${eligible}::uuid[])`;
  const pending = Prisma.sql`${ready} AND s.setup_status='PLACEMENT_PENDING' AND (s.placement_due_at IS NULL OR s.placement_due_at>${now})`;
  const overdue = Prisma.sql`${ready} AND (s.setup_status='PLACEMENT_OVERDUE' OR (s.setup_status='PLACEMENT_PENDING' AND s.placement_due_at<=${now}))`;
  const placed = Prisma.sql`s.setup_status='PLACED'`;
  const filter =
    input.status === 'PLACED'
      ? placed
      : input.status === 'PLACEMENT_PENDING'
        ? pending
        : input.status === 'PLACEMENT_OVERDUE'
          ? overdue
          : Prisma.sql`((${placed}) OR (${pending}) OR (${overdue}))`;
  const withinHours = (hours: number) => new Date(now.getTime() - hours * 3600000);
  const band = input.aging ? periods[input.aging] : undefined;
  const age =
    input.aging === 'OVERDUE'
      ? Prisma.sql`AND (${overdue})`
      : band
        ? Prisma.sql`AND s.setup_status<>'PLACED' AND s.placement_requested_at>${withinHours(band[1])} AND s.placement_requested_at<=${withinHours(band[0])}`
        : Prisma.empty;
  const where = Prisma.sql`(${filter}) ${age}`;
  const [keys, [totals]] = await Promise.all([
    placementPageKeys(db, where, mode, scope, take, input.after),
    db.$queryRaw(Prisma.sql`SELECT count(*) FILTER (WHERE ${where})::int AS total,count(*) FILTER (WHERE ${pending})::int AS waiting,
      count(*) FILTER (WHERE ${overdue})::int AS late,count(*) FILTER (WHERE ${placed})::int AS done
      FROM membership.qualification_setup s WHERE s.setup_status IN ('PLACEMENT_PENDING','PLACEMENT_OVERDUE','PLACED')`),
  ]);
  const { total, waiting, late, done } = totals;
  const records = await db.qualificationSetup.findMany({
    where: { qualificationId: { in: keys.map((key) => key.qualificationId) } },
  });
  const byKey = new Map(records.map((record: any) => [record.qualificationId, record]));
  const rows = keys.map((key) => byKey.get(key.qualificationId)).filter(Boolean) as any[];
  const ids = [
    ...new Set(
      rows.flatMap((r: any) => [r.qualificationId, r.finalSponsorQualificationId]).filter(Boolean),
    ),
  ];
  const balls = await db.qualification.findMany({
    where: { qualificationId: { in: ids } },
    select: {
      qualificationId: true,
      ballNo: true,
      kind: true,
      canonicalPosition: { select: { positionNo: true } },
      binaryTreeMembership: {
        select: {
          binaryPositionNo: true,
          binaryTree: { select: { topologyVersion: true, status: true } },
        },
      },
      binaryPlacement: {
        select: { side: true, effectiveTo: true, parent: { select: { ballNo: true } } },
      },
      binaryChildren: {
        where: { effectiveTo: null },
        select: { binaryPlacementId: true },
        take: 1,
      },
      ballAllocation: { select: { binaryTreeId: true } },
      currentCompanyPrincipalId: true,
      currentHolderLegalEntity: { select: { memberNo: true, registeredName: true } },
      currentHolder: { select: { memberNo: true, legalName: true, preferredName: true } },
    },
  });
  await attachPlacementOrders(db, balls);
  const byId = new Map<string, any>(balls.map((b: any) => [b.qualificationId, b]));
  return {
    items: rows.slice(0, take).map((r: any) => {
      const b = byId.get(r.qualificationId);
      return {
        qualificationId: r.qualificationId,
        correction:
          r.setupStatus === 'PLACED' && b?.binaryPlacement && b.binaryTreeMembership
            ? {
                position: String(b.binaryTreeMembership.binaryPositionNo),
                version: b.binaryTreeMembership.binaryTree.topologyVersion,
                parent: b.binaryPlacement.parent.ballNo,
                side: b.binaryPlacement.side,
                blocked: b.binaryChildren.length
                  ? '下方已有球'
                  : b.canonicalPosition || b.kind !== 'MEMBER_ORIGIN'
                    ? '系統固定位置'
                    : b.binaryTreeMembership.binaryTree.status !== 'ACTIVE'
                      ? '組織樹未開放'
                      : null,
              }
            : null,
        orderNo: b?.orderNo,
        displayOrderNo: b?.displayOrderNo,
        ballNo: b?.ballNo,
        memberNo: b?.currentHolderLegalEntity?.memberNo ?? b?.currentHolder?.memberNo,
        memberName: b?.currentCompanyPrincipalId
          ? '公司球'
          : b?.currentHolderLegalEntity?.registeredName ||
            b?.currentHolder?.legalName ||
            b?.currentHolder?.preferredName ||
            null,
        treeId: b?.ballAllocation?.binaryTreeId,
        sponsorBallNo: byId.get(r.finalSponsorQualificationId)?.ballNo,
        packageType: r.packageType,
        status:
          r.setupStatus === 'PLACEMENT_PENDING' && r.placementDueAt && r.placementDueAt <= now
            ? 'PLACEMENT_OVERDUE'
            : r.setupStatus,
        requestedAt: r.placementRequestedAt?.toISOString() ?? null,
        dueAt: r.placementDueAt?.toISOString() ?? null,
        placedAt: r.placedAt?.toISOString() ?? null,
      };
    }),
    total,
    nextCursor: keys.length > take ? placementCursor(scope, keys[take - 1]) : null,
    counts: { pending: waiting, overdue: late, placed: done },
    observedAt: now.toISOString(),
  };
}
