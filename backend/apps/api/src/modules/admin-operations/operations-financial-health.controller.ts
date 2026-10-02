import {Controller,Get,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {OperationsFinancialHealthService} from './operations-financial-health.service';
class EnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
@ApiTags('Admin - Operations Financial Health') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/operations/control')
export class OperationsFinancialHealthController{
 constructor(private readonly service:OperationsFinancialHealthService){}
 @Get('financial-health') @ApiOperation({operationId:'adminOperationsFinancialHealth',summary:'有界付款／三類可付款來源／追回證據檢查；金額與異常僅涵蓋本頁'}) @ApiOkResponse({type:EnvelopeDto})
 @ApiQuery({name:'scope',enum:['PAYOUT','PAYABLE','RECOVERY']}) @ApiQuery({name:'take',required:false,type:Number}) @ApiQuery({name:'cursor',required:false}) @ApiQuery({name:'asOf',required:false}) @ApiQuery({name:'reference',required:false})
 read(@Query('scope') scope:string,@Query('take') take?:string,@Query('cursor') cursor?:string,@Query('asOf') asOf?:string,@Query('reference') reference?:string){return this.service.list({scope,take:take===undefined?undefined:Number(take),cursor,asOf,reference}).then(data=>({data}));}
}
