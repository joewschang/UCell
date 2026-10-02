import {IncomeNavigation} from './MemberNavigation';
import {useRef,useState} from 'react';
import {LoadingState,ErrorState,EmptyState} from '@ucell/design-system';
import {MemberPageHeader} from './MemberPageHeader';
import type {Qualification} from './api';
import {memberApi} from './memberApi';
import {useResource} from './useResource';
type Row={reference:string;status:string;paidAmount:string;netAmount:string;grossAmount:string;recoveryOffset:string;occurredAt:string;recordedAt:string;periodStart:string;periodEnd:string;batchStatus:string};
type Page={qualificationNo:string;items:Row[];total:number;offset:number;nextOffset:number|null;asOf:string};
export function parsePayouts(value:unknown):Page{
 const p=value as Page,date=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x)),amount=(x:unknown)=>typeof x==='string'&&/^(0|[1-9][0-9]*)(\.[0-9]{1,4})?$/.test(x);
 if(!p||typeof p.qualificationNo!=='string'||!/^\d{1,19}$/.test(p.qualificationNo)||!Array.isArray(p.items)||p.items.length>50||new Set(p.items.map(row=>row.reference)).size!==p.items.length||!Number.isInteger(p.total)||!Number.isInteger(p.offset)||p.offset<0||p.total<0||!date(p.asOf)||p.nextOffset!==null&&(!Number.isInteger(p.nextOffset)||p.nextOffset!==p.offset+p.items.length||p.nextOffset>=p.total)||p.items.some(r=>!/^PAYMENT_RESULT-[a-f0-9]{40}$/.test(r.reference)||!['PAID','FAILED'].includes(r.status)||![r.paidAmount,r.netAmount,r.grossAmount,r.recoveryOffset].every(amount)||![r.occurredAt,r.recordedAt,r.periodStart,r.periodEnd].every(date)||!['DRAFT','READY','REVIEWED','APPROVED','EXPORTED','PROCESSING','PARTIALLY_PAID','PAID','FAILED','VOIDED'].includes(r.batchStatus)))throw new Error('付款紀錄格式異常，已停止顯示');return p;
}
const labels:Record<string,string>={DRAFT:'草稿',READY:'待審查',REVIEWED:'已審查',APPROVED:'已核准',EXPORTED:'已匯出',PROCESSING:'對帳中',PARTIALLY_PAID:'部分已付款',PAID:'已付款',FAILED:'失敗',VOIDED:'已作廢'};
const time=(value:string)=>new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'short'}).format(new Date(value));
export default function MemberPayouts({q}:{q:Qualification}){
 const [offset,setOffset]=useState(0),frozen=useRef<string>();
 const state=useResource('payouts:'+q.id+':'+offset,async signal=>{const result=parsePayouts(await memberApi('/member/payouts?'+new URLSearchParams({qualificationId:q.id,offset:String(offset),...(frozen.current?{asOf:frozen.current}:{})}),{signal}));frozen.current=result.asOf;return result;});
 return <><MemberPageHeader title="付款紀錄" q={q}/><IncomeNavigation/><p>顯示已保存的付款確認或失敗紀錄。確認金額是該次累計值，可能為部分付款；多次紀錄不可相加。批次狀態與個別結果分別呈現，批次狀態以每次查詢取得的目前紀錄為準。</p>{state.error?<ErrorState message={state.error} retry={state.retry}/>:!state.data?<LoadingState/>:<><p>此查詢共 {state.data.total} 筆 · 紀錄納入截止時間 {time(state.data.asOf)}</p>{!state.data.items.length?<EmptyState title="尚無付款結果紀錄"/>:state.data.items.map(row=><article className="card" key={row.reference}><h2>{row.status==='FAILED'?'付款失敗紀錄':'付款確認紀錄'}</h2><dl><dt>付款期別</dt><dd>{time(row.periodStart)} 至 {time(row.periodEnd)}</dd><dt>本列應付款額</dt><dd>{row.netAmount} 元</dd><dt>該次累計確認金額</dt><dd>{row.paidAmount} 元</dd><dt>批次狀態</dt><dd>{labels[row.batchStatus]}</dd><dt>結果時間</dt><dd>{time(row.occurredAt)}</dd><dt>登錄時間</dt><dd>{time(row.recordedAt)}</dd></dl></article>)}<button disabled={offset===0} onClick={()=>setOffset(Math.max(0,offset-50))}>上一頁</button><button disabled={state.data.nextOffset===null} onClick={()=>setOffset(state.data!.nextOffset!)}>下一頁</button></>}</>;
}
