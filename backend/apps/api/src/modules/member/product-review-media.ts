import {BadRequestException} from '@nestjs/common';
import {validKycImage} from './kyc-image-validation';
export const REVIEW_MIMES=['image/jpeg','image/png','image/webp','video/mp4','video/webm','audio/mpeg','audio/mp4'];
export const MEDIA_PART_SIZE=262144;
export function reviewMediaLimit(mime:string){return mime.startsWith('image/')?5*1024*1024:20*1024*1024;}
export function decodeReviewPart(value:string){if(!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value))throw new BadRequestException({code:'REVIEW_MEDIA_INVALID',message:'附件編碼不正確，請重新選擇檔案。'});const bytes=Buffer.from(value,'base64');if(!bytes.length||bytes.length>MEDIA_PART_SIZE||bytes.toString('base64')!==value)throw new BadRequestException({code:'REVIEW_MEDIA_INVALID'});return bytes;}
export function validReviewMedia(bytes:Buffer,mime:string){
 if(!REVIEW_MIMES.includes(mime)||bytes.length>reviewMediaLimit(mime))return false;
 if(mime==='image/jpeg'||mime==='image/png')return validKycImage(bytes,mime);
 if(mime==='image/webp')return bytes.length>20&&bytes.toString('ascii',0,4)==='RIFF'&&bytes.readUInt32LE(4)+8===bytes.length&&bytes.toString('ascii',8,12)==='WEBP'&&['VP8 ','VP8L','VP8X'].includes(bytes.toString('ascii',12,16));
 if(mime==='video/webm')return bytes.length>32&&bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))&&bytes.subarray(0,256).includes(Buffer.from('webm'));
 if(mime==='audio/mpeg'){let start=0;if(bytes.toString('ascii',0,3)==='ID3'){if(bytes.length<10)return false;start=10+((bytes[6]&127)<<21)+((bytes[7]&127)<<14)+((bytes[8]&127)<<7)+(bytes[9]&127);}return bytes.length>start+4&&bytes[start]===255&&(bytes[start+1]&0xe0)===0xe0;}
 if(mime==='video/mp4'||mime==='audio/mp4'){
  let offset=0;const boxes=new Set<string>();while(offset+8<=bytes.length){let size=bytes.readUInt32BE(offset),header=8;const kind=bytes.toString('ascii',offset+4,offset+8);if(size===1){if(offset+16>bytes.length)return false;const n=bytes.readBigUInt64BE(offset+8);if(n>BigInt(bytes.length))return false;size=Number(n);header=16;}else if(size===0)size=bytes.length-offset;if(size<header||offset+size>bytes.length)return false;boxes.add(kind);offset+=size;}return offset===bytes.length&&boxes.has('ftyp')&&boxes.has('moov')&&boxes.has('mdat');
 }
 return false;
}
