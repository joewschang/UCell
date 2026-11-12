import {ConflictException} from '@nestjs/common';
import {Prisma} from '@ucell/database';

type Side = 'LEFT'|'RIGHT';
type BundlePart = {bundleId:string; position:number; qualificationId:string; qualificationOrderId:string};
type Readiness = BundlePart & {orderStatus:string; setupStatus:string|null; finalSponsor:string|null; ownerMatches:boolean};

export function bundleParentPosition(position:number) {
  if (!Number.isSafeInteger(position) || position<1) throw new RangeError('Invalid bundle position');
  return position===1 ? null : {position:Math.floor(position/2), side:position%2===0?'LEFT' as const:'RIGHT' as const};
}

const fail = (code:string,message:string):never => {throw new ConflictException({code,message});};

async function lockedPart(tx:Prisma.TransactionClient,qualificationId:string) {
  const [part]=await tx.$queryRaw<BundlePart[]>`
    SELECT b.bundle_id AS "bundleId", b.position, b.qualification_id AS "qualificationId",
           b.qualification_order_id AS "qualificationOrderId"
    FROM membership.enrollment_bundle_ball b
    JOIN membership.enrollment_bundle g ON g.bundle_id=b.bundle_id
    WHERE b.qualification_id=${qualificationId}::uuid FOR UPDATE OF g`;
  return part;
}

/** Only this checkout's newly created qualifications can act as a planned internal
 * sponsor. The parent's actual paid order and sponsor edge must already exist at
 * the payment timestamp so the existing referral snapshot sees the whole path. */
export async function internalSponsorAtPayment(tx:Prisma.TransactionClient,qualificationId:string,orderId:string,paidAt:Date,rootSponsorSelected=true) {
  const part=await lockedPart(tx,qualificationId);
  if(!part?.bundleId) return null;
  if(part.qualificationOrderId!==orderId) fail('BUNDLE_ORDER_MISMATCH','此訂單與預排球位不符。');
  const wanted=bundleParentPosition(part.position);
  if(!wanted) {
    if(!rootSponsorSelected) fail('BUNDLE_ROOT_SPONSOR_REQUIRED','請先核對第 1 球的外部推薦人，再確認整組收款。');
    return null;
  }
  const [parent]=await tx.$queryRaw<{id:string; ready:boolean}[]>`
    SELECT p.qualification_id AS id,
      (o.qualification_id=p.qualification_id AND o.status IN ('PAID','FULFILLED')
        AND o.paid_at<=${paidAt} AND q.status='DRAFT'
        AND child.current_holder_person_id IS NOT DISTINCT FROM q.current_holder_person_id
        AND child.current_holder_legal_entity_id IS NOT DISTINCT FROM q.current_holder_legal_entity_id
        AND EXISTS(SELECT 1 FROM organization.sponsor_relationship s
          WHERE s.child_qualification_id=p.qualification_id AND s.effective_from<=${paidAt} AND s.effective_to IS NULL)) AS ready
    FROM membership.enrollment_bundle_ball p
    JOIN commerce."order" o ON o.order_id=p.qualification_order_id
    JOIN membership.qualification q ON q.qualification_id=p.qualification_id
    JOIN membership.qualification child ON child.qualification_id=${qualificationId}::uuid
    WHERE p.bundle_id=${part.bundleId}::uuid AND p.position=${wanted.position}`;
  if(!parent?.ready) fail('BUNDLE_PARENT_PAYMENT_REQUIRED',
    `請先核對第 ${wanted.position} 球的推薦人及付款。第 ${part.position} 球的付款時間須在該球付款後或同時。`);
  return {sponsorQualificationId:parent.id,sponsorSequenceNo:wanted.side==='LEFT'?1:2};
}

export function readyDescendants(rows:Readiness[],rootId:string) {
  if(rows[0]?.qualificationId!==rootId || rows.length<2 || rows.some((row,i)=>row.position!==i+1 || !row.ownerMatches))
    fail('BUNDLE_PLAN_INCONSISTENT','預排球位或持有人資料不一致，請核對原申請。');
  const pending=rows.filter(row=>!['PAID','FULFILLED','PARTIAL_RETURN'].includes(row.orderStatus) ||
    !['PLACEMENT_PENDING','PLACEMENT_OVERDUE'].includes(row.setupStatus??''));
  if(pending.length) fail('BUNDLE_PLACEMENT_NOT_READY',
    `第 ${pending.map(row=>row.position).join('、')} 球仍待確認付款、推薦人或退貨審核。完成後可一起安置。`);
  return rows.slice(1).map(row=>{
    const parent=bundleParentPosition(row.position)!;
    const parentId=rows[parent.position-1].qualificationId;
    if(row.finalSponsor!==parentId) fail('BUNDLE_SPONSOR_MISMATCH','內部推薦球與原預排不符，請核對申請。');
    return {qualificationId:row.qualificationId,binaryParentQualificationId:parentId,side:parent.side as Side};
  });
}

/** Root and every descendant are placed by the same caller's transaction.
 * Ordinary placements have no bundle and follow their existing single-ball path. */
export async function bundleDescendantsForPlacement(tx:Prisma.TransactionClient,qualificationId:string) {
  const part=await lockedPart(tx,qualificationId);
  if(!part?.bundleId) return null;
  if(part.position!==1) fail('BUNDLE_ROOT_PLACEMENT_REQUIRED','此球已由多球申請預排。請選擇該組第 1 球，一起完成安置。');
  const rows=await tx.$queryRaw<Readiness[]>`
    SELECT b.bundle_id AS "bundleId", b.position,b.qualification_id AS "qualificationId",
      b.qualification_order_id AS "qualificationOrderId",o.status AS "orderStatus",
      s.setup_status AS "setupStatus",s.final_sponsor_qualification_id AS "finalSponsor",
      (q.status='DRAFT' AND o.qualification_id=q.qualification_id
        AND q.current_holder_person_id IS NOT DISTINCT FROM firstq.current_holder_person_id
        AND q.current_holder_legal_entity_id IS NOT DISTINCT FROM firstq.current_holder_legal_entity_id
        AND (s.qualifying_order_id IS NULL OR s.qualifying_order_id=b.qualification_order_id)) AS "ownerMatches"
    FROM membership.enrollment_bundle_ball b
    JOIN membership.qualification q ON q.qualification_id=b.qualification_id
    JOIN commerce."order" o ON o.order_id=b.qualification_order_id
    JOIN membership.qualification firstq ON firstq.qualification_id=${qualificationId}::uuid
    LEFT JOIN membership.qualification_setup s ON s.qualification_id=b.qualification_id
    WHERE b.bundle_id=${part.bundleId}::uuid ORDER BY b.position`;
  return readyDescendants(rows,qualificationId);
}
