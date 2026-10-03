import { Body, Controller, Headers, Post, Req, UseGuards } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Equals, IsDateString, IsEmail, IsString, IsUUID, IsOptional, Matches, MaxLength, MinLength } from 'class-validator';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { NetworkRegistrationService } from './network-registration.service';
import { MemberAuthenticationGuard } from './member-authentication.guard';

class NetworkRegistrationDto {
 @ApiProperty({required:false}) @IsOptional() @Matches(/^[a-f0-9]{64}$/) mobileVerificationProof?:string;
 @ApiProperty({required:false}) @IsOptional() @Matches(/^[a-f0-9]{64}$/) emailVerificationProof?:string;
 @ApiProperty({format:'uuid'}) @IsUUID() contractVersionId!:string;
 @ApiProperty({enum:[true]}) @Equals(true) accepted!:true;
 @ApiProperty({minLength:1,maxLength:80}) @IsString() @MinLength(1) @MaxLength(80) legalName!:string;
 @ApiProperty({minLength:1,maxLength:80}) @IsString() @MinLength(1) @MaxLength(80) alias!:string;
 @ApiProperty({description:'Version-neutral gender code; display labels are client/localization concerns.',maxLength:32}) @Matches(/^[A-Za-z0-9_-]{1,32}$/) gender!:string;
 @ApiProperty({format:'date'}) @IsDateString() birthDate!:string;
 @ApiProperty({description:'ISO-style nationality/country code',example:'TW'}) @Matches(/^[A-Z]{2}$/) nationalityCode!:string;
 @ApiProperty({enum:['NATIONAL_ID','RESIDENCE_PERMIT','PASSPORT','OTHER']}) @Matches(/^(NATIONAL_ID|RESIDENCE_PERMIT|PASSPORT|OTHER)$/) identityDocumentType!:'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';
 @ApiProperty({description:'Identity document number corresponding to the selected type',minLength:2,maxLength:64}) @IsString() @MinLength(2) @MaxLength(64) identityDocumentNumber!:string;
 @ApiProperty({example:'+886912345678'}) @Matches(/^\+[1-9][0-9]{7,14}$/) mobile!:string;
 @ApiProperty({format:'email',maxLength:254}) @IsEmail() @MaxLength(254) email!:string;
}

@ApiTags('Member - Registration') @UseGuards(MemberAuthenticationGuard) @Controller('member/registration')
export class NetworkRegistrationController {
 constructor(private readonly service:NetworkRegistrationService){}
 @Post('network') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'registerLineNetworkMember',description:'Requires authenticated LINE-backed UCell session and verified mobile/email proofs, records contract consent and completes NETWORK_MEMBER profile. Contact verification is not KYC. No Qualification is created.'})
 register(@Body() body:NetworkRegistrationDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.registerLinePerson(req.user.personId,body,key,req.requestId);}
}
