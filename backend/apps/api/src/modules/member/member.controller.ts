import { Body, Controller, Get, Post, Patch, Req, UseGuards, Query, Param, ParseUUIDPipe, UnprocessableEntityException } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateOrderDto } from '../order/dto/create-order.dto';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { IsString, IsUUID, IsEmail, MaxLength, MinLength, IsOptional, Matches, ValidateIf } from 'class-validator';
import { MemberReadService } from './member-read.service';
import { MemberContextGuard } from './member-context.guard';
import { MemberAuthenticationGuard } from '../auth/member-authentication.guard';
import { MemberService } from './member.service';
export class LineExchangeDto {
 @ApiProperty({description:'LINE ID token; verified server-side, never logged or persisted raw'}) @IsString() @MinLength(1) @MaxLength(16384) idToken!:string;
}
export class MemberContextDto {
 @ApiProperty({format:'uuid',description:'Selected Qualification; server checks authenticated Person ownership on every request'}) @IsUUID() qualificationId!:string;
}
export class MemberProfileDto {
 @ApiProperty({required:false,maxLength:80,description:'Display name only; legal identity is immutable through Member API'}) @ValidateIf((_o,v)=>v!==undefined) @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(80) name?:string;
 @ApiProperty({required:false,format:'email',maxLength:254}) @ValidateIf((_o,v)=>v!==undefined) @IsEmail() @MaxLength(254) email?:string;
 @ApiProperty({required:false,maxLength:32,description:'Contact data only; does not bind or authenticate an identity'}) @ValidateIf((_o,v)=>v!==undefined) @Matches(/^(?=.*[0-9])\+?[0-9 ()-]{6,32}$/) phone?:string;
}
export class MemberQueryDto extends MemberContextDto {
 @ApiProperty({required:false,pattern:'^\\d{4}-(0[1-9]|1[0-2])$',description:'Posted-event month filter using versioned accounting timezone; not an operational settlement cut-off'}) @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) period?:string;
}
@ApiTags('Member - Authentication')
@Controller('auth/member')
export class MemberAuthController {
 constructor(private readonly service:MemberService){}
 @Post('line/exchange') @ApiOperation({operationId:'memberLineExchange'})
 @ApiResponse({status:401,description:'Invalid/expired token, unbound identity or disabled Person'})
 @ApiResponse({status:409,description:'LINE_TOKEN_REPLAYED'}) @ApiResponse({status:503,description:'LINE configuration/provider unavailable; fail closed'})
 exchange(@Body() body:LineExchangeDto){return this.service.exchange(body.idToken);}
}
@ApiTags('Member') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard,MemberContextGuard)
@ApiResponse({status:401,description:'Member LINE session required, expired/disabled sessions denied'})
@ApiResponse({status:403,description:'Qualification not owned'}) @ApiResponse({status:404,description:'Resource unavailable'})
@ApiResponse({status:409,description:'Conflicting operation'}) @ApiResponse({status:422,description:'Invalid input or pending domain decision'})
@Controller('member')
export class MemberController {
 constructor(private readonly service:MemberService,private readonly reads:MemberReadService){}
 @Get('me') @ApiOperation({operationId:'memberMe'}) me(@Req() req:any){return this.service.me(req.user.personId);}
 @Patch('profile') @ApiOperation({operationId:'memberUpdateProfile',description:'Own display/contact fields only. No legal identity, status, qualification or monetary mutation. Audited transaction.'}) profile(@Req() req:any,@Body() body:MemberProfileDto){if(!Object.values(body).some(v=>typeof v==='string'&&v.trim()))throw new UnprocessableEntityException({code:'PROFILE_FIELDS_REQUIRED'});return this.service.profile(req.user.personId,body,req.requestId);}
 @Get('notifications') @ApiOperation({operationId:'memberNotifications',description:'Person-addressed notices plus selected owned Qualification notices, newest first, bounded 100. No LINE push or server read-state mutation.'}) notifications(@Req() req:any,@Query() q:MemberContextDto){return this.service.notifications(req.user.personId,q.qualificationId);}
 @Get('qualifications') @ApiOperation({operationId:'memberQualifications',description:'Owned temporal holder evidence only; empty array for Person without Qualification. Ordered by immutable qualification number.'}) qualifications(@Req() req:any){return this.service.qualifications(req.user.personId);}
 @Post('context/qualification') @ApiOperation({operationId:'memberQualificationContext',description:'Validate selected ball; all scoped reads must repeat server ownership authorization. No monetary mutation.'}) context(@Req() req:any,@Body() body:MemberContextDto){return this.service.context(req.user.personId,body.qualificationId);}
 @Get('dashboard') dashboard(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'dashboard',q.period);}
 @Get('organization/sponsor') sponsor(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'sponsor',q.period);}
 @Get('organization/binary') binary(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'binary',q.period);}
 @Get('referrals') referrals(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'referrals',q.period);}
 @Get('performance') performance(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'performance',q.period);}
 @Get('bonuses') bonuses(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'bonuses',q.period);}
 @Get('bonuses/ledger') ledger(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'ledger',q.period);}
 @Get('repurchase/status') repurchase(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'repurchase',q.period);}
 @Get('products') products(){return this.reads.products();}
 @Get('orders') orders(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'orders',q.period);}
 @Post('orders') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberCreateOrder',description:'Authenticated ownership and input validation; currently fail closed PENDING_DECISION until formal product/PV-BV mapping and checkout configuration are approved. Never accepts client monetary results.'})
 createOrder(@Body() _body:CreateOrderDto){throw new UnprocessableEntityException({code:'PENDING_DECISION',message:'Member checkout is not enabled: formal PV/BV mapping and checkout configuration required.'});}
 @Get('orders/:id') order(@Req() req:any,@Query() q:MemberQueryDto,@Param('id',new ParseUUIDPipe()) id:string){return this.reads.order(req.user.personId,q.qualificationId,id);}
}
