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
class CompensationProjectionEnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
@ApiTags('Admin - ERP Compensation Projection') @ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','FINANCE') @Controller('admin/erp-projections/compensation')
export class ErpCompensationProjectionController{
 constructor(private readonly service:ErpCompensationProjectionService){}
 @Post('preview') @ApiOperation({operationId:'adminPreviewErpCompensationProjection',summary:'預覽已封存週期的會員應付及回收聚合；不產生 ERP 分錄'}) @ApiOkResponse({type:CompensationProjectionEnvelopeDto})
 preview(@Body() input:CompensationProjectionDto){return this.service.preview(input).then(data=>({data}));}
 @Post('approve') @ApiOperation({operationId:'adminApproveErpCompensationProjection',summary:'核准完全相符的聚合快照並封存追溯證據；缺會計映射時保持外部阻擋'}) @ApiOkResponse({type:CompensationProjectionEnvelopeDto})
 approve(@Body() input:CompensationProjectionApprovalDto,@Req() req:any){if(!req.user?.personId)throw new UnauthorizedException({code:'ERP_PROJECTION_ACTOR_REQUIRED'});return this.service.approve(input,{actorId:req.user.personId,requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()}).then(data=>({data}));}
}
