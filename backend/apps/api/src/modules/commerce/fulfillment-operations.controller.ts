import {Body,Controller,Get,Param,Post,Req,UnauthorizedException} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiProperty,ApiTags} from '@nestjs/swagger';
import {ArrayMaxSize,IsArray,IsISO8601,IsString,Matches,MaxLength,MinLength,ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {FulfillmentOperationsService} from './fulfillment-operations.service';

export class FulfillmentScanDto{
 @ApiProperty() @Matches(/^[a-f0-9]{64}$/) sourceReference!:string;
 @ApiProperty() @IsString() @MaxLength(128) sku!:string;
 @ApiProperty({description:'PBBBSSSS：產品代碼、三位批號及四位序號'}) @Matches(/^[A-Ea-e][0-9]{7}$/) serialNo!:string;
}
export class ErpResultLineDto{
 @ApiProperty() @IsString() @MinLength(1) @MaxLength(128) sku!:string;
 @ApiProperty() @Matches(/^\d+(?:\.0+)?$/) @MaxLength(18) quantity!:string;
 @ApiProperty({type:[String]}) @IsArray() @ArrayMaxSize(10000) @Matches(/^[A-E][0-9]{7}$/,{each:true}) serialNos!:string[];
}
export class FulfillmentErpResultDto{
 @ApiProperty() @IsString() @MinLength(8) @MaxLength(200) resultKey!:string;
 @ApiProperty() @Matches(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/) providerReference!:string;
 @ApiProperty() @IsISO8601() occurredAt!:string;
 @ApiProperty({type:[ErpResultLineDto]}) @IsArray() @ArrayMaxSize(1000) @ValidateNested({each:true}) @Type(()=>ErpResultLineDto) lines!:ErpResultLineDto[];
}
export class ShipmentSerialBindingDto{
 @ApiProperty() @Matches(/^[a-f0-9]{64}$/) shipmentReference!:string;
}
export class ReturnSerialReceiptDto{
 @ApiProperty() @Matches(/^[a-f0-9]{64}$/) returnReference!:string;
 @ApiProperty({type:[String]}) @IsArray() @ArrayMaxSize(10000) @Matches(/^[A-E][0-9]{7}$/,{each:true}) serialNos!:string[];
}
@ApiTags('Admin - Fulfillment')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORDER_OPS')
@Controller('admin/fulfillment/orders')
export class FulfillmentOperationsController{
 constructor(private readonly service:FulfillmentOperationsService){}
 private context(req:any){if(!req.user?.personId)throw new UnauthorizedException({code:'FULFILLMENT_ACTOR_REQUIRED'});return {actorId:req.user.personId,requestId:req.requestId??randomUUID(),correlationId:req.correlationId??randomUUID()};}
 @Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT')
 @Get(':orderNo') @ApiOperation({operationId:'adminFulfillmentOrder',summary:'依訂單號載入出貨明細與序號驗證證據'})
 order(@Param('orderNo') orderNo:string){return this.service.order(orderNo).then(data=>({data}));}
 @Post(':orderNo/prepare') @ApiOperation({operationId:'adminPreparePaidOrderFulfillment',summary:'依已付款訂單快照建立一次實體出貨配置'})
 prepare(@Param('orderNo') orderNo:string,@Req() req:any){return this.service.prepare(orderNo,this.context(req)).then(data=>({data}));}
 @Post(':orderNo/:fulfillmentKey/scans') @ApiOperation({operationId:'adminScanFulfillmentSerial',summary:'核對商品與序號並記錄一次有效配置'})
 scan(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Body() body:FulfillmentScanDto,@Req() req:any){return this.service.scan(orderNo,key,body,this.context(req)).then(data=>({data}));}
 @Post(':orderNo/:fulfillmentKey/pack-verification') @ApiOperation({operationId:'adminVerifyFulfillmentPack',summary:'核對完整數量並保留不可變裝箱證據'})
 pack(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Req() req:any){return this.service.pack(orderNo,key,this.context(req)).then(data=>({data}));}
 @Post(':orderNo/:fulfillmentKey/erp-handoff') @ApiOperation({operationId:'adminRequestFulfillmentErpHandoff',summary:'保留 ERP 交付快照與持久請求；不宣告已出貨'})
 handoff(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Req() req:any){return this.service.handoff(orderNo,key,this.context(req)).then(data=>({data}));}
 @Post(':orderNo/:fulfillmentKey/erp-results') @ApiOperation({operationId:'adminRecordFulfillmentErpResult',summary:'記錄人工核對的 ERP 商品與序號結果；保留差異證據'})
 result(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Body() body:FulfillmentErpResultDto,@Req() req:any){return this.service.reconcile(orderNo,key,{...body,occurredAt:new Date(body.occurredAt)},this.context(req)).then(data=>({data}));}
 @Post(':orderNo/:fulfillmentKey/erp-retry') @ApiOperation({operationId:'adminRetryFulfillmentErpHandoff',summary:'重新排入失敗交付；固定原請求並先核對 ERP 受理狀態'})
 retry(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Req() req:any){return this.service.retryHandoff(orderNo,key,this.context(req)).then(data=>({data}));}
 @Post(':orderNo/:fulfillmentKey/shipment-serials') @ApiOperation({operationId:'adminBindShipmentSerials',summary:'依装箱與物流證據綁定實體序號，不以 ERP 受理代替出貨'})
 shipmentSerials(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Body() body:ShipmentSerialBindingDto,@Req() req:any){return this.service.bindShipment(orderNo,key,body.shipmentReference,this.context(req)).then(data=>({data}));}
 @Post(':orderNo/:fulfillmentKey/return-serials') @ApiOperation({operationId:'adminReceiveReturnSerials',summary:'依已入帳退貨明細驗收原出貨序號，保留商業用途追溯'})
 returnSerials(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Body() body:ReturnSerialReceiptDto,@Req() req:any){return this.service.receiveReturn(orderNo,key,body,this.context(req)).then(data=>({data}));}
}
