import {inflateSync} from 'node:zlib';
import {BadRequestException,ServiceUnavailableException} from '@nestjs/common';
import {greetingBrandSvg} from './greeting-brand';

import {renderGreeting} from './render-greeting';
let active=0;
export function imageType(bytes:Buffer):'png' {
 if(bytes.length<45||bytes.length>3_145_728)throw new BadRequestException({code:'GREETING_IMAGE_SIZE'});
 const fail=()=>{throw new BadRequestException({code:'GREETING_IMAGE_INVALID'});};
 if(bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')fail();
 let offset=8,width=0,height=0,channels=0,ended=false;const data:Buffer[]=[];
 while(offset+12<=bytes.length){
  const size=bytes.readUInt32BE(offset),end=offset+8+size;if(end+4>bytes.length)fail();
  const type=bytes.toString('ascii',offset+4,offset+8),chunk=bytes.subarray(offset+4,end);let crc=0xffffffff;
  for(const value of chunk){crc^=value;for(let n=0;n<8;n++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}
  if(((crc^0xffffffff)>>>0)!==bytes.readUInt32BE(end))fail();
  if(offset===8&&type!=='IHDR')fail();
  if(type==='IHDR'){
   if(offset!==8||size!==13)fail();width=bytes.readUInt32BE(offset+8);height=bytes.readUInt32BE(offset+12);
   const depth=bytes[offset+16],color=bytes[offset+17];channels=color===2?3:color===6?4:0;
   if(depth!==8||!channels||bytes[offset+18]!==0||bytes[offset+19]!==0||bytes[offset+20]!==0)fail();
   if(width<256||height<256||width>2048||height>2048||width*height>4_194_304)fail();
  }else if(type==='IDAT')data.push(bytes.subarray(offset+8,end));
  else if(type==='IEND'){if(size!==0||end+4!==bytes.length)fail();ended=true;break;}
  else if(type==='acTL'||type[0]===type[0].toUpperCase())fail();
  offset=end+4;
 }
 if(!ended||!data.length)fail();
 try{const stride=width*channels+1,decoded=inflateSync(Buffer.concat(data),{maxOutputLength:stride*height});if(decoded.length!==stride*height)fail();for(let y=0;y<height;y++)if(decoded[y*stride]>4)fail();}catch{fail();}
 return 'png';
}
/** Decode and re-encode pixels; metadata is discarded and the official artwork is appended unmodified. */
export async function normalizeGreetingUpload(contentBase64:string,imageMode:'background'|'artwork'='background'):Promise<Buffer>{
 if(contentBase64.length%4!==0||contentBase64.length>4_194_304||! /^[A-Za-z0-9+/]+={0,2}$/.test(contentBase64))throw new BadRequestException({code:'GREETING_IMAGE_BASE64'});
 if(!['background','artwork'].includes(imageMode))throw new BadRequestException({code:'GREETING_IMAGE_MODE'});
 const bytes=Buffer.from(contentBase64,'base64'),type=imageType(bytes);
 if(active>=2)throw new ServiceUnavailableException({code:'GREETING_UPLOAD_BUSY'});
 active++;
 try{
  const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
  // Explicit complete-artwork mode preserves the full canvas, including existing logo and QR.
  const complete=`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><image href="data:image/${type};base64,${bytes.toString('base64')}" width="${width}" height="${height}"/></svg>`;
  const svg=imageMode==='artwork'?complete:`<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080"><rect width="1080" height="1080" fill="white"/><image href="data:image/${type};base64,${bytes.toString('base64')}" x="0" y="0" width="1080" height="880" preserveAspectRatio="xMidYMid meet"/>${greetingBrandSvg()}</svg>`;
  const result=await renderGreeting(svg,'');
  if(result.length>5_242_880)throw new BadRequestException({code:'GREETING_RENDERED_IMAGE_SIZE'});
  return result;
 }catch{throw new BadRequestException({code:'GREETING_IMAGE_DECODE_FAILED'});}finally{active--;}
}
