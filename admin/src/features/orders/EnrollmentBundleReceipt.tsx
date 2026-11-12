import {useRef,useState} from 'react';
import {ConfirmAction} from '../../components/ConfirmAction';
import {ErrorBox,Field} from '../../components/ui';
import {command} from '../../lib/api';
import {dateTime} from '../../lib/format';

interface Bundle {
  bundleId:string;
  total:string;
  lines:{position:number;orderId:string;orderNo:string;publicOrderNo?:string|null;amount:string;status:string;createdAt?:string;paymentDeadline?:string|null}[];
  report:{amount:string;accountLastFive:string;paidAt:string}|null;
  receipt:{referenceNo:string;amount:string;receivedAt:string}|null;
}

function localDateTime(date:Date) {
  return new Date(date.getTime()-date.getTimezoneOffset()*60000).toISOString().slice(0,19);
}

function money(amount:string) {
  const [whole, fraction='']=amount.split('.');
  return 'NT$ '+BigInt(whole).toLocaleString('zh-TW')+(Number(fraction)?'.'+fraction.padEnd(2,'0'):'');
}

function cents(amount:string) {
  if(!/^\d{1,16}(\.\d{1,2})?$/.test(amount))return null;
  const [whole,fraction='']=amount.split('.');
  return BigInt(whole+fraction.padEnd(2,'0'));
}

export function EnrollmentBundleReceipt({bundle,orderId,canConfirm,reload}:{bundle:Bundle;orderId:string;canConfirm:boolean;reload:()=>Promise<unknown>}) {
  const [amount,setAmount]=useState(Number(bundle.total)===0?'0':'');
  const [reference,setReference]=useState('');
  const [method,setMethod]=useState(Number(bundle.total)===0?'COUPON_WAIVER':'BANK_TRANSFER');
  const [at,setAt]=useState('');
  const [busy,setBusy]=useState(false),[error,setError]=useState<unknown>();
  const attempt=useRef<{body:string;key:string}>();
  const expired=bundle.lines.some(line=>line.paymentDeadline && new Date(line.paymentDeadline).getTime()<=Date.now());
  const exactAmount=cents(amount)!==null && cents(amount)===cents(bundle.total);
  const received=new Date(at).getTime();
  const validTime=Number.isFinite(received) && received<=Date.now()+60000 && bundle.lines.every(line=>
    (!line.createdAt || received>=new Date(line.createdAt).getTime()) && (!line.paymentDeadline || received<new Date(line.paymentDeadline).getTime()));
  const ready=canConfirm && !expired && !busy && exactAmount && !!reference.trim() && validTime;
  async function confirm(){
    if(!ready)return;
    setBusy(true);setError(undefined);
    try {
      const body={amount,paymentMethod:method,referenceNo:reference.trim(),occurredAt:new Date(at).toISOString()};
      const serialized=JSON.stringify(body);
      if(attempt.current?.body!==serialized)attempt.current={body:serialized,key:crypto.randomUUID()};
      await command('/admin/orders/'+orderId+'/bundle-payment-confirmations',body,attempt.current.key);
      await reload();
    } catch(e){setError(e);} finally {setBusy(false);}
  }
  return <section className="form" aria-label="整組資格收款">
    <h3>整組資格收款</h3>
    <p>{bundle.lines.length} 顆球的資格套組與建立費合計 <strong>{money(bundle.total)}</strong>。重銷款於各球生效後另行收取。</p>
    <details><summary>查看逐球分攤金額</summary><ul>{bundle.lines.map(line=><li key={line.orderId}>第 {line.position} 球 · 訂單 {line.publicOrderNo||line.orderNo} · {money(line.amount)}</li>)}</ul></details>
    {bundle.report&&<p>會員回報匯款 {money(bundle.report.amount)}，帳號末五碼 {bundle.report.accountLastFive}，時間 {dateTime(bundle.report.paidAt)}。</p>}
    {bundle.receipt?<p role="status">整組已收款 {money(bundle.receipt.amount)} · 憑證 {bundle.receipt.referenceNo} · {dateTime(bundle.receipt.receivedAt)}</p>:
      expired?<p role="status">資格付款期限已過。如會員已匯款，請依原始訂單號與收款憑證辦理逾期款項核對。</p>:
      bundle.lines.some(line=>line.status!=='CONFIRMED')?<p role="status">請先核對組內各筆訂單的最新狀態。</p>:
      canConfirm&&<>
        <Field label="實收金額（新台幣）"><input type="number" inputMode="decimal" step=".01" min="0" value={amount} onChange={e=>setAmount(e.target.value)}/></Field>
        <Field label="付款方式"><select value={method} onChange={e=>setMethod(e.target.value)}>{Number(bundle.total)===0?<option value="COUPON_WAIVER">全額減免</option>:<><option value="BANK_TRANSFER">銀行匯款</option><option value="CASH">現金</option></>}</select></Field>
        <Field label="銀行交易序號或收款憑證"><input maxLength={180} value={reference} onChange={e=>setReference(e.target.value)}/></Field>
        <Field label="實際收款時間"><input type="datetime-local" step="1" max={localDateTime(new Date())} value={at} onChange={e=>setAt(e.target.value)}/></Field>
        {amount&&!exactAmount&&<p role="status">請填寫與整組應付金額相符的數字，最多保留兩位小數。</p>}
        {at&&!validTime&&<p role="status">請核對實際收款時間，應在整組訂單成立後及付款期限內。</p>}
        <ConfirmAction disabled={!ready} onConfirm={confirm}>確認整組資格收款</ConfirmAction>
      </>}
    <ErrorBox error={error}/>
  </section>;
}
