import {Controller,Get,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {CompensationPeriodSourcesService} from './compensation-period-sources.service';
class SourcesEnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
@ApiTags('Admin - Compensation Period Control') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/compensation-period-control')
export class CompensationPeriodSourcesController{
 constructor(private readonly service:CompensationPeriodSourcesService){}
 @Get('sources') @ApiOperation({operationId:'adminCompensationPeriodSources',summary:'按獎金類別及資格查閱原始來源、應付、回收和整筆付款證據'}) @ApiOkResponse({type:SourcesEnvelopeDto})
 @ApiQuery({name:'periodStart'}) @ApiQuery({name:'periodEnd'}) @ApiQuery({name:'ruleVersionCode'}) @ApiQuery({name:'take',required:false,type:Number}) @ApiQuery({name:'cursor',required:false}) @ApiQuery({name:'asOf',required:false}) @ApiQuery({name:'awardType',required:false}) @ApiQuery({name:'qualificationNo',required:false})
 read(@Query('periodStart') periodStart:string,@Query('periodEnd') periodEnd:string,@Query('ruleVersionCode') ruleVersionCode:string,@Query('take') take?:string,@Query('cursor') cursor?:string,@Query('asOf') asOf?:string,@Query('awardType') awardType?:string,@Query('qualificationNo') qualificationNo?:string){return this.service.list({periodStart,periodEnd,ruleVersionCode,take:take===undefined?undefined:Number(take),cursor,asOf,awardType,qualificationNo}).then(data=>({data}));}
}
