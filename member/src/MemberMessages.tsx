import {useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ErrorState,EmptyState,LoadingState} from '@ucell/design-system';
import {MemberPageHeader} from './MemberPageHeader';
import {type Qualification} from './api';
import {memberApi as api} from './memberApi';
import {useResource} from './useResource';
const categories:Record<string,string>={SERVICE:'服務公告',ORDER:'訂單',ACCOUNT:'帳戶',SHIPMENT:'配送',REPURCHASE:'重銷',ACTIVE:'Active',QUALIFICATION:'會員資格',AWARD:'獎金',PAYOUT:'付款',LEARNING:'學習',EVENT:'活動'};
const safeLink=(value:string)=>/^\/(orders|active|qualifications|repurchase|bonuses|payouts|growth|learning|events)$/.test(value)||/^\/(learning\?course|events\?event)=[A-Z][A-Z0-9_-]{2,39}$/.test(value);
type Message={reference:string;qualificationNo:string|null;category:string;title:string;content:string;createdAt:string;publishedAt:string;expiresAt:string|null;readAt:string|null;archivedAt:string|null;status:string;sourceReference:string;deepLink:string|null};
type Page={items:Message[];nextCursor:string|null;asOf:string;dataThrough:string};
export function parseMessages(value:unknown):Page{
 const row=value as Page,ref=(x:unknown)=>typeof x==='string'&&/^MESSAGE-[a-f0-9]{40}$/.test(x),date=(x:unknown)=>typeof x==='string'&&Number.isFinite(Date.parse(x));
 if(!row||!Array.isArray(row.items)||!date(row.asOf)||!date(row.dataThrough)||row.nextCursor!==null&&!ref(row.nextCursor)||new Set(row.items.map(x=>x.reference)).size!==row.items.length||row.items.some(x=>!ref(x.reference)||x.qualificationNo!==null&&!/^[0-9]{1,19}$/.test(x.qualificationNo)||!Object.hasOwn(categories,x.category)||![x.title,x.content,x.sourceReference].every(v=>typeof v==='string'&&!/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i.test(v))||!date(x.createdAt)||!date(x.publishedAt)||[x.expiresAt,x.readAt,x.archivedAt].some(v=>v!==null&&!date(v))||!['PUBLISHED','EXPIRED','RETIRED','ARCHIVED'].includes(x.status)||x.deepLink!==null&&(typeof x.deepLink!=='string'||!safeLink(x.deepLink))))throw new Error('訊息格式異常，已停止顯示');
 return row;
}
export default function MemberMessages({q}:{q?:Qualification}){
 const [view,setView]=useState('ACTIVE'),[category,setCategory]=useState(''),[cursor,setCursor]=useState<string>(),[asOf,setAsOf]=useState<string>(),[busy,setBusy]=useState<string|null>(null),[error,setError]=useState('');
 const params=new URLSearchParams({...(q?{qualificationId:q.id}:{}),view,take:'25',...(category?{category}:{}),...(cursor?{cursor}:{}),...(asOf?{asOf}:{})}),state=useResource('messages:'+params,async signal=>parseMessages(await api('/member/messages?'+params,{signal}))),keys=useRef(new Map<string,string>()),flight=useRef(false),reset=()=>{setCursor(undefined);setAsOf(undefined);};
 async function command(reference:string,action:'read'|'archive'){
  if(flight.current)return;const identity=reference+':'+action,key=keys.current.get(identity)??crypto.randomUUID();keys.current.set(identity,key);flight.current=true;setBusy(identity);setError('');
  try{await api('/member/messages/'+reference+'/'+action,{method:'POST',headers:{'Idempotency-Key':key},body:JSON.stringify(q?{qualificationId:q.id}:{})});keys.current.delete(identity);state.retry();}catch(e){setError(e instanceof Error?e.message:'訊息更新失敗，請重試');}finally{flight.current=false;setBusy(null);}
 }
 const when=(value:string)=>new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});
 return <><MemberPageHeader title="訊息中心" q={q}/><p>此處顯示您的個人訊息及目前資格的訊息。個人訊息保存在 UCell，不會轉成 LINE 大量廣播。</p><section className="card member-message-filters"><label>訊息範圍<select value={view} onChange={event=>{setView(event.target.value);reset();}}><option value="ACTIVE">目前訊息</option><option value="ARCHIVED">封存與到期訊息</option></select></label><label>訊息分類<select value={category} onChange={event=>{setCategory(event.target.value);reset();}}><option value="">全部分類</option>{Object.entries(categories).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label><button onClick={state.retry}>重新讀取</button></section>{error&&<p role="alert">{error}</p>}
 {state.error?<ErrorState message={state.error} retry={state.retry}/>:!state.data?<LoadingState label="訊息載入中…"/>:<>{state.data.items.length?state.data.items.map(row=><article className="card" key={row.reference}><p>{categories[row.category]} · {row.qualificationNo?'資格 '+row.qualificationNo:'個人訊息'} · {row.readAt?'已讀':'未讀'} · {row.status==='EXPIRED'?'已到期':row.status==='RETIRED'?'已下架':row.status==='ARCHIVED'?'已封存':'已發布'}</p><h3>{row.title}</h3><p>{row.content}</p><p>發布：{when(row.publishedAt)}{row.expiresAt?'；到期：'+when(row.expiresAt):''}</p>{row.deepLink&&<Link to={row.deepLink}>查看相關紀錄 →</Link>}<div className="notice-actions">{!row.readAt&&<button disabled={busy!==null} onClick={()=>void command(row.reference,'read')}>標為已讀</button>}{row.status==='PUBLISHED'&&<button disabled={busy!==null} onClick={()=>void command(row.reference,'archive')}>封存訊息</button>}</div><details><summary>來源參考碼</summary>{row.sourceReference}</details></article>):<EmptyState title="目前範圍沒有訊息"/>}{state.data.nextCursor&&<button onClick={()=>{setCursor(state.data!.nextCursor!);setAsOf(state.data!.asOf);}}>訊息下一頁</button>}{cursor&&<button onClick={reset}>返回第一頁</button>}</>}
 </>;
}
