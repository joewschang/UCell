import type {Prisma} from '@ucell/database';
import {projectPersonLegalNames} from '../person/person-legal-name';

type TrackingRow = {orderId:string; memberName?:string|null};
type Identity = {orderId:string; personId:string|null; legalName:string|null; registeredName:string|null; companyName:string|null};

export async function attachTrackingMemberNames(tx:Prisma.TransactionClient, orders:TrackingRow[]) {
  if(!orders.length)return;
  const ids=orders.map(order=>order.orderId);
  const identities=await tx.$queryRaw<Identity[]>`
    SELECT o.order_id AS "orderId", p.person_id AS "personId", p.legal_name AS "legalName",
           le.registered_name AS "registeredName", company.display_name AS "companyName"
      FROM commerce."order" o
      LEFT JOIN commerce.package_purchase_snapshot purchase ON purchase.order_id=o.order_id
      LEFT JOIN commerce.paper_application paper ON paper.order_id=o.order_id
      LEFT JOIN membership.qualification q ON q.qualification_id=o.qualification_id
      LEFT JOIN LATERAL (
        SELECT person_id, legal_entity_id, company_principal_id FROM (
          SELECT 1 AS priority, purchase.person_id, purchase.legal_entity_id, NULL::uuid AS company_principal_id, NULL::timestamptz AS since
          UNION ALL SELECT 2, o.purchaser_person_id, NULL, NULL, NULL
          UNION ALL SELECT 3, paper.person_id, NULL, NULL, NULL
          UNION ALL SELECT 4, h.person_id, h.legal_entity_id, h.company_principal_id, h.effective_from
            FROM membership.qualification_owner_interval h WHERE h.qualification_id=q.qualification_id
              AND h.effective_from<=o.created_at AND (h.effective_to IS NULL OR o.created_at<h.effective_to)
          UNION ALL SELECT 5, h.holder_person_id, h.holder_legal_entity_id, NULL, h.effective_from
            FROM membership.qualification_holder_history h WHERE h.qualification_id=q.qualification_id
              AND h.effective_from<=o.created_at AND (h.effective_to IS NULL OR o.created_at<h.effective_to)
          UNION ALL SELECT 6, q.current_holder_person_id, q.current_holder_legal_entity_id, q.current_company_principal_id, NULL
            WHERE NOT EXISTS (SELECT 1 FROM membership.qualification_owner_interval h WHERE h.qualification_id=q.qualification_id)
              AND NOT EXISTS (SELECT 1 FROM membership.qualification_holder_history h WHERE h.qualification_id=q.qualification_id)
        ) sources WHERE COALESCE(person_id,legal_entity_id,company_principal_id) IS NOT NULL
          ORDER BY priority, since DESC NULLS LAST, legal_entity_id, person_id, company_principal_id LIMIT 1
      ) owner ON TRUE
      LEFT JOIN identity.person p ON p.person_id=owner.person_id
      LEFT JOIN identity.legal_entity le ON le.legal_entity_id=owner.legal_entity_id
      LEFT JOIN membership.company_principal company ON company.company_principal_id=owner.company_principal_id
      WHERE o.order_id=ANY(${ids}::uuid[])`;
  const missing=new Map(identities.filter(row=>row.personId && !row.legalName?.trim() && !row.registeredName && !row.companyName).map(row=>[row.personId!,{personId:row.personId!,legalName:''}]));
  const projected=missing.size?await projectPersonLegalNames(tx,[...missing.values()]):[];
  const fallback=new Map<string,string>(projected.map(person=>[person.personId,person.legalName]));
  const names=new Map(identities.map(row=>[row.orderId,row.registeredName?.trim()||row.companyName?.trim()||row.legalName?.trim()||fallback.get(row.personId??'')||null]));
  for(const order of orders)order.memberName=names.get(order.orderId)??null;
}
