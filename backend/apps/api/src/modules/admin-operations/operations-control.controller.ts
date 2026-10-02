import {Controller,Get,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {OperationsControlService} from './operations-control.service';
class EnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
@ApiTags('Admin - Operations Control') @ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT') @Controller('admin/operations/control')
export class OperationsControlController{
 constructor(private readonly service:OperationsControlService){}
 @Get('erp-health') @ApiOperation({operationId:'adminOperationsErpHealth',summary:'分流分頁讀取 ERP 健康與逾期候選；狀態以目前證據為準'}) @ApiOkResponse({type:EnvelopeDto})
 @ApiQuery({name:'stream',enum:['SALES','RETURN','COMPENSATION','FULFILLMENT']}) @ApiQuery({name:'take',required:false,type:Number}) @ApiQuery({name:'cursor',required:false}) @ApiQuery({name:'asOf',required:false}) @ApiQuery({name:'thresholdHours',required:false,type:Number,description:'Explicit operational threshold, 1–8760 hours. Omit to detect only failure, mismatch and open exceptions.'})
 health(@Query('stream') stream:string,@Query('take') take?:string,@Query('cursor') cursor?:string,@Query('asOf') asOf?:string,@Query('thresholdHours') thresholdHours?:string){return this.service.erpHealth({stream,take:take===undefined?undefined:Number(take),cursor,asOf,thresholdHours:thresholdHours===undefined?undefined:Number(thresholdHours)}).then(data=>({data}));}
}
