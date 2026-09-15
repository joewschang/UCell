import {useQuery} from '@tanstack/react-query';
import {useState} from 'react';
import {get,qs} from '../../lib/api';
import {Badge,Card,ErrorBox,Field,Metric,PageHeader} from '../../components/ui';
import {money} from '../../lib/format';

export function ReportsPage(){
  const now=new Date();const first=new Date(now.getFullYear(),now.getMonth(),1);
  const [from,setFrom]=useState(first.toISOString()),[to,setTo]=useState(now.toISOString());
  const report=useQuery({queryKey:['ops-report',from,to],queryFn:()=>get<any>('/admin/ops-ready/reports/operations'+qs({from,to}))});
  const integrity=useQuery({queryKey:['integrity-alerts'],queryFn:()=>get<any>('/admin/ops-ready/integrity-alerts'),refetchInterval:60_000});
  const r=report.data?.data;const i=integrity.data?.data;
  async function download(dataset:'QUALIFICATIONS'|'ORDERS'|'PAYOUTS'){
    const x:any=await get('/admin/ops-ready/exports/'+dataset+qs({take:10000}));
    const blob=new Blob([x.data.content],{type:x.data.contentType});
    const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=x.data.filename;a.click();URL.revokeObjectURL(url);
  }
  return <><PageHeader title="報表／完整性" subtitle="營運報表與Integrity Alerts分離：報表看趨勢，Alerts用來抓不可接受的帳務/資料不變量破壞。"/>
    <div className="grid two"><Card title="期間"><div className="form"><Field label="From"><input value={from} onChange={e=>setFrom(e.target.value)}/></Field><Field label="To"><input value={to} onChange={e=>setTo(e.target.value)}/></Field><div className="button-row"><button onClick={()=>download('QUALIFICATIONS')}>Export Qualifications CSV</button><button onClick={()=>download('ORDERS')}>Export Orders CSV</button><button onClick={()=>download('PAYOUTS')}>Export Payouts CSV</button></div></div></Card>
    <Card title="Integrity Status"><div className="metrics mini"><Metric label="Critical" value={i?.counts?.critical??'—'} helper="must fix"/><Metric label="High" value={i?.counts?.high??'—'} helper="review"/><Metric label="Total" value={i?.counts?.total??'—'} helper="alerts"/></div><p className="muted">Integrity Alert不是把資料自動改掉；系統只偵測與提示，由受權人員依Audit/Adjustment流程處理。</p></Card></div>
    <ErrorBox error={report.error}/><ErrorBox error={integrity.error}/>
    {r&&<><div className="metrics"><Metric label="新Person" value={r.persons}/><Metric label="新Qualification" value={r.qualifications}/><Metric label="Orders" value={r.orders?.count??0} helper={money(r.orders?.netAmount)}/><Metric label="Payout Net" value={money(r.payouts?._sum?.totalNet??0)} helper={`${r.payouts?._count??0} batches`}/></div>
    <div className="grid two"><Card title="Applications"><div className="table-wrap"><table><thead><tr><th>Status</th><th>Count</th></tr></thead><tbody>{(r.applications??[]).map((x:any)=><tr key={x.status}><td>{x.status}</td><td>{x._count}</td></tr>)}</tbody></table></div></Card>
    <Card title="Awards"><div className="table-wrap"><table><thead><tr><th>Type</th><th>Count</th><th>Theory</th><th>Payable</th></tr></thead><tbody>{(r.awards??[]).map((x:any)=><tr key={x.awardType}><td>{x.awardType}</td><td>{x._count}</td><td>{money(x._sum?.theoryAmount)}</td><td>{money(x._sum?.payableAmount)}</td></tr>)}</tbody></table></div></Card></div></>}
    <Card title="Integrity Alerts"><div className="table-wrap"><table><thead><tr><th>Severity</th><th>Code</th><th>Entity</th><th>Detail</th></tr></thead><tbody>{(i?.alerts??[]).map((x:any,idx:number)=><tr key={`${x.code}-${x.entityId}-${idx}`}><td><Badge tone={x.severity==='CRITICAL'?'danger':'warn'}>{x.severity}</Badge></td><td>{x.code}</td><td>{x.entityType}<br/><span className="mono">{x.entityId}</span></td><td className="compact">{JSON.stringify(x.detail??{})}</td></tr>)}</tbody></table></div></Card>
  </>
}
