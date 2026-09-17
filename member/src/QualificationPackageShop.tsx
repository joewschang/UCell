import {EmptyState,ErrorState,LoadingState} from '@ucell/design-system';
import {useRef,useState} from 'react';
import DeliveryProfileEditor from './DeliveryProfileEditor';
import {createPackageOrder,getDeliveryProfile,getPackageProducts,getQualificationPackages,type PackageOffer} from './memberData';
import {useResource} from './useResource';

export default function QualificationPackageShop({onCreated}:{onCreated:()=>void}){
 const packages=useResource('qualification-packages',getQualificationPackages);
 const delivery=useResource('delivery-profile',getDeliveryProfile);
 const [selected,setSelected]=useState<PackageOffer|null>(null);
 return <><h2>取得第一個會員資格</h2><p>請選擇正式套組與商品。套組價格及訂單金額由 Core 提供，前台不計算 PV、BV 或正式認列。</p>
 {delivery.error?<ErrorState message={delivery.error} retry={delivery.retry}/>:!delivery.data?<LoadingState label="配送資料載入中…"/>:<DeliveryProfileEditor profile={delivery.data} refresh={delivery.retry}/>} {packages.error?<ErrorState message={packages.error} retry={packages.retry}/>:!packages.data?<LoadingState label="套組載入中…"/>:!packages.data.length?<EmptyState title="目前沒有可申請的正式會員套組"/>:packages.data.map(item=><article className="card" key={item.packageVersionId}><h3>{item.displayName}</h3><p>套組價格：{item.currency} {item.priceAmount}</p><p>需選擇 {item.selectableProductQuantity} 件商品</p><button disabled={!delivery.data?.complete} onClick={()=>setSelected(item)}>{delivery.data?.complete?'選擇套組商品':'請先完成配送資料'}</button></article>)}
 {selected&&<PackageSelection offer={selected} onCancel={()=>setSelected(null)} onCreated={onCreated}/>}</>;
}

export function PackageSelection({offer,onCancel,onCreated,targetQualificationId}:{offer:PackageOffer;onCancel:()=>void;onCreated:()=>void;targetQualificationId?:string}){
 const pool=useResource(`qualification-package:${offer.packageVersionId}`,signal=>getPackageProducts(offer.packageVersionId,signal));
 const [quantities,setQuantities]=useState<Record<string,number>>({}),[busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<{id:string;qualificationId:string;total:string}|null>(null);
 const pending=useRef<{body:string;key:string}|null>(null),flight=useRef(false);
 const count=Object.values(quantities).reduce((sum,value)=>sum+value,0);
 function change(id:string,next:number,min:number|null,max:number|null,increment:number){if(flight.current)return;const floor=min??0,ceiling=max??offer.selectableProductQuantity,current=quantities[id]??0;let value=next<=0||current>0&&next<floor?0:next;if(value>0&&value<floor)value=Math.ceil(floor/increment)*increment;if(value>ceiling||value%increment!==0)return;setQuantities(previous=>({...previous,[id]:value}));pending.current=null;setError('');setReceipt(null);}
 async function submit(){const selections=Object.entries(quantities).filter(([,quantity])=>quantity>0).sort(([a],[b])=>a.localeCompare(b)).map(([productRuleProfileId,quantity])=>({productRuleProfileId,quantity}));if(flight.current||count!==offer.selectableProductQuantity)return;const body=JSON.stringify({packageVersionId:offer.packageVersionId,targetQualificationId,selections});if(pending.current?.body!==body)pending.current={body,key:crypto.randomUUID()};flight.current=true;setBusy(true);setError('');try{const order=await createPackageOrder(offer.packageVersionId,selections,pending.current.key,targetQualificationId);setReceipt({id:order.id,qualificationId:order.qualificationId,total:order.total});pending.current=null;onCreated();}catch(e){setError(e instanceof Error?e.message:'建立套組訂單失敗，請保留選擇後重試');}finally{flight.current=false;setBusy(false);}}
 if(pool.error)return <section className="card"><ErrorState message={pool.error} retry={pool.retry}/><button onClick={onCancel}>返回套組清單</button></section>;
 if(!pool.data)return <LoadingState label="套組商品載入中…"/>;
 return <section className="card"><h3>{offer.displayName} · 商品選擇</h3><p>已選 {count}／{offer.selectableProductQuantity} 件</p>{pool.data.products.map(product=>{const quantity=quantities[product.productRuleProfileId]??0,increment=product.selectionIncrement;return <div className="cart-line" key={product.productRuleProfileId}><strong>{product.displayName}</strong><p>{product.available?'可選購':'目前不可選購'}</p><div className="quantity"><button disabled={busy||quantity<=0} onClick={()=>change(product.productRuleProfileId,quantity-increment,product.minQty,product.maxQty,increment)}>減少</button><output>{quantity}</output><button disabled={busy||!product.available||count+increment>offer.selectableProductQuantity||(product.maxQty!==null&&quantity+increment>product.maxQty)} onClick={()=>change(product.productRuleProfileId,quantity+increment,product.minQty,product.maxQty,increment)}>增加</button></div></div>;})}<p>應付金額將由伺服器建立訂單後確認；建立訂單不代表付款、資格生效或業績認列。</p><button disabled={busy||count!==offer.selectableProductQuantity} onClick={submit}>{busy?'建立中…':'建立待付款套組訂單'}</button><button disabled={busy} onClick={onCancel}>返回套組清單</button>{error&&<p role="alert">{error}</p>}{receipt&&<section role="status"><h3>待付款套組訂單已建立</h3><p>{receipt.id} · NT$ {receipt.total}</p><p>{targetQualificationId?'目標資格':'新資格'}識別碼：{receipt.qualificationId}</p></section>}</section>;
}
