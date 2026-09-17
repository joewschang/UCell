import { Body, Controller, Get, Post, Patch, Headers, Req, UseGuards, Query, Param, ParseUUIDPipe, UnprocessableEntityException } from '@nestjs/common';
import { ApiBearerAuth, ApiExtraModels, ApiHeader, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { CreateOrderItemDto } from '../order/dto/create-order.dto';
import { OrderService } from '../order/order.service';
import { Type } from 'class-transformer';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { IsString, IsUUID, IsEmail, IsDateString, MaxLength, MinLength, Min, Max, IsInt, IsOptional, Matches, ValidateIf, IsArray, ArrayMinSize, ArrayMaxSize, ValidateNested, IsBoolean, IsIn, Equals } from 'class-validator';
import { MemberReadService } from './member-read.service';
import * as views from './member-view.dto';
import { MemberContextGuard } from './member-context.guard';
import { MemberAuthenticationGuard } from '../auth/member-authentication.guard';
import { MemberService } from './member.service';
import { MemberShareLinkService } from './member-share-link.service';
import { MemberContractService } from './member-contract.service';
import { DeliveryProfileService } from './delivery-profile.service';
import { FormalMemberApplicationService,FormalDraftInput } from './formal-member-application.service';
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
export class MemberPackageSelectionDto {
 @ApiProperty({format:'uuid'}) @IsUUID() productRuleProfileId!:string;
 @ApiProperty({minimum:1,maximum:10000}) @Type(()=>Number) @IsInt() @Min(1) @Max(10000) quantity!:number;
}
export class MemberCreateOrderDto {
 @ApiProperty({required:false,format:'uuid',description:'Required for retail orders; for active packages this must match targetQualificationId.'}) @IsOptional() @IsUUID() qualificationId?:string;
 @ApiProperty({required:false,format:'uuid',description:'Published package version. When supplied, items are rejected and immutable package snapshots are created.'}) @IsOptional() @IsUUID() packageVersionId?:string;
 @ApiProperty({required:false,format:'uuid'}) @IsOptional() @IsUUID() targetQualificationId?:string;
 @ApiProperty({required:false,type:[CreateOrderItemDto],description:'Retail product IDs and quantities. Mutually exclusive with packageVersionId.'}) @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>CreateOrderItemDto) items?:CreateOrderItemDto[];
 @ApiProperty({required:false,type:[MemberPackageSelectionDto],description:'Exact package selection by versioned product rule profile.'}) @IsOptional() @IsArray() @ArrayMinSize(1) @ArrayMaxSize(200) @ValidateNested({each:true}) @Type(()=>MemberPackageSelectionDto) selections?:MemberPackageSelectionDto[];
}
export class MemberContractConsentDto {
 @ApiProperty({enum:[true],description:'Explicit acceptance is required; false is never recorded as consent.'}) @IsBoolean() @Equals(true) accepted!:true;
 @ApiProperty({enum:['MEMBER_WEB','LIFF']}) @IsIn(['MEMBER_WEB','LIFF']) channel!:'MEMBER_WEB'|'LIFF';
}
export class DeliveryProfileDto {
 @ApiProperty({maxLength:80}) @IsString() @Matches(/\S/) @MinLength(1) @MaxLength(80) recipientName!:string;
 @ApiProperty({maxLength:32}) @Matches(/^(?=.*[0-9])\+?[0-9 ()-]{6,32}$/) phone!:string;
 @ApiProperty({example:'TW'}) @Matches(/^[A-Z]{2}$/) countryCode!:string;
 @ApiProperty({required:false,maxLength:16}) @IsOptional() @IsString() @MaxLength(16) postalCode?:string;
 @ApiProperty({maxLength:80}) @IsString() @Matches(/\S/) @MaxLength(80) region!:string;
 @ApiProperty({maxLength:80}) @IsString() @Matches(/\S/) @MaxLength(80) city!:string;
 @ApiProperty({maxLength:300}) @IsString() @Matches(/\S/) @MinLength(5) @MaxLength(300) address!:string;
}
export class FormalMemberDraftDto implements FormalDraftInput {
 @ApiProperty({format:'uuid'}) @IsUUID() formalContractVersionId!:string;
 @ApiProperty({maxLength:120}) @IsString() @Matches(/\S/) @MaxLength(120) legalName!:string;
 @ApiProperty({maxLength:32}) @IsString() @Matches(/\S/) @MaxLength(32) gender!:string;
 @ApiProperty({format:'date'}) @IsDateString() birthDate!:string;
 @ApiProperty({maxLength:32}) @IsString() @Matches(/\S/) @MaxLength(32) nationalId!:string;
 @ApiProperty({maxLength:500}) @IsString() @Matches(/\S/) @MaxLength(500) communicationAddress!:string;
 @ApiProperty({maxLength:32}) @Matches(/^(?=.*[0-9])\+?[0-9 ()-]{6,32}$/) phone!:string;
 @ApiProperty({format:'email',maxLength:254}) @IsEmail() @MaxLength(254) email!:string;
 @ApiProperty({maxLength:16}) @Matches(/^[A-Za-z0-9-]{2,16}$/) bankCode!:string;
 @ApiProperty({maxLength:34}) @Matches(/^[A-Za-z0-9 -]{4,34}$/) bankAccount!:string;
 @ApiProperty({maxLength:120}) @IsString() @Matches(/\S/) @MaxLength(120) accountHolder!:string;
}
export class MemberQueryDto extends MemberContextDto {
 @ApiProperty({required:false,pattern:'^\\d{4}-(0[1-9]|1[0-2])$',description:'Posted-event month filter using versioned accounting timezone; not an operational settlement cut-off'}) @IsOptional() @Matches(/^\d{4}-(0[1-9]|1[0-2])$/) period?:string;
 @ApiProperty({required:false,format:'uuid',description:'Immutable finalized BINARY_K1 settlement scope. Required before historical volume/carry can be disclosed; omission keeps those values unavailable.'}) @IsOptional() @IsUUID() settlementBatchId?:string;
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
 constructor(private readonly service:MemberService,private readonly reads:MemberReadService,private readonly orderService:OrderService,private readonly shareLinks:MemberShareLinkService,private readonly contracts:MemberContractService,private readonly delivery:DeliveryProfileService,private readonly formalApplications:FormalMemberApplicationService){}
 @Get('me') @ApiResponse({status:200,schema:views.memberEnvelope(views.PersonView)}) @ApiOperation({operationId:'memberMe'}) me(@Req() req:any){return this.service.me(req.user.personId);}
 @Get('contracts/required') @ApiOperation({operationId:'memberRequiredContracts',description:'Return currently effective required Network Member contract versions and immutable consent status.'}) requiredContracts(@Req() req:any){return this.contracts.required(req.user.personId);}
 @Get('contracts/formal-required') @ApiOperation({operationId:'memberFormalRequiredContracts',description:'Effective Formal Member contracts and own immutable consent status.'}) formalRequiredContracts(@Req() req:any){return this.contracts.formalRequired(req.user.personId);}
 @Post('contracts/:versionId/consent') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberConsentContract',description:'Append immutable consent evidence bound to the displayed content hash. Duplicate delivery is idempotent.'}) consentContract(@Req() req:any,@Param('versionId',new ParseUUIDPipe()) versionId:string,@Body() body:MemberContractConsentDto,@Headers('idempotency-key') key:string){return this.contracts.consent(req.user.personId,versionId,body,key,req.requestId);}
 @Post('logout') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiResponse({status:201,schema:views.memberEnvelope(views.LogoutView)}) @ApiOperation({operationId:'memberLogout',description:'Revoke only the authenticated UCell LINE session, with transactional audit. Does not log out LINE. Repeated delivery after revocation returns 401; other sessions are unaffected.'}) logout(@Req() req:any,@Headers('idempotency-key') key:string,@Body() _body:MemberLogoutDto){return this.service.logout(req.user.personId,req.user.sessionId,key,req.requestId);}
 @Patch('profile') @ApiResponse({status:200,schema:views.memberEnvelope(views.PersonView)}) @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberUpdateProfile',description:'Own display/contact fields only. No legal identity, status, qualification or monetary mutation. Audited idempotent transaction.'}) profile(@Req() req:any,@Body() body:MemberProfileDto,@Headers('idempotency-key') key:string){if(!Object.values(body).some(v=>typeof v==='string'&&v.trim()))throw new UnprocessableEntityException({code:'PROFILE_FIELDS_REQUIRED'});return this.service.profile(req.user.personId,body,req.requestId,key);}
 @Get('delivery-profile') @ApiOperation({operationId:'memberDeliveryProfile',description:'Reads only the authenticated Person current encrypted delivery profile. No Qualification context required.'}) deliveryProfile(@Req() req:any){return this.delivery.get(req.user.personId);}
 @Patch('delivery-profile') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberUpdateDeliveryProfile',description:'Creates a new encrypted delivery-profile version and closes the prior version. Audit/outbox contain no address or phone.'}) updateDeliveryProfile(@Req() req:any,@Body() body:DeliveryProfileDto,@Headers('idempotency-key') key:string){return this.delivery.update(req.user.personId,body,key,req.requestId);}
 @Get('formal-applications/current') @ApiOperation({operationId:'memberCurrentFormalApplication',description:'Own current Formal Member application with masked national ID and bank account.'}) currentFormalApplication(@Req() req:any){return this.formalApplications.current(req.user.personId);}
 @Post('formal-applications') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberSaveFormalApplicationDraft',description:'Encrypt and append a Formal Member application draft snapshot. Does not submit, approve, create Qualification, or change membership state.'}) saveFormalApplication(@Req() req:any,@Body() body:FormalMemberDraftDto,@Headers('idempotency-key') key:string){return this.formalApplications.save(req.user.personId,body,key,req.requestId);}
 @Get('notifications') @ApiResponse({status:200,schema:views.memberEnvelope(views.NoticesView)}) @ApiOperation({operationId:'memberNotifications',description:'Person-addressed notices plus selected owned Qualification notices, newest first, bounded 100. No LINE push or server read-state mutation.'}) notifications(@Req() req:any,@Query() q:MemberContextDto){return this.service.notifications(req.user.personId,q.qualificationId);}
 @Patch('notifications/:id/read') @ApiResponse({status:200,schema:views.memberEnvelope(views.NoticeReadView)}) @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberReadNotification',description:'Append first Person read evidence; retry and repeated reads preserve original readAt. Owned Qualification audience required. No LINE push.'}) markRead(@Req() req:any,@Body() body:MemberContextDto,@Param('id',new ParseUUIDPipe()) id:string,@Headers('idempotency-key') key:string){return this.service.markNotificationRead(req.user.personId,body.qualificationId,id,key,req.requestId);}
 @Get('qualifications') @ApiResponse({status:200,schema:views.memberEnvelope(views.QualificationView,true)}) @ApiOperation({operationId:'memberQualifications',description:'Owned temporal holder evidence only; empty array for Person without Qualification. Ordered by immutable qualification number.'}) qualifications(@Req() req:any){return this.service.qualifications(req.user.personId);}
 @Post('context/qualification') @ApiResponse({status:201,schema:views.memberEnvelope(views.ContextView)}) @ApiOperation({operationId:'memberQualificationContext',description:'Validate selected ball; all scoped reads must repeat server ownership authorization. No monetary mutation.'}) context(@Req() req:any,@Body() body:MemberContextDto){return this.service.context(req.user.personId,body.qualificationId);}
 @Get('dashboard') @ApiResponse({status:200,schema:views.memberEnvelope(views.DashboardView)}) dashboard(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'dashboard',q.period);}
 @Get('organization/sponsor') @ApiResponse({status:200,schema:views.memberEnvelope(views.SponsorView)}) sponsor(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'sponsor',q.period);}
 @Get('organization/binary') @ApiResponse({status:200,schema:views.memberEnvelope(views.BinaryView)}) @ApiOperation({operationId:'memberBinaryOrganization',description:'Current placement counts remain separate from immutable settlement metrics. Historical left/right GPV and carry are returned only for an explicitly selected finalized BINARY_K1 settlementBatchId and its sealed historical snapshot.'}) binary(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'binary',q.period,q.settlementBatchId);}
 @Get('referrals') @ApiResponse({status:200,schema:views.memberEnvelope(views.SponsorView)}) referrals(@Req() req:any,@Query() q:MemberQueryDto){return this.reads.read(req.user.personId,q.qualificationId,'referrals',q.period);}
 @Post('share-links') @ApiOperation({operationId:'memberCreateShareLink',description:'Create an encrypted referral URL bound to the selected owned Qualification. Server configuration supplies base URL, key and TTL; missing configuration fails closed.'}) createShareLink(@Req() req:any,@Body() body:MemberContextDto){return this.shareLinks.create(req.user.personId,body.qualificationId);}
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
