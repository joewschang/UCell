import {UnprocessableEntityException,ConflictException} from '@nestjs/common';
import {createHash} from 'node:crypto';
import {fillBankTemplate} from './bank-template-workbook';
export type BankRecipient={payoutLineId:string;accountName:string;accountNumber:string;bankBranchCode?:string;reference?:string;remark?:string};
export type BankExportInput={format:'BULK_REMITTANCE'|'CENTER_TRANSFER';exportReference:string;recipients:BankRecipient[]};
const invalid=(code:string):never=>{throw new UnprocessableEntityException(code);};
const hash=(b:Buffer)=>createHash('sha256').update(b).digest('hex');
function text(v:unknown,max:number,required=false){if(typeof v!=='string'||v!==v.trim()||Array.from(v).length>max||/[\u0000-\u001f\u007f]/.test(v)||/^[=+@-]/.test(v)||(required&&!v))return invalid('BANK_TEXT_INVALID');return v;}
function cents(v:string){if(!/^(0|[1-9][0-9]{0,10})(\.[0-9]{1,4})?$/.test(v))return invalid('BANK_AMOUNT_INVALID');const [n,d='']=v.split('.');if(/[1-9]/.test(d.slice(2)))return invalid('BANK_AMOUNT_PRECISION_EXCEEDS_CENTS');return BigInt(n)*100n+BigInt(d.slice(0,2).padEnd(2,'0'));}
export function createBankPayoutArtifact(lines:Array<{payoutLineId:string;netAmount:string}>,input:BankExportInput){
 if(!input||!['BULK_REMITTANCE','CENTER_TRANSFER'].includes(input.format)||!Array.isArray(input.recipients))return invalid('BANK_FORMAT_INVALID');
 text(input.exportReference,200,true);
 const payable=lines.filter(l=>cents(l.netAmount)>0n),limit=input.format==='CENTER_TRANSFER'?31:999;
 if(!payable.length||payable.length>limit||input.recipients.length>limit)return invalid('BANK_TEMPLATE_ROW_LIMIT');
 if(input.recipients.some(r=>!r||typeof r.payoutLineId!=='string'))return invalid('BANK_RECIPIENT_SET_MISMATCH');
 const mapped=new Map(input.recipients.map(r=>[r.payoutLineId,r]));
 if(mapped.size!==input.recipients.length||mapped.size!==payable.length||input.recipients.some(r=>!payable.some(l=>l.payoutLineId===r.payoutLineId)))return invalid('BANK_RECIPIENT_SET_MISMATCH');
 let total=0n;const normalized=payable.map((l,i)=>{const r=mapped.get(l.payoutLineId)!;const accountName=text(r.accountName,input.format==='CENTER_TRANSFER'?40:40,true),remark=text(r.remark??'',input.format==='CENTER_TRANSFER'?5:40),reference=r.reference??String(i+1).padStart(4,'0');
  if(typeof reference!=='string'||!/^[A-Za-z0-9]{4}$/.test(reference))return invalid('BANK_REFERENCE_INVALID');
  if(typeof r.accountNumber!=='string'||!/^\d+$/.test(r.accountNumber))return invalid('BANK_ACCOUNT_INVALID');
  let accountNumber=r.accountNumber;
  if(input.format==='BULK_REMITTANCE'){if(accountNumber.length>14||typeof r.bankBranchCode!=='string'||!/^\d{7}$/.test(r.bankBranchCode))return invalid('BANK_ROUTING_INVALID');accountNumber=accountNumber.padStart(14,'0');}
  else if(accountNumber.length!==16)return invalid('BANK_CENTER_ACCOUNT_REQUIRES_16_DIGITS');
  const amount=cents(l.netAmount);total+=amount;return {...r,accountName,accountNumber,remark,reference,amount:Number(amount)/100};});
 if(new Set(normalized.map(r=>r.reference)).size!==normalized.length)return invalid('BANK_REFERENCE_DUPLICATE');
 // The supplied manual does not distinguish per-transfer versus per-batch.
 // Until the bank confirms, apply the more restrictive batch total including fees.
 if(input.format==='BULK_REMITTANCE'&&total+BigInt(normalized.length)*3000n>80000000n)return invalid('BANK_BULK_LIMIT_800000');
 const updates:Record<string,Array<{row:number;col:number;value:string|number}>>={};
 const put=(sheet:string,row:number,values:Array<string|number>)=>{(updates[sheet]??=[]).push(...values.map((value,col)=>({row,col,value})));};
 if(input.format==='BULK_REMITTANCE'){
  normalized.forEach((r,i)=>{put('客戶基本資料',i+1,[r.reference,r.accountName,r.bankBranchCode!,r.accountNumber,r.remark]);put('匯款資料登錄',i+2,[r.reference,r.amount,r.accountName,r.bankBranchCode!,r.accountNumber,r.remark,'',30]);});
  put('匯款資料登錄',0,['匯款小計：',Number(total)/100,'匯費小計：',normalized.length*30,'金額合計：',Number(total)/100+normalized.length*30,'筆數：',normalized.length]);
 }else{normalized.forEach((r,i)=>put('中心記帳資料',i+1,[r.reference,r.accountName,r.accountNumber,'',0,r.amount,'74','','',r.remark]));put('中心記帳資料',32,['合計','','','',0,Number(total)/100]);}
 const content=fillBankTemplate(input.format==='BULK_REMITTANCE'?'bulk-remittance':'center-transfer',updates),contentHash=hash(content);
 return {adapterCode:input.format,formatVersion:'BANK_XLS_V1',contentHash,payloadSnapshot:{schemaVersion:1,purpose:'BANK_SUBMISSION_FILE',format:input.format,exportReference:input.exportReference,lineIds:payable.map(l=>l.payoutLineId),totalNet:(Number(total)/100).toFixed(2),contentBase64:content.toString('base64')}};
}
export function readBankPayoutArtifact(a:{formatVersion:string;adapterCode:string;revision:number;contentHash:string;payloadSnapshot:unknown}){const p=a.payloadSnapshot as any;if(a.formatVersion!=='BANK_XLS_V1'||p?.schemaVersion!==1||p.purpose!=='BANK_SUBMISSION_FILE'||p.format!==a.adapterCode||typeof p.contentBase64!=='string')throw new ConflictException('BANK_ARTIFACT_INTEGRITY_INVALID');const content=Buffer.from(p.contentBase64,'base64');if(hash(content)!==a.contentHash)throw new ConflictException('BANK_ARTIFACT_INTEGRITY_INVALID');return {fileName:`ucell-${a.adapterCode.toLowerCase()}-r${a.revision}.xls`,mediaType:'application/vnd.ms-excel',contentBase64:p.contentBase64,fileHash:a.contentHash,artifactHash:a.contentHash,formatVersion:a.formatVersion,revision:a.revision,purpose:p.purpose};}
