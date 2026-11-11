import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {greetingCopy,greetingDate,greetingSvg,validGreetingDate} from '../src/modules/daily-greetings/daily-greeting';
import {DailyGreetingService} from '../src/modules/daily-greetings/daily-greeting.service';
describe('Daily greeting published schedule and PNG',()=>{
 const now=new Date('2026-11-11T12:00:00Z');
 const logo='data:image/jpeg;base64,'+readFileSync(join(__dirname,'../src/modules/daily-greetings/assets/ucell-official-logo.jpeg')).toString('base64');
 it('switches exactly at 07:00 Taipei across UTC/year boundaries',()=>{
  expect(greetingDate(new Date('2026-11-10T22:59:59Z'))).toBe('2026-11-10');
  expect(greetingDate(new Date('2026-11-10T23:00:00Z'))).toBe('2026-11-11');
  expect(greetingDate(new Date('2026-12-31T23:00:00Z'))).toBe('2027-01-01');
 });
 it('rejects invalid, path-like and unpublished dates',()=>{
  for(const date of ['2026-02-30','../../x','2026-11-12','2025-12-31','x','2026-1-01'])expect(validGreetingDate(date,now)).toBe(false);
  expect(validGreetingDate('2026-11-11',now)).toBe(true);
 });
 it('uses Chinese calendar dates and Taiwan fixed observances',()=>{
  expect(greetingCopy('2026-02-17').title).toContain('新春');
  expect(greetingCopy('2026-03-03').title).toContain('元宵');
  expect(greetingCopy('2026-06-19').title).toContain('端午');
  expect(greetingCopy('2026-09-25').title).toContain('中秋');
  expect(greetingCopy('2026-05-10').title).toContain('母親節');
  expect(greetingCopy('2026-05-17').category).not.toBe('節慶');
  expect(greetingCopy('2026-08-08').title).toContain('父親節');
  expect(greetingCopy('2027-02-06').title).toContain('新春');
  expect(greetingCopy('2027-02-07').category).not.toBe('節慶');
  expect(greetingCopy('2027-02-20').title).toContain('元宵');
  expect(greetingCopy('2027-06-09').title).toContain('端午');
  expect(greetingCopy('2027-09-15').title).toContain('中秋');
 });
 it('contains artwork and brand with distinct daily palettes and copy',()=>{
  expect(greetingSvg('2026-11-11',logo)).toContain(logo);
  expect(greetingSvg('2026-11-11',logo)).toContain('preserveAspectRatio="xMidYMid meet"');
  expect(greetingSvg('2026-11-11',logo)).toContain('<path');
  expect(greetingSvg('2026-11-11',logo)).not.toBe(greetingSvg('2026-11-12',logo));
 });
 it('renders a stable real 1080px PNG and plain public share metadata',async()=>{
  const service=new DailyGreetingService(),png=await service.image('2026-11-11',now);
  expect(png.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
  expect(png.readUInt32BE(16)).toBe(1080);expect(png.readUInt32BE(20)).toBe(1080);
  expect(await service.image('2026-11-11',now)).toBe(png);
  expect((await service.current(now)).nextRefreshAt).toBe('2026-11-11T23:00:00.000Z');
  const html=await service.shareHtml('2026-11-11',now);expect(html).toContain('og:image');expect(html).not.toContain('<script');
  await expect(service.image('2026-11-12',now)).rejects.toThrow();
 });
 it('deduplicates requests and rejects excess render queue without blocking API timers',async()=>{
  const service=new DailyGreetingService();let timerFired=false;setTimeout(()=>{timerFired=true;},0);
  const jobs=['2026-11-01','2026-11-02','2026-11-03','2026-11-04'].map(date=>service.image(date,now));
  await expect(service.image('2026-11-05',now)).rejects.toThrow();
  const same=service.image('2026-11-01',now);
  const images=await Promise.all(jobs);expect(await same).toBe(images[0]);expect(timerFired).toBe(true);
 });
 it('rechecks the release date after rendering crosses 07:00',async()=>{
  jest.useFakeTimers().setSystemTime(new Date('2026-11-10T22:59:59.999Z'));
  try{
   const service=new DailyGreetingService();const render=jest.spyOn(service,'image').mockImplementation(async()=>{jest.setSystemTime(new Date('2026-11-10T23:00:00.001Z'));return Buffer.alloc(1);});
   expect((await service.current()).date).toBe('2026-11-11');expect(render.mock.calls.map(call=>call[0])).toEqual(['2026-11-10','2026-11-11']);
  }finally{jest.useRealTimers();}
 });
 it('does not recreate a scheduled timer after shutdown during warmup',async()=>{
  jest.useFakeTimers();
  try{
   const service=new DailyGreetingService();let resolve!:()=>void;
   jest.spyOn(service,'current').mockImplementation(()=>new Promise<any>(done=>{resolve=()=>done({date:'2026-11-11'});}));
   service.onApplicationBootstrap();service.onModuleDestroy();resolve();await Promise.resolve();
   expect(jest.getTimerCount()).toBe(0);
  }finally{jest.useRealTimers();}
 });
 it('does not advertise a poster with a missing Chinese font',async()=>{
  const original=process.env.DAILY_GREETING_FONT_PATH;process.env.DAILY_GREETING_FONT_PATH='/missing/font.ttc';
  try{await expect(new DailyGreetingService().current(now)).rejects.toThrow();}finally{if(original===undefined)delete process.env.DAILY_GREETING_FONT_PATH;else process.env.DAILY_GREETING_FONT_PATH=original;}
 });
});
