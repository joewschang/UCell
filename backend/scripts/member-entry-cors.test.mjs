import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {test} from 'node:test';
import {memberEntryCors} from '../apps/api/src/member-entry-cors.ts';
const require=createRequire(new URL('../apps/api/package.json',import.meta.url));
const Fastify=require('fastify'),cors=require('@fastify/cors');
test('actual Member preflight permits configured Stage origin and PATCH, but not an unlisted origin',async()=>{
 const app=Fastify();try{
  await app.register(cors,memberEntryCors({NODE_ENV:'production',CORS_ALLOWED_ORIGINS:'https://member.stage.test'}));
  const allowed=await app.inject({method:'OPTIONS',url:'/api/v1/member/profile',headers:{origin:'https://member.stage.test','access-control-request-method':'PATCH','access-control-request-headers':'authorization,content-type,idempotency-key'}});
  assert.equal(allowed.statusCode,204);assert.equal(allowed.headers['access-control-allow-origin'],'https://member.stage.test');
  assert.match(allowed.headers['access-control-allow-methods'],/PATCH/);assert.match(allowed.headers['access-control-allow-headers'],/authorization/);
  const denied=await app.inject({method:'OPTIONS',url:'/api/v1/member/profile',headers:{origin:'https://unlisted.test','access-control-request-method':'POST'}});
  assert.equal(denied.headers['access-control-allow-origin'],undefined);
 }finally{await app.close();}
});
