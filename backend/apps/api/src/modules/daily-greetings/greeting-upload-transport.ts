import type {NestFastifyApplication} from '@nestjs/platform-fastify';
/** Reconcile the existing production-only limit without expanding unrelated routes. */
export function configureGreetingUploadTransport(app:NestFastifyApplication){
 app.getHttpAdapter().getInstance().addHook('onRoute',(route:any)=>{
  if(route.method==='POST'&&route.url==='/api/v1/admin/daily-greetings')route.bodyLimit=5*1024*1024;
 });
}
