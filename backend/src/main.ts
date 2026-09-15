import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());
  app.setGlobalPrefix('api/v1');
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  // Swagger UI is explicitly gated. Production must not expose it by accident.
  if (process.env.SWAGGER_ENABLED === 'true' && process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('UCell R1.0B API')
      .setDescription('Deterministic UCell Core API. Official PV/bonus results are server-owned.')
      .setVersion('1.0.0')
      .addBearerAuth()
      .build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, config));
  }

  await app.listen(Number(process.env.PORT ?? 3000), '0.0.0.0');
}
bootstrap();
