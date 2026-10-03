import { Body,Controller,Get,Post,Req,UseGuards } from '@nestjs/common';
import { ApiBearerAuth,ApiOperation,ApiProperty,ApiTags } from '@nestjs/swagger';
import { IsString,MaxLength,MinLength } from 'class-validator';
import { MemberAuthenticationGuard } from './member-authentication.guard';
import { MemberWebAuthService } from './member-web-auth.service';

class LinkGoogleDto{ @ApiProperty() @IsString() @MinLength(1) @MaxLength(16384) idToken!:string; }

@ApiTags('Member - Identity Linking') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard) @Controller('member/identity')
export class MemberIdentityLinkController{
 constructor(private readonly service:MemberWebAuthService){}
 @Get()
 @ApiOperation({operationId:'memberLoginMethods',description:'Return linked provider statuses for the authenticated Person without identity subjects or tokens.'})
 methods(@Req() req:any){return this.service.loginMethods(req.user.personId);}
 @Post('line/link')
 @ApiOperation({operationId:'memberLinkLineIdentity',description:'Link a server-verified LINE subject to the authenticated existing Person. Never creates or merges members, never links by matching email, and never replaces another LINE identity.'})
 linkLine(@Req() req:any,@Body() body:LinkGoogleDto){return this.service.linkLine(req.user.personId,body.idToken);}
 @Post('google/link')
 @ApiOperation({operationId:'memberLinkGoogleIdentity',description:'Link a server-verified Google subject to the authenticated Person. Email equality never auto-links identities.'})
 linkGoogle(@Req() req:any,@Body() body:LinkGoogleDto){return this.service.linkGoogle(req.user.personId,body.idToken);}
}
