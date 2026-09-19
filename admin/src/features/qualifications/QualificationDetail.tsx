import {useId,useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {get,qs} from '../../lib/api';
import {useAuth} from '../auth/auth';
import {canOpen} from '../auth/permissions';
import {LoadingState,ErrorState,EmptyState,QualificationBadge,StatusBadge} from '@ucell/design-system';
import {dateTime,holderName} from '../../lib/format';

const tabs=['Overview','Sponsor','Binary','Active','PV/RPV/EPV','Orders','Bonus','Ledger','Settlement','Audit'];
type SafeField={label:string;keys:string[];date?:boolean};
type Admin360={
 organization?:{status?:string;treeCode?:string|null;binaryPositionNo?:string|null;binaryPath?:string|null;canonicalSide?:'LEFT'|'RIGHT'|null};
 owner?:{status?:string;ownerType?:'MEMBER'|'COMPANY'|null;memberNo?:string|null;companyCode?:string|null};
 plan?:{status?:string;planCode?:string|null;source?:string|null;profileVersion?:string|null;effectiveFrom?:string|null;effectiveTo?:string|null};
 globalRank?:{status?:string;scope?:string|null;highestRank?:string|null};
};

function admin360(qualification:any):Admin360|undefined{return qualification?.admin360;}
const COMPANY_BOOTSTRAP_PROFILE_V1='COMPANY_BOOTSTRAP_PROFILE_V1';

function validInterval(from:unknown,to:unknown){
 const start=typeof from==='string'?Date.parse(from):NaN;
 const end=to===null?null:typeof to==='string'?Date.parse(to):NaN;
 return Number.isFinite(start)&&(end===null||Number.isFinite(end)&&end>start);
}

/**
 * A Company LEADER label is a claim about the sealed bootstrap profile, not
 * about the current holder. Keep it bound to the complete server projection.
 */
export function hasApprovedLeaderCompanyBinding(qualification:any){
 const view=admin360(qualification),plan=view?.plan,owner=view?.owner;
 return qualification?.kind==='COMPANY_BOOTSTRAP'
  && owner?.status==='AVAILABLE'
  && owner.ownerType==='COMPANY'
  && plan?.status==='AVAILABLE'
  && plan.planCode==='LEADER'
  && plan.source==='COMPANY_BOOTSTRAP_PROFILE_BINDING'
  && plan.profileVersion===COMPANY_BOOTSTRAP_PROFILE_V1
  && validInterval(plan.effectiveFrom,plan.effectiveTo);
}

function planLabel(qualification:any){
 const plan=admin360(qualification)?.plan;
 if(!plan||plan.status!=='AVAILABLE'||!plan.planCode)return '方案資料未提供';
 if(qualification?.kind==='COMPANY_BOOTSTRAP')return hasApprovedLeaderCompanyBinding(qualification)?'LEADER':'方案資料未提供';
 if(qualification?.kind==='MEMBER_ORIGIN'&&plan.source==='QUALIFICATION_PLAN_HISTORY')return plan.planCode;
 return '方案資料未提供';
}
function ownerLabel(qualification:any){const owner=admin360(qualification)?.owner;if(!owner||owner.status!=='AVAILABLE'||!owner.ownerType)return '持有證據未提供';if(owner.ownerType==='COMPANY')return owner.companyCode?`公司持有 · ${owner.companyCode}`:'公司持有';return owner.memberNo?`會員持有 · ${owner.memberNo}`:'會員持有';}
function treeLabel(qualification:any){const organization=admin360(qualification)?.organization;return organization?.status==='AVAILABLE'&&organization.treeCode?organization.treeCode:'樹資料未提供';}
function positionLabel(qualification:any){const organization=admin360(qualification)?.organization;return organization?.status==='AVAILABLE'&&organization.binaryPositionNo?organization.binaryPositionNo:'位置資料未提供';}
function pathLabel(qualification:any){const organization=admin360(qualification)?.organization;return organization?.status==='AVAILABLE'&&organization.binaryPath?organization.binaryPath:'路徑資料未提供';}
function rankLabel(qualification:any){const rank=admin360(qualification)?.globalRank;return rank?.status==='AVAILABLE'?rank.highestRank??'尚無全球累積階級':'全球累積階級未提供';}
/** Company Always Active comes from authoritative owner evidence, never a raw currentCompanyPrincipalId. */
function companyOwner(qualification:any){const owner=admin360(qualification)?.owner;return owner?.status==='AVAILABLE'&&owner.ownerType==='COMPANY';}

function valueFrom(record:any,keys:string[]){
 for(const key of keys){
  const value=key.split('.').reduce((current,part)=>current&&typeof current==='object'?current[part]:undefined,record);
  if(typeof value==='string'||typeof value==='number'||typeof value==='boolean')return String(value);
 }
 return '未提供';
}

function SafeFactTable({records,fields,label}:{records:any[];fields:SafeField[];label:string}){
 return <div className="table-wrap"><table><caption className="uc-sr-only">{label}</caption><thead><tr>{fields.map(field=><th key={field.label} scope="col">{field.label}</th>)}</tr></thead><tbody>{records.map((record,index)=><tr key={index}>{fields.map(field=>{const value=valueFrom(record,field.keys);return <td key={field.label}>{field.date&&value!=='未提供'?dateTime(value):value}</td>})}</tr>)}</tbody></table></div>;
}

function RelationshipSummary({relation,kind}:{relation:any;kind:'SPONSOR'|'BINARY'}){
 if(!relation)return <EmptyState title={kind==='SPONSOR'?'尚無 Sponsor 證據':'尚無 Binary 放置證據'}/>;
 const party=kind==='SPONSOR'?(relation.sponsor??relation.sponsorQualification):(relation.parent??relation.binaryParent);
 return <dl className="detail-grid">
  <dt>{kind==='SPONSOR'?'推薦 Ball':'父 Ball'}</dt><dd>{party?.ballNo??relation.parentBallNo??relation.sponsorBallNo??'證據未提供'}</dd>
  <dt>{kind==='SPONSOR'?'推薦人':'左右側'}</dt><dd>{kind==='SPONSOR'?(party?.currentHolder?.memberNo??party?.memberNo??holderName(party)):(relation.side==='LEFT'?'左側':relation.side==='RIGHT'?'右側':'證據未提供')}</dd>
  {kind==='SPONSOR'?<><dt>實際 Sponsor 序號</dt><dd>{relation.actualSponsorSequenceNo??relation.sponsorSequenceNo??'證據未提供'}</dd></>:<><dt>Binary Tree</dt><dd>{relation.tree?.treeCode??relation.binaryTree?.treeCode??'證據未提供'}</dd><dt>放置時間</dt><dd>{relation.effectiveAt?dateTime(relation.effectiveAt):'證據未提供'}</dd></>}
 </dl>;
}

export function QualificationDetail({id}:{id:string}){
 const [tab,setTab]=useState('Overview');const group=useId();const {user}=useAuth();
 const detail=useQuery({queryKey:['qualification-detail-ux2',id],queryFn:()=>get<any>('/admin/qualifications/'+id)});
 const ops=useQuery({queryKey:['qualification-ops-ux2',id],queryFn:()=>get<any>('/admin/observability/qualifications/'+id+'/operations'),enabled:['PV/RPV/EPV','Bonus','Ledger','Settlement'].includes(tab)});
 const auditAllowed=canOpen(user?.role,'/audit');
 const audit=useQuery({queryKey:['qualification-audit-ux2',id],queryFn:()=>get<any>('/admin/ops-ready/audit-events'+qs({entityType:'QUALIFICATION',entityId:id,take:50})),enabled:tab==='Audit'&&auditAllowed});
 if(detail.isPending)return <LoadingState label="正在載入 Ball 360…"/>;
 if(detail.error)return <ErrorState message={String(detail.error)} retry={()=>void detail.refetch()}/>;
 const q=detail.data?.data;
 if(!q||q.qualificationId!==id)return <ErrorState message="Ball evidence 不一致；停止顯示"/>;
 const o=ops.data?.data;
 if(o&&o.qualification?.qualificationId!==id)return <ErrorState message="Ball operations evidence 不一致；停止顯示"/>;
 const companyHeld=companyOwner(q),approvedCompanyLeader=hasApprovedLeaderCompanyBinding(q),plan=planLabel(q),owner=ownerLabel(q),tree=treeLabel(q),position=positionLabel(q),path=pathLabel(q),rank=rankLabel(q);
 const planSource=admin360(q)?.plan;
 let body:React.ReactNode;
 if(tab==='Overview')body=<><dl className="detail-grid"><dt>Ball Number（球編號）</dt><dd>{q.ballNo??'尚未完成 Binary 放置'}</dd><dt>Tree Code（樹號）</dt><dd>{tree}</dd><dt>Binary Position Number（位置號）</dt><dd>{position}</dd><dt>Binary Path（位置路徑）</dt><dd>{path}</dd><dt>Plan（方案）</dt><dd>{plan}</dd><dt>Global cumulative rank（全球累積階級）</dt><dd>{rank}</dd><dt>Owner（持有狀態）</dt><dd>{owner}</dd><dt>Domain Status</dt><dd><StatusBadge status={q.status??'UNAVAILABLE'}/></dd><dt>Active</dt><dd>{companyHeld?'Always Active (Company Rule)':q.activeFlag?'ACTIVE':'INACTIVE'}</dd><dt>Effective</dt><dd>{dateTime(q.effectiveAt)}</dd></dl>{planSource&&<p className="uc-muted">方案來源：{approvedCompanyLeader?'已核准 Company Bootstrap LEADER Binding':planSource.status==='AVAILABLE'&&planSource.source==='QUALIFICATION_PLAN_HISTORY'?'Qualification Plan History':'權威方案證據未提供'}。{companyHeld&&!approvedCompanyLeader?'公司持有本身不會推定為 LEADER。':''}</p>}</>;
 else if(tab==='Sponsor')body=<><h3>推薦關係</h3><RelationshipSummary relation={q.sponsorRelation} kind="SPONSOR"/><p className="uc-muted">Sponsor 與 Binary parent 是不同關係；畫面不會用其中一方推導另一方。</p></>;
 else if(tab==='Binary')body=<><h3>二元安置</h3><RelationshipSummary relation={q.binaryPlacement} kind="BINARY"/><p className="uc-muted">位置與 Ball Number 為權威資料；此畫面不顯示內部 Qualification UUID。</p></>;
 else if(tab==='Active')body=companyHeld?<section className="callout info"><strong>Always Active (Company Rule)</strong><p>公司持有期間適用；不代表公司金額功能已啟用，也不會豁免 Global rank 條件。</p></section>:q.activePeriods?.length?<><p className="uc-muted">Backend 最近最多 20 筆 Active history</p><ol className="timeline-list">{q.activePeriods.map((p:any,index:number)=><li key={p.activePeriodId??index}>{dateTime(p.activeFrom)} → {dateTime(p.activeTo)} · {p.sourceType??'來源未提供'}</li>)}</ol></>:<EmptyState title="尚無 Active history"/>;
 else if(tab==='Orders')body=q.orders?.length?<><p className="uc-muted">Backend 最近最多 10 筆訂單。訂單金額與狀態由伺服器提供。</p><SafeFactTable label="Ball orders" records={q.orders} fields={[{label:'訂單編號',keys:['orderNo']},{label:'用途',keys:['purpose']},{label:'狀態',keys:['status']},{label:'淨額',keys:['netAmount']},{label:'建立時間',keys:['createdAt'],date:true}]}/></>:<EmptyState title="此 Ball 尚無訂單"/>;
 else if(tab==='Audit')body=!auditAllowed?<EmptyState title="此角色無 Audit 讀取權限"><p>系統沒有載入或快取 Audit 內容。</p></EmptyState>:audit.isPending?<LoadingState label="正在載入 Audit evidence…"/>:audit.error?<ErrorState message={String(audit.error)} retry={()=>void audit.refetch()}/>:audit.data?.data?.length?<SafeFactTable label="Ball audit events" records={audit.data.data} fields={[{label:'動作',keys:['action','eventType','eventName']},{label:'狀態',keys:['status']},{label:'生效時間',keys:['effectiveAt'],date:true},{label:'記錄時間',keys:['recordedAt','createdAt'],date:true}]}/>:<EmptyState title="此 Ball 尚無 Audit 記錄"/>;
 else if(ops.isPending)body=<LoadingState label="正在載入 Ball operations…"/>;
 else if(ops.error)body=<ErrorState message={String(ops.error)} retry={()=>void ops.refetch()}/>;
 else if(tab==='PV/RPV/EPV')body=<><p className="uc-muted">Backend ledger aggregation；缺少的 type 不推定為零。</p>{o?.balances?.length?<dl className="detail-grid">{o.balances.map((b:any,index:number)=><div key={b.pvType??index}><dt>{b.pvType??'PV type 未提供'}</dt><dd>{b._sum?.amount??'待提供'}</dd></div>)}</dl>:<EmptyState title="尚無業績 ledger aggregation"/>}</>;
 else if(tab==='Bonus')body=o?.awards?.length?<><p className="uc-muted">最近最多 200 筆 Core Award facts；不代表出款授權。畫面僅顯示可安全辨識的業務欄位。</p><SafeFactTable label="Ball award facts" records={o.awards} fields={[{label:'類型',keys:['awardType','type']},{label:'狀態',keys:['status']},{label:'Final',keys:['finalAmount','amount']},{label:'生效時間',keys:['effectiveAt','createdAt'],date:true}]}/></>:<EmptyState title="尚無 Award"/>;
 else if(tab==='Ledger')body=<><p>PV Ledger · append-only history · 最近最多 200 筆</p>{o?.pv?.length?<SafeFactTable label="Ball PV ledger" records={o.pv} fields={[{label:'PV 類型',keys:['pvType','type']},{label:'數量',keys:['amount']},{label:'狀態',keys:['status']},{label:'生效時間',keys:['effectiveAt'],date:true},{label:'記錄時間',keys:['recordedAt','createdAt'],date:true}]}/>:<EmptyState title="尚無 PV Ledger"/>}</>;
 else {const records=[...new Map((o?.awards??[]).filter((a:any)=>a.settlementBatch).map((a:any)=>[a.settlementBatch.settlementBatchId,a.settlementBatch])).values()];body=records.length?<SafeFactTable label="Ball settlements" records={records} fields={[{label:'結算批次',keys:['settlementBatchNo','periodCode']},{label:'狀態',keys:['status']},{label:'結算日',keys:['settledAt','createdAt'],date:true}]}/>:<EmptyState title="最近 200 筆 Award 尚無 linked Settlement"/>}
 return <section className="uc-qualification-detail" aria-label="Ball 360"><QualificationBadge code={`球編號 ${q.ballNo??'未放置'}`} rank={`方案 ${plan}`}/><p className="uc-muted">{`樹號 ${tree} · 位置 ${position} · 路徑 ${path} · ${owner}`}</p><div className="uc-detail-tabs" role="tablist" aria-label="Ball 詳情" onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const i=tabs.indexOf(tab);const next=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;setTab(tabs[next]);document.getElementById(group+'-'+next)?.focus()}}>{tabs.map((t,i)=><button type="button" key={t} id={group+'-'+i} role="tab" aria-selected={tab===t} aria-controls={group+'-panel'} tabIndex={tab===t?0:-1} onClick={()=>setTab(t)}>{t}</button>)}</div><div id={group+'-panel'} role="tabpanel" aria-labelledby={group+'-'+tabs.indexOf(tab)} aria-busy={detail.isPending||ops.isPending||audit.isPending}>{body}</div></section>;
}
