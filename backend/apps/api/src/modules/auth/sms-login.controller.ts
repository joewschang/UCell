import {Body,Controller,Get,Headers,Post,UseGuards} from '@nestjs/common';
import {IsString,IsUUID,Matches,MaxLength} from 'class-validator';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {SmsLoginService} from './sms-login.service';
class SmsRequestDto{@IsString() @MaxLength(32) mobile!:string;}
class SmsLoginDto extends SmsRequestDto{@IsUUID() challengeId!:string;@Matches(/^\d{6}$/) code!:string;}
@Controller('auth/member/sms')
export class SmsLoginController{
 constructor(private readonly service:SmsLoginService){}
 @Get('policy') policy(){return {enabled:this.service.enabled()};}
 @Post('challenges') @UseGuards(IdempotencyGuard) request(@Body() body:SmsRequestDto,@Headers('idempotency-key') key:string){return this.service.request(body.mobile,key);}
 @Post('login') login(@Body() body:SmsLoginDto){return this.service.login(body.mobile,body.challengeId,body.code);}
}
