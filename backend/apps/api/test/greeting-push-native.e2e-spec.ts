import {Resvg} from '@resvg/resvg-js';
const {renderPushedGreeting}=require('../dist/modules/daily-greetings/cloud-greeting-render');
const png=(size=1024)=>Buffer.from(new Resvg(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="100%" height="100%" fill="#82a9bd"/></svg>`).render().asPng());
function metadata(input:Buffer){const data=Buffer.from('Comment\0synthetic-test-metadata'),type=Buffer.from('tEXt'),chunk=Buffer.alloc(data.length+12);chunk.writeUInt32BE(data.length);type.copy(chunk,4);data.copy(chunk,8);let crc=0xffffffff;for(const byte of chunk.subarray(4,-4)){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}chunk.writeUInt32BE((crc^0xffffffff)>>>0,chunk.length-4);return Buffer.concat([input.subarray(0,33),chunk,input.subarray(33)]);}
describe('Compiled native Dot image worker',()=>{
 it('composes trusted artwork, strips metadata and hashes canonical pixels without blocking timers',async()=>{
  const input=png();let ticked=false;const pending=renderPushedGreeting(input,'2026-11-17','早安');const timer=setTimeout(()=>{ticked=true;},0);
  const first=await pending;clearTimeout(timer);expect(ticked).toBe(true);expect(first.image.readUInt32BE(16)).toBe(1080);expect(first.image.readUInt32BE(20)).toBe(1080);expect(first.image.length).toBeLessThan(3_000_000);
  const second=await renderPushedGreeting(metadata(input),'2026-11-18','日安');expect(second.backgroundHash).toBe(first.backgroundHash);expect(second.image.includes(Buffer.from('synthetic-test-metadata'))).toBe(false);expect(second.image.equals(first.image)).toBe(false);
 });
 it('rejects malformed, non-square and lower-resolution images',async()=>{
  for(const input of [Buffer.alloc(100),png(512),Buffer.from(new Resvg('<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1080"><rect width="100%" height="100%" fill="red"/></svg>').render().asPng())])await expect(renderPushedGreeting(input,'2026-11-17','早安')).rejects.toThrow();
 });
 it('fails closed when the configured Traditional Chinese font is missing',async()=>{
  const saved=process.env.DAILY_GREETING_FONT_PATH;process.env.DAILY_GREETING_FONT_PATH='/missing/synthetic-font.ttc';try{await expect(renderPushedGreeting(png(),'2026-11-17','早安')).rejects.toThrow();}finally{if(saved===undefined)delete process.env.DAILY_GREETING_FONT_PATH;else process.env.DAILY_GREETING_FONT_PATH=saved;}
 });
});
