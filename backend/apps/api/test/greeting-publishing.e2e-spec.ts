import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {Reflector} from '@nestjs/core';
import {ConfigService} from '@nestjs/config';
import {imageType,normalizeGreetingUpload} from '../src/modules/daily-greetings/greeting-upload';
import {GreetingPublicationService} from '../src/modules/daily-greetings/greeting-publication.service';
import {GreetingPublicationController,DotGreetingController} from '../src/modules/daily-greetings/greeting-publication.controller';
import {DailyGreetingService} from '../src/modules/daily-greetings/daily-greeting.service';
import {AdminRoleGuard} from '../src/modules/auth/admin-role.guard';
import {AdminAuthenticationGuard} from '../src/modules/auth/admin-authentication.guard';
const png=readFileSync(join(__dirname,'../../../../member/tests/fixtures/daily-greeting-2026-11-11.png'));
describe('Greeting publishing controls',()=>{
 const enabled=process.env.DAILY_GREETING_PUBLISHING_ENABLED;
 afterEach(()=>{if(enabled===undefined)delete process.env.DAILY_GREETING_PUBLISHING_ENABLED;else process.env.DAILY_GREETING_PUBLISHING_ENABLED=enabled;jest.useRealTimers();});
 it('accepts bounded RGB PNG; rejects SVG, corruption, JPEG and oversized input',async()=>{
  expect(imageType(png)).toBe('png');const corrupt=Buffer.from(png);corrupt[50]^=1;
  for(const image of [corrupt,Buffer.from('<svg>'+ 'x'.repeat(100)+'</svg>'),Buffer.alloc(600001),Buffer.from([255,216,...Array(100).fill(0)])])expect(()=>imageType(image)).toThrow();
  await expect(normalizeGreetingUpload('not base64')).rejects.toThrow();
 });
 it('re-encodes pixels into a 1080px branded PNG',async()=>{
  const result=await normalizeGreetingUpload(png.toString('base64'));
  expect(imageType(result)).toBe('png');expect(result.readUInt32BE(16)).toBe(1080);expect(result.readUInt32BE(20)).toBe(1080);expect(result.equals(png)).toBe(false);
 });
 it('never touches persistence while disabled',async()=>{
  delete process.env.DAILY_GREETING_PUBLISHING_ENABLED;const db={$queryRaw:jest.fn()},service=new GreetingPublicationService(db as any,{} as any,{} as any);
  await expect(service.list()).rejects.toThrow();expect(await service.released()).toBeNull();expect(db.$queryRaw).not.toHaveBeenCalled();
 });
 it('reserves dot without enabling it through a feature flag',()=>{
  process.env.DAILY_GREETING_PUBLISHING_ENABLED='true';expect(()=>new DotGreetingController().draft()).toThrow();
 });
 it('requires admin authentication; audit-only and member roles cannot write',async()=>{
  const context=(role?:string,handler='draft')=>({switchToHttp:()=>({getRequest:()=>({url:'/api/v1/admin/daily-greetings',headers:{},user:role?{role}:undefined})}),getHandler:()=>(GreetingPublicationController.prototype as any)[handler],getClass:()=>GreetingPublicationController}) as any;
  const authentication=new AdminAuthenticationGuard({} as any,new ConfigService({NODE_ENV:'production'}));await expect(authentication.canActivate(context())).rejects.toThrow();
  const guard=new AdminRoleGuard(new Reflector());for(const role of ['COMPLIANCE_AUDIT','NETWORK_MEMBER','UNKNOWN'])expect(()=>guard.canActivate(context(role))).toThrow();
  for(const role of ['SUPER_ADMIN','ORDER_OPS'])expect(guard.canActivate(context(role))).toBe(true);expect(guard.canActivate(context('COMPLIANCE_AUDIT','list'))).toBe(true);
 });
 it('retains the honest published date with a future refresh window',async()=>{
  const source={released:jest.fn().mockResolvedValue({id:'00000000-0000-0000-0000-000000000001',image_hash:'a'.repeat(64),greeting_date:'2026-11-10',title:'已核准',message:'保留昨日圖片',publish_at:new Date('2026-11-09T23:00:00Z')})};
  const service=new DailyGreetingService(source as any),render=jest.spyOn(service,'image');const result=await service.current(new Date('2026-11-11T02:00:00Z'));
  expect(result.date).toBe('2026-11-10');expect(result.renderer).toBe('reviewed-upload-v1');expect(result.nextRefreshAt).toBe('2026-11-11T23:00:00.000Z');expect(render).not.toHaveBeenCalled();
 });
 it('retries warm-up after 30 seconds and stops on shutdown',async()=>{
  jest.useFakeTimers().setSystemTime(new Date('2026-11-11T02:00:00Z'));const service=new DailyGreetingService(),current=jest.spyOn(service,'current').mockRejectedValue(new Error('temporary'));
  service.onApplicationBootstrap();await jest.advanceTimersByTimeAsync(29999);expect(current).toHaveBeenCalledTimes(1);await jest.advanceTimersByTimeAsync(1);expect(current).toHaveBeenCalledTimes(2);service.onModuleDestroy();await jest.advanceTimersByTimeAsync(900000);expect(current).toHaveBeenCalledTimes(2);
 });
});
