import {Body,Controller,Get,Headers,Param,ParseUUIDPipe,Post,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiProperty,ApiPropertyOptional,ApiTags} from '@nestjs/swagger';
import {IsBoolean,IsEnum,IsISO8601,IsOptional,IsString,IsUrl,MaxLength,MinLength} from 'class-validator';
import {Roles} from '../auth/roles.decorator';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {ContentService,ContentInput} from './content.service';

class ContentDto implements ContentInput {
 @ApiProperty({enum:['VIDEO_EXTERNAL','EXTERNAL_LINK']}) @IsEnum(['VIDEO_EXTERNAL','EXTERNAL_LINK']) contentType!:'VIDEO_EXTERNAL'|'EXTERNAL_LINK';
 @ApiProperty({maxLength:160}) @IsString() @MinLength(1) @MaxLength(160) title!:string;
 @ApiPropertyOptional({maxLength:1000}) @IsOptional() @IsString() @MaxLength(1000) summary?:string;
 @ApiProperty() @IsUrl({protocols:['https'],require_protocol:true}) externalUrl!:string;
 @ApiPropertyOptional() @IsOptional() @IsUrl({protocols:['https'],require_protocol:true}) thumbnailUrl?:string;
 @ApiProperty({enum:['NETWORK_MEMBER']}) @IsEnum(['NETWORK_MEMBER']) audiencePolicy!:'NETWORK_MEMBER';
 @ApiProperty() @IsBoolean() shareable!:boolean;
 @ApiPropertyOptional({format:'date-time'}) @IsOptional() @IsISO8601() publishFrom?:string;
 @ApiPropertyOptional({format:'date-time'}) @IsOptional() @IsISO8601() publishTo?:string;
}
class PublishDto { @ApiProperty({maxLength:200}) @IsString() @MinLength(1) @MaxLength(200) approvalReference!:string; }

@ApiTags('Admin - Content') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT')
@Controller('admin/content')
export class AdminContentController {
 constructor(private readonly service:ContentService){}
 @Get() list(){return this.service.adminList();}
 @Post() @Roles('SUPER_ADMIN','ORDER_OPS') @UseGuards(IdempotencyGuard)
 create(@Body() body:ContentDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.create(body,key,req.requestId,req.user?.personId??req.user?.subject);}
 @Post(':id/versions') @Roles('SUPER_ADMIN','ORDER_OPS') @UseGuards(IdempotencyGuard)
 add(@Param('id',new ParseUUIDPipe()) id:string,@Body() body:ContentDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.addVersion(id,body,key,req.requestId,req.user?.personId??req.user?.subject);}
 @Post(':id/versions/:versionId/publish') @Roles('SUPER_ADMIN','ORDER_OPS') @UseGuards(IdempotencyGuard)
 publish(@Param('id',new ParseUUIDPipe()) id:string,@Param('versionId',new ParseUUIDPipe()) versionId:string,@Body() body:PublishDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.publish(id,versionId,body.approvalReference,key,req.requestId,req.user?.personId??req.user?.subject);}
}

@ApiTags('Member - Content') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard)
@Controller('member/content')
export class MemberContentController {
 constructor(private readonly service:ContentService){}
 @Get() list(@Req() req:any){return this.service.list(req.user.personId);}
 @Get(':id') get(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string){return this.service.get(req.user.personId,id);}
}
