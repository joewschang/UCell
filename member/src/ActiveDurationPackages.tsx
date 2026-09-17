import {EmptyState,ErrorState,LoadingState} from '@ucell/design-system';
import {useState} from 'react';
import type {Qualification} from './api';
import {getActiveDurationPackages,type PackageOffer} from './memberData';
import {PackageSelection} from './QualificationPackageShop';
import {useResource} from './useResource';

export default function ActiveDurationPackages({q,onCreated}:{q:Qualification;onCreated:()=>void}){
 const packages=useResource(`active-duration-packages:${q.id}`,getActiveDurationPackages),[selected,setSelected]=useState<PackageOffer|null>(null);
 return <section><h2>資格有效期套組</h2><p>目標資格固定為目前選取的 {q.code} · {q.ballLabel}，不得以同一人的其他 Ball 替代。</p>{packages.error?<ErrorState message={packages.error} retry={packages.retry}/>:!packages.data?<LoadingState label="有效期套組載入中…"/>:!packages.data.length?<EmptyState title="目前沒有可購買的資格有效期套組"/>:packages.data.map(item=><article className="card" key={item.packageVersionId}><h3>{item.displayName}</h3><p>{item.currency} {item.priceAmount} · 選擇 {item.selectableProductQuantity} 件商品</p><button onClick={()=>setSelected(item)}>選擇有效期套組商品</button></article>)}{selected&&<PackageSelection offer={selected} targetQualificationId={q.id} onCancel={()=>setSelected(null)} onCreated={onCreated}/>}</section>;
}
