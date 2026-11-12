import {ConflictException} from '@nestjs/common';
import {Prisma} from '@ucell/database';

export async function assertSingleApplicationCheckout(tx:Prisma.TransactionClient,personId:string) {
  const [found]=await tx.$queryRaw<{bundle_id:string}[]>`
    SELECT b.bundle_id FROM membership.enrollment_bundle b
    JOIN identity.formal_member_application a ON a.formal_member_application_id=b.application_id
    WHERE b.superseded_at IS NULL AND b.person_id=${personId}::uuid AND a.status IN ('DRAFT','NEEDS_MORE_INFO','SUBMITTED','UNDER_REVIEW') LIMIT 1`;
  if(found) throw new ConflictException({code:'ENROLLMENT_BUNDLE_EXISTS',message:'本次申請已有多球訂單，請返回申請頁查看。'});
}

export async function assertRepurchaseBallEffective(tx:Prisma.TransactionClient,orderId:string,occurredAt=new Date()) {
  const [target]=await tx.$queryRaw<{status:string;effectiveAt:Date|null}[]>`
    SELECT q.status::text AS status,q.effective_at AS "effectiveAt" FROM membership.enrollment_bundle_ball b
    JOIN membership.qualification q ON q.qualification_id=b.qualification_id
    WHERE b.repurchase_order_id=${orderId}::uuid`;
  if(target && (target.status!=='EFFECTIVE'||!target.effectiveAt||target.effectiveAt>occurredAt)) throw new ConflictException({
    code:'BUNDLE_REPURCHASE_AWAITS_PLACEMENT',message:'請先完成這顆球的資格審核與安置，再確認其重銷付款。'
  });
}
