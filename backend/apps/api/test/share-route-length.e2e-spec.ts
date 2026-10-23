import {FastifyAdapter} from '@nestjs/platform-fastify';
import {HTTP_OPTIONS} from '../src/http-options';
describe('Share-token HTTP routing',()=>{
 const adapter=new FastifyAdapter({...HTTP_OPTIONS,logger:false});
 const app=adapter.getInstance();
 beforeAll(async()=>{for(const route of ['card','preview'])app.get(`/api/v1/referrals/${route}/:token`,async(req:any)=>({length:req.params.token.length}));await app.ready();});
 afterAll(async()=>{await app.close();});
 it.each(['card','preview'])('accepts long generated tokens on %s and retains a finite limit',async(route)=>{
  for(const length of [430,4096]){const result=await app.inject({method:'GET',url:`/api/v1/referrals/${route}/`+'a'.repeat(length)});expect(result.statusCode).toBe(200);expect(result.json()).toEqual({length});}
  const rejected=await app.inject({method:'GET',url:`/api/v1/referrals/${route}/`+'a'.repeat(4097)});expect(rejected.statusCode).toBeGreaterThanOrEqual(400);
 });
});
