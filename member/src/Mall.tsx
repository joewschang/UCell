import {useRef,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ErrorState,LoadingState,EmptyState} from '@ucell/design-system';
import type {Qualification} from './api';
import {useResource} from './useResource';
import {getFormalEnrollment,payStageCommerceOrder,getProducts,getDeliveryProfile,createConnectedOrder,createWebRetailOrder,getCommercialOffers,type CommercialOffer} from './memberData';
import QualificationPackageShop from './QualificationPackageShop';
import ActiveDurationPackages from './ActiveDurationPackages';
import DeliveryProfileEditor from './DeliveryProfileEditor';
export const mallCategories=['會員資格套組','重購方案套組','主商品','促銷商品套組'] as const;
export default function Mall({q,onCreated}:{q?:Qualification;onCreated:()=>void}){
 const [category,setCategory]=useState<string>(mallCategories[0]),navigate=useNavigate();
 async function qualificationCreated(){try{const state=await getFormalEnrollment();if(state.membershipState!=='FORMAL_MEMBER'){navigate('/membership/upgrade');return;}}catch{navigate('/membership/upgrade');return;}onCreated();}
 return <section><h1>商品商城</h1><div className="tabs" role="group" aria-label="商品分類">{mallCategories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
 {category==='會員資格套組'&&<QualificationPackageShop onCreated={qualificationCreated}/>}
 {category==='重購方案套組'&&(q?<ActiveDurationPackages q={q} onCreated={onCreated}/>:<section className="card"><h2>重購方案套組</h2><p>重購方案需指定本人會員資格。請先完成正式會員申請並取得會員資格，再選購重購方案。</p></section>)}
 {(category==='主商品'||category==='促銷商品套組')&&<OfferShop key={category+q?.id} q={q} type={category==='主商品'?'CORE_PRODUCT':'PROMOTIONAL_BUNDLE'}/>}
 </section>;
}
export function OfferShop({q,type}:{q?:Qualification;type:'CORE_PRODUCT'|'PROMOTIONAL_BUNDLE'}){
 const offers=useResource('mall-offers',getCommercialOffers),products=useResource('mall-products',getProducts),delivery=useResource('mall-delivery',getDeliveryProfile);
 const [selected,setSelected]=useState<CommercialOffer|null>(null),[quantities,setQuantities]=useState<Record<string,number>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<string|null>(null),[stagePaid,setStagePaid]=useState(false);
 const key=useRef(crypto.randomUUID()),flight=useRef(false);
 function choose(offer:CommercialOffer){setSelected(offer);setError('');setReceipt(null);setStagePaid(false);key.current=crypto.randomUUID();setQuantities(Object.fromEntries(offer.composition.map(x=>[x.sku,x.quantity])));}
 const allowed=selected?(selected.selectionRule?.eligibleSkus??selected.composition.map(x=>x.sku)):[];
 const pool=products.data?.filter(p=>p.sku&&allowed.includes(p.sku))??[],count=Object.values(quantities).reduce((a,b)=>a+b,0);
 const required=selected?.selectionRule?.requiredTotalQuantity;
 const fixed=selected?.composition.length!==0;
 const valid=!!selected&&count>0&&(required===undefined||count===required)&&pool.length===new Set(allowed).size&&pool.every(p=>p.available)&&Object.keys(quantities).every(sku=>allowed.includes(sku));
 async function submit(){if(flight.current||!valid||!selected||!delivery.data?.complete)return;flight.current=true;setBusy(true);setError('');try{const items=pool.filter(p=>(quantities[p.sku!]??0)>0).map(p=>({productId:p.id,quantity:String(quantities[p.sku!])}));const payment=await getFormalEnrollment();const order=q?await createConnectedOrder(q,items,key.current,selected.offeringCode):await createWebRetailOrder(items,key.current,undefined,selected.offeringCode);if(payment.stagePaymentEnabled)await payStageCommerceOrder(order.id,key.current);setStagePaid(payment.stagePaymentEnabled);setReceipt(order.orderNo??order.id);}catch(e){setError(e instanceof Error?e.message:'建立訂單失敗，請保留選擇後重試');}finally{flight.current=false;setBusy(false);}}
 if(offers.error||products.error||delivery.error)return <ErrorState message={offers.error||products.error||delivery.error!} retry={()=>{offers.retry();products.retry();delivery.retry();}}/>;
 if(!offers.data||!products.data||!delivery.data)return <LoadingState label="商品分類載入中…"/>;
 const available=offers.data.filter(o=>o.offeringType===type);
 return <section><h2>{type==='CORE_PRODUCT'?'主商品':'促銷商品套組'}</h2>{!available.length?<EmptyState title="目前沒有上架方案"/>:available.map(o=><article className="card" key={o.offeringCode}><h3>{o.displayName}</h3><p>{o.composition.length?'固定商品組合':`請選擇 ${o.selectionRule?.requiredTotalQuantity??1} 件商品`}</p><button disabled={busy} onClick={()=>choose(o)}>選擇商品細節</button></article>)}
 {selected&&<section className="card"><h3>{selected.displayName} · 商品細節</h3>{pool.map(p=><div key={p.id}><h4>{p.name}</h4><p>單價：NT$ {p.price} · {p.available?'可訂購':'暫不可訂購'}</p>{fixed?<p>數量：{quantities[p.sku!]??0}</p>:<label>數量<input type="number" min={0} max={99} value={quantities[p.sku!]??0} disabled={busy} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=99){setQuantities(v=>({...v,[p.sku!]:n}));key.current=crypto.randomUUID();setReceipt(null);}}}/></label>}</div>)}{required!==undefined&&<p>已選 {count}／{required} 件</p>}<DeliveryProfileEditor profile={delivery.data} refresh={delivery.retry}/><p>應付金額由伺服器確認；本頁不計算正式業績或獎金。</p><button disabled={busy||!valid||!delivery.data.complete||!!receipt} onClick={submit}>{busy?'處理中…':'確認商品細節並建立訂單'}</button>{receipt&&<p role="status">訂單已建立：{receipt}。{stagePaid?'Stage 付款已通過，不會實際扣款。':'待付款，實際狀態以訂單紀錄為準。'}</p>}{error&&<p role="alert">{error}</p>}</section>}</section>;
}
