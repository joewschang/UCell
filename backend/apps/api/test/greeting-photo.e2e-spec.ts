import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {greetingPhotos,greetingPhoto,greetingPhotoData} from '../src/modules/daily-greetings/greeting-photo';
import {DailyGreetingService} from '../src/modules/daily-greetings/daily-greeting.service';
import {greetingSvg,GREETING_VERSION} from '../src/modules/daily-greetings/daily-greeting';
const GREETING_PHOTOS=greetingPhotos();
describe('Reviewed high-resolution photographic backgrounds',()=>{
 it('bundles ten distinct CC0 assets with provenance and verified hashes',()=>{
  expect(GREETING_PHOTOS).toHaveLength(10);expect(new Set(GREETING_PHOTOS.map(p=>p.sha256)).size).toBe(10);
  for(const photo of GREETING_PHOTOS){
   expect(photo.license).toBe('CC0');expect(photo.licenseUrl).toContain('creativecommons.org/publicdomain/zero');
   expect(photo.sourcePage).toMatch(/^https:\/\/commons.wikimedia.org\/wiki\/File:/);expect(photo.author.trim()).not.toBe('');
   expect(photo.width).toBeGreaterThanOrEqual(2160);expect(photo.height).toBeGreaterThanOrEqual(1440);
   const bytes=readFileSync(join(__dirname,'../src/modules/daily-greetings/assets/photos',photo.file));
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(photo.sha256);expect(bytes.length).toBeLessThan(3_000_000);
  }
 });
 it('uses every photo before repeating, with different adjacent subject categories',()=>{
  const dates=Array.from({length:24},(_,i)=>new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10));
  const photos=dates.map(greetingPhoto);expect(new Set(photos.slice(0,10).map(p=>p.id)).size).toBe(10);
  for(let i=1;i<photos.length;i++)expect(photos[i].category).not.toBe(photos[i-1].category);
  expect(photos[0].id).toBe(photos[10].id);
 });
 it('renders every background within the existing 3 MB database limit',async()=>{
  const service=new DailyGreetingService();
  try{for(let i=0;i<10;i++){const date=new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10);const png=await service.image(date,new Date('2026-11-13T12:00:00Z'));expect(png.length).toBeLessThanOrEqual(3_000_000);expect(png.readUInt32BE(16)).toBe(1080);expect(png.readUInt32BE(20)).toBe(1080);}}finally{service.onModuleDestroy();}
 });
 it('rejects malformed dates and embeds photos rather than hotlinking third parties',()=>{
  for(const date of ['bad','2026-02-30','../../secret'])expect(()=>greetingPhoto(date)).toThrow();
  const date='2026-11-13',svg=greetingSvg(date,'data:image/jpeg;base64,dGVzdA==');
  expect(svg).toContain(greetingPhotoData(date));expect(svg).not.toMatch(/href="https?:/);expect(svg).toContain('fill-opacity=".95"');
  expect(GREETING_VERSION).toBe('template-v3-photography');
 });
});
