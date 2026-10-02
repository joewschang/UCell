import {ConflictException} from '@nestjs/common';
import {createHash} from 'node:crypto';
import {Prisma} from '@ucell/database';
type Line={payoutLineId:string;memberNo:string|null;ballNo:string|null;grossAmount:string;recoveryOffset:string;netAmount:string};
export type FinanceSnapshot={schemaVersion:1;format:'GENERIC_FINANCE_CSV_V1';exportRevision:number;payoutBatchId:string;periodStart:string;periodEnd:string;totalGross:string;totalRecovery:string;totalNet:string;lines:Line[]};
const hash=(content:string)=>createHash('sha256').update(content,'utf8').digest('hex');
const invalid=():never=>{throw new ConflictException('PAYOUT_ARTIFACT_INTEGRITY_INVALID');};
const text=(value:unknown):string=>typeof value==='string'&&value.length<=300?value:invalid();
const amount=(value:unknown):string=>typeof value==='string'&&/^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$/.test(value)?value:invalid();
/** Reconstruct the original V1 key order for its historical JSON hash. */
function snapshot(value:any):FinanceSnapshot{
 if(!value||value.schemaVersion!==1||value.format!=='GENERIC_FINANCE_CSV_V1'||!Number.isInteger(value.exportRevision)||value.exportRevision<1||!Array.isArray(value.lines))return invalid();
 const lines=value.lines.map((line:any)=>({payoutLineId:text(line.payoutLineId),memberNo:line.memberNo===null?null:text(line.memberNo),ballNo:line.ballNo===null?null:text(line.ballNo),grossAmount:amount(line.grossAmount),recoveryOffset:amount(line.recoveryOffset),netAmount:amount(line.netAmount)}));
 const result:FinanceSnapshot={schemaVersion:1,format:'GENERIC_FINANCE_CSV_V1',exportRevision:value.exportRevision,payoutBatchId:text(value.payoutBatchId),periodStart:text(value.periodStart),periodEnd:text(value.periodEnd),totalGross:amount(value.totalGross),totalRecovery:amount(value.totalRecovery),totalNet:amount(value.totalNet),lines};
 if(!Number.isFinite(Date.parse(result.periodStart))||!Number.isFinite(Date.parse(result.periodEnd)))return invalid();
 for(const line of lines)if(!new Prisma.Decimal(line.grossAmount).sub(line.recoveryOffset).equals(line.netAmount))return invalid();
 for(const [total,key] of [['totalGross','grossAmount'],['totalRecovery','recoveryOffset'],['totalNet','netAmount']] as const)if(!lines.reduce((sum:Prisma.Decimal,line:Line)=>sum.add(line[key]),new Prisma.Decimal(0)).equals(result[total]))return invalid();
 return result;
}
function cell(value:string|number|null){let safe=String(value??'');if(/^[\s]*[=+\-@]/.test(safe)||/^[\t\r\n]/.test(safe))safe="'"+safe;return '"'+safe.replace(/"/g,'""')+'"';}
function csv(source:FinanceSnapshot,reference:string){
 const headers=['匯出參考','版次','期間起日','期間迄日','會員編號','資格編號','應付總額','追回抵扣','實付淨額'];
 return '\uFEFF'+[headers,...source.lines.map(line=>[reference,source.exportRevision,source.periodStart,source.periodEnd,line.memberNo,line.ballNo,line.grossAmount,line.recoveryOffset,line.netAmount])].map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
export function createFinanceReviewArtifact(value:unknown,exportReference:string){
 const source=snapshot(value),content=csv(source,text(exportReference));
 return {formatVersion:'GENERIC_FINANCE_CSV_V2',contentHash:hash(content),payloadSnapshot:{schemaVersion:2,format:'GENERIC_FINANCE_CSV_V2',purpose:'FINANCE_REVIEW_ONLY',exportReference,source,content}};
}
export function readFinanceReviewArtifact(artifact:{formatVersion:string;revision:number;exportReference:string;contentHash:string;payloadSnapshot:unknown;payoutBatchId:string}){
 const value=artifact.payloadSnapshot as any;
 let source:FinanceSnapshot,content:string;
 if(artifact.formatVersion==='GENERIC_FINANCE_CSV_V1'){
  source=snapshot(value);if(hash(JSON.stringify(source))!==artifact.contentHash)return invalid();
  content=csv(source,artifact.exportReference);
 }else if(artifact.formatVersion==='GENERIC_FINANCE_CSV_V2'){
  if(value?.schemaVersion!==2||value.format!==artifact.formatVersion||value.purpose!=='FINANCE_REVIEW_ONLY'||value.exportReference!==artifact.exportReference||typeof value.content!=='string')return invalid();
  source=snapshot(value.source);content=value.content;
  if(csv(source,artifact.exportReference)!==content||hash(content)!==artifact.contentHash)return invalid();
 }else return invalid();
 if(source.payoutBatchId!==artifact.payoutBatchId||source.exportRevision!==artifact.revision)return invalid();
 return {fileName:`ucell-finance-review-r${artifact.revision}.csv`,mediaType:'text/csv;charset=utf-8',content,fileHash:hash(content),artifactHash:artifact.contentHash,revision:artifact.revision,formatVersion:artifact.formatVersion,purpose:'FINANCE_REVIEW_ONLY'};
}
