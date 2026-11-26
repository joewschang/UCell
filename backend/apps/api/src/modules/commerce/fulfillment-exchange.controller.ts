import {Body,Controller,Param,Post,Req,UnauthorizedException} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiProperty,ApiTags} from '@nestjs/swagger';
import {ArrayMaxSize,ArrayMinSize,ArrayUnique,IsArray,IsString,IsUUID,Matches,MaxLength} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {FulfillmentExchangeService} from './fulfillment-exchange.service';

export class ExchangeReceiptDto{
 @ApiProperty({type:[String],minItems:1,maxItems:100,description:'本案件實際退回的原出貨商品序號'})
 @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ArrayUnique() @Matches(/^[A-E][0-9]{7}$/,{each:true}) serialNos!:string[];
}
export class CreateShipmentExchangeDto extends ExchangeReceiptDto{
 @ApiProperty() @Matches(/^[a-f0-9]{64}$/) shipmentReference!:string;
 @ApiProperty({maxLength:500}) @IsString() @Matches(/\S/) @MaxLength(500) reason!:string;
 @ApiProperty({format:'uuid',description:'同一申請重試沿用原始 UUID，避免重複建立案件'}) @IsUUID() requestKey!:string;
}

@ApiTags('Admin - Fulfillment')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORDER_OPS')
@Controller('admin/fulfillment/orders/:orderNo/:fulfillmentKey/exchanges')
export class FulfillmentExchangeController{
 constructor(private readonly service:FulfillmentExchangeService){}
 private context(req:any){if(!req.user?.personId)throw new UnauthorizedException({code:'FULFILLMENT_ACTOR_REQUIRED'});return {actorId:req.user.personId,requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()};}
 @Post() @ApiOperation({operationId:'adminCreateShipmentExchange',summary:'對已出貨原序號申請同商品換貨，不改寫原訂單金額或業績'})
 create(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Body() body:CreateShipmentExchangeDto,@Req() req:any){return this.service.create(orderNo,key,body,this.context(req)).then(data=>({data}));}
 @Post(':exchangeReference/receive') @ApiOperation({operationId:'adminReceiveShipmentExchange',summary:'逐件驗收換貨退回品，保留原序號並列為退回待處理'})
 receive(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Param('exchangeReference') reference:string,@Body() body:ExchangeReceiptDto,@Req() req:any){return this.service.receive(orderNo,key,reference,body.serialNos,this.context(req)).then(data=>({data}));}
 @Post(':exchangeReference/replacement') @ApiOperation({operationId:'adminCreateExchangeReplacement',summary:'全部驗收後依原品項建立一次換貨補寄出貨配置'})
 replacement(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Param('exchangeReference') reference:string,@Req() req:any){return this.service.replacement(orderNo,key,reference,this.context(req)).then(data=>({data}));}
 @Post(':exchangeReference/cancel') @ApiOperation({operationId:'adminCancelShipmentExchange',summary:'撤銷完全尚未驗收的換貨申請，保留案件歷史'})
 cancel(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Param('exchangeReference') reference:string,@Req() req:any){return this.service.cancel(orderNo,key,reference,this.context(req)).then(data=>({data}));}
}
