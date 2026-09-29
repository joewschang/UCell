import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link,useSearchParams} from 'react-router-dom';
import {useAuth} from '../auth/auth';
import {command,get,ApiError} from '../../lib/api';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
type Source={sourceReference:string;sku:string;quantity:string;serialNos:string[]};
type AcceptedReturn={returnReference:string;occurredAt:string;lines:{sku:string;quantity:string}[]};
type Fulfillment={fulfillmentKey:string;status:string;sources:Source[];shipments?:{shipmentReference:string;status:string;trackingNo:string|null;serials:{serialNo:string;returned:boolean}[]}[];packVerification:null|{status:string;occurredAt:string};erpHandoff:null|{providerCode:string;requestedAt:string;deliveryState?:string;dispatch?:null|{outcome:string;attemptNumber:number};results?:{outcome:string;occurredAt:string;recordedAt:string;resultHash:string}[]}};
type Order={orderNo:string;status:string;returns?:AcceptedReturn[];fulfillments:Fulfillment[]};
const shipmentStatuses:Record<string,string>={READY:'準備中',LABEL_CREATED:'已建物流單',PICKED_UP:'物流已收件',IN_TRANSIT:'配送中',DELIVERED:'已送達',DELIVERY_FAILED:'配送失敗',RETURNING:'退回中',RETURNED:'已退回',CANCELLED:'已取消'};
const statuses:Record<string,string>={READY:'待揀貨',ALLOCATED:'已配置',PICKING:'揀貨中',PICKED:'已揀貨',QC_PENDING:'待檢查',QC_PASSED:'檢查完成',PACKED:'已裝箱',SHIPPING_REQUESTED:'已提出出貨請求',SHIPPED:'已出貨',DELIVERED:'已送達',EXCEPTION:'待處理異常',CANCELLED:'已取消'};
const errors:Record<string,string>={SHIPMENT_NOT_BINDABLE:'此物流單尚不符合序號綁定條件。',SHIPMENT_PACK_EVIDENCE_MISMATCH:'物流單內容與裝箱快照不符，請重新核對。',SHIPMENT_DISPATCH_EVIDENCE_REQUIRED:'缺少物流收件證據，暫不能確認已出貨。',RETURN_SERIAL_SOURCE_MISMATCH:'退貨序號不屬於這筆原出貨明細。',RETURN_SERIAL_QUANTITY_EXCEEDED:'已達核准退貨數量，請勿重複驗收其他產品。',RETURN_SERIAL_NOT_SHIPPED:'此序號尚無符合條件的出貨證據。',SERIAL_ALREADY_RETURNED:'此序號已由另一筆退貨驗收。',POSTED_RETURN_REQUIRED:'請選擇這筆訂單已入帳的退貨。',ERP_RESULT_INVALID:'回報格式不正確，請核對商品、數量與序號。',ERP_RESULT_IDEMPOTENCY_CONFLICT:'此回報已保存不同內容，請重新核對後另建回報。',ERP_HANDOFF_REQUIRED:'請先建立 ERP 交付請求。',SERIAL_NOT_FOUND:'查無此序號，請核對標籤。',SERIAL_SKU_MISMATCH:'商品或序號不符合這筆出貨明細。',SERIAL_ALREADY_SHIPPED:'此序號已出貨，不能再次配置。',SERIAL_ALREADY_ALLOCATED:'此序號已配置給其他出貨單。',SERIAL_BATCH_INELIGIBLE:'此批次已停用或過期，請改用合格產品。',SERIAL_NOT_AVAILABLE:'此序號目前不可出貨。',FULFILLMENT_SOURCE_QUANTITY_EXCEEDED:'掃描數量已達需求，請勿再加入產品。',FULFILLMENT_SERIAL_SCAN_INCOMPLETE:'尚未完成全部序號核對，請檢查各品項數量。',SERIAL_PACK_UNIT_INELIGIBLE:'部分序號已不符合出貨資格，請交由主管處理。'};
function warehouseError(error:unknown){
 if(error instanceof ApiError){const body=error.body as any,code=body?.error?.code??body?.code??body?.message?.code;if(errors[code])return new Error(errors[code]);}
 return error;
}
export function FulfillmentPage(){
 const [params]=useSearchParams(),{user}=useAuth();
 const initial=params.get('orderNo')??'';
 const [input,setInput]=useState(initial),[orderNo,setOrderNo]=useState(/^\d+$/.test(initial)?initial:''),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null),[notice,setNotice]=useState('');
 const query=useQuery({queryKey:['fulfillment-order',orderNo],queryFn:()=>get<{data:Order}>(`/admin/fulfillment/orders/${encodeURIComponent(orderNo)}`),enabled:!!orderNo});
 const canWrite=user?.role==='SUPER_ADMIN'||user?.role==='ORDER_OPS';
 async function run(key:string,action:string,body:unknown={}){
  setBusy(true);setError(null);setNotice('');
  try{await command(`/admin/fulfillment/orders/${encodeURIComponent(orderNo)}${key?'/'+encodeURIComponent(key):''}/${action}`,body);await query.refetch();setNotice(action==='shipment-serials'?'物流與原序號對應已核對。':action==='return-serials'?'退貨序號已驗收。':action==='erp-retry'?'已重新排程，Worker 將先核對 ERP 是否受理。':action==='erp-results'?'ERP 回報已保存，請查看對帳紀錄。':action==='prepare'?'出貨配置已建立。':action==='scans'?'序號已核對。':action==='pack-verification'?'裝箱驗證完成。':'交付請求已保存，等待 ERP 處理與對帳。');return true;}
  catch(e){setError(warehouseError(e));return false;}finally{setBusy(false);}
 }
 return <><PageHeader title="出貨與序號核對" subtitle="依訂單載入需求，掃描商品與序號，再確認裝箱。" actions={<Link to="/orders">返回訂單與收款</Link>}/>
  <Card><form onSubmit={e=>{e.preventDefault();setError(null);setNotice('');if(input.trim()===orderNo)void query.refetch();else setOrderNo(input.trim());}}><Field label="訂單號"><input required pattern="[0-9]{1,19}" value={input} onChange={e=>setInput(e.target.value)} inputMode="numeric" disabled={busy}/></Field><button disabled={busy||query.isFetching}>載入出貨明細</button></form></Card>
  <ErrorBox error={error||query.error}/>{query.isFetching&&<p role="status">正在載入出貨資料…</p>}{notice&&<p role="status">{notice}</p>}
  {!orderNo&&<p>輸入或掃描訂單號開始核對。</p>}
  {query.data&&!query.error&&query.data.data.fulfillments.length===0&&<Card><p>此訂單尚無出貨配置。</p>{canWrite&&query.data.data.status==='PAID'?<button disabled={busy||query.isFetching} onClick={()=>run('','prepare')}>依付款明細建立出貨配置</button>:<p>完成付款後，由倉務人員建立出貨配置。</p>}</Card>}
  {!query.error&&query.data?.data.fulfillments.map(f=><Card key={f.fulfillmentKey} title={`出貨單 ${f.fulfillmentKey}`}>
   <p>狀態：{statuses[f.status]??'待確認'}{f.packVerification?' · 裝箱驗證完成':''}</p>
   {f.sources.map(s=><SourceScan key={s.sourceReference} source={s} disabled={busy||query.isFetching||!canWrite||!!f.packVerification||!!f.erpHandoff} scan={body=>run(f.fulfillmentKey,'scans',body)}/>)}
   {!canWrite&&<p>目前為唯讀檢視；掃描與交付需倉務權限。</p>}
   <h3>物流與序號追溯</h3>{!f.shipments?.length&&<p>尚無物流單。裝箱完成不代表已出貨。</p>}
   {f.shipments?.map((shipment,index)=><section key={shipment.shipmentReference}><p>物流單 {shipment.trackingNo??index+1} · {shipmentStatuses[shipment.status]??'待確認'} · 已綁定 {shipment.serials.length} 件</p>
    <details><summary>查看物流單序號</summary>{shipment.serials.length?<ul>{shipment.serials.map(s=><li key={s.serialNo}>{s.serialNo}{s.returned?' · 已驗收退貨':''}</li>)}</ul>:<p>尚未綁定產品序號。</p>}</details>
    {canWrite&&!['CANCELLED','RETURNING','RETURNED'].includes(shipment.status)&&<button disabled={busy||query.isFetching} onClick={()=>run(f.fulfillmentKey,'shipment-serials',{shipmentReference:shipment.shipmentReference})}>核對序號與物流證據</button>}
   </section>)}
   {canWrite&&!!query.data?.data.returns?.length&&!!f.shipments?.some(s=>s.serials.length)&&<ReturnReceiptForm returns={query.data.data.returns} disabled={busy||query.isFetching} submit={body=>run(f.fulfillmentKey,'return-serials',body)}/>}
   {canWrite&&<div className="actions"><button disabled={busy||query.isFetching||!!f.packVerification||!!f.erpHandoff} onClick={()=>run(f.fulfillmentKey,'pack-verification')}>確認裝箱</button><button disabled={busy||query.isFetching||!f.packVerification||!!f.erpHandoff} onClick={()=>run(f.fulfillmentKey,'erp-handoff')}>建立 ERP 交付請求</button></div>}
   {f.erpHandoff&&<><p>ERP 交付請求已保存；實際出貨仍待處理與對帳。</p>
    {f.erpHandoff.dispatch&&<p>ERP 受理：{f.erpHandoff.dispatch.outcome==='ACCEPTED'?'已受理，尚不代表已出貨':f.erpHandoff.dispatch.outcome==='REJECTED'?'受理失敗，需核對原因':'受理結果待確認'} · 已嘗試 {f.erpHandoff.dispatch.attemptNumber} 次</p>}
    {f.erpHandoff.deliveryState==='DEAD'&&<div><p>自動重試已停止。確認 ERP 連線及交付資料後，可重新排程核對受理狀態。</p>{canWrite&&<button disabled={busy||query.isFetching} onClick={()=>run(f.fulfillmentKey,'erp-retry')}>重新排程 ERP 受理核對</button>}</div>}
    <h3>ERP 對帳紀錄（最近 50 筆）</h3>{f.erpHandoff.results?.length?<ul>{f.erpHandoff.results.map(r=><li key={r.resultHash+r.recordedAt}>{({MATCHED:'商品與序號全部相符',PARTIAL:'部分回報，尚未完成',MISMATCH:'商品、數量或序號不符'} as Record<string,string>)[r.outcome]??'待確認'} · 回報時間 {new Date(r.occurredAt).toLocaleString('zh-TW')}</li>)}</ul>:<p>尚無 ERP 結果。交付請求不代表已出貨。</p>}
    {canWrite&&<ErpResultForm disabled={busy||query.isFetching} submit={body=>run(f.fulfillmentKey,'erp-results',body)}/>}
   </>}
  </Card>)}
 </>;
}
function ReturnReceiptForm({returns,disabled,submit}:{returns:AcceptedReturn[];disabled:boolean;submit:(body:unknown)=>Promise<boolean>}){
 const [reference,setReference]=useState(''),[serial,setSerial]=useState('');
 return <details><summary>驗收已核准退貨的產品</summary><p>先選擇已入帳退貨，再逐件掃描原出貨序號；系統會核對原始訂單與核准數量。</p><form onSubmit={async e=>{e.preventDefault();if(await submit({returnReference:reference,serialNos:[serial.trim().toUpperCase()]}))setSerial('');}}>
  <fieldset disabled={disabled}><Field label="已入帳退貨"><select required value={reference} onChange={e=>setReference(e.target.value)}><option value="">請選擇退貨明細</option>{returns.map(r=><option key={r.returnReference} value={r.returnReference}>{new Date(r.occurredAt).toLocaleString('zh-TW')} · {r.lines.map(l=>`${l.sku} ${l.quantity} 件`).join('、')}</option>)}</select></Field><Field label="退貨產品序號"><input required pattern="[A-Ea-e][0-9]{7}" value={serial} onChange={e=>setSerial(e.target.value)} autoComplete="off"/></Field><button type="submit">驗收退貨序號</button></fieldset>
 </form></details>;
}
function ErpResultForm({disabled,submit}:{disabled:boolean;submit:(body:unknown)=>Promise<boolean>}){
 const blank=()=>({sku:'',serials:''});
 const [reference,setReference]=useState(''),[occurredAt,setOccurredAt]=useState(''),[rows,setRows]=useState([blank()]),[resultKey,setResultKey]=useState(()=>crypto.randomUUID());
 function changed(){setResultKey(crypto.randomUUID());}
 return <details><summary>登錄 ERP 實際結果</summary><p>依 ERP 回報輸入商品與實際序號，每行一個序號；數量依序號計算。此紀錄不會直接變更出貨狀態。</p>
  <form onSubmit={async e=>{e.preventDefault();const lines=rows.map(r=>{const serialNos=r.serials.trim().split(/\s+/).filter(Boolean).map(s=>s.toUpperCase());return {sku:r.sku.trim(),quantity:String(serialNos.length),serialNos};});if(await submit({resultKey,providerReference:reference.trim(),occurredAt:new Date(occurredAt).toISOString(),lines})){setReference('');setOccurredAt('');setRows([blank()]);changed();}}}>
   <fieldset disabled={disabled}><Field label="ERP 回報編號"><input required pattern="[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}" value={reference} onChange={e=>{setReference(e.target.value);changed();}}/></Field>
   <Field label="ERP 回報時間"><input required type="datetime-local" value={occurredAt} onChange={e=>{setOccurredAt(e.target.value);changed();}}/></Field>
   {rows.map((row,index)=><section key={index}><Field label={`商品代碼 ${index+1}`}><input required maxLength={128} value={row.sku} onChange={e=>{setRows(current=>current.map((r,i)=>i===index?{...r,sku:e.target.value}:r));changed();}}/></Field><Field label={`實際序號 ${index+1}`}><textarea required value={row.serials} onChange={e=>{setRows(current=>current.map((r,i)=>i===index?{...r,serials:e.target.value}:r));changed();}}/></Field>{rows.length>1&&<button type="button" onClick={()=>{setRows(current=>current.filter((_,i)=>i!==index));changed();}}>移除此品項</button>}</section>)}
   <button type="button" disabled={rows.length>=100} onClick={()=>{setRows(current=>[...current,blank()]);changed();}}>新增回報品項</button><button type="submit">保存實際結果並對帳</button></fieldset>
  </form>
 </details>;
}
function SourceScan({source,disabled,scan}:{source:Source;disabled:boolean;scan:(body:unknown)=>Promise<boolean>}){
 const [sku,setSku]=useState(''),[serialNo,setSerialNo]=useState('');
 return <section><h3>{source.sku}</h3><p>需求 {source.quantity} 件 · 已核對 {source.serialNos.length} 件</p>
  <details><summary>查看已核對序號</summary>{source.serialNos.length?<ul>{source.serialNos.map(s=><li key={s}>{s}</li>)}</ul>:<p>尚無序號。</p>}</details>
  {!disabled&&<form onSubmit={async e=>{e.preventDefault();if(await scan({sourceReference:source.sourceReference,sku:sku.trim(),serialNo:serialNo.trim().toUpperCase()}))setSerialNo('');}}>
   <Field label="掃描商品代碼"><input required value={sku} onChange={e=>setSku(e.target.value)} autoComplete="off"/></Field>
   <Field label="掃描產品序號" hint="一個產品代碼、三位批號、四位序號"><input required pattern="[A-Ea-e][0-9]{7}" value={serialNo} onChange={e=>setSerialNo(e.target.value)} autoComplete="off"/></Field>
   <button type="submit">核對序號</button>
  </form>}
 </section>;
}
