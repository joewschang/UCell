import {ConflictException, Controller, Get, Header} from '@nestjs/common';
import {ApiBearerAuth, ApiConflictResponse, ApiForbiddenResponse, ApiOkResponse, ApiOperation, ApiTags} from '@nestjs/swagger';
import {PrismaService} from '@ucell/database';
import {Roles} from '../auth/roles.decorator';

interface SponsorMapNode {
  id: string;
  parentId: string | null;
  ballNo: string | null;
  name: string;
  plan: string | null;
  active: boolean;
  sponsorSequenceNo: number | null;
  createdAt: Date;
}

function assertForest(nodes: SponsorMapNode[]) {
  const parents=new Map<string,string|null>();
  function conflict(): never {
    throw new ConflictException({code:'SPONSOR_MAP_INCONSISTENT',message:'推薦關係資料不一致，請核對組織關係後重新載入。'});
  }
  for(const node of nodes) {
    if (!node.createdAt || parents.has(node.id)) conflict();
    parents.set(node.id,node.parentId);
  }
  const checked=new Set<string>();
  for(const start of parents.keys()) {
    let cursor:string|null=start;
    const path=new Set<string>();
    while(cursor!==null && !checked.has(cursor)) {
      if(!parents.has(cursor) || path.has(cursor)) conflict();
      path.add(cursor);
      cursor=parents.get(cursor) ?? null;
    }
    for(const id of path) checked.add(id);
  }
}

@ApiTags('Admin - Observability')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
@Controller('admin/observability/organization/sponsor-map')
export class SponsorMapController {
  constructor(private readonly db:PrismaService) {}

  @Get()
  @Header('Cache-Control','private, no-store')
  @ApiOperation({operationId:'adminSponsorMap',summary:'全公司推薦樹全貌',
    description:'SUPER_ADMIN、MEMBERSHIP_OPS、COMPLIANCE_AUDIT 可檢視。同一截點包含已發球號且未作廢、未關閉的球，以及所有有效推薦邊的兩端。包括無上下線與未活躍的球。依建檔時間與資格 UUID 排序。回傳完整森林，資料缺漏或矛盾時整筆失敗。'})
  @ApiOkResponse({description:'完整推薦森林，沒有資料時 data 為空陣列。',schema:{
    type:'object',required:['data','meta'],properties:{
      data:{type:'array',items:{type:'object',required:['id','parentId','ballNo','name','plan','active','sponsorSequenceNo','createdAt'],properties:{
        id:{type:'string',format:'uuid'},parentId:{type:'string',format:'uuid',nullable:true},ballNo:{type:'string',nullable:true},
        name:{type:'string'},plan:{type:'string',nullable:true},active:{type:'boolean'},sponsorSequenceNo:{type:'integer',nullable:true},createdAt:{type:'string',format:'date-time'},
      }}},
      meta:{type:'object',required:['asOf','complete','total'],properties:{asOf:{type:'string',format:'date-time'},complete:{type:'boolean',enum:[true]},total:{type:'integer',minimum:0}}},
    }
  }})
  @ApiForbiddenResponse({description:'角色無權檢視公司推薦全貌。'})
  @ApiConflictResponse({description:'SPONSOR_MAP_INCONSISTENT。存在缺失端點、重複上線或循環，未回傳部分樹。'})
  async read() {
    const asOf=new Date();
    const nodes=await this.db.$queryRaw<SponsorMapNode[]>`
      WITH instant AS (SELECT ${asOf}::timestamptz AS at),
      edges AS (
        SELECT s.sponsor_qualification_id AS parent, s.child_qualification_id AS child, s.sponsor_sequence_no
        FROM organization.sponsor_relationship s CROSS JOIN instant
        WHERE s.effective_from <= instant.at AND (s.effective_to IS NULL OR s.effective_to > instant.at)
      ),
      candidates AS (
        SELECT qualification_id AS id FROM membership.qualification
        WHERE NULLIF(btrim(ball_no),'') IS NOT NULL AND status NOT IN ('VOIDED','CLOSED')
        UNION SELECT parent FROM edges UNION SELECT child FROM edges
      )
      SELECT c.id, s.parent AS "parentId", NULLIF(btrim(q.ball_no),'') AS "ballNo", q.created_at AS "createdAt",
        s.sponsor_sequence_no AS "sponsorSequenceNo",
        CASE WHEN q.kind='COMPANY_BOOTSTRAP' THEN COALESCE(NULLIF(btrim(cp.display_name),''),'公司球')
             ELSE COALESCE(NULLIF(btrim(cp.display_name),''),NULLIF(btrim(e.registered_name),''),
                           NULLIF(btrim(p.legal_name),''),NULLIF(btrim(p.preferred_name),''),'姓名未提供') END AS name,
        CASE WHEN q.kind='COMPANY_BOOTSTRAP' THEN COALESCE(b.plan_code,q.plan_level_code) ELSE q.plan_level_code END AS plan,
        (COALESCE(o.owner_type::text='COMPANY',false) OR COALESCE(q.active_flag,false)) AS active
      FROM candidates c CROSS JOIN instant
      LEFT JOIN membership.qualification q ON q.qualification_id=c.id
      LEFT JOIN edges s ON s.child=c.id
      LEFT JOIN identity.person p ON p.person_id=q.current_holder_person_id
      LEFT JOIN identity.legal_entity e ON e.legal_entity_id=q.current_holder_legal_entity_id
      LEFT JOIN membership.company_principal cp ON cp.company_principal_id=q.current_company_principal_id
      LEFT JOIN LATERAL (
        SELECT owner_type FROM membership.qualification_owner_interval
        WHERE qualification_id=q.qualification_id AND effective_from<=instant.at AND (effective_to IS NULL OR effective_to>instant.at)
        ORDER BY effective_from DESC LIMIT 1
      ) o ON true
      LEFT JOIN LATERAL (
        SELECT plan_code FROM membership.company_bootstrap_profile_binding
        WHERE qualification_id=q.qualification_id AND effective_from<=instant.at AND (effective_to IS NULL OR effective_to>instant.at)
        ORDER BY effective_from DESC,binding_id LIMIT 1
      ) b ON q.kind='COMPANY_BOOTSTRAP'
      ORDER BY q.created_at,c.id
    `;
    assertForest(nodes);
    return {data:nodes,meta:{asOf:asOf.toISOString(),complete:true,total:nodes.length}};
  }
}
