import {useRef, useState, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import {domainLabel} from '../../../../shared/design-system/i18n';
import {AdminTable} from '../../components/AdminTable';
import {QueryFeedback} from '../../components/QueryFeedback';
import {Badge, Card, ErrorBox, Field, Metric, PageHeader} from '../../components/ui';
import {get, qs} from '../../lib/api';
import {useAuth} from '../auth/auth';
import './report.css';

type Period = {start:string; end:string};
type Preset = 'today'|'week'|'month'|'previous';
type Dataset = 'QUALIFICATIONS'|'ORDERS'|'PAYOUTS';
type Numeric = string|number|null;
type CurrencyRow = {currency?:string; count?:Numeric; amount?:Numeric};
type Report = {
  persons?:Numeric; qualifications?:Numeric;
  orders?:{count?:Numeric};
  ordersByCurrency?:CurrencyRow[]; paidOrdersByCurrency?:CurrencyRow[]; returnsByCurrency?:CurrencyRow[];
  returns?:{lineCount?:Numeric; gpvReversal?:Numeric};
  payouts?:{_count?:Numeric; _sum?:{totalNet?:Numeric}};
  applications?:{status:string;_count?:Numeric}[];
  awards?:{awardType:string;_count?:Numeric;_sum?:{theoryAmount?:Numeric;payableAmount?:Numeric}}[];
};
type Integrity = {counts?:{critical?:Numeric;high?:Numeric;total?:Numeric};alerts?:{
  severity:string;code:string;entityType?:string;entityId?:string;detail?:unknown;
}[]};

const presets:Record<Preset,string> = {today:'今日',week:'近 7 天',month:'本月',previous:'上月'};
const exportsByName:Record<Dataset,string> = {QUALIFICATIONS:'資格 CSV',ORDERS:'訂單 CSV',PAYOUTS:'付款批次 CSV'};
const alertLabels:Record<string,string>={RECOVERY_BALANCE_MISMATCH:'獎金回收餘額不一致',PAYOUT_NET_MISMATCH:'付款淨額不一致',EFFECTIVE_APPLICATION_WITHOUT_QUALIFICATION:'已生效申請缺少資格',ACTIVE_FLAG_WITHOUT_PERIOD:'啟用資格缺少有效期間',CURRENT_PLAN_HISTORY_MISMATCH:'套組等級與歷史不一致',PAID_ORDER_WITHOUT_GPV:'已付款商品尚未認列業績',PACKAGE_RECOGNITION_CONFIGURATION_PENDING:'套組已付款，認列設定尚待完成'};
const tzOffset = 8 * 60 * 60 * 1000;
const dayMs = 24 * 60 * 60 * 1000;

function validDay(day:string) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day) || day.startsWith('0000')) return false;
  const date = new Date(day+'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0,10)===day;
}
function shiftDay(day:string, offset:number) {
  return new Date(Date.parse(day+'T00:00:00.000Z')+offset*dayMs).toISOString().slice(0,10);
}
export function reportPreset(preset:Preset, now=new Date()):Period {
  const today = new Date(now.getTime()+tzOffset).toISOString().slice(0,10);
  const first = today.slice(0,7)+'-01';
  switch(preset) {
    case 'today': return {start:today,end:today};
    case 'week': return {start:shiftDay(today,-6),end:today};
    case 'previous': {
      const end=shiftDay(first,-1);
      return {start:end.slice(0,7)+'-01',end};
    }
    default: return {start:first,end:today};
  }
}
export function reportInterval(period:Period) {
  if(!validDay(period.start)||!validDay(period.end)||period.start>period.end) return null;
  const from = new Date(Date.parse(period.start+'T00:00:00.000+08:00'));
  const to = new Date(Date.parse(period.end+'T00:00:00.000+08:00')+dayMs);
  return {from:from.toISOString(),to:to.toISOString(),endExclusive:'true'};
}
export function exactNumber(value:unknown, integer=false):string {
  if(typeof value==='number' && (!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)) return '—';
  if(typeof value!=='string' && typeof value!=='number' && typeof value!=='bigint') return '—';
  const raw = String(value);
  if(!(integer ? /^\d+$/ : /^-?\d+(?:\.\d+)?$/).test(raw)) return '—';
  const [whole,fraction]=raw.split('.');
  const formatted=whole.replace(/\B(?=(\d{3})+(?!\d))/g,',');
  return fraction===undefined?formatted:formatted+'.'+fraction;
}
function PeriodAmounts({title,scope,rows,unit}:{title:string;scope:string;rows?:CurrencyRow[];unit:string}) {
  return <section className="ops-report-amount"><h3>{title}</h3><p>{scope}</p>
    {!Array.isArray(rows)?<p className="ops-report-missing">此項資料暫無法取得。</p>
    :!rows.length?<p>期間內無符合紀錄。</p>
    :<table aria-label={title}><thead><tr><th scope="col">幣別</th><th scope="col">{unit}</th><th scope="col">金額</th></tr></thead>
    <tbody>{rows.map((row,index)=><tr key={(row.currency||'')+index}><th scope="row">{row.currency||'—'}</th><td>{exactNumber(row.count,true)}</td><td>{exactNumber(row.amount)}</td></tr>)}</tbody></table>}
  </section>;
}
function DataRows({items,children}:{items?:unknown[];children:ReactNode}) {
  if(!Array.isArray(items)) return <p className="ops-report-missing">此項資料暫無法取得。</p>;
  if(!items.length) return <p>沒有符合紀錄。</p>;
  return <div className="table-wrap">{children}</div>;
}

export function ReportsPage() {
  const {user}=useAuth();
  const canReadIntegrity=user?.role==='SUPER_ADMIN'||user?.role==='COMPLIANCE_AUDIT';
  const [applied,setApplied]=useState<Period>(()=>reportPreset('month'));
  const [draft,setDraft]=useState(applied);
  const [exportError,setExportError]=useState<unknown>(null);
  const [exporting,setExporting]=useState(false);
  const exportPending=useRef(false);
  const interval=reportInterval(applied);
  const dirty=applied.start!==draft.start||applied.end!==draft.end;
  const invalid=!reportInterval(draft);
  const report=useQuery({
    queryKey:['ops-report',interval?.from,interval?.to,'exclusive'],
    enabled:!!interval,
    queryFn:({signal})=>get<{data:Report}>('/admin/ops-ready/reports/operations'+qs(interval!),{signal})
  });
  const integrity=useQuery({
    queryKey:['integrity-alerts',user?.role],enabled:canReadIntegrity,
    queryFn:({signal})=>get<{data:Integrity}>('/admin/ops-ready/integrity-alerts',{signal}),refetchInterval:60_000
  });
  const r=report.error?undefined:report.data?.data;
  const i=integrity.error||!canReadIntegrity?undefined:integrity.data?.data;
  function apply(period:Period) {
    if(!reportInterval(period))return;
    setApplied(period);setDraft(period);setExportError(null);
  }
  async function download(dataset:Dataset) {
    if(exportPending.current||dirty||!interval)return;
    exportPending.current=true;setExporting(true);setExportError(null);
    let url:string|undefined;
    try {
      const {data}=await get<{data:{content:string;filename:string;contentType:string}}>('/admin/ops-ready/exports/'+dataset+qs({take:10000,...interval}));
      if(typeof data?.content!=='string'||!data.filename) throw new Error('匯出內容不完整，請重新匯出。');
      url=URL.createObjectURL(new Blob([data.content],{type:data.contentType}));
      const a=document.createElement('a');a.href=url;a.download=data.filename;a.click();
    } catch(error){setExportError(error);}
    finally{if(url) URL.revokeObjectURL(url);exportPending.current=false;setExporting(false);}
  }
  const dates=Object.keys(presets) as Preset[];
  return <div className="ops-report">
    <PageHeader title="營運報表" subtitle="依台北日期檢視訂單、已付款與退貨金額。"/>
    <Card title="報表期間">
      <div className="ops-report-presets" role="group" aria-label="常用期間">{dates.map(key=>
        <button key={key} type="button" disabled={exporting} onClick={()=>apply(reportPreset(key))}>{presets[key]}</button>)}</div>
      <form className="ops-report-period" noValidate onSubmit={e=>{e.preventDefault();apply(draft);}}>
        <Field label="開始日期"><input type="date" value={draft.start} disabled={exporting} aria-invalid={invalid} onChange={e=>setDraft({...draft,start:e.target.value})}/></Field>
        <Field label="結束日期"><input type="date" value={draft.end} disabled={exporting} aria-invalid={invalid} onChange={e=>setDraft({...draft,end:e.target.value})}/></Field>
        <button type="submit" className="primary" disabled={exporting||!dirty||invalid}>套用期間</button>
      </form>
      <p className="ops-report-applied" role="status">目前報表與匯出期間為 {applied.start} 至 {applied.end}（台北時間，含首尾兩日）。</p>
      {dirty&&<p className="ops-report-draft" role="status">{invalid?'請選擇有效日期，結束日期須在開始日期當日或之後。':'日期已修改，請套用期間以更新報表並開放匯出。'}</p>}
    </Card>
    <QueryFeedback query={report}/>
    {report.isSuccess&&!r&&<p>此期間的報表資料暫無法取得。</p>}
    {r&&<>
      <div className="metrics"><Metric label="新增自然人" value={exactNumber(r.persons,true)}/><Metric label="新增經營資格" value={exactNumber(r.qualifications,true)}/>
        <Metric label="建立訂單數" value={exactNumber(r.orders?.count,true)}/><Metric label="退貨明細行數" value={exactNumber(r.returns?.lineCount,true)}/></div>
      <Card title="訂單、已付款與退貨"><div className="ops-report-amounts">
        <PeriodAmounts title="已付款訂單" scope="依訂單入帳日，只計正額訂單。退貨另列。" rows={r.paidOrdersByCurrency} unit="訂單數"/>
        <PeriodAmounts title="建立訂單" scope="依訂單建立日，含各狀態，金額採折扣後應付額。" rows={r.ordersByCurrency} unit="訂單數"/>
        <PeriodAmounts title="退貨申報" scope="依退貨發生日，統計明細行數及申報金額。退款進度請查閱原案件。" rows={r.returnsByCurrency} unit="行數"/>
      </div><p>期間退貨沖回 GPV　{exactNumber(r.returns?.gpvReversal)}</p></Card>
      <div className="grid two"><Card title="會員申請"><DataRows items={r.applications}><AdminTable><thead><tr><th>狀態</th><th>件數</th></tr></thead>
        <tbody>{r.applications?.map(x=><tr key={x.status}><td>{domainLabel(x.status)}</td><td>{exactNumber(x._count,true)}</td></tr>)}</tbody></AdminTable></DataRows></Card>
      <Card title="獎金與付款"><p>付款批次 {exactNumber(r.payouts?._count,true)} 批　淨額 {exactNumber(r.payouts?._sum?.totalNet)}</p>
        <DataRows items={r.awards}><AdminTable><thead><tr><th>獎金類別</th><th>筆數</th><th>理論金額</th><th>應付金額</th></tr></thead>
        <tbody>{r.awards?.map(x=><tr key={x.awardType}><td>{domainLabel(x.awardType)}</td><td>{exactNumber(x._count,true)}</td><td>{exactNumber(x._sum?.theoryAmount)}</td><td>{exactNumber(x._sum?.payableAmount)}</td></tr>)}</tbody></AdminTable></DataRows></Card></div>
    </>}
    <Card title="匯出 CSV"><p>資格與訂單依建立時間，付款批次依期間結束時間。每份最多 10,000 筆。</p>
      <div className="button-row">{(Object.keys(exportsByName) as Dataset[]).map(key=><button key={key} type="button" disabled={exporting||dirty||!interval} onClick={()=>void download(key)}>{exportsByName[key]}</button>)}</div>
      <ErrorBox error={exportError}/>{exporting&&<p role="status">正在匯出…</p>}</Card>
    {canReadIntegrity&&<Card title="資料完整性警示"><p>檢查目前資料。警示時間範圍獨立於上方報表期間。</p><QueryFeedback query={integrity}/>
      {integrity.isSuccess&&!i&&<p>完整性警示暫無法取得。</p>}
      {i&&<><div className="metrics mini"><Metric label="重大" value={exactNumber(i.counts?.critical,true)}/><Metric label="高風險" value={exactNumber(i.counts?.high,true)}/><Metric label="警示總數" value={exactNumber(i.counts?.total,true)}/></div>
        <DataRows items={i.alerts}><AdminTable><thead><tr><th>嚴重度</th><th>警示原因</th><th>對象</th><th>明細</th></tr></thead>
          <tbody>{i.alerts?.map((x,idx)=><tr key={x.code+'-'+x.entityId+'-'+idx}><td><Badge tone={x.severity==='CRITICAL'?'danger':'warn'}>{domainLabel(x.severity)}</Badge></td>
            <td>{alertLabels[x.code]??x.code}<br/><small className="mono">{x.code}</small></td><td>{x.entityType}<br/><span className="mono">{x.entityId}</span></td>
            <td className="compact">{x.detail==null?'—':JSON.stringify(x.detail)}</td></tr>)}</tbody>
        </AdminTable></DataRows></>}
    </Card>}
  </div>;
}
