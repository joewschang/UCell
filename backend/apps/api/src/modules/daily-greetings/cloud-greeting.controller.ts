import {Body,Controller,HttpCode,Post,Req,UseGuards,BadRequestException} from '@nestjs/common';
import {GreetingMachineGuard} from './cloud-greeting-auth';
import {CloudGreetingService} from './cloud-greeting.service';
/** Narrow trigger only: caller cannot upload arbitrary images, choose prompts, replace, archive or read drafts. */
@Controller('integrations/dot/daily-greetings') @UseGuards(GreetingMachineGuard)
export class CloudGreetingController {
 constructor(private cloud:CloudGreetingService){}
 @Post('generate') @HttpCode(200) generate(@Body() body:unknown,@Req() req:any){
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).length!==1||typeof (body as any).date!=='string')throw new BadRequestException({code:'GREETING_GENERATION_REQUEST_INVALID'});
  return this.cloud.run((body as any).date,req.greetingActor);
 }
}
