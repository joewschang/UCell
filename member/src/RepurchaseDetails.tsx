import {Link} from 'react-router-dom';
import {useState} from 'react';
import { qualificationReferenceLabel } from './terminology';
import {LoadingState,ErrorState,EmptyState} from '@ucell/design-system';
import type {Qualification} from './api';
import {getRepurchaseStatus} from './memberData';
import {useResource} from './useResource';
const statuses:Record<string,string>={ACTIVE:'已有認列紀錄',PENDING:'等待認列',INACTIVE:'尚無認列紀錄',SCHEDULED:'已排程',DUE:'等待認列',RECOGNIZED:'已認列',CANCELLED:'已取消',REVERSED:'已回沖'};
export default function RepurchaseDetails({q}:{q:Qualification}){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Taipei',year:'numeric',month:'2-digit'}).formatToParts(new Date());
 const [period,setPeriod]=useState(parts.find(p=>p.type==='year')!.value+'-'+parts.find(p=>p.type==='month')!.value);
 const state=useResource('repurchase:'+q.id+':'+period,signal=>getRepurchaseStatus(q,signal,period));
 return <section className="card"><h3>重銷認列詳情 · {qualificationReferenceLabel(q)}</h3><label>查詢月份<input type="month" value={period} onChange={event=>setPeriod(event.target.value)}/></label>{state.error?<ErrorState message={state.error} retry={state.retry}/>:!state.data?<LoadingState label="重銷資料載入中…"/>:<><p>{state.data.period} · {statuses[state.data.status]}</p>{state.data.recognitions.length?state.data.recognitions.map(row=><p key={row.id}>{statuses[row.status]} · 排程認列時間：{new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'short'}).format(new Date(row.dueAt))}</p>):<EmptyState title="此月份沒有重銷認列排程"/>}<small>保存狀態與排程時間以來源紀錄為準；此頁不判定 Active 或產生重銷資格。</small><p><Link to="/growth">查看保存的實際認列時間</Link></p></>}</section>;
}
