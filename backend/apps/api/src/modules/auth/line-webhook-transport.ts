import { RequestMethod } from '@nestjs/common';
import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { captureLineWebhookRawBody } from './line-webhook-raw-body';

export const lineWebhookPrefixOptions = {exclude:[{path:'api/line/webhook',method:RequestMethod.POST}]};
/** Shared by production bootstrap and HTTP tests; both routes preserve exact bytes. */
export function configureLineWebhookTransport(app:NestFastifyApplication){
  app.setGlobalPrefix('api/v1',lineWebhookPrefixOptions);
  app.getHttpAdapter().getInstance().addHook('preParsing',(request:any,_reply:any,payload:any,done:any):void=>{
    const path=String(request.raw?.url??request.url??'').split('?')[0];
    if(['/api/line/webhook','/api/v1/integrations/line/messaging/webhook'].includes(path))return done(null,captureLineWebhookRawBody(request,payload));
    done(null,payload);
  });
}
