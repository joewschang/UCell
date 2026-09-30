import {Body,Controller,Get,Param,Post,Query,Req,UnauthorizedException} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiTags} from '@nestjs/swagger';
import {ArrayMaxSize,IsArray,IsIn,IsInt,IsOptional,IsISO8601,Matches,Max,Min,ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {ErpAccountingMappingService} from './erp-accounting-mapping.service';
class EntryDto{
 @ApiProperty() @Matches(/^(COMPENSATION|PAYMENT)-GROUP-[a-f0-9]{40}$/) groupReference!:string;
 @ApiProperty({enum:['MAP','REPORT_ONLY']}) @IsIn(['MAP','REPORT_ONLY']) treatment!:'MAP'|'REPORT_ONLY';
 @ApiProperty({nullable:true}) @IsOptional() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/) mappingCode!:string|null;
}
class MappingDto{
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,99}$/) connectionKey!:string;
 @ApiProperty() @IsInt() @Min(1) @Max(2147483647) connectionVersion!:number;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/) policyReference!:string;
 @ApiProperty() @IsInt() @Min(1) @Max(2147483647) policyVersion!:number;
 @ApiProperty({nullable:true}) @IsOptional() @Matches(/^ERP-MAPPING-[a-f0-9]{40}$/) previousMappingReference:string|null=null;
 @ApiProperty({type:[EntryDto]}) @IsArray() @ArrayMaxSize(1000) @ValidateNested({each:true}) @Type(()=>EntryDto) entries!:EntryDto[];
}
class ApprovalDto extends MappingDto{
 @ApiProperty() @Matches(/^[a-f0-9]{64}$/) reviewHash!:string;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/) approvalReference!:string;
}
class EnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
class ResultGroupDto{
 @ApiProperty() @Matches(/^(COMPENSATION|PAYMENT)-GROUP-[a-f0-9]{40}$/) groupReference!:string;
 @ApiProperty() @Matches(/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$/) amount!:string;
}
class ResultDto{
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,199}$/) resultKey!:string;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/) providerReference!:string;
 @ApiProperty() @Matches(/^[a-f0-9]{64}$/) requestHash!:string;
 @ApiProperty() @Matches(/^[A-Z]{3}$/) currency!:string;
 @ApiProperty() @IsISO8601() occurredAt!:string;
 @ApiProperty({type:[ResultGroupDto]}) @IsArray() @ArrayMaxSize(1000) @ValidateNested({each:true}) @Type(()=>ResultGroupDto) groups!:ResultGroupDto[];
}
@ApiTags('Admin - ERP Accounting Mapping') @ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT') @Controller('admin/erp-accounting-mappings')
export class ErpAccountingMappingController{
 constructor(private readonly service:ErpAccountingMappingService){}
 @Get('connections') @ApiOperation({operationId:'adminErpAccountingMappingConnections',summary:'讀取可核准映射的 ERP 連線版本，不回傳憑證'}) @ApiOkResponse({type:EnvelopeDto})
 connections(){return this.service.connections().then(data=>({data}));}
 @Get(':reference') @ApiOperation({operationId:'adminErpAccountingMappingHistory',summary:'讀取不可變更的映射核准歷史'}) @ApiQuery({name:'before',required:false,type:Number}) @ApiOkResponse({type:EnvelopeDto})
 history(@Param('reference') reference:string,@Query('before') before?:string){return this.service.history(reference,before===undefined?undefined:Number(before)).then(data=>({data}));}
 @Roles('SUPER_ADMIN','FINANCE') @Post(':reference/preview') @ApiOperation({operationId:'adminPreviewErpAccountingMapping',summary:'預覽完整群組映射或僅供報表的明確決策'}) @ApiOkResponse({type:EnvelopeDto})
 preview(@Param('reference') reference:string,@Body() body:MappingDto){return this.service.preview(reference,body).then(data=>({data}));}
 @Roles('SUPER_ADMIN','FINANCE') @Post(':reference/approve') @ApiOperation({operationId:'adminApproveErpAccountingMapping',summary:'核准並封存映射版本；傳送建立後不得修改映射'}) @ApiOkResponse({type:EnvelopeDto})
 approve(@Param('reference') reference:string,@Body() body:ApprovalDto,@Req() req:any){if(!req.user?.personId)throw new UnauthorizedException({code:'ERP_MAPPING_ACTOR_REQUIRED'});return this.service.approve(reference,body,{actorId:req.user.personId,requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()}).then(data=>({data}));}
 @Roles('SUPER_ADMIN','FINANCE') @Post(':reference/results') @ApiOperation({operationId:'adminReconcileErpAccountingProjection',summary:'核對已受理映射版本的實際 ERP 聚合金額，保留獨立例外'}) @ApiOkResponse({type:EnvelopeDto})
 result(@Param('reference') reference:string,@Body() body:ResultDto,@Req() req:any){if(!req.user?.personId)throw new UnauthorizedException({code:'ERP_MAPPING_ACTOR_REQUIRED'});return this.service.reconcile(reference,body,{actorId:req.user.personId,requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()}).then(data=>({data}));}
}
