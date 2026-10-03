import { Body,Controller,Get,Headers,Post,UseGuards } from '@nestjs/common';
import { ApiHeader,ApiOperation,ApiProperty,ApiTags } from '@nestjs/swagger';
import { Equals,IsDateString,IsEmail,IsIn,IsString,IsUUID,Matches,MaxLength,MinLength } from 'class-validator';
import { IdempotencyGuard } from '../../common/guards/idempotency.guard';
import { MemberWebRegistrationService } from './member-web-registration.service';

class CompleteWebRegistrationDto{
 @ApiProperty({format:'uuid'}) @IsUUID() contractVersionId!:string;
 @ApiProperty({enum:[true]}) @Equals(true) accepted!:true;
 @ApiProperty({maxLength:80}) @IsString() @MinLength(1) @MaxLength(80) legalName!:string;
 @ApiProperty({maxLength:80}) @IsString() @MinLength(1) @MaxLength(80) alias!:string;
 @ApiProperty({maxLength:32}) @Matches(/^[A-Za-z0-9_-]{1,32}$/) gender!:string;
 @ApiProperty({format:'date'}) @IsDateString() birthDate!:string;
 @ApiProperty({example:'TW'}) @Matches(/^[A-Z]{2}$/) nationalityCode!:string;
 @ApiProperty({enum:['NATIONAL_ID','RESIDENCE_PERMIT','PASSPORT','OTHER']}) @IsIn(['NATIONAL_ID','RESIDENCE_PERMIT','PASSPORT','OTHER']) identityDocumentType!:'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';
 @ApiProperty({maxLength:64}) @IsString() @Matches(/\S/) @MaxLength(64) identityDocumentNumber!:string;
 @ApiProperty({example:'+886912345678'}) @Matches(/^\+[1-9][0-9]{7,14}$/) mobile!:string;
 @ApiProperty({format:'email',maxLength:254}) @IsEmail() @MaxLength(254) email!:string;
 @ApiProperty({minLength:12,maxLength:256}) @IsString() @MinLength(12) @MaxLength(256) password!:string;
 @ApiProperty({maxLength:16384,description:'Google ID token explicitly presented for Web registration; verified server-side and linked to the newly created Person only after all registration checks pass.'}) @IsString() @MinLength(1) @MaxLength(16384) googleIdToken!:string;
}

@ApiTags('Member - Web Registration') @Controller('auth/member/register')
export class MemberWebRegistrationController{
 constructor(private readonly service:MemberWebRegistrationService){}

 @Get('contract')
 @ApiOperation({operationId:'memberWebRegistrationContract',description:'Public effective Network Member contract required before Web registration. No identity or qualification data is returned.'})
 contract(){return this.service.requiredContract();}

 @Post('complete') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 @ApiOperation({operationId:'memberWebRegistrationComplete',description:'Complete Google-verified Web Network Member registration. Creates Person/memberNo and local password credential only; no Qualification/Ball.'})
 complete(@Body() body:CompleteWebRegistrationDto,@Headers('idempotency-key') key:string){return this.service.complete(body,key);}
}
