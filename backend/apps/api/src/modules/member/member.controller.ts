import { Body, Controller, Get, Post, Patch, Headers, Req, UseGuards, Query, Param, ParseUUIDPipe, UnprocessableEntityException } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiHeader, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateOrderItemDto } from '../order/dto/create-order.dto';
import { OrderService } from '../order/order.service';
import { Type } from 'class-transformer';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { IsString, IsUUID, IsEmail, MaxLength, MinLength, IsOptional, Matches, ValidateIf, IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested } from 'class-validator';
import { MemberReadService } from './member-read.service';
import * as views from './member-view.dto';
import { MemberContextGuard } from './member-context.guard';
import { MemberAuthenticationGuard } from '../auth/member-authentication.guard';
import { MemberService } from './member.service';
export class LineExchangeDto {
 @ApiProperty({description:'LINE ID token; verified server-side, never logged or persisted raw'}) @IsString() @MinLength(1) @MaxLength(16384) idToken!:string;
}
export class MemberContextDto {
 @ApiProperty({format:'uuid',description:'Selected Qualification; server checks authenticated Person ownership on every request'}) @IsUUID() qualificationId!:string;
}
export class MemberLogoutDto { @ApiProperty({required:false,description:'Optional fixed intent marker; no Person, session or Qualification identifiers accepted.'}) @IsOptional() @Matches(/^LOGOUT$/) intent?:string; }
export class MemberProfileDto {
 @ApiProperty({required:false,maxLength:80,description:'Display name only; legal identity is immutable through Member API'}) @ValidateIf((_o,v)=>v!==undefined) @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(80) name?:string;
 @ApiProperty({required:false,format:'email',maxLength:254}) @ValidateIf((_o,v)=>v!==undefined) @IsEmail() @MaxLength(254) email?:string;
 @ApiProperty({required:false,maxLength:32,description:'Contact data only; does not bind or authenticate an identity'}) @ValidateIf((_o,v)=>v!==undefined) @Matches(/^(?=.*[0-9])\+?[0-9 ()-]{6,32}$/) phone?:string;
}
export class MemberCreateOrderDto extends MemberContextDto {
 @ApiProperty({type:[CreateOrderItemDto],description:'Product IDs and quantities only; Core determines price/rule snapshots. RETAIL purpose only.'}) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>CreateOrderItemDto) items!:CreateOrderItemDto[];
}
export class MemberQueryDto extends MemberContextDto {
 @ApiProperty({required:false,pattern:'^\\d{4}-(0[1-9]|1[0-2])$',description:'Posted-event month filter using versioned accounting timezone; not an operational settlement cut-off'}) @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) period?:string;
}
@ApiExtraModels(...views.memberViewModels) @ApiTags('Member - Authentication')
@Controller('auth/member')
export class MemberAuthController {
 constructor(private readonly service:MemberService){}
 @Post('line/exchange') @ApiResponse({status:201,schema:views.memberEnvelope(views.LineSessionView)}) @ApiOperation({operationId:'memberLineExchange'})
 @ApiResponse({status:401,description:'Invalid/expired token, unbound identity or disabled Person'})
 @ApiResponse({status:409,description:'LINE_TOKEN_REPLAYED'}) @ApiResponse({status:503,description:'LINE configuration/provider unavailable; fail closed'})
 exchange(@Body() body:LineExchangeDto){return this.service.exchange(body.idToken);}
}
@ApiExtraModels(...views.memberViewModels) @ApiTags('Member') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard,MemberContextGuard)
@ApiResponse({status:400,description:'Validation failure; unknown identity/qualification/monetary fields rejected'})
@ApiResponse({status:401,description:'Member LINE session required, expired/disabled sessions denied'})
@ApiResponse({status:403,description:'Qualification not owned'}) @ApiResponse({status:404,description:'Resource unavailable'})
@ApiResponse({status:409,description:'Conflicting operation'}) @ApiResponse({status:422,description:'Invalid input or pending domain decision'})
@Controller('member')
export class MemberController {
 constructor(private readonly service:MemberService,private readonly reads:MemberReadService,private readonly orderService:OrderService){}
 @Get('me') @ApiResponse({status:200,schema:views.memberEnvelope(views.PersonView)}) @ApiOperation({operationId:'memberMe'}) me(@Req() req:any){return this.service.me(req.user.personId);}
 @Post('logout') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiResponse({status:201,schema:views.memberEnvelope(views.LogoutView)}) @ApiOperation({operationId:'memberLogout',description:'Revoke only the authenticated UCell LINE session, with transactional audit. Does not log out LINE. Repeated delivery after revocation returns 401; other sessions are unaffected.'}) logout(@Req() req:any,@Headers('idempotency-key') key:string,@Body() _body:MemberLogoutDto){return this.service.logout(req.user.personId,req.user.sessionId,key,req.requestId);}
 @Patch('profile') @ApiResponse({status:200,schema:views.memberEnvelope(views.PersonView)}) @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberUpdateProfile',description:'Own display/contact fields only. No legal identity, status, qualification or monetary mutation. Audited idempotent transaction.'}) profile(@Req() req:any,@Body() body:MemberProfileDto,@Headers('idempotency-key') key:string){if(!Object.values(body).some(v=>typeof v==='string'&&v.trim()))throw new UnprocessableEntityException({code:'PROFILE_FIELDS_REQUIRED'});return this.service.profile(req.user.personId,body,req.requestId,key);}
 @Get('notifications') @ApiResponse({status:200,schema:views.memberEnvelope(views.NoticesView)}) @ApiOperation({operationId:'memberNotifications',description:'Person-addressed notices plus selected owned Qualification notices, newest first, bounded 100. No LINE push or server read-state mutation.'}) notifications(@Req() req:any,@Query() q:MemberContextDto){return this.service.notifications(req.user.personId,q.qualificationId);}
 @Patch('notifications/:id/read') @ApiResponse({status:200,schema:views.memberEnvelope(views.NoticeReadView)}) @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberReadNotification',description:'Append first Person read evidence; retry and repeated reads preserve original readAt. Owned Qualification audience required. No LINE push.'}) markRead(@Req() req:any,@Body() body:MemberContextDto,@Param('id',new ParseUUIDPipe()) id:string,@Headers('idempotency-key') key:string){return this.service.markNotificationRead(req.user.personId,body.qualificationId,id,key,req.requestId);}
 @Get('qualifications') @ApiResponse({status:200,schema:views.memberEnvelope(views.QualificationView,true)}) @ApiOperation({operationId:'memberQualifications',description:'Owned temporal holder evidence only; empty array for Person without Qualification. Ordered by immutable qualification number.'}) qualifications(@Req() req:any){return this.service.qualifications(req.user.personId);}
 @Post('context/qualification') @ApiResponse({status:201,schema:views.memberEnvelope(views.ContextView)}) @ApiOperation({operationId:'memberQualificationContext',description:'Validate selected ball; all scoped reads must repeat server ownership authorization. No monetary mutation.'}) context(@Req() req:any,@Body() body:MemberContextDto){return this.service.context(req.user.personId,body.qualificationId);}
 @Get('dashboard') @ApiResponse({status:200,schema:views.memberEnvelope(views.DashboardView)}) dashboard(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'dashboard',q.period);}
 @Get('organization/sponsor') @ApiResponse({status:200,schema:views.memberEnvelope(views.SponsorView)}) sponsor(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'sponsor',q.period);}
 @Get('organization/binary') @ApiResponse({status:200,schema:views.memberEnvelope(views.BinaryView)}) binary(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'binary',q.period);}
 @Get('referrals') @ApiResponse({status:200,schema:views.memberEnvelope(views.SponsorView)}) referrals(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'referrals',q.period);}
 @Get('performance') @ApiResponse({status:200,schema:views.memberEnvelope(views.PerformanceView)}) performance(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'performance',q.period);}
 @Get('bonuses') @ApiResponse({status:200,schema:views.memberEnvelope(views.BonusesView)}) bonuses(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'bonuses',q.period);}
 @Get('bonuses/ledger') @ApiResponse({status:200,schema:views.memberEnvelope(views.LedgerView)}) ledger(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'ledger',q.period);}
 @Get('repurchase/status') @ApiResponse({status:200,schema:views.memberEnvelope(views.RepurchaseView)}) repurchase(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'repurchase',q.period);}
 @Get('products') @ApiResponse({status:200,schema:views.memberEnvelope(views.ProductView,true)}) products(){return this.reads.products();}
 @Get('orders') @ApiResponse({status:200,schema:views.memberEnvelope(views.OrdersView)}) orders(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'orders',q.period);}
 @Post('orders') @ApiResponse({status:201,schema:views.memberEnvelope(views.OrderView)}) @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberCreateOrder',description:'Core-authoritative RETAIL order, pending payment/fulfillment; no PV/BV recognition. Missing/overlapping product profile fails closed 422. Retry conflicts with identical key/body. Reject client monetary results.'})
 async createOrder(@Req() req:any,@Body() body:MemberCreateOrderDto,@Headers('idempotency-key') key:string){const result=await this.orderService.createMember(body,key,req.requestId,req.user.personId),order=result.value;return {qualificationId:order.qualificationId,id:order.orderId,status:order.status,total:order.netAmount.toString(),paymentStatus:'PENDING',shipmentStatus:'FULFILLMENT_PENDING',createdAt:new Date(order.createdAt).toISOString(),replayed:result.replayed,lines:order.lines.map(line=>({productId:line.productId,name:line.productNameSnapshot,quantity:line.quantity.toString(),unitPrice:line.unitPrice.toString(),amount:line.lineAmount.toString(),pv:null}))};}
 @Get('orders/:id') @ApiResponse({status:200,schema:views.memberEnvelope(views.OrderView)}) order(@Req() req:any,@Query() q:MemberQueryDto,@Param('id',new ParseUUIDPipe()) id:string){return this.reads.order(req.user.personId,q.qualificationId,id);}
}
