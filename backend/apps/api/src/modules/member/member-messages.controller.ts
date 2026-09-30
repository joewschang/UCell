import {randomUUID} from 'node:crypto';
import {Body,Controller,Get,Headers,Param,Post,Query,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiCreatedResponse,ApiHeader,ApiOkResponse,ApiOperation,ApiProperty,ApiPropertyOptional,ApiTags} from '@nestjs/swagger';
import {IsDateString,IsIn,IsInt,IsOptional,IsString,IsUUID,Matches,Max,Min} from 'class-validator';
import {Type} from 'class-transformer';
import {MEMBER_MESSAGE_CATEGORIES} from '@ucell/database';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {MemberMessagesService} from './member-messages.service';
class ContextDto{@ApiPropertyOptional({format:'uuid'}) @IsOptional() @IsUUID() qualificationId?:string;}
class QueryDto extends ContextDto{
 @ApiPropertyOptional({enum:['ACTIVE','ARCHIVED']}) @IsOptional() @IsIn(['ACTIVE','ARCHIVED']) view?:string;
 @ApiPropertyOptional({enum:MEMBER_MESSAGE_CATEGORIES}) @IsOptional() @IsIn(MEMBER_MESSAGE_CATEGORIES) category?:string;
 @ApiPropertyOptional({minimum:1,maximum:100}) @IsOptional() @Type(()=>Number) @IsInt() @Min(1) @Max(100) take?:number;
 @ApiPropertyOptional() @IsOptional() @IsString() @Matches(/^MESSAGE-[a-f0-9]{40}$/) cursor?:string;
 @ApiPropertyOptional() @IsOptional() @IsDateString() asOf?:string;
}
class EnvelopeDto{@ApiProperty({type:'object',additionalProperties:true}) data!:Record<string,unknown>;}
@ApiTags('Member - Messages') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard) @Controller('member/messages')
export class MemberMessagesController{
 constructor(private readonly service:MemberMessagesService){}
 @Get() @ApiOperation({operationId:'memberMessages',summary:'讀取本人目前資格及個人站內訊息；不發送 LINE 廣播'}) @ApiOkResponse({type:EnvelopeDto})
 list(@Req() req:any,@Query() query:QueryDto){return this.service.list(req.user.personId,query).then(data=>({data}));}
 @Post(':reference/read') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberMessageRead',summary:'保存首次已讀時間'}) @ApiCreatedResponse({type:EnvelopeDto})
 read(@Req() req:any,@Param('reference') reference:string,@Body() body:ContextDto,@Headers('idempotency-key') key:string){return this.service.command(req.user.personId,reference,body.qualificationId,'READ',key,req.requestId??randomUUID()).then(data=>({data}));}
 @Post(':reference/archive') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'memberMessageArchive',summary:'封存本人站內訊息；不變更已讀證據'}) @ApiCreatedResponse({type:EnvelopeDto})
 archive(@Req() req:any,@Param('reference') reference:string,@Body() body:ContextDto,@Headers('idempotency-key') key:string){return this.service.command(req.user.personId,reference,body.qualificationId,'ARCHIVE',key,req.requestId??randomUUID()).then(data=>({data}));}
}
