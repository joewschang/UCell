import { Body,Controller,Post } from '@nestjs/common';
import { ApiOperation,ApiProperty,ApiTags } from '@nestjs/swagger';
import { IsString,Matches,MaxLength,MinLength } from 'class-validator';
import { MemberWebAuthService } from './member-web-auth.service';

class GoogleExchangeDto{ @ApiProperty() @IsString() @MinLength(1) @MaxLength(16384) idToken!:string; }
class PasswordLoginDto{
 @ApiProperty({example:'2609000001'}) @Matches(/^\d{10}$/) memberNo!:string;
 @ApiProperty({minLength:12,maxLength:256}) @IsString() @MinLength(12) @MaxLength(256) password!:string;
}
class ForgotPasswordDto{ @ApiProperty() @IsString() @MinLength(3) @MaxLength(254) identifier!:string; }
class ResetPasswordDto{
 @ApiProperty() @IsString() @MinLength(20) @MaxLength(256) token!:string;
 @ApiProperty({minLength:12,maxLength:256}) @IsString() @MinLength(12) @MaxLength(256) newPassword!:string;
}

@ApiTags('Member - Web Authentication') @Controller('auth/member')
export class MemberWebAuthController{
 constructor(private readonly service:MemberWebAuthService){}

 @Post('google/exchange') @ApiOperation({operationId:'memberGoogleExchange',description:'Verify Google OIDC server-side, resolve an explicitly linked GOOGLE ProviderIdentity and issue the standard opaque Member session.'})
 google(@Body() body:GoogleExchangeDto){return this.service.googleExchange(body.idToken);}

 @Post('password/login') @ApiOperation({operationId:'memberPasswordLogin',description:'Login using immutable memberNo plus a dedicated Member password credential. Generic failures do not disclose account existence.'})
 password(@Body() body:PasswordLoginDto){return this.service.passwordLogin(body.memberNo,body.password);}

 @Post('password/forgot') @ApiOperation({operationId:'memberForgotPassword',description:'Always returns accepted. If an eligible account/email exists, sends a short-lived single-use reset link through the configured provider.'})
 forgot(@Body() body:ForgotPasswordDto){return this.service.forgotPassword(body.identifier);}

 @Post('password/reset') @ApiOperation({operationId:'memberResetPassword',description:'Consume a single-use reset token, set a new password hash and revoke active Member sessions.'})
 reset(@Body() body:ResetPasswordDto){return this.service.resetPassword(body.token,body.newPassword);}
}
