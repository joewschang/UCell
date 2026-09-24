import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { LineMessagingIngressService } from './line-messaging-ingress.service';

@ApiTags('Integrations - LINE Messaging')
@Controller('integrations/line/messaging')
export class LineMessagingWebhookController {
  constructor(private readonly ingress:LineMessagingIngressService,private readonly config:ConfigService){}
  @Post('webhook') @HttpCode(200)
  @ApiOperation({operationId:'lineMessagingWebhook',summary:'LINE Messaging raw-body webhook ingress',description:'Validates x-line-signature over untouched UTF-8 bytes, deduplicates metadata into the IDENTITY inbox, then returns quickly. Raw payloads and secrets are never persisted.'})
  @ApiResponse({status:200,description:'Verified webhook accepted for asynchronous processing'})
  @ApiResponse({status:401,description:'Signature or payload invalid'})
  @ApiResponse({status:503,description:'LINE Messaging configuration is unavailable'})
  async receive(@Req() req:any,@Headers('x-line-signature') signature?:string){
    await this.ingress.receive({rawBody:req.rawBody,signature,channelSecret:this.config.get<string>('LINE_MESSAGING_CHANNEL_SECRET'),configVersion:this.config.get<string>('LINE_MESSAGING_CONFIG_VERSION')});
    return {data:{accepted:true}};
  }
}
