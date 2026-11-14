import {useEffect,useState} from 'react';
import type {PackageOffer} from '../memberData';
import {getPackageProducts,getPackageQuote} from '../memberData';
import {useResource} from '../useResource';
import {emptyPackage,money,packageLabel,quantityStep,quantityTotal,type PackageDraft} from './model';

export default function PackageEditor({title,offers,choice,change,optional=false,fixed=false}:{title:string;offers:PackageOffer[];
  choice:PackageDraft|undefined;change:(value:PackageDraft|undefined)=>void;optional?:boolean;fixed?:boolean}) {
  const offer=offers.find(item=>item.packageVersionId===choice?.version);
  return <section className="eb-package">
    {fixed&&offer?<div className="eb-fixed-offer"><small>{title}</small><strong>{packageLabel(offer.displayName,offer.packageCode)}</strong></div>:<label className="eb-label">{title}
      <select aria-label={title} value={choice?.version??''} onChange={event=>{
        const next=offers.find(item=>item.packageVersionId===event.target.value);
        change(next?emptyPackage(next.packageVersionId,packageLabel(next.displayName,next.packageCode)):optional?undefined:emptyPackage());
      }}>
        <option value="">{optional?'本球不加購重銷':'請選擇資格套組'}</option>
        {offers.map(item=><option key={item.packageVersionId} value={item.packageVersionId}>{packageLabel(item.displayName,item.packageCode)} · NT$ {money(item.priceAmount)}</option>)}
      </select>
    </label>}
    {choice&&offer&&<PackageItems key={offer.packageVersionId} offer={offer} choice={choice} update={change}/>}
  </section>;
}
function PackageItems({offer,choice,update}:{offer:PackageOffer;choice:PackageDraft;update:(p:PackageDraft)=>void}) {
  const [applied,setApplied]=useState(choice.quotedCoupon);
  const pool=useResource('bundle-products:'+offer.packageVersionId,signal=>getPackageProducts(offer.packageVersionId,signal));
  const pricing=useResource('bundle-price:'+offer.packageVersionId+':'+applied,()=>getPackageQuote(offer.packageVersionId,applied||undefined));
  useEffect(()=>{
    if(pool.data&&pricing.data){
      update({...choice,quote:pricing.data,quotedCoupon:applied,products:pool.data.products});
    }
  },[pool.data,pricing.data,applied]);
  const coupon=choice.coupon.trim().toUpperCase();
  const required=pricing.data?.selectableProductQuantity;
  function applyCoupon() {
    update({...choice,quote:undefined});
    if(applied===coupon) pricing.retry();
    else setApplied(coupon);
  }
  return <>
    {offer.packageClass==='QUALIFICATION'&&<details className="eb-coupon" open={coupon?true:undefined}>
      <summary>使用優惠碼</summary>
      <div className="eb-inline"><label>優惠碼<input value={choice.coupon} maxLength={40} autoCapitalize="characters" onChange={e=>update({...choice,coupon:e.target.value.toUpperCase()})}/></label>
      <button type="button" onClick={applyCoupon}>套用</button></div>
      {choice.quote?.couponCode&&<p>已套用 {choice.quote.couponCode}。清空後再按「套用」即可取消。</p>}
    </details>}
    {pool.error||pricing.error?<div role="alert"><p>{pool.error||pricing.error}</p><button type="button" onClick={()=>{pool.retry();pricing.retry();}}>重新取得套組資料</button></div>
      :!pool.data||!pricing.data?<p role="status">正在取得商品與報價…</p>:<>
      <div className="eb-price"><span>套組 {money(pricing.data.goodsAmount)} 元</span>
        {offer.packageClass==='QUALIFICATION'&&<span>建立費 {money(pricing.data.qualificationFee)} 元</span>}
        <strong>NT$ {money(pricing.data.total)}</strong></div>
      {coupon!==applied&&<p role="status">優惠碼已修改，請按「套用」更新報價。</p>}
      <p className="eb-qty-head" aria-live="polite">{required===0?'此套組不含自選商品':'已選 '+quantityTotal(choice)+'／'+required+' 盒'}</p>
      {required!==0&&pool.data.products.filter(p=>p.available||choice.quantities[p.productRuleProfileId]>0).map(product=>{
        const id=product.productRuleProfileId,quantity=choice.quantities[id]??0;
        const step=(n:1|-1)=>quantityStep({...choice,quote:pricing.data},product,n);
        return <div key={id} className="eb-product"><span>{product.displayName}</span><div className="eb-counter">
          <button type="button" disabled={quantity===0} aria-label={'減少'+product.displayName} onClick={()=>update({...choice,quantities:{...choice.quantities,[id]:step(-1)}})}>-</button>
          <output aria-label={product.displayName+'盒數'}>{quantity}</output>
          <button type="button" disabled={step(1)===quantity} aria-label={'增加'+product.displayName} onClick={()=>update({...choice,quantities:{...choice.quantities,[id]:step(1)}})}>+</button>
        </div></div>;
      })}
    </>}
  </>;
}
