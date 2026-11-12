import {useEffect,useState} from 'react';
import {Link,useSearchParams} from 'react-router-dom';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuth} from '../auth/auth';
import {get,command} from '../../lib/api';
import {Card,ErrorBox,Field} from '../../components/ui';
import {ConfirmAction} from '../../components/ConfirmAction';
import {money,dateTime} from '../../lib/format';
import {domainLabel,uiText} from '../../../../shared/design-system/i18n';
import {orderNumber} from '../../../../shared/order-identity';
import {EnrollmentBundleReceipt} from './EnrollmentBundleReceipt';
import {OrderMaintenance} from './OrderMaintenance';
import {OrderPaymentPanel} from './OrderPaymentPanel';
import {ManualOrderStatus} from './ManualOrderStatus';
import {OrderExchange} from './OrderExchange';
import {OrdersWorkbench,OrderNextAction,useOrderRoute} from './OrderWorkbench';
import './order-workspace.css';

export function OrdersPage(){
 const route=useOrderRoute(),[params]=useSearchParams(),{user}=useAuth(),qc=useQueryClient();
 const [section,setSection]=useState(params.has('feeRefund')?'管理':'商品');
 const [busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null),[refundRef,setRefundRef]=useState(''),[refundReason,setRefundReason]=useState('');
 const canRefund=['SUPER_ADMIN','FINANCE'].includes(user?.role??'');
 const detail=useQuery({queryKey:['order',route.id],enabled:!!route.id,queryFn:({signal})=>get<any>('/admin/orders/'+route.id,{signal})});
 const o=detail.data?.data;
 useEffect(()=>{setSection(params.has('feeRefund')?'管理':'商品');setError(null);setRefundRef('');setRefundReason('');},[route.id,params.has('feeRefund')]);
 useEffect(()=>{if(params.has('feeRefund')&&o){const el=document.getElementById('qualification-fee-refund');el?.focus();}},[o?.orderId,params.has('feeRefund')]);
 return <OrdersWorkbench route={route} role={user?.role} busy={busy} displayState={domainLabel}>
 <ErrorBox error={error}/><Card title="訂單作業">{detail.isError?<p role="alert">無法讀取這筆訂單。 <button onClick={()=>void detail.refetch()}>重試</button></p>:!o?<p role="status">正在載入所選訂單…</p>:<><section className="order-workspace"><header><strong>{orderNumber(o)}</strong><div>{o.purchaser?.legalName||o.qualification?.currentHolder?.legalName||o.qualification?.currentHolderLegalEntity?.registeredName} · {domainLabel(o.status)} · {money(o.netAmount)}</div></header>
 <OrderNextAction order={o} role={user?.role} disabled={busy} onOpen={setSection}/>
 <div className="order-sections" id="order-sections" tabIndex={-1} aria-label="訂單作業選單">{['商品','收款','出貨','管理'].map(tab=><button key={tab} type="button" aria-pressed={section===tab} disabled={busy} onClick={()=>setSection(tab)}>{tab==='商品'?'商品明細':tab==='管理'?'修改與作廢':tab}</button>)}</div>
 {section==='商品'&&<><h3>訂單商品</h3>{o.lines?.length?<ul className="order-goods">{o.lines.map((l:any)=><li key={l.orderLineId}><span><strong>{l.productNameSnapshot}</strong><small>{l.skuSnapshot}</small></span><b>× {String(l.quantity)}</b></li>)}</ul>:<p>本單沒有實體商品。</p>}{['SUPER_ADMIN','ORDER_OPS'].includes(user?.role??'')&&<OrderExchange key={o.orderId} id={o.orderId} onBusy={setBusy}/>}</>}
 {section==='收款'&&(o.enrollmentBundlePayment?<EnrollmentBundleReceipt key={o.orderId} bundle={o.enrollmentBundlePayment} orderId={o.orderId} canConfirm={['SUPER_ADMIN','ORDER_OPS','FINANCE'].includes(user?.role??'')} onBusy={setBusy} reload={async()=>{await detail.refetch();await qc.invalidateQueries({queryKey:['orders']});}}/>:<OrderPaymentPanel key={o.orderId} orderId={o.orderId} readOnly={user?.role==='COMPLIANCE_AUDIT'} onBusy={setBusy} onConfirmed={()=>void detail.refetch()}/>)}
 {section==='出貨'&&<>{['SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT'].includes(user?.role??'')&&o.orderNo&&<Link className="button-link" to={"/fulfillment?orderNo="+encodeURIComponent(o.orderNo)}>查看出貨明細</Link>}<ManualOrderStatus key={o.orderId+':manual'} orderId={o.orderId}/></>}
 {section==='管理'&&<><OrderMaintenance key={o.orderId+':maintenance'} order={o} onBusy={setBusy}/><p><Link className="button-link" to={'/economic-lineage?orderNo='+encodeURIComponent(orderNumber(o))}>追蹤本單 GPV 與上線獎金 →</Link></p><details><summary>訂單商品與技術識別資訊</summary><dl className="detail-grid"><dt>訂單識別碼</dt><dd className="mono">{o.orderId}</dd><dt>狀態</dt><dd>{domainLabel(o.status)}</dd><dt>用途</dt><dd>{domainLabel(o.purpose)}</dd><dt>套組</dt><dd>{o.packagePurchase?.packageName??'一般商品'}</dd><dt>商品／資格建立費</dt><dd>{money(o.packagePurchase?.priceAmount??o.netAmount)}／{money(o.packagePurchase?.qualificationFee??0)}</dd><dt>優惠碼／折抵</dt><dd>{o.packagePurchase?.promoCode??'未使用'}／{money(o.packagePurchase?.discountAmount??0)}</dd><dt>付款期限</dt><dd>{o.packagePurchase?.paymentDeadline?dateTime(o.packagePurchase.paymentDeadline):'依原訂單資料'}</dd></dl></details>
  {canRefund&&Number(o.packagePurchase?.qualificationFee)===600&&['PAID','FULFILLED','PARTIAL_RETURN','RETURNED'].includes(o.status)&&!o.paymentEvents?.some((e:any)=>e.eventType==='QUALIFICATION_FEE_REFUNDED')&&<details id="qualification-fee-refund" tabIndex={-1} open={params.has('feeRefund')||undefined}><summary>資格建立費退款登錄</summary><p>先完成商品退貨；已安置資格須先完成退出審查。此處只登錄已完成的實際退款，不會發動匯款。0 盒方案可直接登錄建立費退款。</p><Field label="退款憑證編號"><input maxLength={200} value={refundRef} onChange={e=>setRefundRef(e.target.value)}/></Field><Field label="退款原因"><input maxLength={500} value={refundReason} onChange={e=>setRefundReason(e.target.value)}/></Field><ConfirmAction disabled={busy||!refundRef.trim()||!refundReason.trim()} onConfirm={async()=>{setBusy(true);setError(null);try{await command('/admin/qualification-fees/'+o.orderId+'/refund-confirmations',{referenceNo:refundRef,reason:refundReason,occurredAt:new Date().toISOString()});await detail.refetch();qc.invalidateQueries({queryKey:['orders']});}catch(e){setError(e);}finally{setBusy(false);}}}>確認已實際退回建立費 600 元並登錄</ConfirmAction></details>}{o.paymentEvents?.some((e:any)=>e.eventType==='QUALIFICATION_FEE_REFUNDED')&&<p>資格建立費 600 元退款已登錄。</p>}{o.status==='PAID'&&<div className="success-panel"><strong>已付款</strong><p>{o.packagePurchase?o.packageDownstreamStatus==='BALL_SETUP_PENDING'?uiText("套組付款已確認，新資格尚待 Sponsor／Binary 安置。"):'套組付款已確認，正式有效期／認列規則未完成前不會自動生效。':uiText("SALE_CONFIRMED事件將由Backend/Worker建立GPV。")}</p><Link className="button-link" to={`/qualifications?qualificationId=${o.qualificationId}`}>{uiText("查看Qualification／PV Ledger")}</Link></div>}</>}</section></>}</Card>
 </OrdersWorkbench>;
}
