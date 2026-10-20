import {Test} from '@nestjs/testing';
import {FastifyAdapter,NestFastifyApplication} from '@nestjs/platform-fastify';
import {ReferralAttributionController} from '../src/modules/member/referral-attribution.controller';
import {ReferralAttributionService} from '../src/modules/member/referral-attribution.service';
import {MemberShareLinkService} from '../src/modules/member/member-share-link.service';
import {EnvelopeInterceptor} from '../src/common/interceptors/envelope.interceptor';
describe('Share card through the real Fastify transport and envelope interceptor',()=>{
 let app:NestFastifyApplication;
 const preview=jest.fn();
 beforeAll(async()=>{
  const module=await Test.createTestingModule({controllers:[ReferralAttributionController],providers:[{provide:ReferralAttributionService,useValue:{}},{provide:MemberShareLinkService,useValue:{preview}}]}).compile();
  app=module.createNestApplication<NestFastifyApplication>(new FastifyAdapter());
  app.useGlobalInterceptors(new EnvelopeInterceptor());await app.init();await app.getHttpAdapter().getInstance().ready();
 });
 afterAll(()=>app.close());
 it('serves HTML social metadata rather than serializing the reply into JSON',async()=>{
  preview.mockResolvedValueOnce({content:{title:'公開影片',summary:'介紹',thumbnailUrl:'https://example.com/image.png'}});
  const response=await app.inject({method:'GET',url:'/referrals/card/TEST'});
  expect(response.statusCode).toBe(200);expect(response.headers['content-type']).toContain('text/html');
  expect(response.headers['cache-control']).toBe('no-store');expect(response.body).toContain('og:title');
  expect(response.body).toContain('公開影片');expect(response.body).not.toContain('"data":');
 });
 it('returns an actionable HTML shell with 410 for a revoked or invalid share',async()=>{
  preview.mockRejectedValueOnce(new Error('INVALID'));
  const response=await app.inject({method:'GET',url:'/referrals/card/INVALID'});
  expect(response.statusCode).toBe(410);expect(response.body).toContain('/share-entry.js');expect(response.body).not.toContain('og:image');
 });
});
