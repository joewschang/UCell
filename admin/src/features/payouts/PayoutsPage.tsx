import {ConfirmAction} from '../../components/ConfirmAction';
import {AdminTable} from '../../components/AdminTable';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {command,get,qs} from '../../lib/api';
import {Badge,Card,ErrorBox,Field,Metric,PageHeader} from '../../components/ui';
import {useAuth} from '../auth/auth';
import {dateTime,money} from '../../lib/format';

export function PayoutsPage(){
 const qc=useQueryClient();const {user}=useAuth();
 const [status,setStatus]=useState(''),[selected,setSelected]=useState<string|null>(null),[cutoff,setCutoff]=useState('');
 const [periodStart,setPeriodStart]=useState(''),[periodEnd,setPeriodEnd]=useState('');
 const [paidAt,setPaidAt]=useState('');
 const [exportRef,setExportRef]=useState(''),[paymentRef,setPaymentRef]=useState(''),[paymentMethod,setPaymentMethod]=useState('BANK_TRANSFER');
 const [error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false);

 const queue=useQuery({queryKey:['payout-queue',status],queryFn:()=>get<any>('/admin/operations/payout-batches'+qs({status:status||undefined,take:100}))});
 const detail=useQuery({queryKey:['payout-detail',selected],queryFn:()=>get<any>(`/admin/operations/payout-batches/${selected}`),enabled:!!selected});
 const recovery=useQuery({queryKey:['recovery-aging'],queryFn:()=>get<any>('/admin/operations/recoveries'+qs({take:100}))});
 const rows=queue.data?.data??[];const d=detail.data?.data;const rec=recovery.data?.data??[];

 async function mutate(fn:()=>Promise<any>){setBusy(true);setError(null);try{await fn();await qc.invalidateQueries({queryKey:['payout-queue']});await qc.invalidateQueries({queryKey:['payout-detail',selected]});await qc.invalidateQueries({queryKey:['recovery-aging']})}catch(e){setError(e)}finally{setBusy(false)}}
 const financeApproved=d?.approvals?.some((x:any)=>x.stage==='FINANCE_REVIEW'&&x.decision==='APPROVED');
 const complianceApproved=d?.approvals?.some((x:any)=>x.stage==='COMPLIANCE_REVIEW'&&x.decision==='APPROVED');

 return <><PageHeader title="付款批次與對帳" subtitle="Effective Award → Payable → Recovery Offset → Dual Approval → Export → External Payment Reconciliation。"/>
 <ErrorBox error={error}/>
 <div className="metrics"><Metric label="Open Recovery" value={rec.length} helper={money(rec.reduce((s:number,x:any)=>s+Number(x.outstandingAmount),0))}/><Metric label="Payout Batches" value={rows.length} helper={status||'All'}/><Metric label="Role" value={user?.role??'—'} helper="UI only"/><Metric label="Rule" value="R1.0B" helper="Qualification-first"/></div>

 <div className="grid two"><Card title="建立Payable／Payout Batch"><div className="form">
  <Field label="Materialize Cutoff" hint="Production operational cut-off 尚未核准；必須由授權人員提供既有 evidence"><input value={cutoff} onChange={e=>setCutoff(e.target.value)}/></Field><ConfirmAction disabled={busy||!cutoff} onConfirm={()=>mutate(()=>command('/admin/payouts/materialize',{cutoff}))}>Materialize Effective Awards</ConfirmAction>
  <Field label="Period Start"><input value={periodStart} onChange={e=>setPeriodStart(e.target.value)}/></Field><Field label="Period End"><input value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)}/></Field><ConfirmAction className="primary" disabled={busy||!periodStart||!periodEnd} onConfirm={()=>mutate(()=>command('/admin/payouts/batches',{periodStart,periodEnd}))}>Create Payout Batch</ConfirmAction>
 </div></Card>
 <Card title="付款控制"><p><Badge tone="ok">每顆Qualification獨立付款</Badge></p><p><Badge tone="warn">Finance + Compliance雙核准</Badge></p><p>兩階段必須由不同Actor核准；完成後才能Export。系統只記錄外部付款結果，不直接執行銀行轉帳。</p></Card></div>

 <div className="toolbar"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部狀態</option><option>DRAFT</option><option>READY</option><option>EXPORTED</option><option>PAID</option><option>VOIDED</option></select></div>
 <div className="split-view"><Card title={`Payout Batches (${rows.length})`}>{rows.map((x:any)=><button className={`list-row ${selected===x.payoutBatchId?'selected':''}`} key={x.payoutBatchId} onClick={()=>setSelected(x.payoutBatchId)}><strong>{x.status} · Net {money(x.totalNet)}</strong><span>Gross {money(x.totalGross)} − Recovery {money(x.totalRecovery)}</span><small>{dateTime(x.periodEnd)} · {x._count?.lines??0} Qualifications · approvals {x._count?.approvals??0}/2</small></button>)}</Card>
 <Card title="Payout Detail">{!d?<p className="muted">選擇一個付款批次。</p>:<>
  <dl className="detail-grid"><dt>Status</dt><dd><Badge tone={d.status==='PAID'?'ok':d.status==='READY'?'warn':'neutral'}>{d.status}</Badge></dd><dt>Period</dt><dd>{dateTime(d.periodStart)} → {dateTime(d.periodEnd)}</dd><dt>Gross</dt><dd>{money(d.totalGross)}</dd><dt>Recovery</dt><dd>{money(d.totalRecovery)}</dd><dt>Net</dt><dd><strong>{money(d.totalNet)}</strong></dd><dt>Export Ref</dt><dd>{d.exportReference??'—'}</dd><dt>Payment Ref</dt><dd>{d.paymentReference??'—'}</dd></dl>
  <h3>Approvals</h3><p>Finance：{financeApproved?<Badge tone="ok">APPROVED</Badge>:<Badge tone="warn">PENDING</Badge>}　Compliance：{complianceApproved?<Badge tone="ok">APPROVED</Badge>:<Badge tone="warn">PENDING</Badge>}</p>
  {d.status==='READY'&&<div className="button-row"><ConfirmAction disabled={busy||financeApproved||!['FINANCE','SUPER_ADMIN'].includes(user?.role??'')} onConfirm={()=>mutate(()=>command(`/admin/operations/payout-batches/${d.payoutBatchId}/approvals/FINANCE_REVIEW`,{note:'Admin UI finance review'}))}>Finance Approve</ConfirmAction><ConfirmAction disabled={busy||complianceApproved||!['COMPLIANCE_AUDIT','SUPER_ADMIN'].includes(user?.role??'')} onConfirm={()=>mutate(()=>command(`/admin/operations/payout-batches/${d.payoutBatchId}/approvals/COMPLIANCE_REVIEW`,{note:'Admin UI compliance review'}))}>Compliance Approve</ConfirmAction></div>}
  {d.status==='READY'&&financeApproved&&complianceApproved&&<div className="form sticky-actions"><Field label="Export Reference"><input value={exportRef} onChange={e=>setExportRef(e.target.value)}/></Field><ConfirmAction className="primary" disabled={!exportRef||busy||!['FINANCE','SUPER_ADMIN'].includes(user?.role??'')} onConfirm={()=>mutate(()=>command(`/admin/operations/payout-batches/${d.payoutBatchId}/export`,{exportReference:exportRef}))}>Mark EXPORTED</ConfirmAction></div>}
  {d.status==='EXPORTED'&&<div className="form sticky-actions"><Field label="Payment Reference"><input value={paymentRef} onChange={e=>setPaymentRef(e.target.value)}/></Field><Field label="Payment Method"><input value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}/></Field><Field label="外部付款時間（ISO）"><input value={paidAt} onChange={e=>setPaidAt(e.target.value)}/></Field><ConfirmAction className="primary" disabled={!paymentRef||!paidAt||busy||!['FINANCE','SUPER_ADMIN'].includes(user?.role??'')} onConfirm={()=>mutate(()=>command(`/admin/operations/payout-batches/${d.payoutBatchId}/mark-paid`,{paymentReference:paymentRef,paymentMethod,paidAt}))}>Reconcile & Mark PAID</ConfirmAction></div>}
  <h3>Qualification Lines</h3><div className="table-wrap"><AdminTable><thead><tr><th>會員</th><th>Qualification</th><th>Gross</th><th>Recovery</th><th>Net</th></tr></thead><tbody>{(d.lines??[]).map((x:any)=><tr key={x.payoutLineId}><td>{x.recipient?.currentHolder?.legalName??'—'}</td><td className="mono">{x.recipientQualificationId}</td><td>{money(x.grossAmount)}</td><td>{money(x.recoveryOffset)}</td><td>{money(x.netAmount)}</td></tr>)}</tbody></AdminTable></div>
 </>}</Card></div>

 <Card title="Recovery Aging"><div className="table-wrap"><AdminTable><thead><tr><th>會員</th><th>Award</th><th>Status</th><th>Age</th><th>Recovery</th><th>Recovered</th><th>Outstanding</th></tr></thead><tbody>{rec.map((x:any)=><tr key={x.bonusRecoveryEventId}><td>{x.bonusAward?.recipient?.currentHolder?.legalName??'—'}</td><td>{x.bonusAward?.awardType}</td><td>{x.status}</td><td>{x.agingDays}d</td><td>{money(x.recoveryAmount)}</td><td>{money(x.recoveredAmount)}</td><td>{money(x.outstandingAmount)}</td></tr>)}</tbody></AdminTable></div></Card>
 </>
}
