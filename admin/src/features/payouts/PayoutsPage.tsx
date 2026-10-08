import {ConfirmAction} from '../../components/ConfirmAction';
import {AdminTable} from '../../components/AdminTable';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {command,get,qs} from '../../lib/api';
import {Badge,Card,ErrorBox,Field,Metric,PageHeader} from '../../components/ui';
import {useAuth} from '../auth/auth';
import {dateTime} from '../../lib/format';
import {formatStoredDecimal} from '../../lib/stored-decimal';
const money=(value:unknown)=>'NT$ '+formatStoredDecimal(value);
import {BankExportForm} from './BankExportForm';
import {PayoutResultForm} from './PayoutResultForm';
import {saveBankDownload,saveFinanceReviewDownload,type FinanceReviewDownload} from './payout-download';
const statusLabels:Record<string,string>={DRAFT:'草稿',READY:'待財務覆核',REVIEWED:'待獨立核准',APPROVED:'已核准，待匯出',EXPORTED:'已匯出，待對帳',PROCESSING:'對帳處理中',PARTIALLY_PAID:'部分已付款',FAILED:'付款失敗',PAID:'已付款',VOIDED:'已作廢'};

export function PayoutsPage(){
 const qc=useQueryClient();const {user}=useAuth();
 const [status,setStatus]=useState(''),[selected,setSelected]=useState<string|null>(()=>{const value=typeof window==='undefined'?null:new URLSearchParams(window.location.search).get('reference');return value&&/^PAYOUT-[a-f0-9]{40}$/.test(value)?value:null;}),[cutoff,setCutoff]=useState('');
 const [periodStart,setPeriodStart]=useState(''),[periodEnd,setPeriodEnd]=useState('');
 const [exportRef,setExportRef]=useState(''),[notice,setNotice]=useState('');
 const [error,setError]=useState<unknown>(null),[pending,setBusy]=useState(false);

 const queue=useQuery({queryKey:['payout-queue',status],queryFn:()=>get<any>('/admin/operations/payout-batches'+qs({status:status||undefined,take:100}))});
 const detail=useQuery({queryKey:['payout-detail',selected],queryFn:()=>get<any>(`/admin/operations/payout-batches/${selected}`),enabled:!!selected});
 const recovery=useQuery({queryKey:['recovery-aging'],queryFn:()=>get<any>('/admin/operations/recoveries'+qs({take:100}))});
 const rows=queue.data?.data??[];const d=detail.data?.data;const rec=recovery.data?.data??[];
 const queueReady=queue.isSuccess&&!queue.error,recoveryReady=recovery.isSuccess&&!recovery.error;
 const busy=pending||detail.isFetching||!!detail.error;

 const finance=['FINANCE','SUPER_ADMIN'].includes(user?.role??'');
 async function mutate(fn:()=>Promise<any>){setBusy(true);setError(null);setNotice('');try{await fn();await qc.invalidateQueries({queryKey:['payout-queue']});await qc.invalidateQueries({queryKey:['payout-detail',selected]});await qc.invalidateQueries({queryKey:['recovery-aging']});setNotice('已保存，請核對更新後的批次狀態。');return true;}catch(e){setError(e);return false;}finally{setBusy(false)}}
 const financeApproved=d?.approvals?.some((x:any)=>x.stage==='FINANCE_REVIEW'&&x.decision==='APPROVED');
 const complianceApproved=d?.approvals?.some((x:any)=>x.stage==='COMPLIANCE_REVIEW'&&x.decision==='APPROVED');

 return <><PageHeader title="付款批次與對帳" subtitle="有效獎金 → 可付款項 → 追回抵扣 → 雙重核准 → 匯出 → 外部付款對帳。"/>
 <ErrorBox error={error}/><ErrorBox error={queue.error??detail.error??recovery.error}/>{notice&&<p role="status">{notice}</p>}{(queue.isFetching||detail.isFetching)&&<p role="status">載入付款資料中…</p>}
 <div className="metrics"><Metric label="本頁待追回筆數" value={recoveryReady?rec.length:'—'} helper={recoveryReady?money(rec.reduce((s:number,x:any)=>s+Number(x.outstandingAmount),0)):'尚未取得資料'}/><Metric label="付款批次" value={queueReady?rows.length:'—'} helper={queueReady?(statusLabels[status]??'本頁全部狀態'):'尚未取得資料'}/></div>

 <div className="grid two"><Card title="準備付款批次"><div className="form">
  <Field label="入帳截止時間（含時區）" hint="請依本次作業核准的截止時間填寫，須包含時區。"><input value={cutoff} onChange={e=>setCutoff(e.target.value)}/></Field><ConfirmAction disabled={busy||!finance||!cutoff} onConfirm={()=>mutate(()=>command('/admin/payouts/materialize',{cutoff}))}>建立可付款項</ConfirmAction>
  <Field label="期間起日（含時區）"><input value={periodStart} onChange={e=>setPeriodStart(e.target.value)}/></Field><Field label="期間迄日（含時區）"><input value={periodEnd} onChange={e=>setPeriodEnd(e.target.value)}/></Field><ConfirmAction className="primary" disabled={busy||!finance||!periodStart||!periodEnd} onConfirm={()=>mutate(()=>command('/admin/payouts/batches',{periodStart,periodEnd}))}>建立付款批次</ConfirmAction>
 </div></Card>
 <Card title="付款控制"><p><Badge tone="ok">各資格獨立付款</Badge></p><p><Badge tone="warn">財務覆核＋獨立合規核准</Badge></p><p>兩階段必須由不同人完成；核准後才能匯出。系統只記錄外部付款結果，不直接執行銀行轉帳。</p></Card></div>

 <div className="toolbar"><button disabled={pending||queue.isFetching||detail.isFetching||recovery.isFetching} onClick={()=>{queue.refetch();recovery.refetch();if(selected)detail.refetch();}}>重新載入</button><select aria-label="付款批次狀態" value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部狀態</option>{Object.entries(statusLabels).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
 <div className="split-view"><Card title={`付款批次${queueReady?` (${rows.length})`:''}`}>{queueReady&&!rows.length&&<p>目前沒有符合狀態的付款批次。</p>}{!!queue.error&&<p>無法取得付款批次，請重新載入。{rows.length>0?'下方保留上次載入的資料。':''}</p>}{rows.map((x:any)=><button className={`list-row ${selected===x.payoutBatchId?'selected':''}`} key={x.payoutBatchId} disabled={pending||detail.isFetching} onClick={()=>{setSelected(x.payoutBatchId);setError(null);setNotice('' );setExportRef('');}}><strong>{statusLabels[x.status]??x.status} · 淨額 {money(x.totalNet)}</strong><span>應付 {money(x.totalGross)} − 追回 {money(x.totalRecovery)}</span><small>{dateTime(x.periodEnd)} · {x._count?.lines??0} 個資格 · 已核准 {x._count?.approvals??0}/2</small></button>)}</Card>
 <Card title="批次明細">{!!detail.error&&<p role="status">批次明細更新失敗，請重新載入後再操作。{d?'下方保留上次載入的資料。':''}</p>}{!d?<p className="muted">{selected?(detail.isFetching?'正在載入所選批次…':'尚未取得所選批次資料。'):'選擇一個付款批次。'}</p>:<>
  <dl className="detail-grid"><dt>狀態</dt><dd><Badge tone={d.status==='PAID'?'ok':d.status==='READY'?'warn':'neutral'}>{statusLabels[d.status]??d.status}</Badge></dd><dt>期間</dt><dd>{dateTime(d.periodStart)} → {dateTime(d.periodEnd)}</dd><dt>應付總額</dt><dd>{money(d.totalGross)}</dd><dt>追回抵扣</dt><dd>{money(d.totalRecovery)}</dd><dt>實付淨額</dt><dd><strong>{money(d.totalNet)}</strong></dd><dt>匯出參考</dt><dd>{d.exportReference??'—'}</dd><dt>付款參考</dt><dd>{d.paymentReference??'—'}</dd></dl>
  <h3>核准紀錄</h3><p>財務覆核：{financeApproved?<Badge tone="ok">已完成</Badge>:<Badge tone="warn">待處理</Badge>}　獨立合規核准：{complianceApproved?<Badge tone="ok">已完成</Badge>:<Badge tone="warn">待處理</Badge>}</p>
  {!!d.exportArtifacts?.length&&<section><h3>匯出檔案紀錄</h3><p>CSV 僅供財務覆核，不是銀行匯款檔。每次下載均須授權並留下稽核紀錄；匯出不代表已付款。</p>{d.exportArtifacts.map((artifact:any)=><div key={artifact.revision}><p>第 {artifact.revision} 版 · {dateTime(artifact.generatedAt)} · {artifact.exportReference}</p><p>內容雜湊：<code>{artifact.contentHash}</code></p>{finance&&<button disabled={busy} onClick={()=>mutate(async()=>{const response=await command<{data:FinanceReviewDownload}>(`/admin/operations/payout-batches/${d.payoutBatchId}/export-downloads`,{revision:artifact.revision});if(artifact.formatVersion==='BANK_XLS_V1')await saveBankDownload(response.data as any);else await saveFinanceReviewDownload(response.data);})}>下載第 {artifact.revision} 版{artifact.formatVersion==='BANK_XLS_V1'?'銀行 XLS':'覆核 CSV'}</button>}</div>)}</section>}
  {!!d.paymentResults?.length&&<section><h3>付款結果紀錄</h3><p>每筆金額均為該筆付款明細截至當次的累計確認值。</p><div className="table-wrap"><AdminTable><thead><tr><th>資格</th><th>結果</th><th>累計已付款</th><th>憑證發生時間</th></tr></thead><tbody>{d.paymentResults.map((result:any,index:number)=><tr key={index}><td>{d.lines?.find((line:any)=>line.payoutLineId===result.payoutLineId)?.recipient?.ballNo??'付款明細'}</td><td>{result.resultStatus==='PAID'?'付款已確認':'付款失敗'}</td><td>{money(result.paidAmount)}</td><td>{dateTime(result.occurredAt)}</td></tr>)}</tbody></AdminTable></div></section>}
  {['READY','REVIEWED'].includes(d.status)&&<div className="button-row"><ConfirmAction disabled={busy||d.status!=='READY'||financeApproved||!finance} onConfirm={()=>mutate(()=>command(`/admin/operations/payout-batches/${d.payoutBatchId}/approvals/FINANCE_REVIEW`,{note:'財務覆核'}))}>財務覆核</ConfirmAction><ConfirmAction disabled={busy||d.status!=='REVIEWED'||complianceApproved||!['COMPLIANCE_AUDIT','SUPER_ADMIN'].includes(user?.role??'')||d.approvals?.some((a:any)=>a.stage==='FINANCE_REVIEW'&&a.actorId===user?.personId)} onConfirm={()=>mutate(()=>command(`/admin/operations/payout-batches/${d.payoutBatchId}/approvals/COMPLIANCE_REVIEW`,{note:'獨立合規核准'}))}>獨立合規核准</ConfirmAction></div>}
  {d.status==='APPROVED'&&financeApproved&&complianceApproved&&<div className="form sticky-actions"><Field label="匯出參考"><input value={exportRef} onChange={e=>setExportRef(e.target.value)}/></Field><ConfirmAction className="primary" disabled={!exportRef||busy||!['FINANCE','SUPER_ADMIN'].includes(user?.role??'')} onConfirm={()=>mutate(()=>command(`/admin/operations/payout-batches/${d.payoutBatchId}/export`,{exportReference:exportRef}))}>建立財務覆核 CSV</ConfirmAction></div>}
  {finance&&d.status==='EXPORTED'&&!d.paymentResults?.length&&!d.exportArtifacts?.some((a:any)=>a.formatVersion==='BANK_XLS_V1')&&<BankExportForm key={d.payoutBatchId} lines={d.lines??[]} disabled={busy} submit={input=>mutate(async()=>{const response=await command<{data:any}>(`/admin/operations/payout-batches/${d.payoutBatchId}/bank-exports`,input);await saveBankDownload(response.data);})}/>}
  {finance&&['EXPORTED','PROCESSING','PARTIALLY_PAID','FAILED'].includes(d.status)&&<PayoutResultForm key={d.payoutBatchId} lines={d.lines??[]} disabled={busy} submit={body=>mutate(()=>command(`/admin/operations/payout-batches/${d.payoutBatchId}/payment-results`,body))}/>}
  <h3>付款明細</h3><div className="table-wrap"><AdminTable><thead><tr><th>會員</th><th>資格</th><th>應付總額</th><th>追回金額</th><th>實付淨額</th></tr></thead><tbody>{(d.lines??[]).map((x:any)=><tr key={x.payoutLineId}><td>{x.recipient?.currentHolder?.legalName??'—'}</td><td>{x.recipient?.ballNo??x.recipient?.qualificationNo??'待核對'}</td><td>{money(x.grossAmount)}</td><td>{money(x.recoveryOffset)}</td><td>{money(x.netAmount)}</td></tr>)}</tbody></AdminTable></div>
 </>}</Card></div>

 <Card title="待追回款項">{!recoveryReady?<p role="status">{recovery.isFetching?'正在載入待追回款項…':'無法取得待追回款項，請重新載入。'}</p>:<div className="table-wrap"><AdminTable><thead><tr><th>會員</th><th>獎金類型</th><th>狀態</th><th>經過天數</th><th>追回金額</th><th>已追回</th><th>待追回</th></tr></thead><tbody>{rec.map((x:any)=><tr key={x.bonusRecoveryEventId}><td>{x.bonusAward?.recipient?.currentHolder?.legalName??'—'}</td><td>{x.bonusAward?.awardType}</td><td>{x.status}</td><td>{x.agingDays} 天</td><td>{money(x.recoveryAmount)}</td><td>{money(x.recoveredAmount)}</td><td>{money(x.outstandingAmount)}</td></tr>)}</tbody></AdminTable></div>}</Card>
 </>
}
