import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { LineMessagingIngressService } from './line-messaging-ingress.service';

@ApiTags('Integrations - LINE Messaging')
@Controller('api/line')
export class LineStageWebhookController {
  constructor(private readonly ingress:LineMessagingIngressService,private readonly config:ConfigService){}
  @Post('webhook') @HttpCode(200)
  @ApiOperation({operationId:'lineStageWebhook',summary:'LINE OA raw-body webhook; metadata-only durable receipt'})
  @ApiResponse({status:200,description:'Verified events or empty verification accepted'})
  @ApiResponse({status:401,description:'Invalid signature or payload'})
  @ApiResponse({status:503,description:'Channel secret is not configured'})
  async receive(@Req() req:any,@Headers('x-line-signature') signature?:string){
    await this.ingress.receive({rawBody:req.rawBody,signature,channelSecret:this.config.get<string>('LINE_CHANNEL_SECRET')??this.config.get<string>('LINE_MESSAGING_CHANNEL_SECRET'),configVersion:this.config.get<string>('LINE_MESSAGING_CONFIG_VERSION')??'LINE_WEBHOOK_V1'});
    return {data:{accepted:true}};
  }
}
