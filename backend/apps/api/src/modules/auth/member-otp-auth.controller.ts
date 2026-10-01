import { Body,Controller,Headers,Post,UseGuards } from '@nestjs/common';
import { ApiHeader,ApiOperation,ApiProperty,ApiTags } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { MemberOtpAuthService } from './member-otp-auth.service';

class MemberOtpChallengeDto{ @ApiProperty({example:'+886912345678'}) @Matches(/^\+[1-9][0-9]{7,14}$/) mobile!:string; }
class MemberOtpVerifyDto{ @ApiProperty({format:'uuid'}) @Matches(/^[0-9a-fA-F-]{36}$/) challengeId!:string; @ApiProperty({pattern:'^[0-9]{6}$'}) @Matches(/^\d{6}$/) code!:string; }

@ApiTags('Member - Web Authentication') @Controller('auth/member/otp')
export class MemberOtpAuthController{
 constructor(private readonly service:MemberOtpAuthService){}

 @Post('challenges') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'memberOtpLoginChallenge',description:'Create a mobile OTP login challenge without disclosing whether the mobile belongs to an eligible Member.'})
 create(@Body() body:MemberOtpChallengeDto,@Headers('idempotency-key') key:string){return this.service.createLoginChallenge(body.mobile,key);}

 @Post('login')
 @ApiOperation({operationId:'memberOtpLogin',description:'Consume a verified single-use LOGIN OTP challenge and issue the standard opaque Member session.'})
 login(@Body() body:MemberOtpVerifyDto){return this.service.verifyLogin(body.challengeId,body.code);}
}
