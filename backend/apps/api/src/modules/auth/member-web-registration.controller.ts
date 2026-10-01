import { Body,Controller,Get,Headers,Post,UseGuards } from '@nestjs/common';
import { ApiHeader,ApiOperation,ApiProperty,ApiTags } from '@nestjs/swagger';
import { Equals,IsDateString,IsEmail,IsString,IsUUID,Matches,MaxLength,MinLength } from 'class-validator';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { MemberWebRegistrationService } from './member-web-registration.service';

class StartWebRegistrationDto{
 @ApiProperty({format:'uuid'}) @IsUUID() registrationSessionId!:string;
 @ApiProperty({example:'+886912345678'}) @Matches(/^\+[1-9][0-9]{7,14}$/) mobile!:string;
}
class CompleteWebRegistrationDto{
 @ApiProperty({format:'uuid'}) @IsUUID() registrationSessionId!:string;
 @ApiProperty({format:'uuid'}) @IsUUID() challengeId!:string;
 @ApiProperty({format:'uuid'}) @IsUUID() contractVersionId!:string;
 @ApiProperty({enum:[true]}) @Equals(true) accepted!:true;
 @ApiProperty({maxLength:80}) @IsString() @MinLength(1) @MaxLength(80) legalName!:string;
 @ApiProperty({maxLength:80}) @IsString() @MinLength(1) @MaxLength(80) alias!:string;
 @ApiProperty({maxLength:32}) @Matches(/^[A-Za-z0-9_-]{1,32}$/) gender!:string;
 @ApiProperty({format:'date'}) @IsDateString() birthDate!:string;
 @ApiProperty({example:'+886912345678'}) @Matches(/^\+[1-9][0-9]{7,14}$/) mobile!:string;
 @ApiProperty({format:'email',maxLength:254}) @IsEmail() @MaxLength(254) email!:string;
}

@ApiTags('Member - Web Registration') @Controller('auth/member/register')
export class MemberWebRegistrationController{
 constructor(private readonly service:MemberWebRegistrationService){}

 @Get('contract')
 @ApiOperation({operationId:'memberWebRegistrationContract',description:'Public effective Network Member contract required before Web registration. No identity or qualification data is returned.'})
 contract(){return this.service.requiredContract();}

 @Post('otp/challenge') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'memberWebRegistrationOtpChallenge',description:'Start mobile verification for a new Web Network Member registration. Verification uses the existing OTP verify endpoint.'})
 start(@Body() body:StartWebRegistrationDto,@Headers('idempotency-key') key:string){return this.service.start(body.registrationSessionId,body.mobile,key);}

 @Post('complete') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'memberWebRegistrationComplete',description:'Complete a previously OTP-verified Web Network Member registration. Creates Person/memberNo only; no Qualification/Ball.'})
 complete(@Body() body:CompleteWebRegistrationDto,@Headers('idempotency-key') key:string){return this.service.complete(body,key);}
}
