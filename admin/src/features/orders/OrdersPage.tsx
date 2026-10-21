import {useAuth} from '../auth/auth';
import {uiValue,uiText,domainLabel} from "../../../../shared/design-system/i18n";
import {ConfirmAction} from '../../components/ConfirmAction';
import {AdminTable} from '../../components/AdminTable';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useEffect,useRef,useState} from 'react';
import {command,get,qs} from '../../lib/api';
import {Order,OrderPurpose,ProductReference,Qualification} from '../../types/domain';
import {Badge,Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {SearchOption,SearchSelect} from '../../components/SearchSelect';
import {dateTime,money} from '../../lib/format';
import {Link,useSearchParams} from 'react-router-dom';
import {QueryFeedback} from '../../components/QueryFeedback';

type DraftLine={productId:string;name:string;quantity:string;price:string};

export function OrdersPage(){
 const {user}=useAuth();const canRefund=['SUPER_ADMIN','FINANCE'].includes(user?.role??'');const [refundRef,setRefundRef]=useState(''),[refundReason,setRefundReason]=useState('');
 const qc=useQueryClient();const [params]=useSearchParams();const [status,setStatus]=useState(''),[search,setSearch]=useState(''),[selected,setSelected]=useState<string|null>(null);
 const [qualification,setQualification]=useState<SearchOption|null>(null),[purpose,setPurpose]=useState<OrderPurpose>('ENTRY'),[lines,setLines]=useState<DraftLine[]>([]);
 const [paymentRef,setPaymentRef]=useState(''),[paymentMethod,setPaymentMethod]=useState('BANK_TRANSFER'),[error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false);
 const paymentAttempt=useRef<{signature:string;occurredAt:string}>();
 const orders=useQuery({queryKey:['orders',status,search],queryFn:()=>get<any>('/admin/orders'+qs({status:status||undefined,q:search,take:100}))});
 const products=useQuery({queryKey:['products'],queryFn:()=>get<any>('/admin/products')});
 const detail=useQuery({queryKey:['order',selected],queryFn:()=>get<any>(`/admin/orders/${selected}`),enabled:!!selected});
 const rows:Order[]=orders.error?[]:orders.data?.data??[];const p:ProductReference[]=products.error?[]:products.data?.data??[];const o:any=detail.error?undefined:detail.data?.data;

 useEffect(()=>{
  const orderId=params.get('orderId');if(orderId)setSelected(orderId);
  const qid=params.get('qualificationId');
  if(!qid || qualification?.id===qid)return;
  get<any>(`/admin/qualifications/${qid}`).then(r=>{
    const x=r.data;
    setQualification({
      id:x.qualificationId,
      primary:`Q#${x.qualificationNo??'—'} · ${x.currentHolder?.legalName??'—'}`,
      secondary:`${x.planLevelCode} · ${x.qualificationId}`,
      meta:x
    });
  }).catch(()=>undefined);
 },[params,qualification?.id]);


 async function qualSearch(q:string){
  const r:any=await get('/admin/qualifications'+qs({q,status:'EFFECTIVE',take:20}));
  return (r.data as Qualification[]).map(x=>({id:x.qualificationId,primary:`Q#${x.qualificationNo??'—'} · ${x.currentHolder?.legalName??'—'}`,secondary:`${x.planLevelCode} · ${x.qualificationId}`}));
 }
 function addProduct(id:string){
  const x=p.find(x=>x.productId===id);if(!x)return;
  setLines(v=>[...v,{productId:id,name:x.displayName,quantity:'1',price:x.currentPrice}]);
 }
 async function createOrder(){
  if(!qualification||lines.length===0)return;setBusy(true);setError(null);
  try{
   const r:any=await command('/admin/orders',{qualificationId:qualification.id,purpose,items:lines.map(x=>({productId:x.productId,quantity:x.quantity}))});
   setSelected(r.data?.orderId??null);setLines([]);await qc.invalidateQueries({queryKey:['orders']});
  }catch(e){setError(e)}finally{setBusy(false)}
 }
 async function confirmPayment(){
  if(!o)return;setBusy(true);setError(null);
  try{
   const signature=JSON.stringify([o.orderId,String(o.netAmount),paymentMethod,paymentRef]);
   if(paymentAttempt.current?.signature!==signature)paymentAttempt.current={signature,occurredAt:new Date().toISOString()};
   await command(`/admin/orders/${o.orderId}/payment-confirmations`,{amount:String(o.netAmount),paymentMethod,referenceNo:paymentRef,occurredAt:paymentAttempt.current.occurredAt});
   paymentAttempt.current=undefined;
   await qc.invalidateQueries({queryKey:['orders']});await qc.invalidateQueries({queryKey:['order',selected]});
  }catch(e){setError(e)}finally{setBusy(false)}
 }
 return <><PageHeader title="訂單與收款" subtitle={uiText("Order建立時Backend依Product Rule Profile快照金額/GPV；Payment Confirmed後才由Outbox產生PV。")}/>
 <ErrorBox error={error}/><QueryFeedback query={orders} empty={!rows.length}/><QueryFeedback query={products} empty={!p.length}/>{selected&&<QueryFeedback query={detail}/>}
 <div className="grid two"><Card title="建立訂單"><div className="form">
  <SearchSelect label={uiText("歸屬Qualification")} value={qualification} onChange={setQualification} search={qualSearch}/>
  <Field label={uiText("Purpose")}><select value={purpose} onChange={e=>setPurpose(e.target.value as OrderPurpose)}><option value={"ENTRY"}>{uiText("ENTRY")}</option><option value={"RETAIL"}>{uiText("RETAIL")}</option><option value={"REPURCHASE"}>{uiText("REPURCHASE")}</option><option value={"SUBSCRIPTION_PREPAY"}>{uiText("SUBSCRIPTION_PREPAY")}</option><option value={"UPGRADE"}>{uiText("UPGRADE")}</option></select></Field>
  <Field label="加入商品"><select defaultValue="" onChange={e=>{addProduct(e.target.value);e.currentTarget.value=''}}><option value="">選擇商品…</option>{p.map(x=><option key={x.productId} value={x.productId}>{uiValue((x.sku))} · {uiValue((x.displayName))} · {money(x.currentPrice)}</option>)}</select></Field>
  {lines.map((x,i)=><div className="order-builder-row" key={`${x.productId}-${i}`}><div>{x.name}</div><input value={x.quantity} onChange={e=>setLines(v=>v.map((r,j)=>j===i?{...r,quantity:e.target.value}:r))}/><div>參照單價 {money(x.price)}</div><button onClick={()=>setLines(v=>v.filter((_,j)=>j!==i))}>移除</button></div>)}
  <small className="muted">{uiText("正式金額與GPV由Backend建立訂單後提供；後台不自行計算總額。")}</small>
  <button className="primary" disabled={!qualification||lines.length===0||busy} onClick={createOrder}>{uiText("建立CONFIRMED訂單")}</button>
 </div></Card>
 <Card title="訂單詳情／收款">{!o?<p className="muted">從下方清單選擇訂單。</p>:<><dl className="detail-grid"><dt>{uiText("Order ID")}</dt><dd className="mono">{o.orderId}</dd><dt>{uiText("Qualification")}</dt><dd>{o.qualification?.currentHolder?.legalName}<br/><span className="mono">{o.qualificationId}</span></dd><dt>{uiText("Purpose")}</dt><dd>{domainLabel(o.purpose)}</dd><dt>{uiText("Status")}</dt><dd><Badge tone={o.status==='PAID'?'ok':'warn'}>{domainLabel(o.status)}</Badge></dd><dt>{uiText("Net Amount")}</dt><dd>{money(o.netAmount)}</dd>{o.packagePurchase&&<><dt>套組快照</dt><dd>{o.packagePurchase.packageName} · {o.packagePurchase.packageClass}<br/><span className="mono">{o.packagePurchase.packageConfigHash}</span></dd><dt>優惠碼／折抵</dt><dd>{o.packagePurchase.couponCode??'未使用'}／{money(o.packagePurchase.discountAmount??0)}</dd><dt>商品／資格建立費</dt><dd>{money(o.packagePurchase.priceAmount)}／{money(o.packagePurchase.qualificationFee??0)}</dd><dt>付款期限</dt><dd>{o.packagePurchase.paymentDeadline?dateTime(o.packagePurchase.paymentDeadline):'依原訂單'}</dd><dt>下游狀態</dt><dd><Badge tone={o.packageDownstreamStatus==='BALL_SETUP_PENDING'?'warn':'neutral'}>{domainLabel(o.packageDownstreamStatus)}</Badge></dd></>}</dl>
  {o.status==='CONFIRMED'&&<div className="form sticky-actions"><Field label="付款方式"><input value={paymentMethod} onChange={e=>setPaymentMethod(e.target.value)}/></Field><Field label={uiText("Reference No")}><input value={paymentRef} onChange={e=>setPaymentRef(e.target.value)}/></Field><ConfirmAction className="primary" disabled={!paymentRef||busy||!!o.packagePurchase?.paymentDeadline&&Date.parse(o.packagePurchase.paymentDeadline)<=Date.now()} onConfirm={confirmPayment}>確認全額收款 {money(o.netAmount)}</ConfirmAction></div>}
  {canRefund&&Number(o.packagePurchase?.qualificationFee)===600&&['PAID','FULFILLED','PARTIAL_RETURN','RETURNED'].includes(o.status)&&!o.paymentEvents?.some((e:any)=>e.eventType==='QUALIFICATION_FEE_REFUNDED')&&<details><summary>資格建立費退款登錄</summary><p>先完成商品退貨；已安置資格須先完成退出審查。此處只登錄已完成的實際退款，不會發動匯款。0 盒方案可直接登錄建立費退款。</p><Field label="退款憑證編號"><input maxLength={200} value={refundRef} onChange={e=>setRefundRef(e.target.value)}/></Field><Field label="退款原因"><input maxLength={500} value={refundReason} onChange={e=>setRefundReason(e.target.value)}/></Field><ConfirmAction disabled={busy||!refundRef.trim()||!refundReason.trim()} onConfirm={async()=>{setBusy(true);setError(null);try{await command('/admin/qualification-fees/'+o.orderId+'/refund-confirmations',{referenceNo:refundRef,reason:refundReason,occurredAt:new Date().toISOString()});await detail.refetch();qc.invalidateQueries({queryKey:['orders']});}catch(e){setError(e);}finally{setBusy(false);}}}>確認已實際退回建立費 600 元並登錄</ConfirmAction></details>}{o.paymentEvents?.some((e:any)=>e.eventType==='QUALIFICATION_FEE_REFUNDED')&&<p>資格建立費 600 元退款已登錄。</p>}{o.status==='PAID'&&<div className="success-panel"><strong>已付款</strong><p>{o.packagePurchase?o.packageDownstreamStatus==='BALL_SETUP_PENDING'?uiText("套組付款已確認，新資格尚待 Sponsor／Binary 安置。"):'套組付款已確認，正式有效期／認列規則未完成前不會自動生效。':uiText("SALE_CONFIRMED事件將由Backend/Worker建立GPV。")}</p><Link className="button-link" to={`/qualifications?qualificationId=${o.qualificationId}`}>{uiText("查看Qualification／PV Ledger")}</Link></div>}</>}</Card></div>
 <Card title="訂單清單"><div className="toolbar"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部狀態</option><option value={"CONFIRMED"}>{uiText("CONFIRMED")}</option><option value={"PAID"}>{uiText("PAID")}</option><option value={"FULFILLED"}>{uiText("FULFILLED")}</option></select><input value={search} onChange={e=>setSearch(e.target.value)} aria-label={uiText("姓名／手機／Client Reference")} placeholder={uiText("姓名／手機／Client Reference")}/></div>
 <div className="table-wrap"><AdminTable><thead><tr><th>{uiText("Order")}</th><th>會員</th><th>{uiText("Purpose／套組")}</th><th>{uiText("Status／下游")}</th><th>{uiText("Net")}</th><th>{uiText("Created")}</th></tr></thead><tbody>{rows.map((x:any)=><tr key={x.orderId} onClick={()=>setSelected(x.orderId)} style={{cursor:'pointer'}}><td className="mono">{x.orderId}</td><td>{x.qualification?.currentHolder?.legalName??'—'}</td><td>{domainLabel(x.purpose)}{x.packagePurchase&&<><br/><small>{x.packagePurchase.packageName} · {x.packagePurchase.packageClass}</small></>}</td><td>{domainLabel(x.status)}{x.packageDownstreamStatus&&<><br/><small>{domainLabel(x.packageDownstreamStatus)}</small></>}</td><td>{money(x.netAmount)}</td><td>{dateTime(x.createdAt)}</td></tr>)}</tbody></AdminTable></div></Card>
 </>;
}
