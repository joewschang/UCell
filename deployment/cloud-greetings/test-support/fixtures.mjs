import {deflateSync} from 'node:zlib';
import {prepareRequest} from '../uploader.mjs';
export const NOW = new Date('2026-11-16T23:00:00Z');
export const KEY = '11111111-1111-4111-8111-111111111111';
export const URL = 'https://publisher.example.invalid/api/v1/integrations/dot/daily-greetings/publish';
export const TOKEN = 'SYNTHETIC_TOKEN_NOT_REAL';
function chunk(type, data) {
  const b=Buffer.alloc(data.length+12);b.writeUInt32BE(data.length);b.write(type,4);data.copy(b,8);
  let crc=0xffffffff;for(const v of b.subarray(4,-4)){crc^=v;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}b.writeUInt32BE((crc^0xffffffff)>>>0,b.length-4);return b;
}
const hdr=Buffer.alloc(13);hdr.writeUInt32BE(1024);hdr.writeUInt32BE(1024,4);hdr[8]=8;hdr[9]=2;
const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',hdr),chunk('IDAT',deflateSync(Buffer.alloc(1024*3073))),chunk('IEND',Buffer.alloc(0))]);
export const payload={date:'2026-11-17',title:'早安',message:'平安喜樂',contentBase64:png.toString('base64')};
export const prepared=()=>prepareRequest(payload,KEY,NOW);
export const result={date:payload.date,id:KEY,status:'PUBLISHED'};
export const success=()=>Response.json(result);
