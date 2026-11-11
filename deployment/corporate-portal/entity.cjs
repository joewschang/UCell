'use strict';
// A verified representative can also hold a separate personal membership.
// Use the active entity selection, or an unambiguous entity-only account.
async function currentEntity(db,personId){
  const rows=await db.$queryRaw`SELECT DISTINCT e.legal_entity_id AS id,e.member_no AS "memberNo",
    e.registered_name AS name,e.membership_state AS state
    FROM identity.legal_entity_representative r
    JOIN identity.person p ON p.person_id=r.person_id
    JOIN identity.legal_entity e ON e.legal_entity_id=r.legal_entity_id
    LEFT JOIN identity.member_type_current c ON c.legal_entity_id=e.legal_entity_id
    WHERE p.person_id=${personId}::uuid AND p.status='EFFECTIVE' AND p.security_status='NORMAL'
      AND r.role_code='PRIMARY_OPERATING_REPRESENTATIVE' AND r.verified_at IS NOT NULL
      AND r.effective_from<=now() AND (r.effective_to IS NULL OR r.effective_to>now())
      AND e.status='ACTIVE' AND e.membership_state='FORMAL_MEMBER'
      AND ((c.person_id=p.person_id AND c.active_type='LEGAL_ENTITY')
        OR (c.legal_entity_id IS NULL AND (p.member_no IS NULL OR p.member_no=e.member_no)
          AND NOT EXISTS (SELECT 1 FROM identity.member_type_current other WHERE other.person_id=p.person_id AND other.active_type='LEGAL_ENTITY')))
    LIMIT 2`;
  return rows.length===1?rows[0]:null;
}
module.exports={currentEntity};
