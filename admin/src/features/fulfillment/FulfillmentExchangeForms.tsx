import {useEffect,useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ErrorBox,Field} from '../../components/ui';
import './fulfillment-exchanges.css';

export type ExchangeShipment={
 shipmentReference:string;status:string;
 serials:{serialNo:string;returned:boolean;exchangePending?:boolean}[];
};
export type FulfillmentExchange={
 exchangeReference:string;exchangeNo:string;
 status:'REQUESTED'|'RECEIVED'|'REPLACEMENT_CREATED'|'CANCELLED';
 reason:string;createdAt:string;receivedAt:string|null;replacementFulfillmentKey:string|null;
 replacementStatus?:string|null;
 items:{serialNo:string;sku:string;receivedAt:string|null}[];
};
type Submit=(body:unknown)=>Promise<boolean>;
export const fulfillmentAnchor=(key:string)=>`fulfillment-${key}`;
export const isDispatchedShipment=(status:string)=>['PICKED_UP','IN_TRANSIT','DELIVERED','DELIVERY_FAILED'].includes(status);
const exchangeStatuses:Record<FulfillmentExchange['status'],string>={
 REQUESTED:'待收回商品',RECEIVED:'已收齊，待建立補寄單',
 REPLACEMENT_CREATED:'已建立補寄單',CANCELLED:'已取消',
};
const replacementStatuses:Record<string,string>={READY:'待揀貨',ALLOCATED:'已配置',PICKING:'揀貨中',PICKED:'已揀貨',QC_PENDING:'待檢查',QC_PASSED:'檢查完成',PACKED:'已裝箱',SHIPPING_REQUESTED:'已提出出貨請求',SHIPPED:'已出貨',DELIVERED:'已送達',EXCEPTION:'待處理異常',CANCELLED:'已取消'};

/** Keep the request identity while retrying the same submitted content. */
export function ShipmentAfterSalesActions({shipment,orderNo,disabled,submit}:{
 shipment:ExchangeShipment;orderNo:string;disabled:boolean;submit:Submit;
}){
 const [open,setOpen]=useState(false),[selected,setSelected]=useState<string[]>([]),[reason,setReason]=useState('');
 const [error,setError]=useState<unknown>(null),[submitting,setSubmitting]=useState(false);
 const flight=useRef(false),attempt=useRef<{signature:string;requestKey:string}>();
 if(!isDispatchedShipment(shipment.status))return null;
 const eligible=shipment.serials.filter(s=>!s.returned&&!s.exchangePending);
 const eligibleNos=new Set(eligible.map(s=>s.serialNo));
 const hasStaleSelection=selected.some(serial=>!eligibleNos.has(serial));
 const locked=disabled||submitting;
 function toggle(serialNo:string,checked:boolean){
  setError(null);setSelected(current=>checked?[...current.filter(s=>s!==serialNo),serialNo]:current.filter(s=>s!==serialNo));
 }
 return <section className="after-sales-actions">
  <button type="button" disabled={locked} aria-expanded={open} onClick={()=>setOpen(value=>!value)}>退換貨</button>
  {open&&<>
   <h4>同品換貨補寄</h4>
   <p>選擇要退回的商品並填寫原因；收齊後建立補寄出貨單。同品換貨沿用原交易，不重複計獎。</p>
   <ErrorBox error={error}/>
   {hasStaleSelection&&<p role="alert">部分已選取商品的狀態已更新，請取消勾選後重新核對。</p>}
   {!eligible.length&&!selected.length?<p>此物流單目前沒有可申請同品換貨的商品，請查看下方退換貨紀錄。</p>:
    <form onSubmit={async event=>{
     event.preventDefault();
     if(locked||flight.current)return;
     if(!selected.length||selected.length>100||hasStaleSelection){setError(new Error('請選擇 1 至 100 件尚未退回、未申請換貨的商品。'));return;}
     if(!reason.trim()||reason.trim().length>500){setError(new Error('請填寫換貨原因，最多 500 字。'));return;}
     const serialNos=[...selected].sort(),trimmedReason=reason.trim();
     const signature=JSON.stringify([shipment.shipmentReference,serialNos,trimmedReason]);
     if(attempt.current?.signature!==signature)attempt.current={signature,requestKey:crypto.randomUUID()};
     flight.current=true;setSubmitting(true);setError(null);
     try{
      if(await submit({shipmentReference:shipment.shipmentReference,serialNos,reason:trimmedReason,requestKey:attempt.current.requestKey})){
       setSelected([]);setReason('');attempt.current=undefined;setOpen(false);
      }
     }catch(cause){setError(cause);}finally{flight.current=false;setSubmitting(false);}
    }}>
     <fieldset disabled={locked}>
      <legend>選擇退回商品（最多 100 件）</legend>
      {shipment.serials.map(serial=>{
       const checked=selected.includes(serial.serialNo),unavailable=!eligibleNos.has(serial.serialNo);
       return <label className="exchange-serial" key={serial.serialNo}>
        <input type="checkbox" aria-label={`換貨商品 ${serial.serialNo}`} checked={checked} disabled={unavailable&&!checked||!checked&&selected.length>=100}
         onChange={event=>toggle(serial.serialNo,event.target.checked)}/>
        {serial.serialNo}{serial.returned?' · 已退回':serial.exchangePending?' · 已申請換貨':''}
       </label>;
      })}
      <p>已選擇 {selected.length} 件</p>
      <Field label="換貨原因" hint="例如：商品瑕疵、運送破損。此流程更換相同商品。">
       <textarea required maxLength={500} value={reason} onChange={event=>{setReason(event.target.value);setError(null);}}/>
      </Field>
      <button type="submit" disabled={!selected.length||hasStaleSelection||!reason.trim()}>建立同品換貨申請</button>
     </fieldset>
    </form>}
   <h4>退貨退款／更換其他商品</h4>
   <p>退貨沿用原訂單的退貨流程。更換不同商品或有價差時，先辦理退貨，再重新下單；此處不自動計算或收付差額。</p>
   {!locked&&<Link to={`/returns?orderNo=${encodeURIComponent(orderNo)}`}>帶入原訂單辦理退貨</Link>}
  </>}
 </section>;
}

export function FulfillmentExchangeHistory({exchanges,canWrite,disabled,run}:{
 exchanges:FulfillmentExchange[];canWrite:boolean;disabled:boolean;
 run:(reference:string,action:'receive'|'replacement'|'cancel',body?:unknown)=>Promise<boolean>;
}){
 if(!exchanges.length)return null;
 return <section><h3>換貨處理紀錄</h3>{exchanges.map(exchange=><ExchangeCase key={exchange.exchangeReference}
  exchange={exchange} canWrite={canWrite} disabled={disabled} run={(action,body)=>run(exchange.exchangeReference,action,body)}/>)}</section>;
}

function ExchangeCase({exchange,canWrite,disabled,run}:{
 exchange:FulfillmentExchange;canWrite:boolean;disabled:boolean;
 run:(action:'receive'|'replacement'|'cancel',body?:unknown)=>Promise<boolean>;
}){
 const [selected,setSelected]=useState<string[]>([]),[confirmCancel,setConfirmCancel]=useState(false);
 const [error,setError]=useState<unknown>(null),[submitting,setSubmitting]=useState(false),flight=useRef(false);
 const received=exchange.items.filter(item=>item.receivedAt),pending=exchange.items.filter(item=>!item.receivedAt);
 const pendingSignature=pending.map(item=>item.serialNo).sort().join(',');
 useEffect(()=>{
  const currentPending=new Set(pendingSignature.split(',').filter(Boolean));
  setSelected(current=>current.filter(serial=>currentPending.has(serial)));
 },[pendingSignature]);
 const selectedPending=selected.filter(serial=>pending.some(item=>item.serialNo===serial));
 const locked=disabled||submitting||!canWrite;
 async function act(action:'receive'|'replacement'|'cancel',body?:unknown){
  if(locked||flight.current)return false;
  flight.current=true;setSubmitting(true);setError(null);
  try{return await run(action,body);}catch(cause){setError(cause);return false;}
  finally{flight.current=false;setSubmitting(false);}
 }
 return <section className="exchange-case">
  <h4>換貨單 {exchange.exchangeNo} · {exchangeStatuses[exchange.status]??'待確認'}</h4>
  <p>申請時間：{new Date(exchange.createdAt).toLocaleString('zh-TW')} · 原因：{exchange.reason}</p>
  <p>應退回 {exchange.items.length} 件／已驗收 {received.length} 件</p>
  <ul>{exchange.items.map(item=><li key={item.serialNo}>{item.sku} · {item.serialNo} · {item.receivedAt?`已驗收（${new Date(item.receivedAt).toLocaleString('zh-TW')}）`:exchange.status==='CANCELLED'?'已取消，無須退回':'尚未驗收'}</li>)}</ul>
  <ErrorBox error={error}/>
  {canWrite&&exchange.status==='REQUESTED'&&pending.length>0&&<form onSubmit={async event=>{
   event.preventDefault();if(locked)return;
   if(!selectedPending.length||selectedPending.length!==selected.length){setError(new Error('請重新勾選本次實際收到、尚未驗收的商品。'));return;}
   if(await act('receive',{serialNos:[...selectedPending].sort()}))setSelected([]);
  }}><fieldset disabled={locked}><legend>本次收到的退回商品</legend>
   <p>請逐件核對實物序號，再勾選驗收。退回商品保持待檢狀態。</p>
   {pending.map(item=><label className="exchange-serial" key={item.serialNo}>
    <input type="checkbox" aria-label={`驗收商品 ${item.serialNo}`} checked={selected.includes(item.serialNo)} onChange={event=>{
     const checked=event.target.checked;setSelected(current=>checked?[...current.filter(s=>s!==item.serialNo),item.serialNo]:current.filter(s=>s!==item.serialNo));setError(null);
    }}/>{item.sku} · {item.serialNo}
   </label>)}
   <button type="submit" disabled={!selectedPending.length||selectedPending.length!==selected.length}>驗收所選退回商品</button>
  </fieldset></form>}
  {canWrite&&exchange.status==='RECEIVED'&&exchange.items.length>0&&pending.length===0&&<button type="button" disabled={locked} onClick={()=>act('replacement',{})}>建立同品補寄出貨單</button>}
  {exchange.status==='REPLACEMENT_CREATED'&&exchange.replacementFulfillmentKey&&<p>
   <a href={`#${encodeURIComponent(fulfillmentAnchor(exchange.replacementFulfillmentKey))}`}>前往補寄出貨單 {exchange.replacementFulfillmentKey}</a>
   <span> · 補寄進度：{replacementStatuses[exchange.replacementStatus??'']??'待確認'}。</span>
   {!['SHIPPED','DELIVERED'].includes(exchange.replacementStatus??'')&&<span>請完成商品核對與物流出貨；建立補寄單不代表已寄出。</span>}
  </p>}
  {canWrite&&exchange.status==='REQUESTED'&&received.length===0&&(!confirmCancel?
   <button type="button" disabled={locked} onClick={()=>setConfirmCancel(true)}>取消換貨申請</button>:
   <div><p>取消後保留此次申請紀錄，商品可重新申請換貨。</p>
    <button type="button" disabled={locked} onClick={async()=>{if(await act('cancel',{}))setConfirmCancel(false);}}>確認取消此換貨申請</button>
    <button type="button" disabled={locked} onClick={()=>setConfirmCancel(false)}>繼續處理</button>
   </div>)}
 </section>;
}
