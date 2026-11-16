import type {NestFastifyApplication} from '@nestjs/platform-fastify';
/** Route-specific limit: do not expand unrelated JSON endpoints. Install before app.init(). */
export function configureGreetingPushTransport(app:NestFastifyApplication){
 app.getHttpAdapter().getInstance().addHook('onRoute',(options:any)=>{
  if(options.method==='POST'&&options.url==='/api/v1/integrations/dot/daily-greetings/publish')options.bodyLimit=11_000_000;
 });
}
