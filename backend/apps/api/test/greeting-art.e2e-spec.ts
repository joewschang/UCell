import {greetingArtwork,greetingTheme,THEME_LABELS} from '../src/modules/daily-greetings/greeting-art';
import {greetingCopy,greetingSvg,GREETING_VERSION} from '../src/modules/daily-greetings/daily-greeting';
describe('Reviewed daily theme rotation',()=>{
 it('rotates all six ordinary themes deterministically and gives holidays precedence',()=>{
  const themes=Array.from({length:6},(_,i)=>greetingTheme(`2026-11-${11+i}`,false));
  expect(new Set(themes).size).toBe(6);expect(greetingTheme('2026-09-25',true)).toBe('festival');
  for(const theme of themes)expect(greetingArtwork(theme)).not.toMatch(/https?:|<script|<image/);
  expect(new Set(Object.keys(THEME_LABELS).map(t=>greetingArtwork(t as any))).size).toBe(7);
 });
 it('prioritizes verified festivals over weekend copy and uses weekend greetings on ordinary weekends',()=>{
  expect(greetingCopy('2026-11-14').title).toContain('週末愉快');
  expect(greetingCopy('2026-11-15').title).toContain('週末愉快');
  expect(greetingCopy('2027-02-06').title).toContain('新春');
  expect(greetingCopy('2028-02-06').category).not.toBe('節慶');
 });
 it('has daytime greetings and only conditional weather care without invented observations',()=>{
  const copies=Array.from({length:60},(_,i)=>greetingCopy(new Date(Date.UTC(2026,10,1+i)).toISOString().slice(0,10)));
  expect(copies.some(c=>c.title.startsWith('日安'))).toBe(true);
  expect(copies.some(c=>c.lines.join('').includes('所在地氣象預報'))).toBe(true);
  expect(copies.map(c=>c.lines.join('')).join('')).not.toMatch(/今日.*下雨|氣溫|降雨機率|颱風警報/);
 });
 it('keeps full-year copy inside the readable layout and brands every original scene',()=>{
  const logo='data:image/jpeg;base64,dGVzdA==';
  for(let i=0;i<730;i++){
   const date=new Date(Date.UTC(2026,0,1+i)).toISOString().slice(0,10),copy=greetingCopy(date),svg=greetingSvg(date,logo);
   expect(copy.title.length).toBeLessThanOrEqual(16);copy.lines.forEach(line=>expect(line.length).toBeLessThanOrEqual(24));
   expect(svg).toContain(logo);expect(svg).toContain('width="1080" height="1080"');
   if(greetingTheme(date,copy.category==='節慶')==='weather')expect(svg).toContain('非即時預報');
  }
  expect(GREETING_VERSION).toBe('template-v2-themes');
 });
});
