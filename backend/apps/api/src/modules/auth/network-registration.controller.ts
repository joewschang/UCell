import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Equals, IsDateString, IsEmail, IsString, IsUUID, Matches, MaxLength, MinLength } from 'class-validator';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { NetworkRegistrationService } from './network-registration.service';
import { MemberAuthenticationGuard } from './member-authentication.guard';

class NetworkRegistrationDto {
 @ApiProperty({format:'uuid'}) @IsUUID() contractVersionId!:string;
 @ApiProperty({enum:[true]}) @Equals(true) accepted!:true;
 @ApiProperty({minLength:1,maxLength:80}) @IsString() @MinLength(1) @MaxLength(80) legalName!:string;
 @ApiProperty({minLength:1,maxLength:80}) @IsString() @MinLength(1) @MaxLength(80) alias!:string;
 @ApiProperty({description:'Version-neutral gender code; display labels are client/localization concerns.',maxLength:32}) @Matches(/^[A-Za-z0-9_-]{1,32}$/) gender!:string;
 @ApiProperty({format:'date'}) @IsDateString() birthDate!:string;
 @ApiProperty({example:'+886912345678'}) @Matches(/^\+[1-9][0-9]{7,14}$/) mobile!:string;
 @ApiProperty({format:'email',maxLength:254}) @IsEmail() @MaxLength(254) email!:string;
}

@ApiTags('Member - Registration') @UseGuards(MemberAuthenticationGuard) @Controller('member/registration')
export class NetworkRegistrationController {
 constructor(private readonly service:NetworkRegistrationService){}
 @Post('network') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'registerLineNetworkMember',description:'Requires authenticated LINE-backed UCell session, records contract consent and completes NETWORK_MEMBER profile. Mobile/email are contact data. No OTP or Qualification is created.'})
 register(@Body() body:NetworkRegistrationDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.registerLinePerson(req.user.personId,body,key,req.requestId);}
}
