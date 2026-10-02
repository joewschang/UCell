import {randomUUID} from 'node:crypto';
import {Body,Controller,Get,Headers,Param,Post,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiOperation,ApiProperty,ApiPropertyOptional,ApiTags} from '@nestjs/swagger';
import {ArrayMaxSize,ArrayMinSize,IsArray,IsBoolean,IsDateString,IsIn,IsOptional,IsString,Length,Matches,MaxLength,ValidateNested} from 'class-validator';
import {Type} from 'class-transformer';
import {Roles} from '../auth/roles.decorator';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {LearningService} from './learning.service';
class LessonDto{
 @ApiProperty() @IsString() @Length(1,160) title!:string;
 @ApiProperty({enum:['VIDEO_REFERENCE','DOCUMENT_REFERENCE','ARTICLE','EXTERNAL_LINK']}) @IsIn(['VIDEO_REFERENCE','DOCUMENT_REFERENCE','ARTICLE','EXTERNAL_LINK']) contentType!:'VIDEO_REFERENCE'|'DOCUMENT_REFERENCE'|'ARTICLE'|'EXTERNAL_LINK';
 @ApiProperty() @IsString() @Length(1,20000) contentReference!:string;
 @ApiPropertyOptional() @IsOptional() @IsBoolean() required?:boolean;
}
class CourseDto{
 @ApiProperty() @Matches(/^[A-Z][A-Z0-9_-]{2,39}$/) courseCode!:string;
 @ApiProperty() @IsString() @Length(1,160) title!:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) summary?:string;
 @ApiProperty() @Matches(/^[A-Z][A-Z0-9_-]{2,39}$/) categoryCode!:string;
 @ApiPropertyOptional() @IsOptional() @IsDateString() publishFrom?:string;
 @ApiPropertyOptional() @IsOptional() @IsDateString() publishTo?:string;
 @ApiProperty({type:[LessonDto]}) @IsArray() @ArrayMinSize(1) @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(()=>LessonDto) lessons!:LessonDto[];
}
class LearningOutreachDto{ @ApiProperty({pattern:'^[0-9]{10}$'}) @Matches(/^\d{10}$/) memberNo!:string; @ApiProperty({enum:['ASSIGN','REMIND']}) @IsIn(['ASSIGN','REMIND']) action!:'ASSIGN'|'REMIND'; @ApiProperty({maxLength:500}) @IsString() @Length(1,500) reason!:string; }
class PublishDto{@ApiProperty() @IsString() @Length(1,200) approvalReference!:string;}
class ArchiveDto{@ApiProperty() @IsString() @Length(1,500) reason!:string;}
@ApiTags('Admin - Learning') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','MEMBERSHIP_OPS') @Controller('admin/learning')
export class AdminLearningController{
 constructor(private s:LearningService){}
 @Post('courses/:courseCode/outreach') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'adminLearningOutreach',summary:'個別課程指派或學習提醒，僅存入 UCell 個人訊息中心'})
 outreach(@Param('courseCode') courseCode:string,@Body() body:LearningOutreachDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.s.outreach(courseCode,body.memberNo,body.action,body.reason,req.user?.personId??req.user?.subject,key,req.requestId??randomUUID()).then(data=>({data}));}
 @Get('courses') list(){return this.s.adminList().then(data=>({data}));}
 @Post('courses') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 create(@Body() body:CourseDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.s.create(body,req.user?.personId??req.user?.subject,key,req.requestId??randomUUID()).then(data=>({data}));}
 @Post('courses/:courseCode/publish') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 publish(@Param('courseCode') code:string,@Body() body:PublishDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.s.publish(code,body?.approvalReference,req.user?.personId??req.user?.subject,key,req.requestId??randomUUID()).then(data=>({data}));}
 @Post('courses/:courseCode/archive') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true}) @ApiOperation({operationId:'adminArchiveLearningCourse',summary:'封存課程並保留歷史報名與完成證據'})
 archive(@Param('courseCode') code:string,@Body() body:ArchiveDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.s.archive(code,body?.reason,req.user?.personId??req.user?.subject,key,req.requestId??randomUUID()).then(data=>({data}));}
}
@ApiTags('Member - Learning') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard) @Controller('member/learning')
export class MemberLearningController{
 constructor(private s:LearningService){}
 @Get('courses') @ApiOperation({operationId:'memberLearningCourses'}) list(@Req() req:any){return this.s.memberList(req.user.personId).then(data=>({data}));}
 @Get('courses/:courseCode') detail(@Req() req:any,@Param('courseCode') code:string){return this.s.memberDetail(req.user.personId,code).then(data=>({data}));}
 @Post('courses/:courseCode/enroll') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 enroll(@Req() req:any,@Param('courseCode') code:string,@Headers('idempotency-key') key:string){return this.s.enroll(req.user.personId,code,key,req.requestId??randomUUID()).then(data=>({data}));}
 @Post('courses/:courseCode/lessons/:sequenceNo/complete') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 lesson(@Req() req:any,@Param('courseCode') code:string,@Param('sequenceNo') sequenceNo:string,@Headers('idempotency-key') key:string){return this.s.lessonCompleted(req.user.personId,code,Number(sequenceNo),key).then(data=>({data}));}
 @Post('courses/:courseCode/complete') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 complete(@Req() req:any,@Param('courseCode') code:string,@Headers('idempotency-key') key:string){return this.s.complete(req.user.personId,code,key,req.requestId??randomUUID()).then(data=>({data}));}
}