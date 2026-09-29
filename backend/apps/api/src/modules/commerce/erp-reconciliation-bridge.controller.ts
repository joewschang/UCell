import {Controller,Get,Query} from '@nestjs/common';
import {ApiBearerAuth,ApiOkResponse,ApiOperation,ApiProperty,ApiQuery,ApiResponse,ApiTags} from '@nestjs/swagger';
import {Roles} from '../auth/roles.decorator';
import {ErpReconciliationBridgeService,ERP_BRIDGE_LIFECYCLES} from './erp-reconciliation-bridge.service';

class ErpBridgeLineDto{@ApiProperty() sku!:string;@ApiProperty() quantity!:string;@ApiProperty() serialCount!:number;}
class ErpBridgeUcellDto{@ApiProperty() orderStatus!:string;@ApiProperty() fulfillmentStatus!:string;}
class ErpBridgeErpDto{@ApiProperty() provider!:string;@ApiProperty({nullable:true}) connection!:string|null;@ApiProperty() formatVersion!:string;@ApiProperty() outboxStatus!:string;@ApiProperty() attemptCount!:number;@ApiProperty({nullable:true}) latestAttemptOutcome!:string|null;@ApiProperty({nullable:true}) providerReference!:string|null;@ApiProperty({type:[ErpBridgeLineDto]}) expected!:ErpBridgeLineDto[];@ApiProperty({type:[ErpBridgeLineDto]}) actual!:ErpBridgeLineDto[];@ApiProperty({nullable:true}) reconciliationOutcome!:string|null;@ApiProperty({nullable:true}) reasonCode!:string|null;}
class ErpBridgeShipmentDto{@ApiProperty() status!:string;@ApiProperty() count!:number;}
class ErpBridgeEvidenceDto{@ApiProperty() payloadHash!:string;@ApiProperty({nullable:true}) resultHash!:string|null;@ApiProperty({nullable:true}) exceptionReference!:string|null;@ApiProperty({nullable:true}) exceptionCode!:string|null;@ApiProperty({nullable:true}) exceptionSeverity!:string|null;@ApiProperty({nullable:true}) exceptionStatus!:string|null;}
class ErpBridgeTimestampsDto{@ApiProperty() queuedAt!:string;@ApiProperty({nullable:true}) sentAt!:string|null;@ApiProperty({nullable:true}) acknowledgedAt!:string|null;@ApiProperty({nullable:true}) reconciledAt!:string|null;@ApiProperty() dataThrough!:string;}
class ErpBridgeItemDto{@ApiProperty() orderNo!:string;@ApiProperty() fulfillmentKey!:string;@ApiProperty({enum:ERP_BRIDGE_LIFECYCLES}) bridgeStatus!:string;@ApiProperty({type:ErpBridgeUcellDto}) ucell!:ErpBridgeUcellDto;@ApiProperty({type:ErpBridgeErpDto}) erp!:ErpBridgeErpDto;@ApiProperty({type:ErpBridgeShipmentDto}) shipment!:ErpBridgeShipmentDto;@ApiProperty({type:ErpBridgeEvidenceDto}) evidence!:ErpBridgeEvidenceDto;@ApiProperty({type:ErpBridgeTimestampsDto}) timestamps!:ErpBridgeTimestampsDto;}
class ErpBridgeAuthorityDto{@ApiProperty() ucell!:string;@ApiProperty() erp!:string;@ApiProperty() shipment!:string;}
class ErpBridgePageDto{@ApiProperty() asOf!:string;@ApiProperty() dataThrough!:string;@ApiProperty({type:[ErpBridgeItemDto]}) items!:ErpBridgeItemDto[];@ApiProperty({nullable:true}) nextCursor!:string|null;@ApiProperty() limit!:number;@ApiProperty({type:ErpBridgeAuthorityDto}) authority!:ErpBridgeAuthorityDto;@ApiProperty() liveTransportStatus!:string;}
class ErpBridgeEnvelopeDto{@ApiProperty({type:ErpBridgePageDto}) data!:ErpBridgePageDto;}

@ApiTags('Admin - ERP Reconciliation Bridge')
@ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/erp-reconciliation')
export class ErpReconciliationBridgeController{
 constructor(private readonly service:ErpReconciliationBridgeService){}
 @Get()
 @ApiOperation({operationId:'adminErpReconciliationBridge',summary:'Read provider-neutral UCell, ERP and shipment reconciliation evidence',description:'Snapshot-consistent, bounded operational view. ERP acceptance never implies UCell payment or physical shipment.'})
 @ApiQuery({name:'status',required:false,enum:ERP_BRIDGE_LIFECYCLES})
 @ApiQuery({name:'orderNo',required:false,description:'Public order number'})
 @ApiQuery({name:'take',required:false,schema:{type:'integer',minimum:1,maximum:200,default:50}})
 @ApiQuery({name:'asOf',required:false,description:'ISO-8601 snapshot cutoff returned by the first page'})
 @ApiQuery({name:'cursor',required:false,description:'Opaque continuation token returned by the previous page'})
 @ApiOkResponse({type:ErpBridgeEnvelopeDto,description:'Privacy-safe authoritative reconciliation bridge page'})
 @ApiResponse({status:400,description:'Invalid filters, cutoff or cursor'})
 @ApiResponse({status:401,description:'Admin authentication required'})
 @ApiResponse({status:403,description:'Order, finance or compliance role required'})
 list(@Query('status') status?:string,@Query('orderNo') orderNo?:string,@Query('take') take?:string,@Query('asOf') asOf?:string,@Query('cursor') cursor?:string){return this.service.list({status,orderNo,take:take===undefined?undefined:Number(take),asOf,cursor}).then(data=>({data}));}
}
