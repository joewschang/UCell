import { Body, Controller, Get, Post, Req, UseGuards, Query, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength, MinLength, IsOptional, Matches } from 'class-validator';
import { MemberReadService } from './member-read.service';
import { MemberAuthenticationGuard } from '../auth/member-authentication.guard';
import { MemberService } from './member.service';
export class LineExchangeDto {
 @ApiProperty({description:'LINE ID token; verified server-side, never logged or persisted raw'}) @IsString() @MinLength(1) @MaxLength(16384) idToken!:string;
}
export class MemberContextDto {
 @ApiProperty({format:'uuid',description:'Selected Qualification; server checks authenticated Person ownership on every request'}) @IsUUID() qualificationId!:string;
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
@ApiTags('Member') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard)
@ApiResponse({status:401,description:'Member LINE session required, expired/disabled sessions denied'})
@ApiResponse({status:403,description:'Qualification not owned'}) @ApiResponse({status:404,description:'Resource unavailable'})
@ApiResponse({status:409,description:'Conflicting operation'}) @ApiResponse({status:422,description:'Invalid input or pending domain decision'})
@Controller('member')
export class MemberController {
 constructor(private readonly service:MemberService,private readonly reads:MemberReadService){}
 @Get('me') @ApiOperation({operationId:'memberMe'}) me(@Req() req:any){return this.service.me(req.user.personId);}
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
 @Get('orders/:id') order(@Req() req:any,@Query() q:MemberQueryDto,@Param('id',new ParseUUIDPipe()) id:string){return this.reads.order(req.user.personId,q.qualificationId,id);}
}
