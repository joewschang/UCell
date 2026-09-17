import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {ConfirmDialog,DetailDrawer,EmptyState,ErrorState,LoadingState,UCellButton} from '@ucell/design-system';
import {AdminDataGrid,type GridColumn} from '../../components/AdminDataGrid';
import {QueryFeedback} from '../../components/QueryFeedback';
import {Badge,Card,Field,Metric,PageHeader} from '../../components/ui';
import {useAuth} from '../auth/auth';
import {ApiError,command,get,qs} from '../../lib/api';

type Domain='PAYMENT'|'INVOICE'|'LOGISTICS';
type Status='RECEIVED'|'VERIFIED'|'REJECTED'|'PROCESSING'|'PROCESSED'|'RETRY_PENDING'|'MANUAL_REVIEW';
type Health={generatedAt:string;state:'HEALTHY'|'DEGRADED'|'CRITICAL';total:number;dueBacklog:number;expiredLeases:number;manualReview:number;oldestDueReceivedAt:string|null;counts:{byDomain:Partial<Record<Domain,number>>}};
export type BacklogItem={providerWebhookInboxId:string;domain:Domain;provider:string;connectionId:string;status:Status;attemptCount:number;lastErrorCode:string|null;receivedAt:string;nextAttemptAt:string|null;correlationId:string;due:boolean;leaseExpired:boolean};
type Backlog={generatedAt:string;items:BacklogItem[];limit:number;truncated:boolean};
type AuditItem={auditEventId:string;actorType:string;actorId:string|null;actorReference:string|null;action:string;reasonCode:string|null;reason:string|null;requestId:string;correlationId:string;occurredAt:string};
type WebhookDetail=BacklogItem&{providerEventIdentity:string|null;verifiedAt:string|null;processedAt:string|null;leaseExpiresAt:string|null;signatureTimestamp:string|null;audit:AuditItem[];auditTruncated:boolean};
type Filters={domain:''|Domain;provider:string;status:''|Status;take:number};
const endpoint='/admin/provider-operations/webhooks',domains:Domain[]=['PAYMENT','INVOICE','LOGISTICS'],statuses:Status[]=['RECEIVED','VERIFIED','REJECTED','PROCESSING','PROCESSED','RETRY_PENDING','MANUAL_REVIEW'];
const initial:Filters={domain:'',provider:'',status:'',take:50};
const time=(value:string|null)=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'—';
const baseColumns:GridColumn<BacklogItem>[]=[
 {key:'receivedAt',label:'接收時間（台北）',value:r=>r.receivedAt,render:r=>time(r.receivedAt)},
 {key:'domain',label:'Domain',value:r=>r.domain},{key:'provider',label:'Provider',value:r=>r.provider},{key:'connectionId',label:'Connection',value:r=>r.connectionId},
 {key:'status',label:'狀態',value:r=>r.status,render:r=><Badge tone={r.status==='MANUAL_REVIEW'||r.status==='REJECTED'?'danger':r.status==='RETRY_PENDING'||r.status==='PROCESSING'?'warn':'neutral'}>{r.status}</Badge>},
 {key:'attention',label:'營運狀態',value:r=>r.leaseExpired?'LEASE_EXPIRED':r.due?'DUE':'WAITING',render:r=>r.leaseExpired?<Badge tone="danger">Lease 已逾期</Badge>:r.due?<Badge tone="warn">待處理</Badge>:<Badge>等待中</Badge>},
 {key:'attemptCount',label:'嘗試次數',value:r=>String(r.attemptCount)},{key:'nextAttemptAt',label:'下次嘗試（台北）',value:r=>r.nextAttemptAt??'',render:r=>time(r.nextAttemptAt)},
 {key:'lastErrorCode',label:'最後錯誤碼',value:r=>r.lastErrorCode??'—'},{key:'correlationId',label:'Correlation ID',value:r=>r.correlationId},
];

function retryError(error:unknown){
 if(error instanceof ApiError&&error.status===409)return '此 webhook 狀態已變更或正在處理，請重新整理後確認。';
 if(error instanceof ApiError&&error.status===422)return '此 webhook 不符合人工重試條件，請檢查狀態與必要設定。';
 return error instanceof Error?error.message:'人工重試失敗，請稍後再試。';
}

export function ProviderOperationsPage(){
 const [draft,setDraft]=useState(initial),[filters,setFilters]=useState(initial);
 const [retryTarget,setRetryTarget]=useState<BacklogItem|null>(null),[retryNotice,setRetryNotice]=useState<string|null>(null),[detailId,setDetailId]=useState<string|null>(null);
 const {user}=useAuth(),queryClient=useQueryClient(),canRetry=user?.role==='SUPER_ADMIN';
 const health=useQuery({queryKey:['provider-webhooks','health'],queryFn:()=>get<{data:Health}>(`${endpoint}/health`),refetchInterval:60_000});
 const backlog=useQuery({queryKey:['provider-webhooks','backlog',filters],queryFn:()=>get<{data:Backlog}>(`${endpoint}/backlog`+qs({domain:filters.domain,provider:filters.provider,status:filters.status,take:filters.take})),refetchInterval:60_000});
 const detail=useQuery({queryKey:['provider-webhooks','detail',detailId],queryFn:()=>get<{data:WebhookDetail}>(`${endpoint}/${encodeURIComponent(detailId!)}`),enabled:!!detailId});
 const retry=useMutation({mutationFn:({id,reason}:{id:string;reason:string})=>command(`${endpoint}/${encodeURIComponent(id)}/retry`,{reason}),onSuccess:async()=>{setRetryTarget(null);setRetryNotice('已提交人工重試，清單正在更新。');await Promise.all([queryClient.invalidateQueries({queryKey:['provider-webhooks','health']}),queryClient.invalidateQueries({queryKey:['provider-webhooks','backlog']})])},onError:error=>setRetryNotice(retryError(error))});
 const h=health.data?.data,b=backlog.data?.data;
 const columns:GridColumn<BacklogItem>[]=[...baseColumns,{key:'actions',label:'操作',value:r=>`${r.providerWebhookInboxId} ${canRetry&&r.status==='MANUAL_REVIEW'?'人工重試':''}`,render:r=><div className="button-row"><UCellButton onClick={()=>setDetailId(r.providerWebhookInboxId)}>查看</UCellButton>{canRetry&&r.status==='MANUAL_REVIEW'&&<UCellButton disabled={retry.isPending} onClick={()=>{setRetryNotice(null);setRetryTarget(r)}}>人工重試</UCellButton>}</div>}];
 return <><PageHeader title="Provider Webhook 營運" subtitle="監看付款、發票與物流 provider webhook inbox；資料每分鐘自動更新。" actions={<button onClick={()=>{void health.refetch();void backlog.refetch()}}>重新整理</button>}/>
 <QueryFeedback query={health}/>{h&&<><Card title="Inbox 健康狀態"><div className="status-strip"><Badge tone={h.state==='HEALTHY'?'ok':h.state==='DEGRADED'?'warn':'danger'}>{h.state}</Badge><span className="muted">產生時間：{time(h.generatedAt)}（台北時間）</span></div></Card><div className="metrics"><Metric label="Inbox 總數" value={h.total}/><Metric label="到期 backlog" value={h.dueBacklog}/><Metric label="逾期 lease" value={h.expiredLeases}/><Metric label="人工檢視" value={h.manualReview}/></div><div className="grid two"><Card title="Domain 分布"><p>{domains.map(d=>`${d} ${h.counts.byDomain[d]??0}`).join(' · ')}</p></Card><Card title="最舊待處理項目"><p>{time(h.oldestDueReceivedAt)}</p></Card></div></>}
 <Card title="Backlog 篩選"><form onSubmit={e=>{e.preventDefault();setFilters({...draft,provider:draft.provider.trim()})}}><div className="filter-grid"><Field label="Domain"><select value={draft.domain} onChange={e=>setDraft(v=>({...v,domain:e.target.value as Filters['domain']}))}><option value="">全部</option>{domains.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="Provider"><input maxLength={100} value={draft.provider} onChange={e=>setDraft(v=>({...v,provider:e.target.value}))}/></Field><Field label="狀態"><select value={draft.status} onChange={e=>setDraft(v=>({...v,status:e.target.value as Filters['status']}))}><option value="">預設營運 backlog</option>{statuses.map(v=><option key={v}>{v}</option>)}</select></Field><Field label="載入筆數"><select value={draft.take} onChange={e=>setDraft(v=>({...v,take:Number(e.target.value)}))}>{[25,50,100,200].map(v=><option key={v}>{v}</option>)}</select></Field></div><div className="button-row"><button className="primary" type="submit">套用篩選</button><button type="button" onClick={()=>{setDraft(initial);setFilters(initial)}}>清除</button></div></form></Card>
 <QueryFeedback query={backlog} empty={!!b&&!b.items.length}/>{retryNotice&&<p className={retry.isError?'callout error':'callout'} role={retry.isError?'alert':'status'}>{retryNotice}</p>}{b&&b.items.length>0&&<Card title="Webhook backlog"><AdminDataGrid rows={b.items} columns={columns} rowId={r=>r.providerWebhookInboxId} label="Provider webhook backlog" searchable/>{b.truncated&&<p className="callout warning" role="status">結果超過本次 {b.limit} 筆上限。請縮小篩選條件。</p>}<p className="muted">資料產生時間：{time(b.generatedAt)}（台北時間）</p></Card>}
 <DetailDrawer open={!!detailId} title="Webhook 營運明細" onClose={()=>setDetailId(null)}>{detail.isPending?<LoadingState/>:detail.error?<ErrorState message={detail.error instanceof Error?detail.error.message:'讀取失敗'} retry={()=>void detail.refetch()}/>:detail.data?.data?<WebhookDetailView value={detail.data.data}/>:<EmptyState title="找不到 webhook 明細"/>}</DetailDrawer>
 <ConfirmDialog open={!!retryTarget} title="確認人工重試" busy={retry.isPending} onCancel={()=>{if(!retry.isPending)setRetryTarget(null)}} onConfirm={reason=>{if(retryTarget)retry.mutate({id:retryTarget.providerWebhookInboxId,reason})}}><p>Webhook：{retryTarget?.providerWebhookInboxId}</p><p>此操作會要求 worker 重新取得處理權，正式 Actor、時間、理由與結果以 Core audit 為準。</p></ConfirmDialog></>;
}

function WebhookDetailView({value}:{value:WebhookDetail}){
 return <><dl className="detail-grid"><dt>Webhook ID</dt><dd>{value.providerWebhookInboxId}</dd><dt>Domain／Provider</dt><dd>{value.domain}／{value.provider}</dd><dt>Connection</dt><dd>{value.connectionId}</dd><dt>狀態</dt><dd><Badge tone={value.status==='MANUAL_REVIEW'?'danger':'neutral'}>{value.status}</Badge></dd><dt>Provider Event</dt><dd>{value.providerEventIdentity??'未提供'}</dd><dt>嘗試次數</dt><dd>{value.attemptCount}</dd><dt>最後錯誤</dt><dd>{value.lastErrorCode??'—'}</dd><dt>接收時間</dt><dd>{time(value.receivedAt)}</dd><dt>驗證時間</dt><dd>{time(value.verifiedAt)}</dd><dt>處理時間</dt><dd>{time(value.processedAt)}</dd><dt>Correlation ID</dt><dd>{value.correlationId}</dd></dl><h3>操作稽核</h3>{value.audit.length?<ol className="uc-timeline">{value.audit.map(event=><li key={event.auditEventId}><strong>{event.action}</strong><span>{time(event.occurredAt)} · {event.actorId??event.actorReference??event.actorType}</span>{event.reason&&<p>{event.reason}</p>}<small>{event.reasonCode??'—'} · {event.correlationId}</small></li>)}</ol>:<EmptyState title="尚無人工操作稽核"/>}{value.auditTruncated&&<p className="callout warning">僅顯示最近 50 筆稽核紀錄。</p>}<p className="muted">此明細不提供 raw payload、簽章、evidence hash/reference 或 worker lease owner。</p></>;
}
