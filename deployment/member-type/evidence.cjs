'use strict';
const {createHash}=require('node:crypto');
const {BadRequestException}=require('@nestjs/common');
const {PiiCryptoService}=require('@ucell/database');
const {decodeFile}=require('../document-intake/intake-policy');
const size=5*1024*1024;
function registration(raw){
 const n=String(raw??'').normalize('NFKC').trim();
 if(!/^\d{8}$/.test(n))throw new BadRequestException('公司統編須為 8 位數字，請與營業登記文件核對');
 return n;
}
function evidence(file){
 if(!file||!['application/pdf','image/jpeg','image/png'].includes(file.mime)||typeof file.base64!=='string'||file.base64.length>Math.ceil(size/3)*4)throw new BadRequestException('請上傳 5 MB 以內的營業登記 PDF、JPG 或 PNG');
 const bytes=decodeFile(file.base64,file.mime);
 if(bytes.length>size)throw new BadRequestException('營業登記文件超過 5 MB');
 if(file.mime==='application/pdf'&&!bytes.subarray(-1024).includes(Buffer.from('%%EOF')))throw new BadRequestException('PDF 不完整，請重新上傳');
 return {mime:file.mime,hash:createHash('sha256').update(bytes).digest('hex'),...new PiiCryptoService().encrypt(file.base64)};
}
module.exports={registration,evidence};
