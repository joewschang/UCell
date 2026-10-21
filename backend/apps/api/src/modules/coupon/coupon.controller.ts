import {Body,Controller,Get,Post,Param,ParseUUIDPipe,Query,Headers,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiTags} from '@nestjs/swagger';
import {ArrayNotEmpty,ArrayMaxSize,IsArray,IsBoolean,IsIn,IsInt,IsISO8601,IsOptional,IsString,IsUUID,Matches,Max,MaxLength,Min,MinLength} from 'class-validator';
import {Roles} from '../auth/roles.decorator';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {CouponService} from './coupon.service';
class CouponDto{
 @Matches(/^[A-Z0-9_-]{3,40}$/) code!:string;
 @IsString() @MinLength(1) @MaxLength(120) name!:string;
 @IsArray() @ArrayNotEmpty() @ArrayMaxSize(3) @IsIn(['STARTER','ELITE','LEADER'],{each:true}) packageCodes!:string[];
 @IsISO8601() startsAt!:string; @IsISO8601() endsAt!:string;
 @IsInt() @Min(0) @Max(100000000) maxUses!:number;
 @IsInt() @Min(0) @Max(100000000) perPersonLimit!:number;
 @IsBoolean() enabled!:boolean;
 @IsOptional() @IsInt() @Min(1) revision?:number;
}
class QuoteDto{@IsUUID() packageVersionId!:string; @IsOptional() @IsString() @MaxLength(40) couponCode?:string;}
class FeeRefundDto{@IsString() @MinLength(1) @MaxLength(200) referenceNo!:string; @IsISO8601() occurredAt!:string; @IsString() @MinLength(1) @MaxLength(500) reason!:string;}
@ApiTags('Admin - Qualification fee') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','FINANCE') @Controller('admin/qualification-fees')
export class AdminQualificationFeeController{constructor(private readonly s:CouponService){} @Post(':id/refund-confirmations') @UseGuards(IdempotencyGuard) refund(@Param('id',new ParseUUIDPipe()) id:string,@Body() b:FeeRefundDto,@Headers('idempotency-key') k:string,@Req() r:any){return this.s.recordFeeRefund(id,b,k,r.requestId,r.user.personId);}}
@ApiTags('Admin - Coupons') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT') @Controller('admin/coupons')
export class AdminCouponController{
 constructor(private readonly s:CouponService){}
 @Get() list(){return this.s.list();}
 @Get(':id/usage') usage(@Param('id',new ParseUUIDPipe()) id:string,@Query('page') page?:string){return this.s.usage(id,Number(page)||1);}
 @Post() @Roles('SUPER_ADMIN','ORDER_OPS') @UseGuards(IdempotencyGuard) create(@Body() b:CouponDto,@Headers('idempotency-key') k:string,@Req() r:any){return this.s.save(undefined,b,k,r.requestId,r.user?.personId??r.user?.subject);}
 @Post(':id') @Roles('SUPER_ADMIN','ORDER_OPS') @UseGuards(IdempotencyGuard) update(@Param('id',new ParseUUIDPipe()) id:string,@Body() b:CouponDto,@Headers('idempotency-key') k:string,@Req() r:any){return this.s.save(id,b,k,r.requestId,r.user?.personId??r.user?.subject);}
}
@ApiTags('Member - Coupons') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard) @Controller('member/package-quote')
export class MemberCouponController{constructor(private readonly s:CouponService){} @Post() quote(@Body() b:QuoteDto,@Req() r:any){return this.s.quote(r.user.personId,b.packageVersionId,b.couponCode);}}
