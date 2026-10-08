import {useState} from 'react';
import {Field} from '../../components/ui';
import {ConfirmAction} from '../../components/ConfirmAction';
type Line={payoutLineId:string;netAmount:string;recipient?:{ballNo?:string;currentHolder?:{legalName?:string}}};
export function BankExportForm({lines,disabled,submit}:{lines:Line[];disabled:boolean;submit:(input:any)=>Promise<any>}){
 const [format,setFormat]=useState('BULK_REMITTANCE'),[reference,setReference]=useState(''),[recipients,setRecipients]=useState<Record<string,{accountName:string;accountNumber:string;bankBranchCode:string}>>({});
 const payable=lines.filter(l=>Number(l.netAmount)>0);
 const patch=(id:string,key:string,value:string)=>setRecipients(previous=>({...previous,[id]:{...(previous[id]??{accountName:'',accountNumber:'',bankBranchCode:''}),[key]:value}}));
 return <section><h3>銀行匯款檔</h3><p>依銀行原始 XLS 範本填入本批次實付金額。下載後請財務核對並交銀行；產生檔案不代表完成付款。</p>
 <Field label="匯款格式"><select value={format} disabled={disabled} onChange={e=>setFormat(e.target.value)}><option value="BULK_REMITTANCE">整批匯款</option><option value="CENTER_TRANSFER">中心轉帳（獎金存入 74）</option></select></Field>
 <p>{format==='CENTER_TRANSFER'?'須提供銀行確認的 16 碼全帳號；本範本每批最多 31 筆。':'銀行與分行共 7 碼，帳號不足 14 碼自動前補零。限額未確認前，每批含匯費不得超過 80 萬元。'}</p>
 <Field label="本次銀行匯出參考"><input value={reference} disabled={disabled} maxLength={200} onChange={e=>setReference(e.target.value)}/></Field>
 {payable.map(l=><fieldset key={l.payoutLineId}><legend>{l.recipient?.ballNo??l.payoutLineId} · NT$ {l.netAmount}</legend><Field label="收款戶名"><input disabled={disabled} value={recipients[l.payoutLineId]?.accountName??''} maxLength={40} onChange={e=>patch(l.payoutLineId,'accountName',e.target.value)}/></Field>{format==='BULK_REMITTANCE'&&<Field label="銀行＋分行代碼（7 碼）"><input disabled={disabled} inputMode="numeric" value={recipients[l.payoutLineId]?.bankBranchCode??''} onChange={e=>patch(l.payoutLineId,'bankBranchCode',e.target.value)}/></Field>}<Field label={format==='CENTER_TRANSFER'?'全帳號（16 碼）':'收款帳號（最多 14 碼）'}><input disabled={disabled} inputMode="numeric" value={recipients[l.payoutLineId]?.accountNumber??''} onChange={e=>patch(l.payoutLineId,'accountNumber',e.target.value)}/></Field></fieldset>)}
 <ConfirmAction disabled={disabled||!reference||!payable.length||payable.some(l=>!recipients[l.payoutLineId]?.accountName||!recipients[l.payoutLineId]?.accountNumber||(format==='BULK_REMITTANCE'&&!recipients[l.payoutLineId]?.bankBranchCode))} onConfirm={()=>submit({format,exportReference:reference,recipients:payable.map(l=>({payoutLineId:l.payoutLineId,...recipients[l.payoutLineId]}))})}>建立並下載銀行 XLS</ConfirmAction>
 </section>;
}
