import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {Link,useSearchParams} from 'react-router-dom';
import {useAuth} from '../auth/auth';
import {command,get,ApiError} from '../../lib/api';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
type Source={sourceReference:string;sku:string;quantity:string;serialNos:string[]};
type Fulfillment={fulfillmentKey:string;status:string;sources:Source[];packVerification:null|{status:string;occurredAt:string};erpHandoff:null|{providerCode:string;requestedAt:string}};
type Order={orderNo:string;status:string;fulfillments:Fulfillment[]};
const statuses:Record<string,string>={READY:'待揀貨',ALLOCATED:'已配置',PICKING:'揀貨中',PICKED:'已揀貨',QC_PENDING:'待檢查',QC_PASSED:'檢查完成',PACKED:'已裝箱',SHIPPING_REQUESTED:'已提出出貨請求',SHIPPED:'已出貨',DELIVERED:'已送達',EXCEPTION:'待處理異常',CANCELLED:'已取消'};
const errors:Record<string,string>={SERIAL_NOT_FOUND:'查無此序號，請核對標籤。',SERIAL_SKU_MISMATCH:'商品或序號不符合這筆出貨明細。',SERIAL_ALREADY_SHIPPED:'此序號已出貨，不能再次配置。',SERIAL_ALREADY_ALLOCATED:'此序號已配置給其他出貨單。',SERIAL_BATCH_INELIGIBLE:'此批次已停用或過期，請改用合格產品。',SERIAL_NOT_AVAILABLE:'此序號目前不可出貨。',FULFILLMENT_SOURCE_QUANTITY_EXCEEDED:'掃描數量已達需求，請勿再加入產品。',FULFILLMENT_SERIAL_SCAN_INCOMPLETE:'尚未完成全部序號核對，請檢查各品項數量。',SERIAL_PACK_UNIT_INELIGIBLE:'部分序號已不符合出貨資格，請交由主管處理。'};
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
  try{await command(`/admin/fulfillment/orders/${encodeURIComponent(orderNo)}${key?'/'+encodeURIComponent(key):''}/${action}`,body);await query.refetch();setNotice(action==='prepare'?'出貨配置已建立。':action==='scans'?'序號已核對。':action==='pack-verification'?'裝箱驗證完成。':'交付請求已保存，等待 ERP 處理與對帳。');return true;}
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
   {canWrite&&<div className="actions"><button disabled={busy||query.isFetching||!!f.packVerification||!!f.erpHandoff} onClick={()=>run(f.fulfillmentKey,'pack-verification')}>確認裝箱</button><button disabled={busy||query.isFetching||!f.packVerification||!!f.erpHandoff} onClick={()=>run(f.fulfillmentKey,'erp-handoff')}>建立 ERP 交付請求</button></div>}
   {f.erpHandoff&&<p>ERP 交付請求已保存；實際出貨仍待處理與對帳。</p>}
  </Card>)}
 </>;
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
