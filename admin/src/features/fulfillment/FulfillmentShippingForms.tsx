import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {get} from '../../lib/api';
import {ErrorBox,Field} from '../../components/ui';
type Submit=(body:unknown)=>Promise<boolean>;
export function DeliveryCaptureForm({disabled,expectedVersion,submit}:{disabled:boolean;expectedVersion:number;submit:Submit}){
 const [show,setShow]=useState(false),[recipientName,setName]=useState(''),[phone,setPhone]=useState(''),[postalCode,setPostal]=useState(''),[address,setAddress]=useState('');
 const [editingVersion,setEditingVersion]=useState(expectedVersion);
 if(!show)return <button disabled={disabled} onClick={()=>{setEditingVersion(expectedVersion);setShow(true);}}>填寫或更新宅配資料</button>;
 return <form onSubmit={async e=>{e.preventDefault();if(await submit({expectedVersion:editingVersion,recipientName:recipientName.trim(),phone:phone.trim(),countryCode:'TW',postalCode:postalCode.trim(),address:address.trim()}))setShow(false);}}><fieldset disabled={disabled}>
  <legend>宅配資料</legend><p>請依本次訂單確認收件資料。建立物流單或 ERP 開始處理後，這份配送資料即固定。</p>
  <Field label="收件人"><input required maxLength={80} value={recipientName} onChange={e=>setName(e.target.value)} autoComplete="off"/></Field>
  <Field label="聯絡電話"><input required type="tel" pattern="(?=.*[0-9])\+?[0-9 ()-]{6,32}" value={phone} onChange={e=>setPhone(e.target.value)} autoComplete="off"/></Field>
  <p>配送地區：台灣 · 宅配</p><Field label="郵遞區號（選填）"><input maxLength={16} value={postalCode} onChange={e=>setPostal(e.target.value)} inputMode="numeric" autoComplete="off"/></Field>
  <Field label="完整配送地址" hint="請包含縣市、行政區、街道與門牌。"><textarea required minLength={5} maxLength={500} value={address} onChange={e=>setAddress(e.target.value)} autoComplete="off"/></Field>
  <button type="submit">確認並保存宅配資料</button><button type="button" onClick={()=>setShow(false)}>取消</button>
 </fieldset></form>;
}
type Connection={connectionReference:string;provider:string;connectionKey:string;version:number;environment:string};
const providerLabels:Record<string,string>={BLACK_CAT:'黑貓宅急便',SEVEN_ELEVEN:'7-ELEVEN 物流',ECPAY_LOGISTICS:'綠界物流',OTHER:'其他物流'};
export function ShipmentRegistrationForm({disabled,submit}:{disabled:boolean;submit:Submit}){
 const [show,setShow]=useState(false),[connectionReference,setConnection]=useState(''),[providerShipmentReference,setReference]=useState(''),[trackingNo,setTracking]=useState(''),[packageIntegrityConfirmed,setPackage]=useState(false),[labelVerified,setLabel]=useState(false);
 const query=useQuery({queryKey:['fulfillment-logistics-connections'],queryFn:()=>get<{data:Connection[]}>('/admin/fulfillment/orders/logistics/connections'),enabled:show});
 if(!show)return <button disabled={disabled} onClick={()=>setShow(true)}>登錄已建立的物流單</button>;
 const options=query.data?.data??[];
 return <section><h4>登錄物流單與標籤</h4><p>請輸入物流系統已建立的單號，並確認外箱及標籤。登錄後仍需物流收件證據才會顯示已出貨。</p>
  <ErrorBox error={query.error}/>{query.isFetching&&<p role="status">載入物流設定中…</p>}{!query.isFetching&&!options.length&&<p>目前沒有可用的已核准物流設定，請由整合管理員完成設定後重試。</p>}
  <button type="button" disabled={disabled||query.isFetching} onClick={()=>query.refetch()}>重新載入物流設定</button>
  <form onSubmit={async e=>{e.preventDefault();if(await submit({connectionReference,providerShipmentReference:providerShipmentReference.trim(),trackingNo:trackingNo.trim(),packageIntegrityConfirmed,labelVerified}))setShow(false);}}><fieldset disabled={disabled||query.isFetching}>
   <Field label="已核准物流設定"><select required value={connectionReference} onChange={e=>setConnection(e.target.value)}><option value="">請選擇物流設定</option>{options.map((c,index)=><option key={c.connectionReference} value={c.connectionReference}>{providerLabels[c.provider]??'物流設定'} · 設定 {index+1} · 第 {c.version} 版</option>)}</select></Field>
   <Field label="物流系統單號"><input required pattern="[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}" value={providerShipmentReference} onChange={e=>setReference(e.target.value)} autoComplete="off"/></Field>
   <Field label="貨件追蹤號碼"><input required pattern="[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}" value={trackingNo} onChange={e=>setTracking(e.target.value)} autoComplete="off"/></Field>
   <label><input type="checkbox" required checked={packageIntegrityConfirmed} onChange={e=>setPackage(e.target.checked)}/>我已檢查外箱完整</label>
   <label><input type="checkbox" required checked={labelVerified} onChange={e=>setLabel(e.target.checked)}/>我已核對物流標籤與本次配送資料</label>
   <button type="submit" disabled={!options.length}>保存物流單與序號對應</button><button type="button" onClick={()=>setShow(false)}>取消</button>
  </fieldset></form>
 </section>;
}
