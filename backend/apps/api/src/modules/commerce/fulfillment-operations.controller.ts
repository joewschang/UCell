import {Body,Controller,Get,Param,Post,Req,UnauthorizedException} from '@nestjs/common';
import {ApiBearerAuth,ApiOperation,ApiProperty,ApiTags} from '@nestjs/swagger';
import {IsString,Matches,MaxLength} from 'class-validator';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {FulfillmentOperationsService} from './fulfillment-operations.service';

export class FulfillmentScanDto{
 @ApiProperty() @Matches(/^[a-f0-9]{64}$/) sourceReference!:string;
 @ApiProperty() @IsString() @MaxLength(128) sku!:string;
 @ApiProperty({description:'PBBBSSSS：產品代碼、三位批號及四位序號'}) @Matches(/^[A-Ea-e][0-9]{7}$/) serialNo!:string;
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
 @Post(':orderNo/:fulfillmentKey/scans') @ApiOperation({operationId:'adminScanFulfillmentSerial',summary:'核對商品與序號並記錄一次有效配置'})
 scan(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Body() body:FulfillmentScanDto,@Req() req:any){return this.service.scan(orderNo,key,body,this.context(req)).then(data=>({data}));}
 @Post(':orderNo/:fulfillmentKey/pack-verification') @ApiOperation({operationId:'adminVerifyFulfillmentPack',summary:'核對完整數量並保留不可變裝箱證據'})
 pack(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Req() req:any){return this.service.pack(orderNo,key,this.context(req)).then(data=>({data}));}
 @Post(':orderNo/:fulfillmentKey/erp-handoff') @ApiOperation({operationId:'adminRequestFulfillmentErpHandoff',summary:'保留 ERP 交付快照與持久請求；不宣告已出貨'})
 handoff(@Param('orderNo') orderNo:string,@Param('fulfillmentKey') key:string,@Req() req:any){return this.service.handoff(orderNo,key,this.context(req)).then(data=>({data}));}
}
