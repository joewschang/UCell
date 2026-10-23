import {Body,Controller,Get,Headers,Param,Post,Query,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiTags} from '@nestjs/swagger';
import {IsIn,IsInt,IsOptional,IsString,Matches,Max,MaxLength,Min} from 'class-validator';
import {Type} from 'class-transformer';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {OrderHubService} from './order-hub.service';
class HubQuery{@IsOptional() @IsIn(['PAYMENT','SHIPPING','RECEIVING','REVIEW','ALL']) tab?:string;@IsOptional() @IsString() @MaxLength(100) search?:string;@IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100000) page?:number;}
class OrderReference{@Matches(/^[1-9][0-9]{0,17}$/) orderNo!:string;}
class ReviewInput{@IsInt() @Min(1) @Max(5) rating!:number;@IsOptional() @IsString() @MaxLength(1000) comment?:string;}
@ApiTags('Member - Order tracking') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard) @Controller('member/order-hub')
export class OrderHubController{
 constructor(private readonly service:OrderHubService){}
 @Get() list(@Req() req:any,@Query() query:HubQuery){return this.service.list(req.user.personId,query).then(data=>({data}));}
 @Post(':orderNo/review') @UseGuards(IdempotencyGuard) review(@Req() req:any,@Param() params:OrderReference,@Body() body:ReviewInput,@Headers('idempotency-key') key:string){return this.service.review(req.user.personId,params.orderNo,body,key,req.requestId).then(data=>({data}));}
}
