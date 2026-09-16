import {LoadingState,ErrorState,EmptyState} from '@ucell/design-system';
import type {Qualification} from './api';
import {getRepurchaseStatus} from './memberData';
import {useResource} from './useResource';
const statuses:Record<string,string>={ACTIVE:'已完成',PENDING:'確認中',INACTIVE:'未完成',SCHEDULED:'已排程',DUE:'等待認列',RECOGNIZED:'已認列',CANCELLED:'已取消',REVERSED:'已回沖'};
export default function RepurchaseDetails({q}:{q:Qualification}){
 const state=useResource('repurchase:'+q.id,signal=>getRepurchaseStatus(q,signal));
 return <section className="card"><h3>重購認列詳情 · {q.code}</h3>{state.error?<ErrorState message={state.error} retry={state.retry}/>:!state.data?<LoadingState label="重購資料載入中…"/>:<><p>{state.data.period} · {statuses[state.data.status]}</p>{state.data.recognitions.length?state.data.recognitions.map(row=><p key={row.id}>{statuses[row.status]} · {new Intl.DateTimeFormat('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'medium',timeStyle:'short'}).format(new Date(row.dueAt))}</p>):<EmptyState title="此月份沒有重購認列排程"/>}<small>狀態與認列時間由 Core 提供；此頁不判定 Active 或產生重購資格。</small></>}</section>;
}
