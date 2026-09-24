import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import { AppModule } from './app.module';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';
import { EnvelopeInterceptor } from './common/interceptors/envelope.interceptor';
import { RequestContextInterceptor } from './common/interceptors/request-context.interceptor';
import { captureLineWebhookRawBody } from './modules/auth/line-webhook-raw-body';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true }),
  );

  const config = app.get(ConfigService);
  const fastify:any=app.getHttpAdapter().getInstance();
  fastify.addHook('preParsing', (request:any, _reply:any, payload:any, done:any) => {
    const url=String(request.raw?.url??request.url??'').split('?')[0];
    if (url==='/api/v1/integrations/line/messaging/webhook') return done(null,captureLineWebhookRawBody(request,payload));
    done(null,payload);
  });
  await app.register(helmet);
  await app.register(cors, {
    origin: process.env.NODE_ENV === 'production'
      ? ['https://admin.ucell.life', 'https://app.ucell.life']
      : true,
    credentials: true,
  });

  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }));
  app.useGlobalFilters(new ApiExceptionFilter());
  app.useGlobalInterceptors(
    new RequestContextInterceptor(),
    new EnvelopeInterceptor(),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('UCell R1.0B API')
    .setDescription('UCell Core API. API version and Rule Version are independent.')
    .setVersion('1.0.0')
    .addBearerAuth(undefined, 'adminBearer')
    .addBearerAuth(undefined, 'memberBearer')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  if (config.get('SWAGGER_ENABLED') === 'true') {
    SwaggerModule.setup('docs', app, document);
  }

  await app.listen(Number(config.get('PORT') ?? 3000), '0.0.0.0');
}

bootstrap();
