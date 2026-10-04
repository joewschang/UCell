import {Body,Controller,Get,Headers,Post,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiOperation,ApiProperty,ApiPropertyOptional,ApiTags} from '@nestjs/swagger';
import {IsIn,IsOptional,IsString,IsUUID,Matches,MaxLength,MinLength} from 'class-validator';
import {MemberAuthenticationGuard} from './member-authentication.guard';
import {ContactVerificationService,ContactChannel,ContactPurpose} from './contact-verification.service';
class ContactDto{
 @ApiProperty({enum:['SMS','EMAIL']}) @IsIn(['SMS','EMAIL']) channel!:ContactChannel;
 @ApiProperty({maxLength:254}) @IsString() @MinLength(1) @MaxLength(254) destination!:string;
}
class RegistrationContactDto extends ContactDto{
 @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(16384) googleIdToken?:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(16384) lineIdToken?:string;
}
class RegistrationVerifyDto extends RegistrationContactDto{
 @ApiProperty({format:'uuid'}) @IsUUID() challengeId!:string;
 @ApiProperty({pattern:'^[0-9]{6}$'}) @Matches(/^\d{6}$/) code!:string;
}
class MemberContactDto extends ContactDto{
 @ApiProperty({enum:['REGISTRATION','PROFILE']}) @IsIn(['REGISTRATION','PROFILE']) purpose!:ContactPurpose;
}
class MemberVerifyDto extends MemberContactDto{
 @ApiProperty({format:'uuid'}) @IsUUID() challengeId!:string;
 @ApiProperty({pattern:'^[0-9]{6}$'}) @Matches(/^\d{6}$/) code!:string;
}
@ApiTags('Member - Contact Verification') @Controller('auth/member/contact-verification')
export class RegistrationContactVerificationController{
 constructor(private readonly service:ContactVerificationService){}
 @Get('policy') @ApiOperation({operationId:'getContactVerificationPolicy',description:'Public contact requirements. Email remains mandatory; SMS deferral is permitted only in Stage and never marks a phone verified.'})
 policy(){return this.service.policy();}
 @Post('challenges') @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'sendRegistrationContactCode',description:'Requires a server-verified Google or LINE identity. Sends contact verification code with persistent destination and subject quotas. No membership is created.'})
 async send(@Body() input:RegistrationContactDto,@Headers('idempotency-key') key:string){return this.service.send(await this.service.registrationOwner(input),'REGISTRATION',input.channel,input.destination,key);}
 @Post('verify') @ApiOperation({operationId:'verifyRegistrationContactCode',description:'Verifies a code bound to identity, destination, channel and purpose; returns a short-lived proof consumed atomically by registration.'})
 async verify(@Body() input:RegistrationVerifyDto){return this.service.verify(await this.service.registrationOwner(input),'REGISTRATION',input.channel,input.destination,input.challengeId,input.code);}
}
@ApiTags('Member - Contact Verification') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard) @Controller('member/contact-verification')
export class MemberContactVerificationController{
 constructor(private readonly service:ContactVerificationService){}
 @Post('challenges') @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'sendMemberContactCode',description:'Sends code bound to the authenticated Person, destination and purpose. Does not change contacts until proof consumption.'})
 send(@Req() req:any,@Body() input:MemberContactDto,@Headers('idempotency-key') key:string){return this.service.send('PERSON:'+req.user.personId,input.purpose,input.channel,input.destination,key);}
 @Post('verify') @ApiOperation({operationId:'verifyMemberContactCode'})
 verify(@Req() req:any,@Body() input:MemberVerifyDto){return this.service.verify('PERSON:'+req.user.personId,input.purpose,input.channel,input.destination,input.challengeId,input.code);}
}
