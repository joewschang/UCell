import {SUPPORTED_PERIOD_METRICS} from './period-projection-sources';
import {PERIOD_ERROR_SCHEMA,periodJobAccepted,PERIOD_JOB_STATUS,PERIOD_EXPORT_STATUS,PERIOD_QUERY_RESPONSE} from './period-openapi';
import {Body,Controller,Get,Header,Headers,Param,ParseUUIDPipe,Post,Req,StreamableFile,ConflictException,GoneException} from '@nestjs/common';
import {ApiHeader,ApiBearerAuth,ApiOperation,ApiProperty,ApiPropertyOptional,ApiResponse,ApiTags} from '@nestjs/swagger';
import {IsIn,IsObject,IsOptional,IsString,IsUUID,MaxLength} from 'class-validator';
import {Readable} from 'node:stream';
import {Roles} from '../auth/roles.decorator';
import {TreePrincipal} from '../binary-tree/tree-authorization';
import {PeriodProjectionService} from './period-projection.service';
import {PeriodExportService} from './period-export.service';
const querySchema={type:'object',required:['metrics','time'],additionalProperties:false,properties:{
 metrics:{type:'array',minItems:1,maxItems:1,items:{type:'string',enum:SUPPORTED_PERIOD_METRICS}},
 time:{type:'object',required:['timezone','asOf','knowledgeCutoff','periodStart','periodEnd'],additionalProperties:false,properties:{timezone:{type:'string',enum:['Asia/Taipei']},asOf:{type:'string',format:'date-time'},knowledgeCutoff:{type:'string',format:'date-time'},periodStart:{type:'string',format:'date-time'},periodEnd:{type:'string',format:'date-time'},settlementId:{type:'string',format:'uuid'},ruleVersion:{type:'string'}}},
 dimensions:{type:'array',items:{type:'string'}},groupBy:{type:'array',items:{type:'string'}},filters:{type:'object',additionalProperties:{type:'string'}},limit:{type:'integer',minimum:1,maximum:100,default:50}
}} as const;
export class PeriodReadDto{
 @ApiProperty({...querySchema,description:'Train A AnalyticsQuery; one supported metric and explicit AsOfContext. Unknown metrics, dimensions and filters return 422.'} as any) @IsObject() query!:Record<string,unknown>;
 @ApiPropertyOptional({format:'uuid',description:'Immutable aggregate generation. Required with after; query must match exactly.'}) @IsOptional() @IsUUID() snapshot?:string;
 @ApiPropertyOptional({maxLength:200}) @IsOptional() @IsString() @MaxLength(200) after?:string;
}
export class PeriodJobDto{
 @ApiProperty(querySchema as any) @IsObject() query!:Record<string,unknown>;
 @ApiProperty({enum:['DRY_RUN','REBUILD','RECONCILE']}) @IsIn(['DRY_RUN','REBUILD','RECONCILE']) mode!:'DRY_RUN'|'REBUILD'|'RECONCILE';
}
export class PeriodExportDto{
 @ApiProperty(querySchema as any) @IsObject() query!:Record<string,unknown>;
 @ApiProperty({format:'uuid'}) @IsUUID() snapshot!:string;
}
@ApiTags('Admin - Period Analytics') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@ApiResponse({status:400,description:'Malformed UUID or DTO shape rejected by global validation',schema:PERIOD_ERROR_SCHEMA as any})
@ApiResponse({status:401,description:'Session expired',schema:PERIOD_ERROR_SCHEMA as any})
@ApiResponse({status:403,description:'Live Entra Finance/Super Admin/Audit grant required; session and grants rechecked',schema:PERIOD_ERROR_SCHEMA as any})
@ApiResponse({status:404,description:'Job not visible to this actor',schema:PERIOD_ERROR_SCHEMA as any})
@ApiResponse({status:409,description:'Idempotency conflict, queue limit, unavailable generation or snapshot context mismatch',schema:PERIOD_ERROR_SCHEMA as any})
@ApiResponse({status:422,description:'Invalid query, unsupported metric/filter/dimension or time context',schema:PERIOD_ERROR_SCHEMA as any})
@Controller('admin/analytics/period-projections')
export class PeriodProjectionController{
 constructor(private readonly service:PeriodProjectionService,private readonly exports:PeriodExportService){}
@ApiHeader({name:'Idempotency-Key',required:true,schema:{type:'string',maxLength:128,pattern:'^[-a-zA-Z0-9_:]{1,128}$'}})
 @Post('jobs') @Header('Cache-Control','no-store')
 @ApiOperation({operationId:'adminRequestPeriodProjection',summary:'建立 dry-run／rebuild／reconcile 背景工作',description:'Derived read models only. Requires Idempotency-Key. Never writes economic facts.'})
 @ApiResponse({status:201,description:'Actor-bound idempotent projection job',schema:periodJobAccepted('jobId') as any})
 async request(@Req() req:{user:TreePrincipal},@Body() body:PeriodJobDto,@Headers('idempotency-key') key:string){return {data:await this.service.request(req.user,body.query,body.mode,key)};}
 @Get('jobs/:id') @Header('Cache-Control','no-store')
 @ApiOperation({operationId:'adminGetPeriodProjectionJob',summary:'讀取本人投影工作的狀態及 reconciliation 結果'})
 @ApiResponse({status:200,description:'Actor-bound projection status and reconciliation evidence',schema:PERIOD_JOB_STATUS as any})
 async status(@Req() req:{user:TreePrincipal},@Param('id',ParseUUIDPipe) id:string){return {data:await this.service.status(req.user,id)};}
 @Post('query') @Header('Cache-Control','no-store')
 @ApiOperation({operationId:'adminQueryPeriodAggregate',summary:'讀取固定 generation 的分析資料',description:'Finance-confidential. Maximum 100 rows. STALE/REBUILDING/UPDATING/FAILED is not authoritative current data. No SQL input; monetary values remain source decimal strings.'})
 @ApiResponse({status:201,description:'Standard HTTP envelope containing projection evidence and fixed generation cursor',schema:PERIOD_QUERY_RESPONSE as any})
 async read(@Req() req:{user:TreePrincipal},@Body() body:PeriodReadDto){return this.service.read(req.user,body.query,body.snapshot,body.after);}
@ApiHeader({name:'Idempotency-Key',required:true,schema:{type:'string',maxLength:128,pattern:'^[-a-zA-Z0-9_:]{1,128}$'}})
 @Post('exports') @Header('Cache-Control','no-store')
 @ApiOperation({operationId:'adminRequestPeriodExport',summary:'建立相同查詢與 snapshot 的背景 CSV 匯出',description:'Requires Idempotency-Key. Expires after 24 hours. Actor-bound private download; authorization rechecked by worker and download.'})
 @ApiResponse({status:201,description:'Actor-bound idempotent export job',schema:periodJobAccepted('exportId') as any})
 async export(@Req() req:{user:TreePrincipal},@Body() body:PeriodExportDto,@Headers('idempotency-key') key:string){return {data:await this.exports.request(req.user,body.query,body.snapshot,key)};}
 @Get('exports/:id') @Header('Cache-Control','no-store')
 @ApiOperation({operationId:'adminGetPeriodExport',summary:'讀取本人 ExportJob 與 snapshot／filters／定義版本'})
 @ApiResponse({status:200,description:'Export lifecycle, snapshot and provenance',schema:PERIOD_EXPORT_STATUS as any})
 async exportStatus(@Req() req:{user:TreePrincipal},@Param('id',ParseUUIDPipe) id:string){return {data:await this.exports.status(req.user,id)};}
 @Get('exports/:id/file') @Header('Cache-Control','private, no-store')
 @ApiOperation({operationId:'adminDownloadPeriodExport',summary:'串流下載本人未到期 CSV',description:'Server reads bounded stored chunks. Browser does not request all source data. Download is audited and reauthorizes every chunk.'})
 @ApiResponse({status:200,description:'UTF-8 CSV with generatedAt, dataThrough, snapshot, filters and definitionVersion',content:{'text/csv':{schema:{type:'string',format:'binary'}}}})
 @ApiResponse({status:410,description:'Export expired',schema:PERIOD_ERROR_SCHEMA as any})
 async download(@Req() req:{user:TreePrincipal},@Param('id',ParseUUIDPipe) id:string){
  const job=await this.exports.status(req.user,id);if(job.status==='EXPIRED')throw new GoneException({code:'EXPORT_EXPIRED'});
  if(job.status!=='COMPLETED')throw new ConflictException({code:'EXPORT_NOT_COMPLETED'});
  return new StreamableFile(Readable.from(this.exports.download(req.user,id)),{type:'text/csv; charset=utf-8',disposition:'attachment; filename="ucell-period-'+id+'.csv"'});
 }
}
