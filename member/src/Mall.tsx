import ReferralShare from './ReferralShare';
import {uiText} from "../../shared/design-system/i18n";
import {useEffect,useRef,useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {ErrorState,LoadingState,EmptyState} from '@ucell/design-system';
import type {Qualification} from './api';
import {useResource} from './useResource';
import {getFormalEnrollment,payStageCommerceOrder,getProducts,getDeliveryProfile,createConnectedOrder,createWebRetailOrder,getCommercialOffers,type CommercialOffer} from './memberData';
import QualificationPackageShop from './QualificationPackageShop';
import ActiveDurationPackages from './ActiveDurationPackages';
import DeliveryProfileEditor from './DeliveryProfileEditor';
export const mallCategories=['會員資格套組','重購方案套組','主商品','促銷商品套組'] as const;
export default function Mall({q,onCreated}:{q?:Qualification;onCreated:()=>void}){
 const [search]=useSearchParams(),rawSku=search.get('sku');
 const requestedSku=rawSku&&/^TIP-\d{3}$/.test(rawSku)?rawSku:undefined;
 const [category,setCategory]=useState<string>(requestedSku?'主商品':mallCategories[0]),navigate=useNavigate();
 useEffect(()=>{if(requestedSku)setCategory('主商品')},[requestedSku]);
 async function qualificationCreated(){try{const state=await getFormalEnrollment();if(state.membershipState!=='FORMAL_MEMBER'){navigate('/membership/upgrade');return;}}catch{navigate('/membership/upgrade');return;}onCreated();}
 return <section><h1>商品商城</h1><div className="tabs" role="group" aria-label="商品分類">{mallCategories.map(c=><button key={c} aria-pressed={category===c} onClick={()=>setCategory(c)}>{c}</button>)}</div>
 {category==='會員資格套組'&&<QualificationPackageShop onCreated={qualificationCreated}/>}
 {category==='重購方案套組'&&(q?<ActiveDurationPackages q={q} onCreated={onCreated}/>:<section className="card"><h2>重購方案套組</h2><p>重購方案需指定本人會員資格。請先完成正式會員申請並取得會員資格，再選購重購方案。</p></section>)}
 {(category==='主商品'||category==='促銷商品套組')&&<OfferShop key={category+q?.id+requestedSku} q={q} requestedSku={category==='主商品'?requestedSku:undefined} type={category==='主商品'?'CORE_PRODUCT':'PROMOTIONAL_BUNDLE'}/>}
 </section>;
}
export function OfferShop({q,type,requestedSku}:{q?:Qualification;type:'CORE_PRODUCT'|'PROMOTIONAL_BUNDLE';requestedSku?:string}){
 const offers=useResource('mall-offers',getCommercialOffers),products=useResource('mall-products',getProducts),delivery=useResource('mall-delivery',getDeliveryProfile);
 const [selected,setSelected]=useState<CommercialOffer|null>(null),[quantities,setQuantities]=useState<Record<string,number>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<string|null>(null),[stagePaid,setStagePaid]=useState(false);
 const key=useRef(crypto.randomUUID()),flight=useRef(false);
 function choose(offer:CommercialOffer){setSelected(offer);setError('');setReceipt(null);setStagePaid(false);key.current=crypto.randomUUID();setQuantities(Object.fromEntries(offer.composition.map(x=>[x.sku,x.quantity])));}
 const initialized=useRef(false);
 useEffect(()=>{
  if(!requestedSku||!offers.data||!products.data||initialized.current)return;
  initialized.current=true;
  const matching=offers.data.filter(o=>o.offeringType===type&&o.composition.length===1&&o.composition[0].sku===requestedSku);
  const product=products.data.find(p=>p.sku===requestedSku);
  if(matching.length===1&&product?.available)choose(matching[0]);
  else setError(matching.length>1?'此商品有多個購買方案，請在下方選擇。':'您選擇的商品目前無法直接訂購，請查看其他上架商品。');
 },[requestedSku,offers.data,products.data,type]);
 const allowed=selected?(selected.selectionRule?.eligibleSkus??selected.composition.map(x=>x.sku)):[];
 const pool=products.data?.filter(p=>p.sku&&allowed.includes(p.sku))??[],count=Object.values(quantities).reduce((a,b)=>a+b,0);
 const required=selected?.selectionRule?.requiredTotalQuantity;
 const fixed=selected?.composition.length!==0;
 const valid=!!selected&&count>0&&(required===undefined||count===required)&&pool.length===new Set(allowed).size&&pool.every(p=>p.available)&&Object.keys(quantities).every(sku=>allowed.includes(sku));
 async function submit(){if(flight.current||!valid||!selected||!delivery.data?.complete)return;flight.current=true;setBusy(true);setError('');try{const items=pool.filter(p=>(quantities[p.sku!]??0)>0).map(p=>({productId:p.id,quantity:String(quantities[p.sku!])}));const payment=await getFormalEnrollment();const order=q?await createConnectedOrder(q,items,key.current,selected.offeringCode):await createWebRetailOrder(items,key.current,undefined,selected.offeringCode);if(payment.stagePaymentEnabled)await payStageCommerceOrder(order.id,key.current);setStagePaid(payment.stagePaymentEnabled);setReceipt(order.orderNo??order.id);}catch(e){setError(e instanceof Error?e.message:'建立訂單失敗，請保留選擇後重試');}finally{flight.current=false;setBusy(false);}}
 if(offers.error||products.error||delivery.error)return <ErrorState message={offers.error||products.error||delivery.error!} retry={()=>{offers.retry();products.retry();delivery.retry();}}/>;
 if(!offers.data||!products.data||!delivery.data)return <LoadingState label="商品分類載入中…"/>;
 const available=offers.data.filter(o=>o.offeringType===type);
 return <section className="mall-product-flow">{requestedSku&&<div className="mall-intent"><span>您正在查看的商品</span><strong>{products.data.find(p=>p.sku===requestedSku)?.name??requestedSku}</strong><p>請確認商品、數量與配送資料，再建立訂單。</p></div>}{error&&!selected&&<p role="alert">{error}</p>}<h2>{type==='CORE_PRODUCT'?'主商品':'促銷商品套組'}</h2> {selected&&<section className="card mall-selected-detail" aria-label="已選商品細節"><h3>{selected.displayName} · 商品細節</h3>{selected.priceLabel&&<p>{selected.priceLabel}</p>}{pool.map(p=><div key={p.id}><h4>{p.name}</h4><p>{uiText("單價：NT$ ")}{p.price} · {p.available?'可訂購':'暫不可訂購'}</p>{fixed?<p>數量：{quantities[p.sku!]??0}</p>:<label>數量<input type="number" min={0} max={99} value={quantities[p.sku!]??0} disabled={busy} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=0&&n<=99){setQuantities(v=>({...v,[p.sku!]:n}));key.current=crypto.randomUUID();setReceipt(null);}}}/></label>}</div>)}{type==='CORE_PRODUCT'&&q&&pool.filter(p=>p.sku&&/^TIP-\d{3}$/.test(p.sku)).map(p=><ReferralShare key={p.sku} q={q} productSku={p.sku} title={p.name}/>)}{required!==undefined&&<p>已選 {count}／{required} 件</p>}<DeliveryProfileEditor profile={delivery.data} refresh={delivery.retry}/><p>應付金額以訂單確認結果為準。</p><button disabled={busy||!valid||!delivery.data.complete||!!receipt} onClick={submit}>{busy?'處理中…':'確認商品細節並建立訂單'}</button>{receipt&&<p role="status">訂單已建立：{receipt}。{stagePaid?uiText("Stage 付款已通過，不會實際扣款。"):'待付款，實際狀態以訂單紀錄為準。'}</p>}{error&&<p role="alert">{error}</p>}</section>}
{!available.length?<EmptyState title="目前沒有上架方案"/>:<div className="mall-offer-grid">{available.map(o=><article className="card" key={o.offeringCode}><h3>{o.displayName}</h3>{o.coverImage&&<img src={o.coverImage} alt={o.displayName+" 商品封面"} loading="lazy" className="mall-product-cover"/>}{o.packaging&&<p>{o.packaging}</p>}{o.priceLabel&&<p>{o.priceLabel}</p>}<p>{o.composition.length?'固定商品組合':`請選擇 ${o.selectionRule?.requiredTotalQuantity??1} 件商品`}</p><button disabled={busy} onClick={()=>choose(o)}>選擇商品細節</button></article>)}</div>}
</section>;
}
