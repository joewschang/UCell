import {uiValue,uiText,domainLabel} from "../../../../shared/design-system/i18n";
import {ConfirmAction} from '../../components/ConfirmAction';
import {AdminTable} from '../../components/AdminTable';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useEffect,useRef,useState} from 'react';
import {QueryFeedback} from '../../components/QueryFeedback';
import {ApiError,command,get,qs} from '../../lib/api';
import {Order} from '../../types/domain';
import {Badge,Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {SearchOption,SearchSelect} from '../../components/SearchSelect';
import {dateTime,money} from '../../lib/format';
import {Link,useSearchParams} from 'react-router-dom';

type ReturnQty={orderLineId:string;name:string;max:string;quantity:string};
const returnableStatuses=['PAID','FULFILLED','PARTIAL_RETURN'];
function orderOption(order:Order):SearchOption{return {
  id:order.orderId,
  primary:`訂單 ${order.orderNo??'—'} · ${order.qualification?.currentHolder?.legalName??'—'} · ${money(order.netAmount)}`,
  secondary:order.status,meta:order,
};}
function returnQuantities(lines:any[]):ReturnQty[]{return lines.map(line=>({
  orderLineId:line.orderLineId,name:line.productNameSnapshot??line.skuSnapshot??line.orderLineId,
  max:String(line.remainingReversibleQuantity??'0'),quantity:'0',
}));}
function returnError(error:unknown){
  if(error instanceof ApiError){
    const body=error.body as any,code=body?.error?.code??body?.code??body?.message?.code;
    if(code==='RETURN_PENDING_EXCHANGE')return new Error('此商品尚有未完成的換貨，請先完成補寄出貨，或取消尚未驗收的換貨申請，再辦理退貨。');
  }
  return error;
}

export function ReturnsPage(){
  const qc=useQueryClient();
  const [params]=useSearchParams(),sourceOrderNo=params.get('orderNo')??'';
  const fromOrderNo=/^\d{1,19}$/.test(sourceOrderNo)?BigInt(sourceOrderNo).toString():sourceOrderNo;
  const [search,setSearch]=useState(''),[status,setStatus]=useState('POSTED'),[selected,setSelected]=useState<string|null>(null);
  const [order,setOrder]=useState<SearchOption|null>(null),[reason,setReason]=useState('MEMBER_RETURN'),[occurredAt,setOccurredAt]=useState(new Date().toISOString());
  const [returnLines,setReturnLines]=useState<ReturnQty[]>([]);const [error,setError]=useState<unknown>(null);const [busy,setBusy]=useState(false);
  const [orderLoading,setOrderLoading]=useState(false),[notice,setNotice]=useState('');
  const orderLoad=useRef<AbortController>();
  useEffect(()=>()=>orderLoad.current?.abort(),[]);
  useEffect(()=>{
    orderLoad.current?.abort();const controller=new AbortController();orderLoad.current=controller;
    setOrder(null);setReturnLines([]);setError(null);setNotice('');setOrderLoading(false);
    if(!fromOrderNo)return ()=>controller.abort();
    if(!/^\d{1,19}$/.test(fromOrderNo)||BigInt(fromOrderNo)>9223372036854775807n){
      setError(new Error('來源訂單號格式不正確，請從出貨單重新進入退貨。'));return ()=>controller.abort();
    }
    setOrderLoading(true);
    void (async()=>{
      try{
        const result=await get<{data:Order[]}>('/admin/orders'+qs({orderNo:fromOrderNo,take:1}),{signal:controller.signal});
        if(controller.signal.aborted)return;
        if(!Array.isArray(result.data)||result.data.length!==1||String(result.data[0].orderNo)!==fromOrderNo){
          throw new Error('找不到與來源出貨單完全相符的訂單，請重新載入原出貨單。');
        }
        const source=result.data[0];
        if(!returnableStatuses.includes(source.status))throw new Error('這張訂單目前無可辦理退貨的狀態，請核對既有退貨紀錄。');
        const detail=await get<{data:Order&{lines:any[]}}>(`/admin/orders/${encodeURIComponent(source.orderId)}`,{signal:controller.signal});
        if(controller.signal.aborted)return;
        if(detail.data?.orderId!==source.orderId||String(detail.data.orderNo)!==fromOrderNo||!returnableStatuses.includes(detail.data.status)){
          throw new Error('訂單資料已變更，請返回原出貨單重新核對。');
        }
        setOrder(orderOption({...source,...detail.data}));setReturnLines(returnQuantities(detail.data.lines??[]));
      }catch(cause){if(!controller.signal.aborted)setError(cause);}
      finally{if(!controller.signal.aborted)setOrderLoading(false);}
    })();
    return ()=>controller.abort();
  },[fromOrderNo]);

  const queue=useQuery({queryKey:['return-queue',status,search],queryFn:()=>get<any>('/admin/operations/returns'+qs({status:status||undefined,q:search,take:100}))});
  const detail=useQuery({queryKey:['return-detail',selected],queryFn:()=>get<any>(`/admin/operations/returns/${selected}`),enabled:!!selected});
  const rows=queue.error?[]:queue.data?.data??[];const d=detail.error?undefined:detail.data?.data;

  async function orderSearch(q:string){
    const r:any=await get('/admin/orders'+qs({q,take:30}));
    return (r.data as Order[]).filter(x=>returnableStatuses.includes(x.status)).map(orderOption);
  }
  async function chooseOrder(x:SearchOption|null){
    orderLoad.current?.abort();const controller=new AbortController();orderLoad.current=controller;
    setOrder(x);setReturnLines([]);setError(null);setNotice('');setOrderLoading(false);if(!x)return;
    setOrderLoading(true);
    try{
      const r:any=await get(`/admin/orders/${x.id}`,{signal:controller.signal});
      if(controller.signal.aborted)return;
      setReturnLines(returnQuantities(r.data?.lines??[]));
    }catch(e){if(!controller.signal.aborted)setError(e)}finally{if(!controller.signal.aborted)setOrderLoading(false)}
  }
  async function createReturn(){
    if(!order||busy||orderLoading)return;const lines=returnLines.filter(x=>Number(x.quantity)>0).map(x=>({orderLineId:x.orderLineId,quantity:x.quantity}));
    if(!lines.length){setError(new Error('至少輸入一筆退貨數量'));return}
    if(returnLines.some(x=>!/^\d+(\.\d+)?$/.test(x.quantity)||Number(x.quantity)>Number(x.max))){setError(new Error('退貨數量不得超過伺服器提供的剩餘可退數量'));return;}
    setBusy(true);setError(null);
    try{
      const r:any=await command(`/admin/orders/${order.id}/returns`,{reasonCode:reason,occurredAt,lines});
      setSelected(r.data?.returnCaseId??null);setOrder(null);setReturnLines([]);
      setNotice('退貨已入帳。請返回原出貨單驗收實際退回的商品；退款與改購商品請依原流程辦理。');
      await qc.invalidateQueries({queryKey:['return-queue']});
    }catch(e){setError(returnError(e))}finally{setBusy(false)}
  }
  async function act(kind:'reverse'|'replay'){
    if(!d?.returnCase)return;setBusy(true);setError(null);
    try{
      if(kind==='reverse') await command(`/admin/orders/${d.returnCase.orderId}/returns/${d.returnCase.returnCaseId}/process-reversal`);
      else await command(`/admin/replays/returns/${d.returnCase.returnCaseId}`,{maxWeeks:26});
      await qc.invalidateQueries({queryKey:['return-detail',selected]});await qc.invalidateQueries({queryKey:['return-queue']});
    }catch(e){setError(e)}finally{setBusy(false)}
  }

  return <><PageHeader title={uiText("退貨／反向／Replay")} subtitle={uiText("保留原交易；退貨→GPV Reversal→Recovery／Recalculation→Carry-chain Replay，全程可追查。")} actions={fromOrderNo&&/^\d{1,19}$/.test(fromOrderNo)?<Link to={`/fulfillment?orderNo=${encodeURIComponent(fromOrderNo)}`}>返回原出貨單</Link>:undefined}/>
  <ErrorBox error={error}/><QueryFeedback query={queue} empty={!rows.length}/>{selected&&<QueryFeedback query={detail}/>}
  {orderLoading&&<p role="status">正在核對原訂單與可退數量…</p>}{notice&&<p role="status">{notice}</p>}
  {fromOrderNo&&<Card title={`來源出貨訂單 ${fromOrderNo}`}><p>更換不同商品或有價差時，先依原交易辦理退貨，再重新下單。此頁不自動計算或收付差額。</p><Link to="/orders">前往訂單與收款</Link></Card>}
  <div className="grid two">
    <Card title="建立退貨"><div className="form">
      {fromOrderNo?<><p>{order?.primary??'尚未載入可退貨的原訂單。'}</p><Link to="/returns">改選其他訂單</Link></>:<SearchSelect label="已付款／已出貨訂單" value={order} onChange={chooseOrder} search={orderSearch}/>}
      <fieldset disabled={busy||orderLoading}>
      <Field label={uiText("Reason Code")}><input value={reason} onChange={e=>setReason(e.target.value)}/></Field>
      <Field label={uiText("Occurred At")}><input value={occurredAt} onChange={e=>setOccurredAt(e.target.value)}/></Field>
      {returnLines.map((x,i)=><div className="order-builder-row" key={x.orderLineId}><div>{x.name}<small className="muted">可退上限 {x.max}</small></div><input value={x.quantity} onChange={e=>setReturnLines(v=>v.map((r,j)=>j===i?{...r,quantity:e.target.value}:r))}/><div>{uiText("Qty")}</div><span/></div>)}
      <button className="primary" disabled={!order||!returnLines.length||busy||orderLoading} onClick={createReturn}>{uiText("建立Return Case")}</button>
      </fieldset>
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
