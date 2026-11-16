import {Body,Controller,Headers,HttpCode,Post,Req,UseGuards} from '@nestjs/common';
import {ApiOperation,ApiTags,ApiBearerAuth,ApiBody,ApiHeader} from '@nestjs/swagger';
import {GreetingPushGuard} from './cloud-greeting-auth';
import {GreetingPushService} from './greeting-push.service';
@ApiTags('Integrations - Daily greetings') @ApiBearerAuth('greetingMachineBearer')
@Controller('integrations/dot/daily-greetings') @UseGuards(GreetingPushGuard)
export class GreetingPushController {
 constructor(private service:GreetingPushService){}
 @ApiHeader({name:'idempotency-key',required:true,schema:{type:'string',format:'uuid'}})
 @ApiBody({schema:{type:'object',additionalProperties:false,required:['date','title','message','contentBase64'],properties:{date:{type:'string',format:'date'},title:{type:'string',minLength:1,maxLength:8},message:{type:'string',minLength:1,maxLength:60},contentBase64:{type:'string',minLength:60,maxLength:10666668,description:'Unbranded 1024x1024 RGB/RGBA PNG; at most 8000000 decoded bytes. Server composes trusted copy, logo and QR.'}}}})
 @Post('publish') @HttpCode(200)
 @ApiOperation({operationId:'publishDotDailyGreeting',description:'Pinned app-only Greeting.Publish credential; date/title/message/PNG only; immutable publication.'})
 publish(@Body() body:unknown,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.publish(body,key,req.greetingActor);}
}
