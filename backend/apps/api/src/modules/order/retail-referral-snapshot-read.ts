import { Prisma } from '@prisma/client';

/** Shared historical source for Retail Explain and order lineage. */
export function readRetailReferralSnapshot(db: Pick<Prisma.TransactionClient, 'retailReferralOrderLineSnapshot'>, orderLineId: string) {
  return db.retailReferralOrderLineSnapshot.findUnique({
    where: { orderLineId },
    include: {
      attribution: true,
      orderLine: { select: { skuSnapshot: true, orderId: true, order: { select: { orderNo: true } } } },
    },
  });
}
