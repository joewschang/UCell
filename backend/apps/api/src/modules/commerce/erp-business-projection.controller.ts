import {Body,Controller,Get,Param,Post,Query,Req,UnauthorizedException} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiTags} from '@nestjs/swagger';
import {ArrayMaxSize,IsArray,IsISO8601,IsString,IsUUID,Matches,MaxLength,MinLength,ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {ErpBusinessProjectionService} from './erp-business-projection.service';

class ErpBusinessResultLineDto{
 @ApiProperty() @Matches(/^(ORDER|RETURN)-LINE-[a-f0-9]{40}$/) lineReference!:string;
 @ApiProperty() @Matches(/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$/) amount!:string;
 @ApiProperty() @Matches(/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$/) quantity!:string;
}
class ErpBusinessResultDto{
 @ApiProperty() @IsString() @MinLength(8) @MaxLength(200) resultKey!:string;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/) providerReference!:string;
 @ApiProperty() @IsISO8601() occurredAt!:string;
 @ApiProperty() @Matches(/^[A-Z]{3}$/) currency!:string;
 @ApiProperty() @Matches(/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$/) amount!:string;
 @ApiProperty({type:[ErpBusinessResultLineDto]}) @IsArray() @ArrayMaxSize(1000) @ValidateNested({each:true}) @Type(()=>ErpBusinessResultLineDto) lines!:ErpBusinessResultLineDto[];
}
class ErpBusinessEnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
class ErpBusinessRetryDto{
 @ApiProperty() @IsUUID() retryKey!:string;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/) reasonReference!:string;
}
@ApiTags('Admin - ERP Business Projections')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/erp-projections')
export class ErpBusinessProjectionController{
 constructor(private readonly service:ErpBusinessProjectionService){}
 private context(req:any){if(!req.user?.personId)throw new UnauthorizedException({code:'ERP_PROJECTION_ACTOR_REQUIRED'});return {actorId:req.user.personId,requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()};}
 @Get() @ApiOperation({operationId:'adminErpBusinessProjectionList',summary:'讀取 Sales、Return 與 Compensation 投影及獨立 ERP 對帳證據'})
 @ApiQuery({name:'stream',required:false,enum:['SALES','RETURN','COMPENSATION']}) @ApiQuery({name:'take',required:false,type:Number}) @ApiQuery({name:'cursor',required:false}) @ApiQuery({name:'asOf',required:false,description:'Fixed projection creation horizon; statuses remain current'})
 @ApiOkResponse({type:ErpBusinessEnvelopeDto})
 list(@Query('stream') stream?:string,@Query('take') take?:string,@Query('cursor') cursor?:string,@Query('asOf') asOf?:string){return this.service.list({stream,take:take===undefined?undefined:Number(take),cursor,asOf}).then(data=>({data}));}
 @Get('orders/:orderNo/sources') @ApiOperation({operationId:'adminErpBusinessProjectionSources',summary:'以訂單號取得可識別的退貨商業參考'}) @ApiOkResponse({type:ErpBusinessEnvelopeDto})
 sources(@Param('orderNo') orderNo:string){return this.service.orderSources(orderNo).then(data=>({data}));}
 @Roles('SUPER_ADMIN','ORDER_OPS','FINANCE')
 @Post('orders/:orderNo/sales') @ApiOperation({operationId:'adminRequestErpSalesProjection',summary:'從已付款訂單封存一次 Sales 投影，不執行 ERP 出貨或會計'}) @ApiOkResponse({type:ErpBusinessEnvelopeDto})
 sales(@Param('orderNo') orderNo:string,@Req() req:any){return this.service.sales(orderNo,this.context(req)).then(data=>({data}));}
 @Roles('SUPER_ADMIN','ORDER_OPS','FINANCE')
 @Post('orders/:orderNo/returns/:returnReference') @ApiOperation({operationId:'adminRequestErpReturnProjection',summary:'封存正式入帳 ReturnCase 的 ERP 投影，不改寫會員回收'}) @ApiOkResponse({type:ErpBusinessEnvelopeDto})
 returned(@Param('orderNo') orderNo:string,@Param('returnReference') returnReference:string,@Req() req:any){return this.service.returned(orderNo,returnReference,this.context(req)).then(data=>({data}));}
 @Get(':projectionReference') @ApiOperation({operationId:'adminErpBusinessProjectionDetail',summary:'讀取投影、對帳及經 hash 驗證的商業來源追溯'}) @ApiOkResponse({type:ErpBusinessEnvelopeDto})
 detail(@Param('projectionReference') projectionReference:string){return this.service.detail(projectionReference).then(data=>({data}));}
 @Roles('SUPER_ADMIN','ORDER_OPS','FINANCE')
 @Post(':projectionReference/retry') @ApiOperation({operationId:'adminRetryErpBusinessProjection',summary:'稽核後重新排入失敗投影；保留原版本、冪等鍵及歷次嘗試'}) @ApiOkResponse({type:ErpBusinessEnvelopeDto})
 retry(@Param('projectionReference') projectionReference:string,@Body() input:ErpBusinessRetryDto,@Req() req:any){return this.service.retry(projectionReference,input,this.context(req)).then(data=>({data}));}
 @Roles('SUPER_ADMIN','ORDER_OPS','FINANCE')
 @Post(':projectionReference/results') @ApiOperation({operationId:'adminReconcileErpBusinessProjection',summary:'核對已受理 ERP 單據的金額和數量，差異建立例外'}) @ApiOkResponse({type:ErpBusinessEnvelopeDto})
 result(@Param('projectionReference') projectionReference:string,@Body() input:ErpBusinessResultDto,@Req() req:any){return this.service.reconcile(projectionReference,input,this.context(req)).then(data=>({data}));}
}
