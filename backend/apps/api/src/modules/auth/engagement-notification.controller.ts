import {Body,Controller,Headers,Param,Post,Req,UseGuards,BadRequestException} from '@nestjs/common';
import {IsIn,IsString,IsUUID,Length,Matches} from 'class-validator';
import {Roles} from './roles.decorator';
import {SmsNotificationGuard} from './sms-notification.controller';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {EngagementNotificationService} from './engagement-notification.service';
class NotificationDto{@Matches(/^\d{10}$/) memberNo!:string;@IsIn(['SMS','LINE']) channel!:'SMS'|'LINE';@IsString() @Length(1,293) message!:string;}
@Controller('admin/engagement') @Roles('SUPER_ADMIN','MEMBERSHIP_OPS') @UseGuards(SmsNotificationGuard)
export class EngagementNotificationController{
 constructor(private service:EngagementNotificationService){}
 @Post(':kind/:code/notify') @UseGuards(IdempotencyGuard)
 notify(@Param('kind') kind:string,@Param('code') code:string,@Body() body:NotificationDto,@Headers('idempotency-key') key:string,@Req() req:any){
 if(!['EVENT','COURSE'].includes(kind)||!/^[A-Z][A-Z0-9_-]{2,39}$/.test(code)||! /^[0-9a-f-]{36}$/i.test(key))throw new BadRequestException('NOTIFICATION_INPUT_INVALID');
 return this.service.notify(kind as 'EVENT'|'COURSE',code,body,req.user.provider+':'+req.user.subject,key).then(data=>({data}));
 }
}
