import {useState,useId} from 'react';
import {useQuery} from '@tanstack/react-query';
import {get,qs} from '../../lib/api';
import {useAuth} from '../auth/auth';
import {canOpen} from '../auth/permissions';
import {LoadingState,ErrorState,EmptyState,QualificationBadge} from '@ucell/design-system';
import {JsonResult} from '../../components/ui';
import {dateTime,holderName,qNo} from '../../lib/format';
const tabs=['Overview','Sponsor','Binary','Active','PV/RPV/EPV','Orders','Bonus','Ledger','Settlement','Audit'];
export function QualificationDetail({id}:{id:string}){
 const [tab,setTab]=useState('Overview');const group=useId();const {user}=useAuth();
 const detail=useQuery({queryKey:['qualification-detail-ux2',id],queryFn:()=>get<any>('/admin/qualifications/'+id)});
 const ops=useQuery({queryKey:['qualification-ops-ux2',id],queryFn:()=>get<any>('/admin/observability/qualifications/'+id+'/operations'),enabled:['PV/RPV/EPV','Bonus','Ledger','Settlement'].includes(tab)});
 const auditAllowed=canOpen(user?.role,'/audit');const audit=useQuery({queryKey:['qualification-audit-ux2',id],queryFn:()=>get<any>('/admin/ops-ready/audit-events'+qs({entityType:'QUALIFICATION',entityId:id,take:50})),enabled:tab==='Audit'&&auditAllowed});
 if(detail.isPending)return <LoadingState/>;if(detail.error)return <ErrorState message={String(detail.error)} retry={()=>void detail.refetch()}/>;
 const q=detail.data?.data;if(!q||q.qualificationId!==id)return <ErrorState message="Qualification evidence 不一致；停止顯示"/>;
 const o=ops.data?.data;if(o&&o.qualification?.qualificationId!==id)return <ErrorState message="Qualification operations evidence 不一致；停止顯示"/>;
 let body;
 if(tab==='Overview')body=<dl className="detail-grid"><dt>Qualification ID</dt><dd>{id}</dd><dt>Holder Person</dt><dd>{q.currentHolderPersonId}</dd><dt>Plan</dt><dd>{q.planLevelCode}</dd><dt>Domain Status</dt><dd>{q.status}</dd><dt>Active Flag</dt><dd>{q.activeFlag?'ACTIVE':'INACTIVE'}</dd><dt>Effective</dt><dd>{dateTime(q.effectiveAt)}</dd></dl>;
 else if(tab==='Sponsor')body=<><h3>推薦關係</h3><p>{holderName(q.sponsorRelation?.sponsor)}</p><JsonResult value={q.sponsorRelation}/></>;
 else if(tab==='Binary')body=<><h3>二元安置</h3><p>{holderName(q.binaryPlacement?.parent)} · {q.binaryPlacement?.side??'未提供'}</p><JsonResult value={q.binaryPlacement}/></>;
 else if(tab==='Active')body=q.activePeriods?.length?<><p className="uc-muted">Backend 最近最多 20 筆 Active history</p><ol className="timeline-list">{q.activePeriods.map((p:any)=><li key={p.activePeriodId}>{dateTime(p.activeFrom)} → {dateTime(p.activeTo)} · {p.sourceType}</li>)}</ol></>:<EmptyState title="尚無 Active history"/>;
 else if(tab==='Orders')body=q.orders?.length?<><p className="uc-muted">Backend 最近最多 10 筆訂單</p><JsonResult value={q.orders}/></>:<EmptyState title="此資格尚無訂單"/>;
 else if(tab==='Audit')body=!auditAllowed?<EmptyState title="此角色無 Audit 讀取權限"/>:audit.isPending?<LoadingState/>:audit.error?<ErrorState message={String(audit.error)} retry={()=>void audit.refetch()}/>:audit.data?.data?.length?<JsonResult value={audit.data.data}/>:<EmptyState title="此資格尚無 Audit 記錄"/>;
 else if(ops.isPending)body=<LoadingState/>;
 else if(ops.error)body=<ErrorState message={String(ops.error)} retry={()=>void ops.refetch()}/>;
 else if(tab==='PV/RPV/EPV')body=<><p className="uc-muted">Backend ledger aggregation；缺少的 type 不推定為零。</p>{o?.balances?.length?<dl className="detail-grid">{o.balances.map((b:any)=><div key={b.pvType}><dt>{b.pvType}</dt><dd>{b._sum?.amount??'待提供'}</dd></div>)}</dl>:<EmptyState title="尚無業績 ledger aggregation"/>}</>;
 else if(tab==='Bonus')body=o?.awards?.length?<><p className="uc-muted">以下為最近最多 200 筆 Core Award facts；不代表出款授權。currentHolder 僅目前持有人，非 historical recipient evidence。</p><JsonResult value={o.awards}/></>:<EmptyState title="尚無 Award"/>;
 else if(tab==='Ledger')body=<><p>PV Ledger · append-only history · 最近最多 200 筆</p>{o?.pv?.length?<JsonResult value={o.pv}/>:<EmptyState title="尚無 PV Ledger"/>}</>;
 else if(tab==='Settlement'){const records=[...new Map((o?.awards??[]).filter((a:any)=>a.settlementBatch).map((a:any)=>[a.settlementBatch.settlementBatchId,a.settlementBatch])).values()];body=records.length?<JsonResult value={records}/>:<EmptyState title="最近 200 筆 Award 尚無 linked Settlement"/>}
 return <section className="uc-qualification-detail"><QualificationBadge code={'Q#'+qNo(q.qualificationNo)} rank={q.planLevelCode}/><div className="uc-detail-tabs" role="tablist" aria-label="Qualification 詳情" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=tabs.indexOf(tab);const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setTab(tabs[next]);document.getElementById(group+'-'+next)?.focus()}}>{tabs.map((t,i)=><button key={t} id={group+'-'+i} role="tab" aria-selected={tab===t} aria-controls={group+'-panel'} tabIndex={tab===t?0:-1} onClick={()=>setTab(t)}>{t}</button>)}</div><div id={group+'-panel'} role="tabpanel" aria-labelledby={group+'-'+tabs.indexOf(tab)}>{body}</div></section>
}
