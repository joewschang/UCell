import {Controller,Get,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {OperationsWorkflowHealthService} from './operations-workflow-health.service';
import {PeriodProcessTimingDto} from '../settlement-jobs/period-process-timing.dto';
class WorkflowCandidateDto {
 @ApiProperty() code!:string;
 @ApiProperty() reference!:string;
 @ApiProperty() severity!:string;
 @ApiProperty() evidenceHash!:string;
 @ApiProperty() link!:string;
}
class WorkflowHealthItemDto {
 @ApiProperty() reference!:string;
 @ApiProperty({enum:['PERIOD_JOB','RECOGNITION']}) scope!:string;
 @ApiProperty() state!:string;
 @ApiProperty({type:PeriodProcessTimingDto,nullable:true,description:'Period-job process timing only; null for recognition records. Does not time the derived wait or overall financial stage.'}) processTiming!:PeriodProcessTimingDto|null;
 @ApiProperty({format:'date-time'}) createdAt!:string;
 @ApiProperty({type:'object',additionalProperties:true,description:'Whitelisted scope-specific source evidence; excludes payloads, private actors and internal IDs'}) evidence!:Record<string,unknown>;
 @ApiProperty({type:'integer',minimum:0,nullable:true,description:'Whole hours since approved eligibility/due time, not actual stage entry'}) elapsedSinceEligibleHours!:number|null;
 @ApiProperty() link!:string;
 @ApiProperty({type:String,nullable:true}) actionLink!:string|null;
 @ApiProperty({type:String,nullable:true}) periodLink!:string|null;
 @ApiProperty({type:[WorkflowCandidateDto]}) candidates!:WorkflowCandidateDto[];
}
class WorkflowHealthPageDto {
 @ApiProperty({type:[WorkflowHealthItemDto]}) items!:WorkflowHealthItemDto[];
 @ApiProperty({enum:['PERIOD_JOB','RECOGNITION']}) scope!:string;
 @ApiProperty({type:'integer',minimum:0}) observed!:number;
 @ApiProperty({type:'integer',minimum:0}) attention!:number;
 @ApiProperty({enum:['CURRENT_PAGE_ONLY']}) coverage!:string;
 @ApiProperty({type:'integer',minimum:1,maximum:8760,nullable:true}) thresholdHours!:number|null;
 @ApiProperty({format:'date-time'}) asOf!:string;
 @ApiProperty({format:'date-time'}) dataThrough!:string;
 @ApiProperty({type:String,nullable:true}) nextCursor!:string|null;
}
class WorkflowHealthEnvelopeDto{@ApiProperty({type:WorkflowHealthPageDto}) data!:WorkflowHealthPageDto;}
@ApiTags('Admin - Operations Workflow Health') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/operations/control')
export class OperationsWorkflowHealthController{
 constructor(private readonly service:OperationsWorkflowHealthService){}
 @Get('workflow-health') @ApiOperation({operationId:'adminOperationsWorkflowHealth',summary:'分頁檢查結算工作與月認列，保留健康資料的游標及精確來源入口'}) @ApiOkResponse({type:WorkflowHealthEnvelopeDto})
 @ApiQuery({name:'scope',enum:['PERIOD_JOB','RECOGNITION']}) @ApiQuery({name:'take',required:false,type:Number}) @ApiQuery({name:'cursor',required:false}) @ApiQuery({name:'asOf',required:false}) @ApiQuery({name:'reference',required:false}) @ApiQuery({name:'thresholdHours',required:false,type:Number})
 read(@Query('scope') scope:string,@Query('take') take?:string,@Query('cursor') cursor?:string,@Query('asOf') asOf?:string,@Query('reference') reference?:string,@Query('thresholdHours') thresholdHours?:string){return this.service.list({scope,take:take===undefined?undefined:Number(take),cursor,asOf,reference,thresholdHours:thresholdHours===undefined?undefined:Number(thresholdHours)}).then(data=>({data}));}
}
