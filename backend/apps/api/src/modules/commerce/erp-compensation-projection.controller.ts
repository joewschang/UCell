import {Body,Controller,Post,Req,UnauthorizedException} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiTags} from '@nestjs/swagger';
import {IsBoolean,IsISO8601,IsString,Matches,MaxLength,MinLength} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {ErpCompensationProjectionService} from './erp-compensation-projection.service';
class CompensationProjectionDto{
 @ApiProperty() @IsISO8601() periodStart!:string;
 @ApiProperty() @IsISO8601() periodEnd!:string;
 @ApiProperty() @IsString() @MinLength(1) @MaxLength(100) ruleVersionCode!:string;
 @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) accountingDate!:string;
 @ApiProperty({description:'Finance-approved ledger denomination; no currency conversion is performed'}) @Matches(/^[A-Z]{3}$/) currency!:string;
 @ApiProperty({description:'Business reference supporting the approved ledger denomination'}) @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/) currencyBasisReference!:string;
 @ApiProperty() @IsBoolean() groupByPayoutBatch!:boolean;
}
class CompensationProjectionApprovalDto extends CompensationProjectionDto{
 @ApiProperty() @Matches(/^[a-f0-9]{64}$/) reviewHash!:string;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/) approvalReference!:string;
}
class CompensationSupplementDto extends CompensationProjectionDto{
 @ApiProperty() @Matches(/^ERP-PROJECTION-[a-f0-9]{40}$/) previousProjectionReference!:string;
}
class CompensationSupplementApprovalDto extends CompensationProjectionApprovalDto{
 @ApiProperty() @Matches(/^ERP-PROJECTION-[a-f0-9]{40}$/) previousProjectionReference!:string;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/) reasonReference!:string;
}
class CompensationProjectionEnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
@ApiTags('Admin - ERP Compensation Projection') @ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE') @Controller('admin/erp-projections/compensation')
export class ErpCompensationProjectionController{
 constructor(private readonly service:ErpCompensationProjectionService){}
 @Post('preview') @ApiOperation({operationId:'adminPreviewErpCompensationProjection',summary:'預覽已封存週期的會員應付及回收聚合；不產生 ERP 分錄'}) @ApiOkResponse({type:CompensationProjectionEnvelopeDto})
 preview(@Body() input:CompensationProjectionDto){return this.service.preview(input).then(data=>({data}));}
 @Post('supplement-preview') @ApiOperation({operationId:'adminPreviewErpCompensationSupplement',summary:'預覽目前獎金來源對前一封存版本的補充快照'}) @ApiOkResponse({type:CompensationProjectionEnvelopeDto})
 supplementPreview(@Body() input:CompensationSupplementDto){return this.service.previewSupplement(input).then(data=>({data}));}
 @Post('supplement-approve') @ApiOperation({operationId:'adminApproveErpCompensationSupplement',summary:'核准補充版本與前版連結，不改寫歷史核准或 ERP 證據'}) @ApiOkResponse({type:CompensationProjectionEnvelopeDto})
 supplementApprove(@Body() input:CompensationSupplementApprovalDto,@Req() req:any){if(!req.user?.personId)throw new UnauthorizedException({code:'ERP_PROJECTION_ACTOR_REQUIRED'});return this.service.approveSupplement(input,{actorId:req.user.personId,requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()}).then(data=>({data}));}
 @Post('approve') @ApiOperation({operationId:'adminApproveErpCompensationProjection',summary:'核准完全相符的聚合快照並封存追溯證據；缺會計映射時保持外部阻擋'}) @ApiOkResponse({type:CompensationProjectionEnvelopeDto})
 approve(@Body() input:CompensationProjectionApprovalDto,@Req() req:any){if(!req.user?.personId)throw new UnauthorizedException({code:'ERP_PROJECTION_ACTOR_REQUIRED'});return this.service.approve(input,{actorId:req.user.personId,requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()}).then(data=>({data}));}
}
