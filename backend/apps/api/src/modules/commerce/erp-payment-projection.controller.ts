import {Body,Controller,Get,Post,Query,Req,UnauthorizedException} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiTags} from '@nestjs/swagger';
import {IsBoolean,IsISO8601,Matches} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {ErpPaymentProjectionService} from './erp-payment-projection.service';
class PaymentProjectionDto{
 @ApiProperty() @Matches(/^PAYOUT-[a-f0-9]{40}$/) payoutReference!:string;
 @ApiProperty() @IsISO8601() periodStart!:string;
 @ApiProperty() @IsISO8601() periodEnd!:string;
 @ApiProperty() @Matches(/^\d{4}-\d{2}-\d{2}$/) accountingDate!:string;
 @ApiProperty() @Matches(/^[A-Z]{3}$/) currency!:string;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/) currencyBasisReference!:string;
 @ApiProperty() @IsBoolean() groupByEconomicCategory!:boolean;
}
class PaymentProjectionApprovalDto extends PaymentProjectionDto{
 @ApiProperty() @Matches(/^[a-f0-9]{64}$/) reviewHash!:string;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/) approvalReference!:string;
}
class PaymentProjectionEnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
@ApiTags('Admin - ERP Payment Projection') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','FINANCE') @Controller('admin/erp-projections/payment')
export class ErpPaymentProjectionController{
 constructor(private readonly service:ErpPaymentProjectionService){}
 @Roles('SUPER_ADMIN','FINANCE','COMPLIANCE_AUDIT')
 @Get('batches') @ApiOperation({operationId:'adminErpPaymentProjectionBatches',summary:'依付款批次期間取得商業參考與整批金額'}) @ApiOkResponse({type:PaymentProjectionEnvelopeDto}) @ApiQuery({name:'periodStart',required:true}) @ApiQuery({name:'periodEnd',required:true})
 @ApiQuery({name:'cursor',required:false}) @ApiQuery({name:'take',required:false,type:Number})
 batches(@Query('periodStart') periodStart:string,@Query('periodEnd') periodEnd:string,@Query('cursor') cursor?:string,@Query('take') take?:string){return this.service.batches({periodStart,periodEnd,cursor,take:take===undefined?undefined:Number(take)}).then(data=>({data}));}
 @Post('preview') @ApiOperation({operationId:'adminPreviewErpPaymentProjection',summary:'以雙階核准、不可變匯出與銀行證據預覽整批付款投影'}) @ApiOkResponse({type:PaymentProjectionEnvelopeDto})
 preview(@Body() input:PaymentProjectionDto){return this.service.preview(input).then(data=>({data}));}
 @Post('approve') @ApiOperation({operationId:'adminApproveErpPaymentProjection',summary:'核准 hash 完全相符的整批付款投影；不分攤跨期款項'}) @ApiOkResponse({type:PaymentProjectionEnvelopeDto})
 approve(@Body() input:PaymentProjectionApprovalDto,@Req() req:any){if(!req.user?.personId)throw new UnauthorizedException({code:'ERP_PROJECTION_ACTOR_REQUIRED'});return this.service.approve(input,{actorId:req.user.personId,requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()}).then(data=>({data}));}
}
