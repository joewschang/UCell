import {useRef,useState,type FormEvent} from 'react';
import BankTransferDetails from '../BankTransferDetails';
import {useResource} from '../useResource';
import {getPaymentReport,reportPayment,bundleError,type BundleReceipt,type PaymentReport} from './api';
import {money} from './model';
const localNow=()=>{
  const date=new Date();
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,16);
};
export default function BundlePayment({receipt,confirmed,canTransfer,onReported}:{receipt:BundleReceipt;confirmed:boolean;canTransfer:boolean;onReported:()=>void}) {
  const response=useResource('bundle-payment:'+receipt.bundleId,s=>getPaymentReport(receipt.applicationId,s),!confirmed);
  const [result,setResult]=useState<PaymentReport|null>(null),[paidAt,setPaidAt]=useState(localNow),[last5,setLast5]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState('');
  const pending=useRef<{body:string;key:string}|null>(null),flight=useRef(false);
  const report=result??response.data,rootOrder=receipt.balls[0].qualification;
  const combined=receipt.paymentPolicy==='COMBINED';
  const total=combined?receipt.payableTotal:receipt.qualificationTotal;
  async function submit(event:FormEvent) {
    event.preventDefault();if(flight.current||confirmed||!canTransfer||total===undefined)return;
    const date=new Date(paidAt);
    if(!/^\d{5}$/.test(last5)||!Number.isFinite(date.getTime())||date.getTime()>Date.now()+60000){setError('請核對實際轉帳時間及匯出帳號末五碼。');return;}
    const data={amount:total,paidAt:date.toISOString(),accountLastFive:last5};
    const body=JSON.stringify(data);
    if(pending.current?.body!==body)pending.current={body,key:crypto.randomUUID()};
    setBusy(true);flight.current=true;setError('');
    try{setResult(await reportPayment(receipt.applicationId,data,pending.current.key));onReported();}
    catch(e){setError(bundleError(e));response.retry();}finally{flight.current=false;setBusy(false);}
  }
  const deadline=receipt.balls.flatMap(b=>combined&&b.repurchase?[b.qualification.paymentDeadline,b.repurchase.paymentDeadline]:[b.qualification.paymentDeadline]).filter((d):d is string=>!!d).sort()[0];
  if(total===undefined||!/^\d+(\.\d{1,4})?$/.test(total))return <p role="alert">暫時無法取得應付總額，請更新訂單進度後再付款。</p>;
  return <section className="eb-payment"><h3>{combined?'整組合併付款':'資格合併付款'}</h3>
    <div className="eb-summary-line"><span>{combined?'資格與所選重銷':'全部 '+receipt.balls.length+' 顆的資格款'}</span><strong>NT$ {money(total)}</strong></div>
    <p>對帳訂單號　<strong>{rootOrder.publicOrderNo||rootOrder.orderNo||rootOrder.orderId}</strong></p>
    {confirmed?<p role="status">{combined?'本次合併款項已確認。':'整組資格款已確認。'}</p>:Number(total)===0?<p>應付金額已全額折抵，無須匯款。請等候後台確認。</p>
      :report?<div role="status"><p>已回報 NT$ {money(report.amount)}，匯出帳號末五碼 {report.accountLastFive}。</p>{deadline&&new Date(deadline).getTime()<=Date.now()?<p>訂單期限已過，請保留上述對帳訂單號與匯款資料，聯絡公司人工核對，請勿再次匯款。</p>:<p>請等候後台核對。</p>}</div>
      :response.error?<div role="alert"><p>{response.error}</p><button type="button" onClick={response.retry}>重新查詢付款回報</button></div>
      :response.data===undefined?<p role="status">正在查詢付款進度…</p>
      :!canTransfer?<p>這組訂單已無法線上回報。若已匯款，請以對帳訂單號聯絡公司核對。</p>
      :<>{!receipt.rootSponsor&&<p>第 1 球的組外推薦尚未指定，您可在上方補填。</p>}<p>{combined?'全部資格與所選重銷只需匯款並回報一次。':'請合併匯入上述資格款一次，各球的重銷款待該球生效後另付。'}</p>
      {deadline&&<p>請於 {new Date(deadline).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}（台北時間）前付款。</p>}
      <details><summary>查看收款銀行與帳號</summary><BankTransferDetails method="BANK_TRANSFER" grouped/></details>
      <form onSubmit={submit}><fieldset className="eb-body" disabled={busy}><legend>回報已完成的合併匯款</legend>
      <label className="eb-label">實際匯款時間<input type="datetime-local" required max={localNow()} value={paidAt} onChange={e=>setPaidAt(e.target.value)}/></label>
      <label className="eb-label">匯出帳號末五碼<input type="text" inputMode="numeric" pattern="[0-9]{5}" maxLength={5} required value={last5} autoComplete="off" onChange={e=>setLast5(e.target.value.replace(/\D/g,''))}/></label>
      <button className="eb-primary" type="submit" disabled={busy||last5.length!==5||!paidAt}>{busy?'回報中…':'回報本次合併匯款'}</button></fieldset>
      {error&&<p role="alert">{error}</p>}</form></>}
  </section>;
}
