import Fastify from 'fastify';
import cors from '@fastify/cors';
import { corsMethods } from '../src/common/http-methods';

it.each([['PATCH','https://stage.ucell.life','/api/v1/member/delivery-profile'],['PUT','https://admin-stage.ucell.life','/api/v1/admin/package-config/versions/00000000-0000-4000-8000-000000000001/selectable-products']])('permits %s preflight without dropping auth or idempotency headers', async (method,origin,url) => {
  const app=Fastify();
  await app.register(cors,{origin:['https://stage.ucell.life','https://admin-stage.ucell.life'],credentials:true,methods:corsMethods});
  try {
    const result=await app.inject({method:'OPTIONS',url,headers:{origin,'access-control-request-method':method,'access-control-request-headers':'authorization,content-type,idempotency-key'}});
    expect(result.statusCode).toBe(204);
    expect(String(result.headers['access-control-allow-methods']).split(',').map(method=>method.trim())).toContain(method);
    expect(result.headers['access-control-allow-headers']).toBe('authorization,content-type,idempotency-key');
    const denied=await app.inject({method:'OPTIONS',url,headers:{origin:'https://untrusted.invalid','access-control-request-method':method}});
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  } finally {await app.close();}
});
