import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { AppModule } from './app.module';

async function main(){
  const app=await NestFactory.create<NestFastifyApplication>(
    AppModule,new FastifyAdapter(),{logger:false}
  );
  app.setGlobalPrefix('api/v1');

  const config=new DocumentBuilder()
    .setTitle('UCell R1.0B API')
    .setDescription('UCell Core API — Rule Version R1.0B FROZEN')
    .setVersion('1.0.0')
    .addBearerAuth(undefined,'adminBearer')
    .addBearerAuth(undefined,'memberBearer')
    .build();

  const doc=SwaggerModule.createDocument(app,config);
  for(const name of ['MemberExplainActiveQuery','MemberExplainCarryQuery','MemberLogoutDto','MemberProfileDto','MemberContextDto','MemberQueryDto','MemberCreateOrderDto','CreateOrderItemDto','LineExchangeDto']){
    const schema=doc.components?.schemas?.[name];
    if(schema&&'properties' in schema)schema.additionalProperties=false;
  }
  const output=resolve(process.cwd(),'../../openapi.generated.json');
  writeFileSync(output,JSON.stringify(doc,null,2));
  await app.close();
  console.log(`OPENAPI_EXPORTED ${output}`);
}
main();
