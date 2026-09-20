import {MemberPageHeader} from './MemberPageHeader';
import {ErrorState,EmptyState,LoadingState} from '@ucell/design-system';
import {useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import type {Qualification} from './api';
import {getProducts,createConnectedOrder,getConnectedOrder,getDeliveryProfile,type ConnectedOrder} from './memberData';
import {useResource} from './useResource';
import DeliveryProfileEditor from './DeliveryProfileEditor';
import ActiveDurationPackages from './ActiveDurationPackages';
export function ConnectedOrderDetails({q,id}:{q:Qualification;id:string}){
 const state=useResource(`order:${q.id}:${id}`,s=>getConnectedOrder(q,id,s));
 if(state.error)return <ErrorState message={state.error} retry={state.retry}/>;
 if(!state.data)return <LoadingState label="訂單載入中…"/>;
 const order=state.data;
 return <section className="card"><h3>訂單明細 · {q.code}</h3><p>{order.status}</p><p>伺服器商品金額：NT$ {order.total}</p>{order.lines.map((line,index)=><p key={index}>{line.name} × {line.quantity} · NT$ {line.amount}</p>)}<p>付款與配送依後端紀錄，建立訂單不代表付款成功或已出貨。</p></section>;
}
export default function ConnectedShop({q}:{q:Qualification}){
 const catalog=useResource('connected-products',getProducts);
 const delivery=useResource('delivery-profile',getDeliveryProfile);
 const [cart,setCart]=useState<Record<string,number>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<ConnectedOrder|null>(null),[checkout,setCheckout]=useState(false),[editingDelivery,setEditingDelivery]=useState(false),[notice,setNotice]=useState('');
 const flight=useRef(false),pending=useRef<{body:string;key:string}|null>(null);
 function change(id:string,n:number){if(flight.current)return;setCart(previous=>{const next={...previous};if(n<=0)delete next[id];else next[id]=Math.min(n,99);return next;});pending.current=null;setReceipt(null);setError('');}
 function add(id:string,name:string){const quantity=(cart[id]??0)+1;change(id,quantity);setNotice(`已加入購物車：${name}，目前 ${quantity} 件`);}
 async function submit(){
  if(flight.current||!Object.keys(cart).length)return;
  const items=Object.entries(cart).sort(([a],[b])=>a.localeCompare(b)).map(([productId,n])=>({productId,quantity:String(n)}));
  const body=JSON.stringify({qualificationId:q.id,items});if(pending.current?.body!==body)pending.current={body,key:crypto.randomUUID()};
  flight.current=true;setBusy(true);setError('');
  try{const order=await createConnectedOrder(q,items,pending.current.key);setReceipt(order);setCart({});setCheckout(false);pending.current=null;}
  catch(e){setError(e instanceof Error?e.message:'建立訂單失敗，請保留資料重試');}
  finally{flight.current=false;setBusy(false);}
 }
 const availableProducts=catalog.data?.filter(product=>product.available)??[];
 const cartCount=Object.values(cart).reduce((total,quantity)=>total+quantity,0);
 const deliverySummary=delivery.data&&<section className="card"><h3>配送資料</h3><p>{delivery.data.recipientName} · {delivery.data.phone}</p><p>{[delivery.data.postalCode,delivery.data.region,delivery.data.city,delivery.data.address].filter(Boolean).join(' ')}</p><p>結帳將使用此已儲存的配送資料。</p><button type="button" disabled={busy} onClick={()=>setEditingDelivery(true)}>修改配送資料</button></section>;
 return <><MemberPageHeader title="商品商城" q={q}/><p>目前資格：{q.code} · {q.ballLabel}</p><p>商品價格由 Core 確認。訂單成立後待付款；PV 尚未認列，配送與庫存另待確認。</p><p role="status" aria-live="polite">{notice}</p>{catalog.error?<section><ErrorState message={catalog.error}/><button onClick={catalog.retry}>重新載入商品</button></section>:!catalog.data?<LoadingState label="商品載入中…"/>:!availableProducts.length?<EmptyState title="目前沒有可訂購商品"/>:availableProducts.map(p=><article className="card" key={p.id}><h3>{p.name}</h3><p>{p.price===null?'價格待確認':`NT$ ${p.price.toLocaleString('zh-TW')}`} · PV 待認列</p><button disabled={busy||(cart[p.id]??0)>=99} onClick={()=>add(p.id,p.name)}>加入購物車</button></article>)}<section className="card" id="checkout"><h3>購物車 · {cartCount} 件</h3>{Object.keys(cart).length?Object.entries(cart).map(([id,n])=><p key={id}>{catalog.data?.find(p=>p.id===id)?.name??'商品'} × {n} <button disabled={busy} onClick={()=>change(id,n-1)}>減少</button><button disabled={busy} onClick={()=>change(id,0)}>移除</button></p>):<p>購物車尚無商品</p>}<p>應付商品金額由伺服器建立訂單後提供，前台不計算正式金額或 PV。</p>{!checkout?<button type="button" disabled={busy||!cartCount} onClick={()=>{setCheckout(true);setNotice('已進入結帳，請確認配送資料');}}>前往結帳</button>:delivery.error?<section><ErrorState message={delivery.error}/><button onClick={delivery.retry}>重新載入配送資料</button></section>:!delivery.data?<LoadingState label="配送資料載入中…"/>:editingDelivery||!delivery.data.complete?<DeliveryProfileEditor profile={delivery.data} refresh={delivery.retry} onSaved={()=>{setEditingDelivery(false);setNotice('配送資料已儲存，請確認後建立訂單');}}/>:<><h3>結帳確認</h3>{deliverySummary}<button disabled={busy||!cartCount} onClick={submit}>{busy?'建立中…':'使用此配送資料建立待付款訂單'}</button></>}{error&&<p role="alert">{error}</p>}</section>{receipt&&<><section role="status" className="card"><h3>待付款訂單已建立</h3><p>NT$ {receipt.total}</p></section><ConnectedOrderDetails q={q} id={receipt.id}/></>}<ActiveDurationPackages q={q} onCreated={()=>{setReceipt(null)}}/><Link to="/orders">查看我的訂單 →</Link></>;
}
