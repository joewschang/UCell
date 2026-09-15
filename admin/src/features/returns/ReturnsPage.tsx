import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
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

  const queue=useQuery({queryKey:['return-queue',status,search],queryFn:()=>get<any>('/admin/operations/returns'+qs({status:status||undefined,q:search,take:100}))});
  const detail=useQuery({queryKey:['return-detail',selected],queryFn:()=>get<any>(`/admin/operations/returns/${selected}`),enabled:!!selected});
  const rows=queue.data?.data??[];const d=detail.data?.data;

  async function orderSearch(q:string){
    const r:any=await get('/admin/orders'+qs({q,take:30}));
    return (r.data as Order[]).filter(x=>['PAID','FULFILLED','PARTIAL_RETURN'].includes(x.status)).map(x=>({
      id:x.orderId,
      primary:`${x.qualification?.currentHolder?.legalName??'—'} · ${x.status} · ${money(x.netAmount)}`,
      secondary:`${x.orderId}`,meta:x
    }));
  }
  async function chooseOrder(x:SearchOption|null){
    setOrder(x);setReturnLines([]);if(!x)return;
    try{
      const r:any=await get(`/admin/orders/${x.id}`);
      setReturnLines((r.data?.lines??[]).map((l:any)=>({
        orderLineId:l.orderLineId,
        name:l.productNameSnapshot??l.skuSnapshot??l.orderLineId,
        max:String(l.quantity),
        quantity:'0'
      })));
    }catch(e){setError(e)}
  }
  async function createReturn(){
    if(!order)return;const lines=returnLines.filter(x=>Number(x.quantity)>0).map(x=>({orderLineId:x.orderLineId,quantity:x.quantity}));
    if(!lines.length){setError(new Error('至少輸入一筆退貨數量'));return}
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

  return <><PageHeader title="退貨／反向／Replay" subtitle="保留原交易；退貨→GPV Reversal→Recovery／Recalculation→Carry-chain Replay，全程可追查。"/>
  <ErrorBox error={error}/>
  <div className="grid two">
    <Card title="建立退貨"><div className="form">
      <SearchSelect label="已付款／已出貨訂單" value={order} onChange={chooseOrder} search={orderSearch}/>
      <Field label="Reason Code"><input value={reason} onChange={e=>setReason(e.target.value)}/></Field>
      <Field label="Occurred At"><input value={occurredAt} onChange={e=>setOccurredAt(e.target.value)}/></Field>
      {returnLines.map((x,i)=><div className="order-builder-row" key={x.orderLineId}><div>{x.name}<small className="muted">可退上限 {x.max}</small></div><input value={x.quantity} onChange={e=>setReturnLines(v=>v.map((r,j)=>j===i?{...r,quantity:e.target.value}:r))}/><div>Qty</div><span/></div>)}
      <button className="primary" disabled={!order||busy} onClick={createReturn}>建立Return Case</button>
    </div></Card>
    <Card title="處理原則"><p><Badge tone="warn">不可刪除原訂單／PV／Award</Badge></p><p>Return只新增反向與Recovery事實。Binary/Matching歷史差異以Replay與補償帳處理。</p><p className="muted">R4已修正退貨經濟週期改用正式Settlement Calendar，不再使用UTC Sunday捷徑。</p></Card>
  </div>

  <div className="toolbar"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部狀態</option><option>POSTED</option><option>VOIDED</option></select><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="會員姓名／手機／Reason"/></div>
  <div className="split-view">
    <Card title={`Return Queue (${rows.length})`}>{rows.map((x:any)=><button key={x.returnCaseId} className={`list-row ${selected===x.returnCaseId?'selected':''}`} onClick={()=>setSelected(x.returnCaseId)}><strong>{x.order?.qualification?.currentHolder?.legalName??'—'} · {money(x.lines?.reduce((s:number,l:any)=>s+Number(l.returnAmount),0))}</strong><span>{x.status} · {x.reasonCode}</span><small>{dateTime(x.occurredAt)} · Recovery outstanding {money(x.recoverySummary?.outstanding)}</small></button>)}</Card>
    <Card title="Return Detail">{!d?<p className="muted">選擇Return Case。</p>:<>
      <dl className="detail-grid"><dt>Return ID</dt><dd className="mono">{d.returnCase.returnCaseId}</dd><dt>Order</dt><dd className="mono">{d.returnCase.orderId}</dd><dt>會員</dt><dd>{d.returnCase.order?.qualification?.currentHolder?.legalName}</dd><dt>Reason</dt><dd>{d.returnCase.reasonCode}</dd><dt>Occurred</dt><dd>{dateTime(d.returnCase.occurredAt)}</dd><dt>GPV Reversal Events</dt><dd>{d.reversals?.length??0}</dd><dt>Recovery Events</dt><dd>{d.recoveries?.length??0}</dd><dt>Replay</dt><dd>{d.replay?.status??'尚未執行'}</dd></dl>
      <div className="button-row sticky-actions"><button disabled={busy} onClick={()=>act('reverse')}>Process Reversal</button><button className="primary" disabled={busy} onClick={()=>act('replay')}>Carry-chain Replay</button></div>
      <h3>Recovery</h3><div className="table-wrap"><table><thead><tr><th>Award</th><th>Status</th><th>Recovery</th><th>Recovered</th><th>Outstanding</th></tr></thead><tbody>{(d.recoveries??[]).map((r:any)=><tr key={r.bonusRecoveryEventId}><td>{r.bonusAward?.awardType} · {r.bonusAward?.recipient?.currentHolder?.legalName}</td><td>{r.status}</td><td>{money(r.recoveryAmount)}</td><td>{money(r.recoveredAmount)}</td><td>{money(r.outstandingAmount)}</td></tr>)}</tbody></table></div>
      <h3>Replay Periods</h3><div className="table-wrap"><table><thead><tr><th>#</th><th>Period</th><th>K1</th><th>K2</th></tr></thead><tbody>{(d.replay?.periods??[]).map((x:any)=><tr key={x.settlementReplayPeriodId}><td>{x.periodNo}</td><td>{dateTime(x.periodEnd)}</td><td>{x.originalK1} → {x.recomputedK1}</td><td>{x.originalK2??'—'} → {x.recomputedK2??'—'}</td></tr>)}</tbody></table></div>
    </>}</Card>
  </div></>
}
