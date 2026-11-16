import {Body,Controller,Headers,HttpCode,Post,Req,UseGuards} from '@nestjs/common';
import {ApiOperation,ApiTags} from '@nestjs/swagger';
import {GreetingPushGuard} from './cloud-greeting-auth';
import {GreetingPushService} from './greeting-push.service';
@ApiTags('Integrations - Daily greetings')
@Controller('integrations/dot/daily-greetings') @UseGuards(GreetingPushGuard)
export class GreetingPushController {
 constructor(private service:GreetingPushService){}
 @Post('publish') @HttpCode(200)
 @ApiOperation({operationId:'publishDotDailyGreeting',description:'Pinned app-only Greeting.Publish credential; date/title/message/PNG only; immutable publication.'})
 publish(@Body() body:unknown,@Headers('idempotency-key') key:string,@Req() req:any){return this.service.publish(body,key,req.greetingActor);}
}
