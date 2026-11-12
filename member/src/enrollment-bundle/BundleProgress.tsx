import {useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {useResource} from '../useResource';
import {bundleError,getBundle,releaseExpired,type BundleOrder,type BundlePaymentSummary,type BundleReceipt} from './api';
import {money,placementLabel} from './model';
import BankTransferDetails from '../BankTransferDetails';
import RootSponsor from './SponsorField';
import BundlePayment from './BundlePayment';
import './bundle.css';

const orderLabels:Record<string,string>={DRAFT:'草稿',CREATED:'待付款',PENDING:'待付款',PENDING_PAYMENT:'待付款',CONFIRMED:'待付款確認',PAID:'已付款',FULFILLED:'已完成',CANCELLED:'已取消',CANCELED:'已取消',VOIDED:'已作廢',EXPIRED:'已逾期',PARTIAL_RETURN:'部分退貨',RETURNED:'已退貨',REFUNDED:'已退款'};
const paidStates=['PAID','FULFILLED','PARTIAL_RETURN'];
const closedStates=['CANCELLED','CANCELED','EXPIRED','VOIDED','RETURNED','REFUNDED'];
const placementLabels:Record<string,string>={PLACED:'已安置',EFFECTIVE:'已生效',PLACEMENT_PENDING:'待安置',PLACEMENT_OVERDUE:'安置待處理',BALL_SETUP_PENDING:'待設定推薦球',RETURN_REVIEW_PENDING:'退貨審查中',DRAFT:'已預排',PENDING:'已預排',PLANNED:'已預排',AWAITING_APPROVAL:'待審核',AWAITING_PAYMENT:'待付款'};
function Order({order,label}:{order:BundleOrder;label:string}) {
  return <div className="eb-order"><div><span>{label} · {order.packageName}</span><small>訂單 {order.publicOrderNo||order.orderNo||order.orderId}</small></div>
    <div><strong>NT$ {money(order.total)}</strong><small>{orderLabels[order.status]??'請查看訂單進度'}</small></div></div>;
}
export function ReceiptDetails({receipt,paymentLink}:{receipt:BundleReceipt;paymentLink?:(order:BundleOrder)=>string}) {
  return <><p>重銷預選合計 NT$ {money(receipt.repurchaseTotal)}，各球生效後另行付款。</p>
    {receipt.balls.map(ball=><details key={ball.position} className="eb-receipt-line">
      <summary><span>第 {ball.position} 球　{ball.ballNo??placementLabel(ball.position)}</span><small>{ball.qualificationStatus==='EFFECTIVE'?'已生效':placementLabels[ball.placementStatus??'']??'待完成安置'}</small></summary>
      <p>{ball.position===1?'組外推薦　'+([receipt.rootSponsor?.ballNo,receipt.rootSponsor?.name].filter(Boolean).join(' · ')||'待核對'):
        '推薦球為第 '+ball.parentPosition+' 球 · '+placementLabel(ball.position)}</p>
      <Order label="資格（合併付款）" order={ball.qualification}/>
      {ball.repurchase&&<><Order label="本球重銷" order={ball.repurchase}/>
        {ball.repurchasePayable?<div><p>本球重銷付款請使用訂單號 {ball.repurchase.publicOrderNo||ball.repurchase.orderNo||ball.repurchase.orderId}。</p>{paymentLink?<Link to={paymentLink(ball.repurchase)}>前往第 {ball.position} 球的重銷付款 →</Link>:<details><summary>查看本球重銷收款資料</summary><BankTransferDetails method="BANK_TRANSFER"/></details>}</div>:
         !paidStates.includes(ball.repurchase.status)&&!closedStates.includes(ball.repurchase.status)&&<p>待本球生效後開放重銷付款。</p>}</>}
    </details>)}</>;
}
export default function BundleProgress({applicationId,payment,initial,onRefresh,onReleased,paymentLink}:{applicationId:string;payment?:BundlePaymentSummary|null;
  initial?:BundleReceipt;paymentLink?:(order:BundleOrder)=>string;onRefresh?:()=>void;onReleased?:()=>void}) {
  const [version,setVersion]=useState(0),[confirm,setConfirm]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
  const releaseKey=useRef<string|null>(null),flight=useRef(false);
  const state=useResource('bundle-receipt:'+applicationId+':'+version,signal=>getBundle(applicationId,signal));
  const receipt=state.data??(state.data===undefined?initial:undefined);
  function refresh(){setVersion(x=>x+1);onRefresh?.();}
  async function restart(){
    if(!receipt?.mayRestart||flight.current)return;
    flight.current=true;setBusy(true);setError('');
    if(!releaseKey.current)releaseKey.current=crypto.randomUUID();
    try{await releaseExpired(applicationId,receipt.bundleId,releaseKey.current);setConfirm(false);refresh();onReleased?.();}
    catch(e){setError(bundleError(e));refresh();}finally{flight.current=false;setBusy(false);}
  }
  const confirmed=!!receipt&&receipt.balls.every(b=>paidStates.includes(b.qualification.status));
  const payable=!!receipt&&receipt.balls.every(b=>!closedStates.includes(b.qualification.status)&&
    (!b.qualification.paymentDeadline||new Date(b.qualification.paymentDeadline).getTime()>Date.now()));
  return <section className="eb eb-progress" aria-label="多球訂單進度"><h2>多球訂單進度</h2>
    {payment&&<p role="status">{payment.paidQualifications}／{payment.qualificationCount} 筆資格訂單已確認款項。</p>}
    {state.error&&<p role="alert">{state.error}</p>}{!receipt&&!state.error&&<p role="status">{state.data===null?'尚未找到這組訂單。':'正在查詢訂單…'}</p>}
    {receipt&&<>{!receipt.rootSponsor&&!confirmed&&payable&&!receipt.mayRestart&&<RootSponsor applicationId={applicationId} onSaved={refresh}/>}<BundlePayment key={receipt.bundleId} receipt={receipt} confirmed={confirmed} canTransfer={payable&&!receipt.mayRestart} onReported={refresh}/>
      <ReceiptDetails receipt={receipt} paymentLink={paymentLink}/></>}
    {receipt?.mayRestart&&(confirm?<div className="eb-restart"><p>這組訂單已逾期。若曾匯款，請先聯繫公司核對。作廢後，這組球位及預選重銷須重新選擇。</p>
      <button disabled={busy} type="button" onClick={restart}>作廢這組未付款訂單並重新選購</button>
      <button disabled={busy} type="button" onClick={()=>setConfirm(false)}>保留訂單</button></div>
      :<button type="button" onClick={()=>setConfirm(true)}>逾期訂單重新選購</button>)}
    {error&&<p role="alert">{error}</p>}
    <button type="button" className="eb-link" onClick={refresh}>更新訂單進度</button>
  </section>;
}
