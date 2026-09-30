import {randomUUID} from 'node:crypto';
import {Body,Controller,Get,Headers,Param,Post,Req,UseGuards} from '@nestjs/common';
import {ApiBearerAuth,ApiHeader,ApiProperty,ApiPropertyOptional,ApiTags} from '@nestjs/swagger';
import {IsDateString,IsIn,IsInt,IsOptional,IsString,Length,Matches,Max,MaxLength,Min} from 'class-validator';
import {Roles} from '../auth/roles.decorator';
import {MemberAuthenticationGuard} from '../auth/member-authentication.guard';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {MemberEventsService} from './events.service';
class EventDto{
 @ApiProperty() @Matches(/^[A-Z][A-Z0-9_-]{2,39}$/) eventCode!:string;
 @ApiProperty() @IsString() @Length(1,160) title!:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(4000) description?:string;
 @ApiProperty({enum:['ONLINE','OFFLINE','HYBRID']}) @IsIn(['ONLINE','OFFLINE','HYBRID']) eventType!:'ONLINE'|'OFFLINE'|'HYBRID';
 @ApiProperty() @IsDateString() startsAt!:string;
 @ApiProperty() @IsDateString() endsAt!:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) locationReference?:string;
 @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) onlineJoinReference?:string;
 @ApiPropertyOptional() @IsOptional() @IsInt() @Min(1) @Max(1000000) capacity?:number;
}
class PublishDto{@ApiProperty() @IsString() @Length(1,200) approvalReference!:string;}
class ArchiveDto{@ApiProperty() @IsString() @Length(1,500) reason!:string;}
class CheckInDto{@ApiProperty() @Matches(/^[A-Za-z0-9_-]{43}$/) checkInToken!:string;}
class AttendanceDto{@ApiProperty() @Matches(/^\d{10}$/) memberNo!:string;}
@ApiTags('Admin - Events') @ApiBearerAuth('adminBearer') @Roles('SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS') @Controller('admin/events')
export class AdminEventsController{
 constructor(private s:MemberEventsService){}
 @Get() list(){return this.s.adminList().then(data=>({data}));}
 @Get(':eventCode/registrations') registrations(@Param('eventCode') eventCode:string){return this.s.adminRegistrations(eventCode).then(data=>({data}));}
 @Post() @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 create(@Body() body:EventDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.s.create(body,req.user?.personId??req.user?.subject,key,req.requestId??randomUUID()).then(data=>({data}));}
 @Post(':eventCode/publish') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 publish(@Param('eventCode') eventCode:string,@Body() body:PublishDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.s.publish(eventCode,body?.approvalReference,req.user?.personId??req.user?.subject,key,req.requestId??randomUUID()).then(data=>({data}));}
 @Post(':eventCode/archive') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 archive(@Param('eventCode') eventCode:string,@Body() body:ArchiveDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.s.archive(eventCode,body?.reason,req.user?.personId??req.user?.subject,key,req.requestId??randomUUID()).then(data=>({data}));}
 @Post('check-in') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 checkIn(@Body() body:CheckInDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.s.checkIn(body?.checkInToken,req.user?.personId??req.user?.subject,key,req.requestId??randomUUID()).then(data=>({data}));}
 @Post(':eventCode/attend') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 attend(@Param('eventCode') eventCode:string,@Body() body:AttendanceDto,@Headers('idempotency-key') key:string,@Req() req:any){return this.s.attend(eventCode,body.memberNo,req.user?.personId??req.user?.subject,key,req.requestId??randomUUID()).then(data=>({data}));}
}
@ApiTags('Member - Events') @ApiBearerAuth('memberBearer') @UseGuards(MemberAuthenticationGuard) @Controller('member/events')
export class MemberEventsController{
 constructor(private s:MemberEventsService){}
 @Get() list(@Req() req:any){return this.s.memberList(req.user.personId).then(data=>({data}));}
 @Get(':eventCode') detail(@Req() req:any,@Param('eventCode') code:string){return this.s.memberDetail(req.user.personId,code).then(data=>({data}));}
 @Post(':eventCode/register') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 register(@Req() req:any,@Param('eventCode') code:string,@Headers('idempotency-key') key:string){return this.s.register(req.user.personId,code,key,req.requestId??randomUUID()).then(data=>({data}));}
 @Post(':eventCode/cancel') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 cancel(@Req() req:any,@Param('eventCode') code:string,@Headers('idempotency-key') key:string){return this.s.cancel(req.user.personId,code,key,req.requestId??randomUUID()).then(data=>({data}));}
 @Post(':eventCode/credential') @UseGuards(IdempotencyGuard) @ApiHeader({name:'Idempotency-Key',required:true})
 credential(@Req() req:any,@Param('eventCode') code:string,@Headers('idempotency-key') key:string){return this.s.credential(req.user.personId,code,key,req.requestId??randomUUID()).then(data=>({data}));}
}