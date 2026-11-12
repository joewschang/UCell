import {ConflictException} from '@nestjs/common';
import {Prisma, PrismaService} from '@ucell/database';

type Reader = PrismaService | Prisma.TransactionClient;
type Totals = {
  paymentPolicy:'COMBINED'|'QUALIFICATION_ONLY';
  payableTotal:string;
  bundleId: string;
  rootOrderId: string;
  rootPaid: boolean;
  paymentReported: boolean;
  qualificationCount: number;
  paidQualifications: number;
  qualificationTotal: string;
  outstandingQualificationTotal: string;
};

export async function enrollmentBundlePayment(db: Reader, applicationId: string, personId: string) {
  const [row] = await db.$queryRaw<Totals[]>`
    SELECT bundle.bundle_id AS "bundleId", root.qualification_order_id AS "rootOrderId",
           bundle.payment_policy AS "paymentPolicy",
           (sum(orders.net_amount)+CASE WHEN bundle.payment_policy='COMBINED' THEN coalesce(sum(rep.net_amount),0) ELSE 0 END)::text AS "payableTotal",
           CASE WHEN bundle.payment_policy='COMBINED' THEN EXISTS(SELECT 1 FROM commerce.enrollment_bundle_payment r WHERE r.bundle_id=bundle.bundle_id)
             ELSE bool_or(ball.position = 1 AND orders.status IN ('PAID','FULFILLED')) END AS "rootPaid",
           EXISTS(SELECT 1 FROM commerce.enrollment_bundle_payment_report report WHERE report.bundle_id=bundle.bundle_id) AS "paymentReported",
           count(*)::int AS "qualificationCount",
           count(*) FILTER (WHERE orders.status IN ('PAID','FULFILLED') OR allocation.order_id IS NOT NULL)::int AS "paidQualifications",
           sum(orders.net_amount)::text AS "qualificationTotal",
           coalesce(sum(orders.net_amount) FILTER (WHERE orders.status = 'CONFIRMED' AND allocation.order_id IS NULL), 0)::text AS "outstandingQualificationTotal"
    FROM membership.enrollment_bundle bundle
    JOIN membership.enrollment_bundle_ball root ON root.bundle_id = bundle.bundle_id AND root.position = 1
    JOIN membership.enrollment_bundle_ball ball ON ball.bundle_id = bundle.bundle_id
    JOIN commerce."order" orders ON orders.order_id = ball.qualification_order_id
    LEFT JOIN commerce.enrollment_bundle_allocation allocation ON allocation.order_id=orders.order_id
    LEFT JOIN commerce."order" rep ON rep.order_id = ball.repurchase_order_id
    WHERE bundle.application_id = ${applicationId}::uuid AND bundle.person_id = ${personId}::uuid AND bundle.superseded_at IS NULL
    GROUP BY bundle.bundle_id, root.qualification_order_id`;
  return row ? {...row, currency: 'TWD' as const} : null;
}

export function requirePaidBundleRoot(summary: Awaited<ReturnType<typeof enrollmentBundlePayment>>) {
  if (summary && !summary.rootPaid) {
    throw new ConflictException({code:'FORMAL_ENROLLMENT_BUNDLE_ROOT_UNPAID',message:'第 1 球的資格套組尚未確認收款。'});
  }
}
