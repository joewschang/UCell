import {uiValue,uiText,domainLabel} from "../../../../shared/design-system/i18n";
import {ConfirmAction} from '../../components/ConfirmAction';
import {AdminTable} from '../../components/AdminTable';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useEffect,useRef,useState} from 'react';
import {QueryFeedback} from '../../components/QueryFeedback';
import {command,get,qs} from '../../lib/api';
import {Order} from '../../types/domain';
import {Badge,Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {SearchOption,SearchSelect} from '../../components/SearchSelect';
import {dateTime,money} from '../../lib/format';

type ReturnQty={orderLineId:string;name:string;max:string;quantity:string};

export function ReturnsPage(){
  const qc=useQueryClient();
  const [search,setSearch]=useState(''),[status,setStatus]=useState('POSTED'),[selected,setSelected]=useState<string|null>(null);
  const [order,setOrder]=useState<SearchOption|null>(null),[reason,setReason]=useState('MEMBER_RETURN'),[occurredAt,setOccurredAt]=useState(new Date().toISOString());
  const [returnLines,setReturnLines]=useState<ReturnQty[]>([]);const [error,setError]=useState<unknown>(null);const [busy,setBusy]=useState(false);
  const orderLoad=useRef<AbortController>();
  useEffect(()=>()=>orderLoad.current?.abort(),[]);

  const queue=useQuery({queryKey:['return-queue',status,search],queryFn:()=>get<any>('/admin/operations/returns'+qs({status:status||undefined,q:search,take:100}))});
  const detail=useQuery({queryKey:['return-detail',selected],queryFn:()=>get<any>(`/admin/operations/returns/${selected}`),enabled:!!selected});
  const rows=queue.error?[]:queue.data?.data??[];const d=detail.error?undefined:detail.data?.data;

  async function orderSearch(q:string){
    const r:any=await get('/admin/orders'+qs({q,take:30}));
    return (r.data as Order[]).filter(x=>['PAID','FULFILLED','PARTIAL_RETURN'].includes(x.status)).map(x=>({
      id:x.orderId,
      primary:`${x.qualification?.currentHolder?.legalName??'—'} · ${x.status} · ${money(x.netAmount)}`,
      secondary:`${x.orderId}`,meta:x
    }));
  }
  async function chooseOrder(x:SearchOption|null){
    orderLoad.current?.abort();const controller=new AbortController();orderLoad.current=controller;
    setOrder(x);setReturnLines([]);setError(null);if(!x)return;
    try{
      const r:any=await get(`/admin/orders/${x.id}`,{signal:controller.signal});
      if(controller.signal.aborted)return;
      setReturnLines((r.data?.lines??[]).map((l:any)=>({
        orderLineId:l.orderLineId,
        name:l.productNameSnapshot??l.skuSnapshot??l.orderLineId,
        max:String(l.remainingReversibleQuantity??'0'),
        quantity:'0'
      })));
    }catch(e){if(!controller.signal.aborted)setError(e)}
  }
  async function createReturn(){
    if(!order)return;const lines=returnLines.filter(x=>Number(x.quantity)>0).map(x=>({orderLineId:x.orderLineId,quantity:x.quantity}));
    if(!lines.length){setError(new Error('至少輸入一筆退貨數量'));return}
    if(returnLines.some(x=>!/^\d+(\.\d+)?$/.test(x.quantity)||Number(x.quantity)>Number(x.max))){setError(new Error('退貨數量不得超過伺服器提供的剩餘可退數量'));return;}
    setBusy(true);setError(null);
    try{
      const r:any=await command(`/admin/orders/${order.id}/returns`,{reasonCode:reason,occurredAt,lines});
      setSelected(r.data?.returnCaseId??null);setOrder(null);setReturnLines([]);
      await qc.invalidateQueries({queryKey:['return-queue']});
    }catch(e){setError(e)}finally{setBusy(false)}
  }
  async function act(kind:'reverse'|'replay'){
    if(!d?.returnCase)return;setBusy(true);setError(null);
    try{
      if(kind==='reverse') await command(`/admin/orders/${d.returnCase.orderId}/returns/${d.returnCase.returnCaseId}/process-reversal`);
      else await command(`/admin/replays/returns/${d.returnCase.returnCaseId}`,{maxWeeks:26});
      await qc.invalidateQueries({queryKey:['return-detail',selected]});await qc.invalidateQueries({queryKey:['return-queue']});
    }catch(e){setError(e)}finally{setBusy(false)}
  }

  return <><PageHeader title={uiText("退貨／反向／Replay")} subtitle={uiText("保留原交易；退貨→GPV Reversal→Recovery／Recalculation→Carry-chain Replay，全程可追查。")}/>
  <ErrorBox error={error}/><QueryFeedback query={queue} empty={!rows.length}/>{selected&&<QueryFeedback query={detail}/>}
  <div className="grid two">
    <Card title="建立退貨"><div className="form">
      <SearchSelect label="已付款／已出貨訂單" value={order} onChange={chooseOrder} search={orderSearch}/>
      <Field label={uiText("Reason Code")}><input value={reason} onChange={e=>setReason(e.target.value)}/></Field>
      <Field label={uiText("Occurred At")}><input value={occurredAt} onChange={e=>setOccurredAt(e.target.value)}/></Field>
      {returnLines.map((x,i)=><div className="order-builder-row" key={x.orderLineId}><div>{x.name}<small className="muted">可退上限 {x.max}</small></div><input value={x.quantity} onChange={e=>setReturnLines(v=>v.map((r,j)=>j===i?{...r,quantity:e.target.value}:r))}/><div>{uiText("Qty")}</div><span/></div>)}
      <button className="primary" disabled={!order||!returnLines.length||busy} onClick={createReturn}>{uiText("建立Return Case")}</button>
    </div></Card>
    <Card title="處理原則"><p><Badge tone="warn">{uiText("不可刪除原訂單／PV／Award")}</Badge></p><p>{uiText("Return只新增反向與Recovery事實。Binary/Matching歷史差異以Replay與補償帳處理。")}</p><p className="muted">{uiText("Replay 使用封存歷史 period/snapshots；缺少 evidence 時 fail closed。Production calendar/cut-off 仍待核准。")}</p></Card>
  </div>

  <div className="toolbar"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部狀態</option><option value={"POSTED"}>{uiText("POSTED")}</option><option value={"VOIDED"}>{uiText("VOIDED")}</option></select><input value={search} onChange={e=>setSearch(e.target.value)} aria-label={uiText("會員姓名／手機／Reason")} placeholder={uiText("會員姓名／手機／Reason")}/></div>
  <div className="split-view">
    <Card title={`Return Queue (${rows.length})`}>{rows.map((x:any)=><button key={x.returnCaseId} className={`list-row ${selected===x.returnCaseId?'selected':''}`} onClick={()=>setSelected(x.returnCaseId)}><strong>{x.order?.qualification?.currentHolder?.legalName??'—'} · {money(x.returnSummary?.totalAmount)}</strong><span>{domainLabel(x.status)} · {x.reasonCode}</span><small>{dateTime(x.occurredAt)} {uiText(" · Recovery outstanding ")}{money(x.recoverySummary?.outstanding)}</small></button>)}</Card>
    <Card title={uiText("Return Detail")}>{!d?<p className="muted">{uiText("選擇Return Case。")}</p>:<>
      <dl className="detail-grid"><dt>{uiText("Return ID")}</dt><dd className="mono">{d.returnCase.returnCaseId}</dd><dt>{uiText("Order")}</dt><dd className="mono">{d.returnCase.orderId}</dd><dt>會員</dt><dd>{d.returnCase.order?.qualification?.currentHolder?.legalName}</dd><dt>{uiText("Reason")}</dt><dd>{d.returnCase.reasonCode}</dd><dt>{uiText("Occurred")}</dt><dd>{dateTime(d.returnCase.occurredAt)}</dd><dt>{uiText("GPV Reversal Events")}</dt><dd>{d.reversals?.length??0}</dd><dt>{uiText("Recovery Events")}</dt><dd>{d.recoveries?.length??0}</dd><dt>{uiText("Replay")}</dt><dd>{uiValue(d.replay?.status??'尚未執行')}</dd></dl>
      <div className="button-row sticky-actions"><ConfirmAction disabled={busy} onConfirm={()=>act('reverse')}>{uiText("Process Reversal")}</ConfirmAction><ConfirmAction className="primary" disabled={busy} onConfirm={()=>act('replay')}>{uiText("Carry-chain Replay")}</ConfirmAction></div>
      <h3>{uiText("Recovery")}</h3><div className="table-wrap"><AdminTable><thead><tr><th>{uiText("Award")}</th><th>{uiText("Status")}</th><th>{uiText("Recovery")}</th><th>{uiText("Recovered")}</th><th>{uiText("Outstanding")}</th></tr></thead><tbody>{(d.recoveries??[]).map((r:any)=><tr key={r.bonusRecoveryEventId}><td>{domainLabel(r.bonusAward?.awardType)} · {r.bonusAward?.recipient?.currentHolder?.legalName}</td><td>{domainLabel(r.status)}</td><td>{money(r.recoveryAmount)}</td><td>{money(r.recoveredAmount)}</td><td>{money(r.outstandingAmount)}</td></tr>)}</tbody></AdminTable></div>
      <h3>{uiText("Replay Periods")}</h3><div className="table-wrap"><AdminTable><thead><tr><th>#</th><th>{uiText("Period")}</th><th>K1</th><th>K2</th></tr></thead><tbody>{(d.replay?.periods??[]).map((x:any)=><tr key={x.settlementReplayPeriodId}><td>{x.periodNo}</td><td>{dateTime(x.periodEnd)}</td><td>{x.originalK1} → {x.recomputedK1}</td><td>{x.originalK2??'—'} → {x.recomputedK2??'—'}</td></tr>)}</tbody></AdminTable></div>
    </>}</Card>
  </div></>
}
