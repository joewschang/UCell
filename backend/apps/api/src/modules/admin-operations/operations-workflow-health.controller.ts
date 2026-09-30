import {Controller,Get,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {OperationsWorkflowHealthService} from './operations-workflow-health.service';
class EnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
@ApiTags('Admin - Operations Workflow Health') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/operations/control')
export class OperationsWorkflowHealthController{
 constructor(private readonly service:OperationsWorkflowHealthService){}
 @Get('workflow-health') @ApiOperation({operationId:'adminOperationsWorkflowHealth',summary:'分頁檢查結算工作與月認列，保留健康資料的游標及精確來源入口'}) @ApiOkResponse({type:EnvelopeDto})
 @ApiQuery({name:'scope',enum:['PERIOD_JOB','RECOGNITION']}) @ApiQuery({name:'take',required:false,type:Number}) @ApiQuery({name:'cursor',required:false}) @ApiQuery({name:'asOf',required:false}) @ApiQuery({name:'reference',required:false}) @ApiQuery({name:'thresholdHours',required:false,type:Number})
 read(@Query('scope') scope:string,@Query('take') take?:string,@Query('cursor') cursor?:string,@Query('asOf') asOf?:string,@Query('reference') reference?:string,@Query('thresholdHours') thresholdHours?:string){return this.service.list({scope,take:take===undefined?undefined:Number(take),cursor,asOf,reference,thresholdHours:thresholdHours===undefined?undefined:Number(thresholdHours)}).then(data=>({data}));}
}
