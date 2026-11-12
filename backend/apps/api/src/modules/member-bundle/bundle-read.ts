import {ConflictException,NotFoundException} from '@nestjs/common';
import {Prisma} from '@ucell/database';
import {formatRepurchaseNames} from '../../common/utils/repurchase-display';

export async function ownedApplication(tx:Prisma.TransactionClient,personId:string,applicationId:string,lock=false) {
  const [app]=await tx.$queryRaw<{status:string,membershipState:string,personStatus:string,securityStatus:string}[]>`
    SELECT a.status,p.membership_state::text AS "membershipState",p.status::text AS "personStatus",p.security_status::text AS "securityStatus"
    FROM identity.formal_member_application a JOIN identity.person p ON p.person_id=a.person_id
    WHERE a.formal_member_application_id=${applicationId}::uuid AND a.person_id=${personId}::uuid
      AND a.applicant_type='INDIVIDUAL' AND a.source_channel='MEMBER_WEB' AND a.legal_entity_id IS NULL
    ${lock?Prisma.sql`FOR UPDATE OF a,p`:Prisma.empty}`;
  if(!app)throw new NotFoundException({code:'FORMAL_APPLICATION_NOT_FOUND'});
  return app;
}

export async function activeBundle(tx:Prisma.TransactionClient,applicationId:string) {
  const [row]=await tx.$queryRaw<{bundleId:string,requestHash:string}[]>`
    SELECT bundle_id::text AS "bundleId",request_hash AS "requestHash"
    FROM membership.enrollment_bundle WHERE application_id=${applicationId}::uuid AND superseded_at IS NULL`;
  return row??null;
}

type Purchase={orderId:string;orderNo:string;publicOrderNo:string|null;packageName:string;total:string;status:string;paymentDeadline:string|null};
type Row={position:number;qualificationId:string;ballNo:string|null;qualificationStatus:string;placementStatus:string|null;currency:string;
  orderId:string;orderNo:string;publicOrderNo:string|null;packageName:string;amount:Prisma.Decimal;status:string;deadline:Date|null;kind:'ENTRY'|'REPURCHASE'};

async function restartEligible(tx:Prisma.TransactionClient,bundleId:string,orders:string[],balls:string[]) {
  const economic=await tx.order.findFirst({where:{orderId:{in:orders},OR:[
    {paidAt:{not:null}},{status:{notIn:['CONFIRMED','VOIDED']}},{paymentEvents:{some:{}}},{payments:{some:{}}},
    {paperReceiptEvidence:{some:{}}},{returns:{some:{}}},{invoices:{some:{}}},{fulfillments:{some:{}}},{inventoryReservations:{some:{}}}
  ]},select:{orderId:true}});
  if(economic || await tx.qualificationSetup.count({where:{qualificationId:{in:balls}}}))return false;
  const [reports]=await tx.$queryRaw<{recorded:boolean;individualTable:boolean}[]>`
    SELECT EXISTS (SELECT 1 FROM commerce.enrollment_bundle_payment_report WHERE bundle_id=${bundleId}::uuid)
        OR EXISTS (SELECT 1 FROM commerce.enrollment_bundle_payment WHERE bundle_id=${bundleId}::uuid) AS recorded,
      to_regclass('commerce.order_payment_report') IS NOT NULL AS "individualTable"`;
  if(reports.recorded)return false;
  if(reports.individualTable){
    const [report]=await tx.$queryRaw<{recorded:boolean}[]>`SELECT EXISTS(SELECT 1 FROM commerce.order_payment_report WHERE order_id IN
      (${Prisma.join(orders.map(id=>Prisma.sql`${id}::uuid`))})) AS recorded`;
    if(report.recorded)return false;
  }
  return true;
}

export async function sponsorLabel(tx:Prisma.TransactionClient,qualification:Prisma.Sql) {
  const [row]=await tx.$queryRaw<{ballNo:string|null,name:string|null}[]>`
    SELECT q.ball_no AS "ballNo",coalesce(cp.display_name,e.registered_name,p.legal_name) AS name
    FROM membership.qualification q LEFT JOIN identity.person p ON p.person_id=q.current_holder_person_id
    LEFT JOIN identity.legal_entity e ON e.legal_entity_id=q.current_holder_legal_entity_id
    LEFT JOIN membership.company_principal cp ON cp.company_principal_id=q.current_company_principal_id
    WHERE q.qualification_id=${qualification}`;
  return row??null;
}

export async function bundleReceipt(tx:Prisma.TransactionClient,bundleId:string,applicationId:string) {
  const [policy]=await tx.$queryRaw<{planCode:'EXCELLENCE'|'CUSTOM';paymentPolicy:'COMBINED'|'QUALIFICATION_ONLY'}[]>`
    SELECT plan_code AS "planCode",payment_policy AS "paymentPolicy" FROM membership.enrollment_bundle WHERE bundle_id=${bundleId}::uuid`;
  const rows=await tx.$queryRaw<Row[]>`
    SELECT b.position,b.qualification_id::text AS "qualificationId",q.ball_no AS "ballNo",q.status::text AS "qualificationStatus",
      setup.setup_status AS "placementStatus",o.currency,o.order_id::text AS "orderId",o.order_no::text AS "orderNo",
      to_jsonb(o)->>'public_order_no' AS "publicOrderNo",
      snap.package_name AS "packageName",snap.package_code AS "packageCode",o.net_amount AS amount,o.status::text AS status,snap.payment_deadline AS deadline,o.purpose::text AS kind
    FROM membership.enrollment_bundle_ball b JOIN membership.qualification q ON q.qualification_id=b.qualification_id
    LEFT JOIN membership.qualification_setup setup ON setup.qualification_id=b.qualification_id
    JOIN commerce."order" o ON o.order_id IN (b.qualification_order_id,b.repurchase_order_id)
    JOIN commerce.package_purchase_snapshot snap ON snap.order_id=o.order_id
    WHERE b.bundle_id=${bundleId}::uuid ORDER BY b.position,o.purpose`;
  if(!rows.length)throw new ConflictException({code:'ENROLLMENT_BUNDLE_INCOMPLETE'});
  for(const row of rows)if(row.kind==='REPURCHASE')formatRepurchaseNames(row);
  const purchase=(r:Row):Purchase=>({orderId:r.orderId,orderNo:r.orderNo,publicOrderNo:r.publicOrderNo,packageName:r.packageName,total:r.amount.toFixed(2),status:r.status,paymentDeadline:r.deadline?.toISOString()??null});
  const reps=new Map(rows.filter(r=>r.kind==='REPURCHASE').map(r=>[r.position,purchase(r)]));
  const entries=rows.filter(r=>r.kind==='ENTRY');
  const balls=entries.map(r=>({position:r.position,parentPosition:r.position===1?null:Math.floor(r.position/2),side:r.position===1?null:r.position%2?'RIGHT':'LEFT',
    qualificationId:r.qualificationId,ballNo:r.ballNo,qualificationStatus:r.qualificationStatus,placementStatus:r.placementStatus,
    qualification:purchase(r),repurchase:reps.get(r.position)??null,
    repurchasePayable:policy.paymentPolicy==='QUALIFICATION_ONLY'&&r.qualificationStatus==='EFFECTIVE'&&reps.get(r.position)?.status==='CONFIRMED'}));
  const root=balls[0];
  const sponsor=await sponsorLabel(tx,Prisma.sql`coalesce(
      (SELECT sponsor_qualification_id FROM organization.sponsor_relationship WHERE child_qualification_id=${root.qualificationId}::uuid AND effective_to IS NULL),
      (SELECT selected_sponsor_qualification_id FROM organization.qualification_sponsor_selection_evidence
        WHERE qualification_id=${root.qualificationId}::uuid ORDER BY selected_at DESC LIMIT 1))`);
  const total=(kind:string)=>rows.filter(r=>r.kind===kind).reduce((sum,r)=>sum.plus(r.amount),new Prisma.Decimal(0));
  const qualification=total('ENTRY'),repurchase=total('REPURCHASE');
  if(rows.some(r=>r.currency!==rows[0].currency))throw new ConflictException({code:'BUNDLE_CURRENCY_MISMATCH'});
  const expired=entries.some(r=>r.status==='VOIDED'||r.deadline&&r.deadline.getTime()<=Date.now());
  const mayRestart=expired&&balls.every(b=>['DRAFT','VOIDED'].includes(b.qualificationStatus))&&
    await restartEligible(tx,bundleId,rows.map(r=>r.orderId),balls.map(b=>b.qualificationId));
  return {bundleId,applicationId,...policy,payableTotal:(policy.paymentPolicy==='COMBINED'?qualification.plus(repurchase):qualification).toFixed(2),
    currency:rows[0].currency,qualificationTotal:qualification.toFixed(2),repurchaseTotal:repurchase.toFixed(2),
    total:qualification.plus(repurchase).toFixed(2),rootSponsor:sponsor??null,mayRestart,balls};
}
