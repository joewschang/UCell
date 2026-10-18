import {Body,CanActivate,Controller,ExecutionContext,Get,Headers,Injectable,Param,ParseUUIDPipe,Post,Req,UnauthorizedException,UseGuards} from '@nestjs/common';
import {ArrayMaxSize,IsArray,IsBoolean,IsInt,IsOptional,IsString,Matches,Max,MaxLength,Min,MinLength} from 'class-validator';
import {IdempotencyGuard} from '../../common/guards/idempotency.guard';
import {IdentityTokenService} from './identity-token.service';
import {Roles} from './roles.decorator';
import {SmsNotificationService} from './sms-notification.service';
@Injectable()
export class SmsNotificationGuard implements CanActivate{
 constructor(private readonly tokens:IdentityTokenService){}
 async canActivate(ctx:ExecutionContext){const req=ctx.switchToHttp().getRequest(),auth=String(req.headers.authorization??'');if(!auth.startsWith('Bearer '))throw new UnauthorizedException('ADMIN_BEARER_REQUIRED');const user=await this.tokens.authenticate(auth.slice(7));if(!['ADMIN_LOCAL','ENTRA'].includes(user.provider)||!['SUPER_ADMIN','MEMBERSHIP_OPS'].includes(user.role??''))throw new UnauthorizedException('SMS_ADMIN_REQUIRED');req.user=user;return true;}
}
class DraftDto{
 @IsString() @MinLength(1) @MaxLength(293) message!:string;
 @IsOptional() @IsArray() @ArrayMaxSize(500) @Matches(/^\d{10}$/,{each:true}) memberNos?:string[];
 @IsOptional() @IsBoolean() allVerified?:boolean;
}
class SendDto{@Matches(/^[a-f0-9]{64}$/) contentHash!:string;@IsInt() @Min(1) @Max(500) recipientCount!:number;}
@Controller('admin/sms') @Roles('SUPER_ADMIN','MEMBERSHIP_OPS') @UseGuards(SmsNotificationGuard)
export class SmsNotificationController{
 constructor(private readonly service:SmsNotificationService){}
 private actor(req:any){return `${req.user.provider}:${req.user.subject}`;}
 @Get('campaigns') list(){return this.service.list();}
 @Post('campaigns') @UseGuards(IdempotencyGuard) draft(@Req() req:any,@Body() body:DraftDto,@Headers('idempotency-key') key:string){return this.service.draft(this.actor(req),body,key);}
 @Post('campaigns/:id/send') send(@Req() req:any,@Param('id',new ParseUUIDPipe()) id:string,@Body() body:SendDto){return this.service.send(this.actor(req),id,body.contentHash,body.recipientCount);}
}
