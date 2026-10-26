import {Body,Controller,Get,Headers,Post,Query,Req,UseGuards} from '@nestjs/common';
import {IsIn,IsInt,IsOptional,IsString,IsUUID,Length,Matches,Max,Min} from 'class-validator';
import {Type} from 'class-transformer';
import {randomUUID} from 'node:crypto';
import {Roles} from '../auth/roles.decorator';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {MarketingService,marketingSegments} from './marketing.service';
class Filter{@IsOptional() @IsString() @Length(0,50) search?:string;@IsOptional() @IsIn(marketingSegments) segment?:string;@IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100000) page?:number;}
class Scope{@IsUUID() qualificationId!:string;}
class Encouragement extends Scope{@Matches(/^\d{10}$/) memberNo!:string;@IsString() @Length(1,600) body!:string;}
@Controller('admin/marketing') @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS','COMPLIANCE_AUDIT')
export class AdminMarketingController{
 constructor(private service:MarketingService){}
 @Get() read(@Query() input:Filter){return this.service.read(input);}
 @Post('encouragements') @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS') @UseGuards(IdempotencyGuard)
 encourage(@Body() input:Encouragement,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.encourage(input,req.user.personId??req.user.subject,key,req.requestId??randomUUID());}
}
@Controller('member/sharing-progress') @UseGuards(MemberAuthenticationGuard)
export class MemberMarketingController{
 constructor(private service:MarketingService){}
 @Get() read(@Req() req:any,@Query() input:Scope){return this.service.personal(req.user.personId,input.qualificationId);}
}
