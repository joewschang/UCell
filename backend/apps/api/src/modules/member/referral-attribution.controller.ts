import {Body,Controller,Headers,Post,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiOperation,ApiProperty,ApiResponse,ApiTags} from '@nestjs/swagger';
import {IsOptional,IsString,IsUUID,MaxLength,MinLength} from 'class-validator';
import {ReferralAttributionService} from './referral-attribution.service';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';

export class ReferralLandingDto {
 @ApiProperty({description:'Opaque encrypted token from a server-issued referral URL',maxLength:4096}) @IsString() @MinLength(1) @MaxLength(4096) token!:string;
 @ApiProperty({required:false,format:'uuid',description:'Anonymous browser identifier returned by the first landing; server generates it when absent.'}) @IsOptional() @IsUUID() anonymousId?:string;
}
export class ReferralBindingDto {
 @ApiProperty({description:'Opaque server-signed transition state returned by referral landing',maxLength:4096}) @IsString() @MinLength(1) @MaxLength(4096) transitionState!:string;
}

@ApiTags('Referral - Public')
@Controller('referrals')
export class ReferralAttributionController {
 constructor(private readonly service:ReferralAttributionService){}
 @Post('landing')
 @ApiOperation({operationId:'referralLanding',description:'Record provisional referral attribution using server time. A 30-day lock does not create or rewrite a Sponsor relationship.'})
 @ApiResponse({status:201,description:'Attribution recorded, retained, or replaced according to the approved 30-day policy.'})
 @ApiResponse({status:409,description:'Concurrent update; retry the same landing.'})
 @ApiResponse({status:503,description:'Invalid, expired, unpersisted, or misconfigured share token; fail closed.'})
 land(@Body() body:ReferralLandingDto){return this.service.land(body.token,body.anonymousId);}
}

@ApiTags('Member - Referral') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard)
@Controller('member/referrals')
export class MemberReferralAttributionController {
 constructor(private readonly service:ReferralAttributionService){}
 @Post('bind') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'memberBindReferralAttribution',description:'Explicitly bind an eligible anonymous attribution to the authenticated LINE Person. Never creates or rewrites Sponsor.'})
 @ApiResponse({status:201,description:'Bound or idempotently already bound to the authenticated Person.'})
 @ApiResponse({status:409,description:'Stale attribution, different Person, existing active Person attribution, or retryable concurrency conflict.'})
 bind(@Req() req:any,@Body() body:ReferralBindingDto,@Headers('idempotency-key') key:string){return this.service.bind(req.user.personId,body.transitionState,key,req.requestId);}
}
