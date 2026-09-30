import {Controller,Get,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {OperationsCompanyHealthService} from './operations-company-health.service';
class EnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
@ApiTags('Admin - Operations Company Health') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/operations/control')
export class OperationsCompanyHealthController{
 constructor(private readonly service:OperationsCompanyHealthService){}
 @Get('company-health') @ApiOperation({operationId:'adminOperationsCompanyHealth',summary:'分頁檢查三類獎金的 Company／Reservoir B 歷史去向與原始及 Replay 權益'}) @ApiOkResponse({type:EnvelopeDto})
 @ApiQuery({name:'scope',enum:['COMPANY_BONUS','COMPANY_RPV','COMPANY_GLOBAL']}) @ApiQuery({name:'take',required:false,type:Number}) @ApiQuery({name:'cursor',required:false}) @ApiQuery({name:'asOf',required:false}) @ApiQuery({name:'reference',required:false})
 read(@Query('scope') scope:string,@Query('take') take?:string,@Query('cursor') cursor?:string,@Query('asOf') asOf?:string,@Query('reference') reference?:string){return this.service.list({scope,take:take===undefined?undefined:Number(take),cursor,asOf,reference}).then(data=>({data}));}
}
