import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {AdminDataGrid,type GridColumn} from '../../components/AdminDataGrid';
import {QueryFeedback} from '../../components/QueryFeedback';
import {Badge,Card,Field,Metric,PageHeader} from '../../components/ui';
import {get,qs} from '../../lib/api';

type Domain='PAYMENT'|'INVOICE'|'LOGISTICS';
type Status='RECEIVED'|'VERIFIED'|'REJECTED'|'PROCESSING'|'PROCESSED'|'RETRY_PENDING'|'MANUAL_REVIEW';
type Health={generatedAt:string;state:'HEALTHY'|'DEGRADED'|'CRITICAL';total:number;dueBacklog:number;expiredLeases:number;manualReview:number;oldestDueReceivedAt:string|null;counts:{byDomain:Partial<Record<Domain,number>>}};
export type BacklogItem={providerWebhookInboxId:string;domain:Domain;provider:string;connectionId:string;status:Status;attemptCount:number;lastErrorCode:string|null;receivedAt:string;nextAttemptAt:string|null;correlationId:string;due:boolean;leaseExpired:boolean};
type Backlog={generatedAt:string;items:BacklogItem[];limit:number;truncated:boolean};
type Filters={domain:''|Domain;provider:string;status:''|Status;take:number};
const endpoint='/admin/provider-operations/webhooks',domains:Domain[]=['PAYMENT','INVOICE','LOGISTICS'],statuses:Status[]=['RECEIVED','VERIFIED','REJECTED','PROCESSING','PROCESSED','RETRY_PENDING','MANUAL_REVIEW'];
const initial:Filters={domain:'',provider:'',status:'',take:50};
const time=(value:string|null)=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'—';
const columns:GridColumn<BacklogItem>[]=[
 {key:'receivedAt',label:'接收時間（台北）',value:r=>r.receivedAt,render:r=>time(r.receivedAt)},
 {key:'domain',label:'Domain',value:r=>r.domain},{key:'provider',label:'Provider',value:r=>r.provider},{key:'connectionId',label:'Connection',value:r=>r.connectionId},
 {key:'status',label:'狀態',value:r=>r.status,render:r=><Badge tone={r.status==='MANUAL_REVIEW'||r.status==='REJECTED'?'danger':r.status==='RETRY_PENDING'||r.status==='PROCESSING'?'warn':'neutral'}>{r.status}</Badge>},
 {key:'attention',label:'營運狀態',value:r=>r.leaseExpired?'LEASE_EXPIRED':r.due?'DUE':'WAITING',render:r=>r.leaseExpired?<Badge tone="danger">Lease 已逾期</Badge>:r.due?<Badge tone="warn">待處理</Badge>:<Badge>等待中</Badge>},
 {key:'attemptCount',label:'嘗試次數',value:r=>String(r.attemptCount)},{key:'nextAttemptAt',label:'下次嘗試（台北）',value:r=>r.nextAttemptAt??'',render:r=>time(r.nextAttemptAt)},
 {key:'lastErrorCode',label:'最後錯誤碼',value:r=>r.lastErrorCode??'—'},{key:'correlationId',label:'Correlation ID',value:r=>r.correlationId},
];

export function ProviderOperationsPage(){
 const [draft,setDraft]=useState(initial),[filters,setFilters]=useState(initial);
 const health=useQuery({queryKey:['provider-webhooks','health'],queryFn:()=>get<{data:Health}>(`${endpoint}/health`),refetchInterval:60_000});
 const backlog=useQuery({queryKey:['provider-webhooks','backlog',filters],queryFn:()=>get<{data:Backlog}>(`${endpoint}/backlog`+qs({domain:filters.domain,provider:filters.provider,status:filters.status,take:filters.take})),refetchInterval:60_000});
 const h=health.data?.data,b=backlog.data?.data;
 return <><PageHeader title="Provider Webhook 營運" subtitle="監看付款、發票與物流 provider webhook inbox；資料每分鐘自動更新。" actions={<button onClick={()=>{void health.refetch();void backlog.refetch()}}>重新整理</button>}/>
 <QueryFeedback query={health}/>{h&&<><Card title="Inbox 健康狀態"><div className="status-strip"><Badge tone={h.state==='HEALTHY'?'ok':h.state==='DEGRADED'?'warn':'danger'}>{h.state}</Badge><span className="muted">產生時間：{time(h.generatedAt)}（台北時間）</span></div></Card><div className="metrics"><Metric label="Inbox 總數" value={h.total}/><Metric label="到期 backlog" value={h.dueBacklog}/><Metric label="逾期 lease" value={h.expiredLeases}/><Metric label="人工檢視" value={h.manualReview}/></div><div className="grid two"><Card title="Domain 分布"><p>{domains.map(d=>`${d} ${h.counts.byDomain[d]??0}`).join(' · ')}</p></Card><Card title="最舊待處理項目"><p>{time(h.oldestDueReceivedAt)}</p></Card></div></>}
 <Card title="Backlog 篩選"><form onSubmit={e=>{e.preventDefault();setFilters({...draft,provider:draft.provider.trim()})}}><div className="filter-grid"><Field label="Domain"><select value={draft.domain} onChange={e=>setDraft(v=>({...v,domain:e.target.value as Filters['domain']}))}><option value="">全部</option>{domains.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Provider"><input maxLength={100} value={draft.provider} onChange={e=>setDraft(v=>({...v,provider:e.target.value}))}/></Field><Field label="狀態"><select value={draft.status} onChange={e=>setDraft(v=>({...v,status:e.target.value as Filters['status']}))}><option value="">預設營運 backlog</option>{statuses.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="載入筆數"><select value={draft.take} onChange={e=>setDraft(v=>({...v,take:Number(e.target.value)}))}>{[25,50,100,200].map(v=><option key={v}>{v}</option>)}</select></Field></div><div className="button-row"><button className="primary" type="submit">套用篩選</button><button type="button" onClick={()=>{setDraft(initial);setFilters(initial)}}>清除</button></div></form></Card>
 <QueryFeedback query={backlog} empty={!!b&&!b.items.length}/>{b&&b.items.length>0&&<Card title="Webhook backlog"><AdminDataGrid rows={b.items} columns={columns} rowId={r=>r.providerWebhookInboxId} label="Provider webhook backlog" searchable/>{b.truncated&&<p className="callout warning" role="status">結果超過本次 {b.limit} 筆上限。請縮小篩選條件。</p>}<p className="muted">資料產生時間：{time(b.generatedAt)}（台北時間）</p></Card>}</>;
}
