import {Controller, Get, Param, ParseUUIDPipe} from '@nestjs/common';
import {PrismaService} from '@ucell/database';
import {Roles} from '../auth/roles.decorator';

@Controller('admin/observability/organization/binary-map')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
export class BinaryMapController {
  constructor(private readonly db:PrismaService) {}

  @Get()
  async trees(){
    const trees=await this.db.binaryTree.findMany({
      where:{status:{not:'ARCHIVED'}}, orderBy:{treeCode:'asc'},
      select:{binaryTreeId:true,treeName:true,treeCode:true,status:true},
    });
    return {data:trees};
  }

  @Get(':treeId')
  async nodes(@Param('treeId',ParseUUIDPipe) treeId:string){
    const rows=await this.db.$queryRaw`
      SELECT q.qualification_id AS id,q.ball_no AS "ballNo",m.binary_position_no::text AS position,
        CASE WHEN q.kind='COMPANY_BOOTSTRAP' THEN coalesce(cp.display_name,'公司球')
             ELSE coalesce(nullif(e.registered_name,''),nullif(p.legal_name,''),'姓名未提供') END AS name,
        CASE WHEN q.kind='COMPANY_BOOTSTRAP' THEN b.plan_code ELSE q.plan_level_code END AS plan,
        (coalesce(o.owner_type::text='COMPANY',false) OR q.active_flag) AS active
      FROM organization.binary_tree_membership m JOIN membership.qualification q USING(qualification_id)
      LEFT JOIN identity.person p ON p.person_id=q.current_holder_person_id
      LEFT JOIN identity.legal_entity e ON e.legal_entity_id=q.current_holder_legal_entity_id
      LEFT JOIN membership.company_principal cp ON cp.company_principal_id=q.current_company_principal_id
      LEFT JOIN LATERAL (SELECT owner_type FROM membership.qualification_owner_interval
        WHERE qualification_id=q.qualification_id AND effective_from<=now() AND (effective_to IS NULL OR effective_to>now())
        ORDER BY effective_from DESC LIMIT 1) o ON true
      LEFT JOIN LATERAL (SELECT plan_code FROM membership.company_bootstrap_profile_binding
        WHERE qualification_id=q.qualification_id AND binary_tree_id=m.binary_tree_id AND effective_from<=now()
        AND (effective_to IS NULL OR effective_to>now()) ORDER BY effective_from DESC LIMIT 1) b ON true
      WHERE m.binary_tree_id=${treeId}::uuid ORDER BY m.binary_position_no`;
    return {data:rows};
  }
}