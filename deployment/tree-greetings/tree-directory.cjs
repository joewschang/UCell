const {BadRequestException, Get, Query} = require('@nestjs/common');
const {Roles} = require('./modules/auth/roles.decorator');

const pageSize = 10;
function phoneKey(value) {
  const digits = value.replace(/[^0-9]/g, '');
  return digits.replace(/^00886/, '0').replace(/^886/, '0');
}

async function findRoots(db, query, placedOnly = false) {
  const term = String(query.q ?? '').trim();
  const page = Number(query.page ?? 1);
  if (term.length > 100 || !Number.isSafeInteger(page) || page < 1 || page > 1000000) {
    throw new BadRequestException('請確認搜尋條件與頁碼');
  }
  const phone = /^[+\d\s()-]+$/.test(term) ? phoneKey(term) : '';
  const rows = await db.$queryRaw`
    WITH criteria AS (SELECT lower(${term}::text) AS word, ${phone}::text AS phone)
    SELECT q.qualification_id::text AS id, q.ball_no AS "ballNo", q.created_at AS "joinedAt",
      COALESCE(ent.registered_name, principal.display_name, p.legal_name, p.preferred_name, '姓名尚未提供') AS name
    FROM membership.qualification q
    LEFT JOIN identity.person p ON p.person_id=q.current_holder_person_id
    LEFT JOIN identity.legal_entity ent ON ent.legal_entity_id=q.current_holder_legal_entity_id
    LEFT JOIN membership.company_principal principal ON principal.company_principal_id=q.current_company_principal_id
    CROSS JOIN criteria c
    WHERE q.ball_no IS NOT NULL AND (NOT ${placedOnly}::boolean OR EXISTS (
      SELECT FROM organization.binary_tree_membership m WHERE m.qualification_id=q.qualification_id
      AND m.effective_from<=now() AND m.recorded_at<=now()
    )) AND (
      c.word='' OR strpos(lower(q.ball_no),c.word)>0
      OR strpos(lower(p.legal_name),c.word)>0 OR strpos(lower(p.preferred_name),c.word)>0
      OR strpos(lower(ent.registered_name),c.word)>0 OR strpos(lower(principal.display_name),c.word)>0
      OR (c.phone<>'' AND strpos(regexp_replace(regexp_replace(p.mobile,'[^0-9]','','g'),'^(00886|886)','0'),c.phone)>0)
      OR EXISTS (SELECT 1 FROM identity.legal_entity_representative rep JOIN identity.person rp ON rp.person_id=rep.person_id
                 WHERE rep.legal_entity_id=ent.legal_entity_id AND rep.effective_from<=now()
                   AND (rep.effective_to IS NULL OR rep.effective_to>now())
                   AND (strpos(lower(rp.legal_name),c.word)>0 OR (c.phone<>'' AND
                     strpos(regexp_replace(regexp_replace(rp.mobile,'[^0-9]','','g'),'^(00886|886)','0'),c.phone)>0))))
    ORDER BY q.created_at ASC, q.qualification_no ASC
    LIMIT ${pageSize+1} OFFSET ${(page-1)*pageSize}`;
  return {data:rows.slice(0,pageSize),meta:{page,hasNext:rows.length>pageSize}};
}

exports.findRoots = findRoots;
function treeRoots(query) {return findRoots(this.service.prisma,query);}

exports.register = function register(controller) {
  const proto = controller.prototype;
  if (typeof proto.sponsorTree !== 'function' || proto.treeRoots) throw Error('Unexpected organization controller');
  Object.defineProperty(proto,'treeRoots',{value:treeRoots,configurable:true});
  const descriptor = Object.getOwnPropertyDescriptor(proto,'treeRoots');
  Query()(proto,'treeRoots',0);
  Roles('SUPER_ADMIN','MEMBERSHIP_OPS','FINANCE','COMPLIANCE_AUDIT')(proto,'treeRoots',descriptor);
  Get('organization/tree-roots')(proto,'treeRoots',descriptor);
};
