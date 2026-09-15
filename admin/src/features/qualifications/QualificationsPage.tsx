import {useQuery} from '@tanstack/react-query';
import {useEffect,useState} from 'react';
import {get,qs} from '../../lib/api';
import {Qualification} from '../../types/domain';
import {Badge,Card,ErrorBox,PageHeader} from '../../components/ui';
import {dateTime,holderName,qNo} from '../../lib/format';
import {useSearchParams} from 'react-router-dom';

export function QualificationsPage(){
 const [params]=useSearchParams();
 const [search,setSearch]=useState(''),[status,setStatus]=useState('EFFECTIVE'),[selected,setSelected]=useState<string|null>(null);
 const list=useQuery({queryKey:['qualifications',search,status],queryFn:()=>get<any>('/admin/qualifications'+qs({q:search,status:status||undefined,take:100}))});
 const detail=useQuery({queryKey:['qualification',selected],queryFn:()=>get<any>(`/admin/qualifications/${selected}`),enabled:!!selected});
 const ledger=useQuery({queryKey:['qualification-pv',selected],queryFn:()=>get<any>(`/admin/qualifications/${selected}/ledger/pv`),enabled:!!selected});
 const rows:Qualification[]=list.data?.data??[];const q:any=detail.data?.data;

 useEffect(()=>{
   const id=params.get('qualificationId');
   if(id)setSelected(id);
 },[params]);
 return <><PageHeader title="會員資格（球）" subtitle="Qualification是UCell制度運算、組織、PV、Carry、Award與Payout的獨立單位。"/>
 <div className="toolbar"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Qualification ID／持有人姓名／手機／Email"/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部狀態</option><option>EFFECTIVE</option><option>CLOSED</option><option>SUSPENDED</option></select></div>
 <ErrorBox error={list.error}/><div className="split-view"><Card title={`Qualifications (${rows.length})`}>{rows.map(x=><button className={`list-row ${selected===x.qualificationId?'selected':''}`} key={x.qualificationId} onClick={()=>setSelected(x.qualificationId)}><strong>Q#{qNo(x.qualificationNo)} · {x.currentHolder?.legalName??'—'}</strong><span>{x.planLevelCode} · <Badge tone={x.activeFlag?'ok':'neutral'}>{x.activeFlag?'ACTIVE':'NOT ACTIVE'}</Badge></span><small>{x.qualificationId}</small></button>)}</Card>
 <Card title="Qualification詳情">{!q?<p className="muted">請選擇一顆會員資格。</p>:<><dl className="detail-grid">
 <dt>Qualification No</dt><dd>Q#{qNo(q.qualificationNo)}</dd><dt>ID</dt><dd className="mono">{q.qualificationId}</dd><dt>Holder</dt><dd>{q.currentHolder?.legalName}</dd><dt>Plan</dt><dd>{q.planLevelCode}</dd><dt>Status</dt><dd>{q.status}</dd><dt>Active Flag</dt><dd>{q.activeFlag?'Yes':'No'}</dd>
 <dt>Sponsor</dt><dd>{holderName(q.sponsorRelation?.sponsor)} · #{q.sponsorRelation?.sponsorSequenceNo??'—'}</dd><dt>Binary Parent</dt><dd>{holderName(q.binaryPlacement?.parent)} · {q.binaryPlacement?.side??'—'}</dd>
 <dt>Effective</dt><dd>{dateTime(q.effectiveAt)}</dd></dl>
 <h3>Active Timeline</h3><div className="timeline-list">{(q.activePeriods??[]).map((x:any)=><div className="timeline-item" key={x.activePeriodId}><strong>{dateTime(x.activeFrom)}</strong><span>→ {dateTime(x.activeTo)}</span><small>{x.sourceType}</small></div>)}</div><h3>PV Ledger</h3><div className="json compact">{JSON.stringify(ledger.data?.data??[],null,2)}</div><h3>最近訂單</h3><div className="table-wrap"><table><thead><tr><th>Order</th><th>Status</th><th>Amount</th><th>Date</th></tr></thead><tbody>{(q.orders??[]).map((o:any)=><tr key={o.orderId}><td className="mono">{o.orderId}</td><td>{o.status}</td><td>{o.netAmount}</td><td>{dateTime(o.createdAt)}</td></tr>)}</tbody></table></div>
 </>}</Card></div></>
}
