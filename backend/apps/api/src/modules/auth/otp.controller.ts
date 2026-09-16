import { Body, Controller, Headers, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Equals, IsUUID, Matches } from 'class-validator';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { OtpService } from './otp.service';

class CreateOtpChallengeDto {
 @ApiProperty({enum:['NETWORK_REGISTRATION']}) @Equals('NETWORK_REGISTRATION') purpose!:'NETWORK_REGISTRATION';
 @ApiProperty({example:'+886912345678'}) @Matches(/^\+[1-9][0-9]{7,14}$/) destination!:string;
 @ApiProperty({format:'uuid'}) @IsUUID() registrationSessionId!:string;
}
class VerifyOtpChallengeDto { @ApiProperty({pattern:'^[0-9]{6}$'}) @Matches(/^[0-9]{6}$/) code!:string; }

@ApiTags('Authentication - OTP') @Controller('auth/otp/challenges')
export class OtpController {
 constructor(private readonly service:OtpService){}
 @Post() @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'createOtpChallenge',description:'Creates a 6-digit, five-minute OTP challenge. Raw OTP is never returned or persisted. Production fails closed until an SMS provider is configured.'}) @ApiResponse({status:503,description:'OTP/SMS provider configuration pending'})
 create(@Body() body:CreateOtpChallengeDto,@Headers('idempotency-key') key:string){return this.service.create(body,key);}
 @Post(':id/verify') @ApiOperation({operationId:'verifyOtpChallenge',description:'Verifies under a database row lock; five failed attempts lock the challenge.'}) verify(@Param('id',new ParseUUIDPipe()) id:string,@Body() body:VerifyOtpChallengeDto){return this.service.verify(id,body.code);}
}
