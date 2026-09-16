import {ConfirmAction} from '../../components/ConfirmAction';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {command,get,qs} from '../../lib/api';
import {MembershipApplication} from '../../types/domain';
import {Badge,Card,ErrorBox,PageHeader} from '../../components/ui';
import {dateTime,holderName} from '../../lib/format';
import {Link} from 'react-router-dom';

function tone(s:string){return s==='EFFECTIVE'?'ok':s==='SUBMITTED'?'warn':s==='DRAFT'?'neutral':'danger'}

export function ApplicationsPage(){
 const qc=useQueryClient();const [status,setStatus]=useState('SUBMITTED'),[search,setSearch]=useState('');
 const [selected,setSelected]=useState<string|null>(null);const [error,setError]=useState<unknown>(null);const [busy,setBusy]=useState(false);
 const list=useQuery({queryKey:['applications',status,search],queryFn:()=>get<any>('/admin/membership-applications'+qs({status:status||undefined,q:search,take:100}))});
 const detail=useQuery({queryKey:['application',selected],queryFn:()=>get<any>(`/admin/membership-applications/${selected}`),enabled:!!selected});
 const rows:MembershipApplication[]=list.data?.data??[];const a:MembershipApplication|undefined=detail.data?.data;
 async function action(kind:'submit'|'approve'){
  if(!selected)return;setBusy(true);setError(null);
  try{await command(`/admin/membership-applications/${selected}/${kind}`);await qc.invalidateQueries({queryKey:['applications']});await qc.invalidateQueries({queryKey:['application',selected]})}
  catch(e){setError(e)}finally{setBusy(false)}
 }
 return <>
  <PageHeader title="會員申請待審" subtitle="Draft → Submitted → Effective；Approve時才正式建立Qualification、Sponsor Relationship與Binary Placement。" actions={<Link className="button-link" to="/applications/new">＋ 新增會員申請</Link>}/>
  <div className="toolbar"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部狀態</option><option>DRAFT</option><option>SUBMITTED</option><option>EFFECTIVE</option></select><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="姓名／手機／Email"/></div>
  <ErrorBox error={list.error}/><ErrorBox error={error}/>
  <div className="split-view"><Card title={`申請佇列 (${rows.length})`}><div>{rows.map(x=><button className={`list-row ${selected===x.applicationId?'selected':''}`} key={x.applicationId} onClick={()=>setSelected(x.applicationId)}><strong>{x.person?.legalName??x.personId}</strong><span>{x.requestedPlanLevelCode} · <Badge tone={tone(x.status) as any}>{x.status}</Badge></span><small>{dateTime(x.createdAt)} · {x.applicationId}</small></button>)}</div></Card>
  <Card title="申請詳情">{!a?<p className="muted">請從左側選擇一筆申請。</p>:<>
   <div className="status-strip"><Badge tone={tone(a.status) as any}>{a.status}</Badge><span>{a.requestedPlanLevelCode}</span></div>
   <dl className="detail-grid">
    <dt>申請人</dt><dd>{a.person.legalName}</dd><dt>手機</dt><dd>{a.person.mobile??'—'}</dd><dt>Person ID</dt><dd className="mono">{a.personId}</dd>
    <dt>Sponsor</dt><dd>{holderName(a.sponsorQualification)}<br/><span className="mono">{a.sponsorQualificationId}</span></dd>
    <dt>Binary Parent</dt><dd>{holderName(a.binaryParentQualification)}<br/><span className="mono">{a.binaryParentQualificationId}</span></dd>
    <dt>Side</dt><dd>{a.binarySide}</dd><dt>Submitted</dt><dd>{dateTime(a.submittedAt)}</dd><dt>Approved</dt><dd>{dateTime(a.approvedAt)}</dd>
    {a.createdQualificationId&&<><dt>Created Qualification</dt><dd className="mono">{a.createdQualificationId}</dd></>}
   </dl>
   <div className="sticky-actions button-row">
    {a.status==='DRAFT'&&<button className="primary" disabled={busy} onClick={()=>action('submit')}>Submit申請</button>}
    {a.status==='SUBMITTED'&&<ConfirmAction className="primary" disabled={busy} onConfirm={()=>action('approve')}>Approve並建立Qualification</ConfirmAction>}
    {a.status==='EFFECTIVE'&&<><Badge tone="ok">Qualification已生效</Badge>{a.createdQualificationId&&<Link className="button-link" to={`/orders?qualificationId=${a.createdQualificationId}`}>建立入會訂單</Link>}</>}
   </div>
  </>}</Card></div>
 </>
}
