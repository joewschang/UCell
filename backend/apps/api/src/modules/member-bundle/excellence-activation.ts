import {ConflictException} from '@nestjs/common';
import {Prisma,preparePackageMonthlySchedule,approvedRepurchaseVolumeReference,approvedRepurchaseCalendarReference} from '@ucell/database';
import {OrderService} from '../order/order.service';

type Phase='NOT_APPLICABLE'|'AWAITING_PAYMENT'|'AWAITING_APPROVAL'|'AWAITING_PLACEMENT'|'ACTIVE';
type Row={id:string;kind:'ENTRY'|'REPURCHASE';status:string;ballStatus:string;placed:Date|null;amount:string};

/** Apply a reconciled prepayment only to the confirmed member, version, and organization.
 * The bank receipt keeps its real transfer date. Order payments record application of
 * that receipt when the intended recipient is known, so historical snapshots remain true. */
export async function activateEnrollmentBundleIfReady(tx:Prisma.TransactionClient,applicationId:string,requestId:string):Promise<{status:Phase}> {
  const [group]=await tx.$queryRaw<{id:string;review:string;member:string;receiptId:string|null;actor:string;method:string;reference:string;received:Date}[]>`
    SELECT b.bundle_id AS id,a.status::text AS review,p.membership_state::text AS member,r.receipt_id AS "receiptId",
      r.actor_id AS actor,r.payment_method AS method,r.reference_no AS reference,r.received_at AS received
    FROM membership.enrollment_bundle b JOIN identity.formal_member_application a ON a.formal_member_application_id=b.application_id
    JOIN identity.person p ON p.person_id=b.person_id LEFT JOIN commerce.enrollment_bundle_payment r USING(bundle_id)
    WHERE b.application_id=${applicationId}::uuid AND b.superseded_at IS NULL AND b.payment_policy='COMBINED' FOR UPDATE OF b`;
  if(!group)return {status:'NOT_APPLICABLE'};
  if(!group.receiptId)return {status:'AWAITING_PAYMENT'};
  if(group.review!=='APPROVED'||group.member!=='FORMAL_MEMBER')return {status:'AWAITING_APPROVAL'};
  const [root]=await tx.$queryRaw<{selected:boolean}[]>`SELECT EXISTS(SELECT 1 FROM organization.qualification_sponsor_selection_evidence e
    WHERE e.qualification_id=p.qualification_id AND e.selected_sponsor_qualification_id IS NOT NULL) AS selected
    FROM membership.enrollment_bundle_ball p WHERE p.bundle_id=${group.id}::uuid AND p.position=1`;
  if(!root?.selected)return {status:'AWAITING_PLACEMENT'};
  const lines=await tx.$queryRaw<Row[]>`SELECT o.order_id AS id,o.purpose::text AS kind,o.status::text AS status,
      q.status::text AS "ballStatus",q.effective_at AS placed,a.amount::text AS amount
    FROM membership.enrollment_bundle_ball p JOIN membership.qualification q ON q.qualification_id=p.qualification_id
    JOIN commerce.enrollment_bundle_allocation a ON a.bundle_id=p.bundle_id AND a.order_id IN (p.qualification_order_id,p.repurchase_order_id)
    JOIN commerce."order" o ON o.order_id=a.order_id WHERE p.bundle_id=${group.id}::uuid ORDER BY p.position,o.purpose
    FOR UPDATE OF o`;
  const at=new Date(Math.max(Date.now(),group.received.getTime()));
  for(const line of lines) {
    if(line.kind==='REPURCHASE' && line.ballStatus!=='EFFECTIVE')continue;
    if(line.status==='CONFIRMED') {
      await OrderService.applyEnrollmentAllocation(tx,line.id,{amount:line.amount,paymentMethod:new Prisma.Decimal(line.amount).isZero()?'COUPON_WAIVER':group.method,
        referenceNo:group.reference,occurredAt:at.toISOString()},'enrollment-allocation:'+line.id,requestId,group.actor);
      if(line.kind==='REPURCHASE'){
        const {subscription}=await preparePackageMonthlySchedule(tx,line.id,group.receiptId);
        if(subscription.status==='PENDING'){
          await tx.subscription.update({where:{subscriptionId:subscription.subscriptionId},data:{status:'ACTIVE',activatedAt:at}});
          await tx.auditEvent.create({data:{actorType:'SYSTEM',action:'PACKAGE_MONTHLY_SUBSCRIPTION_ACTIVATED',entityType:'SUBSCRIPTION',
            entityId:subscription.subscriptionId,requestId,correlationId:group.receiptId,afterData:{orderId:line.id,bundleId:group.id,
              volumePolicyReference:approvedRepurchaseVolumeReference,calendarReference:approvedRepurchaseCalendarReference}}});
        }
      }
    }else if(!['PAID','FULFILLED','PARTIAL_RETURN','RETURNED'].includes(line.status)){
      throw new ConflictException({code:'BUNDLE_ALLOCATION_ORDER_CHANGED',message:'訂單狀態已變更，請核對整組收款。'});
    }
  }
  return {status:lines.length && lines.every(line=>line.ballStatus==='EFFECTIVE')?'ACTIVE':'AWAITING_PLACEMENT'};
}

export async function activateBundleForQualification(tx:Prisma.TransactionClient,qualificationId:string,requestId:string) {
  const [row]=await tx.$queryRaw<{applicationId:string}[]>`SELECT b.application_id AS "applicationId"
    FROM membership.enrollment_bundle_ball p JOIN membership.enrollment_bundle b USING(bundle_id)
    WHERE p.qualification_id=${qualificationId}::uuid AND b.payment_policy='COMBINED' AND b.superseded_at IS NULL`;
  if(row)return activateEnrollmentBundleIfReady(tx,row.applicationId,requestId);
}
