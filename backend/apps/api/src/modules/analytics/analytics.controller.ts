import { applyDecorators, BadRequestException, Body, Controller, Get, Headers, Param, Post, Query, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { Roles } from '../auth/roles.decorator';
import { ANALYTICS_POLICY } from './analytics.policy';
import { AnalyticsService } from './analytics.service';
import { AnalyticsRefreshWorker } from './analytics.refresh';
import { HistoryInput } from './analytics.history';

const HistoryQuery=()=>applyDecorators(
  ApiQuery({name:'from',required:false,type:String,description:'台北日期 YYYY-MM-DD，包含；須與 to 同時提供，最多 366 天'}),
  ApiQuery({name:'to',required:false,type:String,description:'台北日期 YYYY-MM-DD，不包含；最晚為明日'}),
  ApiQuery({name:'policyVersion',required:false,type:String,description:'精確政策版本；預設目前政策，不混合版本'}),
);

@ApiTags('Admin - Management Analytics')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','MEMBERSHIP_OPS','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/analytics')
export class AnalyticsController {
  constructor(private readonly service:AnalyticsService,private readonly refresh:AnalyticsRefreshWorker){}
  @Get('policy')
  @ApiOperation({operationId:'adminAnalyticsPolicy',summary:'版本化 NASL 與十二代健康管理定義'})
  policy(){return {data:ANALYTICS_POLICY};}
  @Get('policy-versions')
  @ApiOperation({operationId:'adminAnalyticsPolicyVersions',summary:'可查詢的管理政策版本'})
  async policyVersions(){return {data:await this.service.policyVersions()};}
  @Get('refresh/status')
  @ApiOperation({operationId:'adminAnalyticsRefreshStatus',summary:'自動更新狀態與各設定範圍的保存快照鮮度'})
  async refreshStatus(){return {data:await this.refresh.status()};}
  @Get('roots')
  @ApiOperation({operationId:'adminAnalyticsRoots',summary:'依球號選擇分析範圍，最多 30 筆，不回傳個資'})
  async roots(@Query('q') q?:string){return {data:await this.service.roots(q)};}
  @Get('overview')
  @ApiOperation({operationId:'adminAnalyticsOverview',summary:'已保存 NASL 分布、同期群與狀態轉換'})
  async overview(){return {data:await this.service.overview()};}
  @Get('nasl/current')
  @ApiOperation({operationId:'adminAnalyticsNaslCurrent',summary:'目前 NASL 分布'})
  async current(){return {data:await this.service.overview()};}
  @Get('nasl/transitions')
  @HistoryQuery()
  @ApiOperation({operationId:'adminAnalyticsNaslTransitions',summary:'已保存快照間狀態轉換'})
  async transitions(@Query() input:HistoryInput){return {data:await this.service.history(this.query(input))};}
  @Get('nasl/cohorts')
  @HistoryQuery()
  @ApiOperation({operationId:'adminAnalyticsNaslCohorts',summary:'同政策固定月末母體的同期群活躍占比與活躍留存'})
  async cohorts(@Query() input:HistoryInput){return {data:await this.service.cohorts(this.query(input))};}
  @Get('nasl/history')
  @HistoryQuery()
  @ApiOperation({operationId:'adminAnalyticsHistory',summary:'每日 NASL 快照，台北日期左含右不含，最多 366 天；預設 90 天'})
  async history(@Query() input:HistoryInput){return {data:await this.service.history(this.query(input))};}
  @Get('sonar/:tree/:qualificationId')
  @ApiOperation({operationId:'adminAnalyticsSonar',summary:'推薦／雙軌十二代健康雷達；僅查詢投影'})
  async sonar(@Param('tree') tree:string,@Param('qualificationId') root:string){return {data:await this.service.sonar(this.tree(tree),root)};}
  @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT')
  @Get('sonar/:tree/:qualificationId/contributors')
  @ApiOperation({operationId:'adminAnalyticsContributors',summary:'單代資格證據 ID，最多 100 筆'})
  async contributors(@Param('tree') tree:string,@Param('qualificationId') root:string,@Query('generation') generation:string){return {data:await this.service.drilldown(this.tree(tree),root,Number(generation))};}
  @Get('sonar/:tree/:qualificationId/volumes')
  @ApiOperation({operationId:'adminAnalyticsSonarVolumes',summary:'事件歷史樹的十二代 GPV/RPV/EPV，最近 30 天原始事件截至快照的修正淨量；Binary 另含已結算 Carry'})
  async volumes(@Param('tree') tree:string,@Param('qualificationId') root:string){return {data:await this.service.volumes(this.tree(tree),root)};}
  @Roles('SUPER_ADMIN')
  @Post('rebuild')
  @ApiOperation({operationId:'adminAnalyticsRebuild',summary:'建立不可覆寫的管理分析快照；需要 UUID Idempotency-Key'})
  async rebuild(@Headers('idempotency-key') key:string,@Body() body:unknown,@Req() req:any){
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>k!=='rootQualificationId'))throw new BadRequestException('ONLY_OPTIONAL_ROOT_QUALIFICATION_ID_ALLOWED');
    const root=(body as {rootQualificationId?:unknown}).rootQualificationId;
    if(root!==undefined&&(typeof root!=='string'||!root))throw new BadRequestException('ROOT_QUALIFICATION_UUID_REQUIRED');
    return {data:await this.service.rebuild(key,root as string|undefined,String(req.user.personId??req.user.subject),req.user.personId)};
  }
  private tree(tree:string):'sponsor'|'binary'{if(tree!=='sponsor'&&tree!=='binary')throw new BadRequestException('SPONSOR_OR_BINARY_REQUIRED');return tree;}
  private query(input:HistoryInput){if(Object.keys(input).some(key=>!['from','to','policyVersion'].includes(key))||Object.values(input).some(value=>typeof value!=='string'))throw new BadRequestException('INVALID_HISTORY_QUERY');return input;}
}
