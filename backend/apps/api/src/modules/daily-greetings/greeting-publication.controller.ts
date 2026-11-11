import {Body,Controller,Get,Header,Headers,Param,ParseUUIDPipe,Post,Req,ServiceUnavailableException,StreamableFile,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiTags,ApiProperty,ApiOperation} from '@nestjs/swagger';
import {IsString,MaxLength,MinLength} from 'class-validator';
import {Roles} from '../auth/roles.decorator';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {GreetingPublicationService} from './greeting-publication.service';
class GreetingDraftDto {
 @ApiProperty({example:"2026-11-11"}) @IsString() @MinLength(10) @MaxLength(10) date!:string;
 @ApiProperty({maxLength:160}) @IsString() @MinLength(1) @MaxLength(160) title!:string;
 @ApiProperty({maxLength:1000}) @IsString() @MinLength(1) @MaxLength(1000) message!:string;
 @ApiProperty({description:"RGB/RGBA PNG bytes, base64, at most 600000 decoded bytes"}) @IsString() @MinLength(32) @MaxLength(800000) contentBase64!:string;
}
class GreetingApprovalDto {@ApiProperty({maxLength:200}) @IsString() @MinLength(1) @MaxLength(200) approvalReference!:string;}
@ApiTags('Admin - Daily greetings') @ApiBearerAuth('adminBearer')
@Roles('SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT') @Controller('admin/daily-greetings')
export class GreetingPublicationController {
 constructor(private service:GreetingPublicationService){}
 @Get() @ApiOperation({operationId:'listDailyGreetingPublications'}) list(){return this.service.list();}
 @Get(':id/preview') @ApiOperation({operationId:'previewDailyGreetingPublication'}) @Header('Cache-Control','no-store')
 async preview(@Param('id',new ParseUUIDPipe()) id:string){return new StreamableFile(await this.service.preview(id),{type:'image/png'});}
 @Post() @ApiOperation({operationId:'createDailyGreetingDraft'}) @Roles('SUPER_ADMIN','ORDER_OPS') @UseGuards(IdempotencyGuard)
 draft(@Body() body:GreetingDraftDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.draft(body,key,req.requestId,req.user.personId??req.user.subject);}
 @Post(':id/publish') @ApiOperation({operationId:'publishDailyGreetingPublication'}) @Roles('SUPER_ADMIN','ORDER_OPS') @UseGuards(IdempotencyGuard)
 publish(@Param('id',new ParseUUIDPipe()) id:string,@Body() body:GreetingApprovalDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.transition(id,'publish',body.approvalReference,key,req.requestId,req.user.personId??req.user.subject);}
 @Post(':id/archive') @ApiOperation({operationId:'archiveDailyGreetingPublication'}) @Roles('SUPER_ADMIN','ORDER_OPS') @UseGuards(IdempotencyGuard)
 archive(@Param('id',new ParseUUIDPipe()) id:string,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.transition(id,'archive','',key,req.requestId,req.user.personId??req.user.subject);}
}
/** Reserved fail-closed route. No environment flag or supplied bearer can enable it. */
@ApiTags('Integrations - Daily greetings') @Controller('integrations/dot/daily-greetings')
export class DotGreetingController {
 @Post('drafts') @ApiOperation({operationId:'reservedDotDailyGreetingDraft'}) draft(){throw new ServiceUnavailableException({code:'DOT_GREETING_AUTHORIZATION_NOT_CONFIGURED'});}
}
