import {MemberShareLinkService} from '../member/member-share-link.service';
import {Controller,Get,Query,Req,UseGuards,Post,Body,Param,ParseUUIDPipe} from '@nestjs/common';
import {ApiBearerAuth,ApiProperty,ApiTags} from '@nestjs/swagger';
import {IsUUID,IsOptional} from 'class-validator';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {Roles} from '../auth/roles.decorator';
import {ContentInsightsService} from './content-insights.service';
class InsightsQuery { @ApiProperty({format:'uuid'}) @IsUUID() qualificationId!:string; }
@ApiTags('Member - Content') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard)
@Controller('member/content-insights')
export class MemberContentInsightsController{
 constructor(private readonly service:ContentInsightsService){}
 @Get() get(@Req() req:any,@Query() query:InsightsQuery){return this.service.read(req.user.personId,query.qualificationId);}
}
@ApiTags('Admin - Content') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT')
@Controller('admin/content-insights')
export class AdminContentInsightsController{
 constructor(private readonly service:ContentInsightsService){}
 @Get() get(){return this.service.read();}
}

class ShareDto extends InsightsQuery { @ApiProperty({format:'uuid',required:false}) @IsOptional() @IsUUID() contentId?:string; }
@ApiTags('Member - Content') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard)
@Controller('member/content-share-links')
export class MemberContentShareController {
 constructor(private readonly links:MemberShareLinkService){}
 @Post() create(@Req() req:any,@Body() body:ShareDto){return this.links.create(req.user.personId,body.qualificationId,new Date(),body.contentId);}
 @Post(':id/revoke') revoke(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:InsightsQuery){return this.links.revoke(req.user.personId,body.qualificationId,id);}
}
