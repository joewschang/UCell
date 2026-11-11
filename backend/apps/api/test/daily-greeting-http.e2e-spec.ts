import {NestFactory} from '@nestjs/core';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import {DailyGreetingModule} from '../src/modules/daily-greetings/daily-greeting.module';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
import {greetingDate} from '../src/modules/daily-greetings/daily-greeting';

describe('Public daily greeting HTTP contract',()=>{
 let app:NestFastifyApplication;
 beforeAll(async()=>{
  app=await NestFactory.create<NestFastifyApplication>(DailyGreetingModule,new FastifyAdapter(),{logger:false});
  app.setGlobalPrefix('api/v1');await app.register(helmet);await app.register(cors,{origin:['https://member.ucell.life']});
  app.useGlobalInterceptors(new EnvelopeInterceptor());await app.init();await app.getHttpAdapter().getInstance().ready();
 });
 afterAll(async()=>{await app?.close();});
 it('serves envelope, PNG and no-script OG share page without credentials',async()=>{
  const headers={origin:'https://member.ucell.life'},base='/api/v1/public/daily-greetings/',date=greetingDate();
  const current=await app.inject({url:base+'current',headers});
  expect(current.statusCode).toBe(200);expect(current.json().data.date).toBe(date);expect(current.headers['cache-control']).toBe('no-store');
  const png=await app.inject({url:base+date+'/image.png',headers});
  expect(png.statusCode).toBe(200);expect(png.headers['content-type']).toBe('image/png');
  expect(png.rawPayload.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.headers['access-control-allow-origin']).toBe(headers.origin);
  expect(png.headers['cross-origin-resource-policy']).toBe('cross-origin');
  const html=await app.inject({url:base+date+'/share',headers});
  expect(html.statusCode).toBe(200);expect(html.headers['content-type']).toContain('text/html');
  expect(html.body).toContain('property="og:image"');expect(html.body).not.toContain('<script');
  expect(html.headers['content-security-policy']).toContain("default-src 'none'");
 });
 it('does not serve malformed or future image dates',async()=>{
  for(const date of ['2026-02-30','9999-01-01','not-a-date'])expect((await app.inject({url:`/api/v1/public/daily-greetings/${date}/image.png`})).statusCode).toBe(404);
 });
});
