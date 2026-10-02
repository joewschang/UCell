import { Prisma } from '@prisma/client';

const include = {
  attribution: true,
  orderLine: { select: { skuSnapshot: true, orderId: true, order: { select: { orderNo: true } } } },
} satisfies Prisma.RetailReferralOrderLineSnapshotInclude;

/** Shared historical source for Retail Explain and order lineage. */
export function readRetailReferralSnapshot(db: Pick<Prisma.TransactionClient, 'retailReferralOrderLineSnapshot'>, orderLineId: string) {
  return db.retailReferralOrderLineSnapshot.findUnique({
    where: { orderLineId },
    include,
  });
}

export function readOrderRetailSnapshots(db: Pick<Prisma.TransactionClient, 'retailReferralOrderLineSnapshot'>, orderId: string) {
  return db.retailReferralOrderLineSnapshot.findMany({
    where: { OR: [{orderId}, {orderLine: {orderId}}] },
    include,
    orderBy: [{createdAt: 'asc'}, {retailReferralOrderLineSnapshotId: 'asc'}],
  });
}
