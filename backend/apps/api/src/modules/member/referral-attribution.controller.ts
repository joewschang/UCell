import {Body,Controller,Post} from '@nestjs/common';
import {ApiOperation,ApiProperty,ApiResponse,ApiTags} from '@nestjs/swagger';
import {IsOptional,IsString,IsUUID,MaxLength,MinLength} from 'class-validator';
import {ReferralAttributionService} from './referral-attribution.service';

export class ReferralLandingDto {
 @ApiProperty({description:'Opaque encrypted token from a server-issued referral URL',maxLength:4096}) @IsString() @MinLength(1) @MaxLength(4096) token!:string;
 @ApiProperty({required:false,format:'uuid',description:'Anonymous browser identifier returned by the first landing; server generates it when absent.'}) @IsOptional() @IsUUID() anonymousId?:string;
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
