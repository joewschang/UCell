import {BadRequestException} from '@nestjs/common';
import {createHash} from 'node:crypto';
export type Audience='ADMIN'|'MEMBER';
export type Intent='MEMBERSHIP_COUNTS'|'SUMMARY'|'COUPON'|'QUALIFICATIONS'|'ORDERS'|'ACTIVE'|'PERFORMANCE'|'BONUS'|'FAQ'|'CLARIFY'|'DENIED';
export const intents:Intent[]=['MEMBERSHIP_COUNTS','SUMMARY','COUPON','QUALIFICATIONS','ORDERS','ACTIVE','PERFORMANCE','BONUS','FAQ','CLARIFY','DENIED'];
export type Actor={id:string;audience:Audience;sessionId:string;provider:string;subject:string;role?:string};
export type Plan={intent:Intent;start?:string;end?:string;couponCode?:string;topic?:string};
export type Answer={status:'AVAILABLE'|'UNAVAILABLE'|'DENIED'|'CLARIFY';title:string;text:string;facts:Array<{label:string;value:string;unit?:string}>;columns?:string[];rows?:string[][];sources:Array<{label:string;ref:string}>;definitionVersion:string;period?:{start:string;end:string};updatedAt:string;scope?:string;finality?:string;notice?:string;exportable?:boolean};
export const uuid=(v:unknown):v is string=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
export const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export function strict(v:any,keys:string[]){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!keys.includes(k)))throw new BadRequestException({code:'AI_INVALID_INPUT'});return v;}
export function boundedText(v:unknown,min=1,max=2000){if(typeof v!=='string'||v.trim().length<min||v.length>max)throw new BadRequestException({code:'AI_INVALID_INPUT'});return v.trim();}
export function monthBounds(now=new Date()){const t=new Date(now.getTime()+8*3600000);return{start:new Date(Date.UTC(t.getUTCFullYear(),t.getUTCMonth(),1)-8*3600000),end:now};}
export function period(plan:Plan,now=new Date()){
 const fallback=monthBounds(now),localNow=new Date(now.getTime()+28800000),nextMonth=new Date(Date.UTC(localNow.getUTCFullYear(),localNow.getUTCMonth()+1,1)-28800000);const parse=(v:string|undefined)=>v&&/^\d{4}-\d{2}-\d{2}$/.test(v)?new Date(v+'T00:00:00+08:00'):null;
 const s=plan.start?parse(plan.start):fallback.start,e=plan.end?parse(plan.end):fallback.end;
 if(!s||!e||!Number.isFinite(s.getTime())||!Number.isFinite(e.getTime())||s>=e||s>now||e>nextMonth||e.getTime()-s.getTime()>366*86400000)throw new BadRequestException({code:'AI_PERIOD_INVALID'});
 for(const [v,d] of [[plan.start,s],[plan.end,e]] as const)if(v&&new Date(d.getTime()+8*3600000).toISOString().slice(0,10)!==v)throw new BadRequestException({code:'AI_PERIOD_INVALID'});
 return{start:s,end:e>now?now:e};
}
export function validatePlan(raw:any,audience:Audience):Plan{strict(raw,['intent','start','end','couponCode','topic']);if(!intents.includes(raw.intent))throw new BadRequestException({code:'AI_INVALID_PLAN'});if(audience==='MEMBER'&&['MEMBERSHIP_COUNTS','SUMMARY','COUPON'].includes(raw.intent))return{intent:'DENIED'};if(audience==='ADMIN'&&['QUALIFICATIONS','ORDERS','ACTIVE','PERFORMANCE','BONUS'].includes(raw.intent))return{intent:'CLARIFY'};for(const k of ['start','end'])if(raw[k]!=null&&!/^\d{4}-\d{2}-\d{2}$/.test(raw[k]))throw new BadRequestException({code:'AI_INVALID_PLAN'});if(raw.couponCode!=null&&!/^[A-Z0-9_-]{3,40}$/.test(raw.couponCode))throw new BadRequestException({code:'AI_INVALID_PLAN'});if(raw.topic!=null&&!/^[a-z-]{2,40}$/.test(raw.topic))throw new BadRequestException({code:'AI_INVALID_PLAN'});return Object.fromEntries(Object.entries(raw).filter(([,v])=>v!==null)) as Plan;}
export function protectQuestion(s:string){return /(?:完整|全部).{0,8}(?:銀行|身分證|身份证|密碼)|(?:其他|別人|别人|所有).{0,5}會員.{0,8}(?:獎金|資料|訂單)|\b(?:password|secret|api[_ -]?key|system prompt|sql)\b|忽略.{0,8}(?:指令|規則)|執行.{0,6}(?:付款|退款|轉帳)/i.test(s);}
/** Mask identifiers before any provider call. No operational facts are ever sent to the planner. */
export function redact(s:string){return s.replace(/[A-Z][12]\d{8}\b/gi,'[證件已遮罩]').replace(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi,'[電子郵件已遮罩]').replace(/\b\d{8,}\b/g,'[號碼已遮罩]').replace(/\b[a-f0-9]{8}-[a-f0-9-]{27,}\b/gi,'[識別碼已遮罩]').replace(/Bearer\s+\S+/gi,'[憑證已遮罩]');}
export function csvCell(s:string){const safe=/^[\s]*[=+@-]/.test(s)?"'"+s:s;return '"'+safe.replace(/"/g,'""')+'"';}
export function reportCsv(a:Answer,snapshotId:string){if(!a.exportable||a.status!=='AVAILABLE')throw new BadRequestException({code:'AI_REPORT_UNAVAILABLE'});return '\uFEFF'+[['UCell AI 報表',a.title],['快照',snapshotId],['定義',a.definitionVersion],['更新',a.updatedAt],['期間起',a.period?.start??''],['期間迄 不含',a.period?.end??''],['說明',a.notice??''],[],...a.facts.map(x=>[x.label,x.value,x.unit??'']),[],...(a.columns?[a.columns]:[]),...(a.rows??[])].map(row=>row.map(csvCell).join(',')).join('\r\n');}
export function unavailable(title='目前無法取得完整資料',text='資料或規則證據尚未齊備，不能解讀為零。請回原功能頁確認。'):Answer{return{status:'UNAVAILABLE',title,text,facts:[],sources:[],definitionVersion:'ai-stage-v1',updatedAt:new Date().toISOString()};}
