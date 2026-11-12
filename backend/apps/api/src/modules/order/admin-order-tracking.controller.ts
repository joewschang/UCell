import {Body,Controller,Get,Param,Post,Query,Req,UnauthorizedException} from '@nestjs/common';
import {IsIn,IsInt,IsOptional,IsString,Matches,Max,MaxLength,Min} from 'class-validator';
import {Type} from 'class-transformer';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {AdminOrderTrackingService} from './admin-order-tracking.service';
class TrackingQuery{
 @IsOptional() @IsIn(['ALL','PAYMENT','SHIPPING','RECEIVING','REVIEW','COMPLETED','EXCEPTION','OTHER']) tab?:string;
 @IsOptional() @IsString() @MaxLength(100) search?:string;
 @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100000) page?:number;
}
class TrackingFile{@IsString() @MaxLength(262144) csv!:string;}
class TrackingCommit extends TrackingFile{@Matches(/^[a-f0-9]{64}$/) previewHash!:string;}
class TrackingOrder{@Matches(/^[1-9][0-9]{0,17}$/) orderNo!:string;}
@Roles('SUPER_ADMIN','ORDER_OPS','FINANCE','COMPLIANCE_AUDIT')
@Controller('admin/order-tracking')
export class AdminOrderTrackingController{
 constructor(private readonly service:AdminOrderTrackingService){}
 @Get() list(@Query() query:TrackingQuery){return this.service.list(query).then(data=>({data}));}
 @Get('imports') history(){return this.service.history().then(data=>({data}));}
 @Get(':orderNo/timeline') timeline(@Param() params:TrackingOrder){return this.service.timeline(params.orderNo).then(data=>({data}));}
 @Roles('SUPER_ADMIN','ORDER_OPS') @Post('preview') preview(@Body() body:TrackingFile){return this.service.preview(body.csv).then(data=>({data}));}
 @Roles('SUPER_ADMIN','ORDER_OPS') @Post('import') apply(@Body() body:TrackingCommit,@Req() req:any){if(!req.user?.personId)throw new UnauthorizedException();return this.service.apply(body.csv,body.previewHash,{actorId:req.user.personId,role:req.user.role,requestId:req.requestId??randomUUID()}).then(data=>({data}));}
}
