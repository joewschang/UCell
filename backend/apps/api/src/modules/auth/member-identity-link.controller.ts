import { Body,Controller,Post,Req,UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation,ApiProperty,ApiTags } from '@nestjs/swagger';
import { IsString,MaxLength,MinLength } from 'class-validator';
import { MemberAuthenticationGuard } from './member-authentication.guard';
import { MemberWebAuthService } from './member-web-auth.service';

class LinkGoogleDto{ @ApiProperty() @IsString() @MinLength(1) @MaxLength(16384) idToken!:string; }

@ApiTags('Member - Identity Linking') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard) @Controller('member/identity')
export class MemberIdentityLinkController{
 constructor(private readonly service:MemberWebAuthService){}
 @Post('google/link')
 @ApiOperation({operationId:'memberLinkGoogleIdentity',description:'Link a server-verified Google subject to the authenticated Person. Email equality never auto-links identities.'})
 linkGoogle(@Req() req:any,@Body() body:LinkGoogleDto){return this.service.linkGoogle(req.user.personId,body.idToken);}
}
