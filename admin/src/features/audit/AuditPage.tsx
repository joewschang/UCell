import {uiText} from "../../../../shared/design-system/i18n";
import {AdminTable} from '../../components/AdminTable';
import {useQuery} from '@tanstack/react-query';
import {useState} from 'react';
import {get,qs} from '../../lib/api';
import {Card,ErrorBox,Field,PageHeader,JsonResult} from '../../components/ui';
import {dateTime} from '../../lib/format';

export function AuditPage(){
  const [entityType,setEntityType]=useState(''),[entityId,setEntityId]=useState(''),[action,setAction]=useState(''),[correlationId,setCorrelationId]=useState('');
  const [from,setFrom]=useState(''),[to,setTo]=useState(''),[selected,setSelected]=useState<any|null>(null);
  const q=useQuery({queryKey:['audit',entityType,entityId,action,correlationId,from,to],queryFn:()=>get<any>('/admin/ops-ready/audit-events'+qs({entityType:entityType||undefined,entityId:entityId||undefined,action:action||undefined,correlationId:correlationId||undefined,from:from||undefined,to:to||undefined,take:300}))});
  const rows=q.data?.data??[];
  return <><PageHeader title="稽核紀錄" subtitle={uiText("Audit Event、Request ID、Correlation ID與Before/After資料是追查營運異動的正式入口。")}/>
    <Card title="搜尋"><div className="filter-grid">
      <Field label={uiText("Entity Type")}><input value={entityType} onChange={e=>setEntityType(e.target.value)}/></Field>
      <Field label={uiText("Entity ID")}><input value={entityId} onChange={e=>setEntityId(e.target.value)}/></Field>
      <Field label={uiText("Action")}><input value={action} onChange={e=>setAction(e.target.value)}/></Field>
      <Field label={uiText("Correlation ID")}><input value={correlationId} onChange={e=>setCorrelationId(e.target.value)}/></Field>
      <Field label={uiText("From")}><input value={from} onChange={e=>setFrom(e.target.value)}/></Field>
      <Field label={uiText("To")}><input value={to} onChange={e=>setTo(e.target.value)}/></Field>
    </div></Card>
    <ErrorBox error={q.error}/>
    <div className="split-view"><Card title={`Audit Events (${rows.length})`}><div className="table-wrap"><AdminTable><thead><tr><th>{uiText("Time")}</th><th>{uiText("Action")}</th><th>{uiText("Entity")}</th><th>{uiText("Actor")}</th><th>{uiText("Correlation")}</th></tr></thead><tbody>{rows.map((x:any)=><tr className="click-row" key={x.auditEventId} onClick={()=>setSelected(x)}><td>{dateTime(x.occurredAt)}</td><td>{x.action}</td><td>{x.entityType}<br/><span className="mono">{x.entityId??'—'}</span></td><td>{x.actorType}<br/><span className="mono">{x.actorId??'—'}</span></td><td className="mono">{x.correlationId}</td></tr>)}</tbody></AdminTable></div></Card>
    <Card title={uiText("Event Detail")}>{!selected?<p className="muted">{uiText("選擇一筆Audit Event。")}</p>:<><dl className="detail-grid"><dt>{uiText("Request ID")}</dt><dd className="mono">{selected.requestId}</dd><dt>{uiText("Correlation ID")}</dt><dd className="mono">{selected.correlationId}</dd><dt>{uiText("Reason")}</dt><dd>{selected.reasonCode??'—'}</dd></dl><h3>{uiText("Before")}</h3><JsonResult value={selected.beforeData}/><h3>{uiText("After")}</h3><JsonResult value={selected.afterData}/></>}</Card></div>
  </>
}
