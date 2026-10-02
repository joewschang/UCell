import {useState} from 'react';
import {ConfirmAction} from '../../components/ConfirmAction';
import {Field} from '../../components/ui';
import {money} from '../../lib/format';
type Line={payoutLineId:string;netAmount:string;recipient?:{ballNo?:string;qualificationNo?:string;currentHolder?:{memberNo?:string;legalName?:string}}};
export function PayoutResultForm({lines,disabled,submit}:{lines:Line[];disabled:boolean;submit:(body:unknown)=>Promise<boolean>}){
 const [lineId,setLine]=useState(''),[status,setStatus]=useState(''),[amount,setAmount]=useState(''),[reference,setReference]=useState(''),[reason,setReason]=useState(''),[occurredAt,setOccurredAt]=useState('');
 const selected=lines.find(line=>line.payoutLineId===lineId);
 const validTime=/T.*(?:Z|[+-][0-9]{2}:[0-9]{2})$/.test(occurredAt)&&Number.isFinite(Date.parse(occurredAt));
 const valid=!!selected&&!!status&&!!reference.trim()&&validTime&&(status==='FAILED'?!!reason.trim():/^(0|[1-9][0-9]*)(\.[0-9]{1,4})?$/.test(amount));
 return <fieldset disabled={disabled}><legend>登錄實際付款結果</legend><p>請依銀行或付款憑證逐筆核對。已付款金額填寫該筆截至本次的累計金額；匯出檔案不代表已付款。</p>
  <Field label="付款明細"><select value={lineId} onChange={e=>{setLine(e.target.value);setAmount('');setReference('');setReason('');}}><option value="">請選擇付款明細</option>{lines.map((line,index)=><option key={line.payoutLineId} value={line.payoutLineId}>{line.recipient?.currentHolder?.memberNo??`明細 ${index+1}`} · {line.recipient?.ballNo??line.recipient?.qualificationNo??'資格'} · 淨額 {money(line.netAmount)}</option>)}</select></Field>
  <Field label="結果"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">請選擇實際結果</option><option value="PAID">已收到付款確認</option><option value="FAILED">付款失敗，尚未付款</option></select></Field>
  {status==='PAID'&&<Field label="累計已付款金額" hint="可小於淨額；不可扣回先前已確認的金額。"><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></Field>}
  <Field label="外部付款／對帳參考"><input maxLength={200} value={reference} onChange={e=>setReference(e.target.value)} autoComplete="off"/></Field>
  {status==='FAILED'&&<Field label="失敗原因代碼"><input maxLength={200} value={reason} onChange={e=>setReason(e.target.value)} autoComplete="off"/></Field>}
  <Field label="憑證發生時間（含時區）" hint="例如 2026-09-29T15:30:00+08:00"><input value={occurredAt} onChange={e=>setOccurredAt(e.target.value)} placeholder="YYYY-MM-DDTHH:mm:ss+08:00"/></Field>
  <ConfirmAction disabled={disabled||!valid} onConfirm={async()=>{if(!valid)return;if(await submit({results:[{payoutLineId:lineId,status,paidAmount:status==='FAILED'?'0':amount,paymentReference:reference.trim(),...(status==='FAILED'?{reasonCode:reason.trim()}:{}),occurredAt:new Date(occurredAt).toISOString()}]})){setAmount('');setReference('');setReason('');setStatus('');}}}>確認並保存付款結果</ConfirmAction>
 </fieldset>;
}
