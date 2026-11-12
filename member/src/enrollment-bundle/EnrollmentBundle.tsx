import {useRef,useState} from 'react';
import {getActiveDurationPackages,getDeliveryProfile,getQualificationPackages} from '../memberData';
import {pendingSponsorCandidate} from '../liff';
import DeliveryProfileEditor from '../DeliveryProfileEditor';
import {useResource} from '../useResource';
import {createBundle,getBundle,bundleError,type BundleReceipt} from './api';
import {asOrder,completeBall,copyBall,emptyBall,emptyPackage,MAX_BUNDLE_BALLS,money,parentPosition,placementLabel,readBallCount,sumAmounts,type BallDraft,type BundleRequest,type PackageDraft} from './model';
import PackageEditor from './PackageEditor';
import {useSponsor,sponsorDescription} from './SponsorField';
import {ReceiptDetails} from './BundleProgress';
import './bundle.css';

const steps=['球數與預排','逐球選購','確認訂單'];
function TreePreview({count}:{count:number}) {
  const levels=Array.from({length:Math.floor(Math.log2(count))+1},(_,i)=>{
    const start=2**i, length=Math.min(start,count-start+1);
    return Array.from({length},(_,offset)=>start+offset);
  });
  return <figure className="eb-tree"><figcaption>二元樹預排與內部推薦</figcaption>
    <p>先由上往下，每層由左至右排列。自第 2 球起，上一層的父球也是這顆球的推薦球。</p>
    <div className="eb-tree-levels">{levels.map((level,index)=><div key={index} className="eb-tree-level">
      <span>第 {index+1} 層</span><ul>{level.map(n=><li key={n}><strong>第 {n} 球</strong><small>{n===1?'對外連接':placementLabel(n)}</small></li>)}</ul>
    </div>)}</div></figure>;
}
function packageText(p:PackageDraft) {
  return (p.products??[]).filter(item=>p.quantities[item.productRuleProfileId]>0)
    .map(item=>item.displayName+' × '+p.quantities[item.productRuleProfileId]).join('、')||'無自選商品';
}
function ReviewItem({ball,index,edit}:{ball:BallDraft;index:number;edit:()=>void}) {
  return <article className="eb-review-item"><div className="eb-review-top"><div><strong>第 {index+1} 球</strong><small>{placementLabel(index+1)}</small></div>
    <button type="button" className="eb-link" onClick={edit}>修改第 {index+1} 球</button></div>
    {[ball.qualification,ball.repurchase].map((p,i)=>p&&<div key={i} className="eb-review-package">
      <div><span>{p.name}</span><strong>NT$ {money(p.quote!.total)}</strong></div>
      <small>{packageText(p)}</small>{!i&&<small>含資格建立費 NT$ {money(p.quote!.qualificationFee)}</small>}
      {p.quote?.couponCode&&<small>已套用 {p.quote.couponCode}</small>}
    </div>)}
  </article>;
}
export default function EnrollmentBundle({applicationId,onClose,onCreated}:{applicationId:string;onClose:()=>void;onCreated?:(receipt:BundleReceipt)=>void}) {
  const [step,setStep]=useState(0),[countInput,setCountInput]=useState('2'),[active,setActive]=useState(0);
  const [drafts,setDrafts]=useState<BallDraft[]>(()=>[emptyBall(),emptyBall()]);
  const [sponsor,setSponsor]=useState(()=>pendingSponsorCandidate()??'');
  const [deliveryMethod,setDeliveryMethod]=useState<'DELIVERY'|'COMPANY_PICKUP'>('DELIVERY');
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[receipt,setReceipt]=useState<BundleReceipt|null>(null);
  const [uncertain,setUncertain]=useState(false);
  const sessionKey=useRef<{payload:string;key:string}|null>(null),flight=useRef(false);
  const heading=useRef<HTMLHeadingElement>(null);
  const qualificationOffers=useResource('bundle-qualification-offers',getQualificationPackages,step===1);
  const repurchaseOffers=useResource('bundle-repurchase-offers',getActiveDurationPackages,step===1);
  const delivery=useResource('bundle-delivery',getDeliveryProfile,step===2&&deliveryMethod==='DELIVERY');
  const candidate=useSponsor(applicationId,sponsor);
  const count=readBallCount(countInput);
  const visible=drafts.slice(0,count??0),ball=drafts[active];
  const allReady=!!count&&visible.length===count&&visible.every(completeBall);
  const blankBalls=visible.filter((b,i)=>i!==active&&!b.qualification.version&&!b.repurchase).length;
  const hasProducts=visible.some(b=>[b.qualification,b.repurchase].some(p=>(p?.quote?.selectableProductQuantity??0)>0));
  const canSubmit=allReady&&(!sponsor||!!candidate.data)&&(!hasProducts||deliveryMethod==='COMPANY_PICKUP'||!!delivery.data?.complete);
  function go(next:number,index=active) {
    setError('');setStep(next);setActive(index);
    requestAnimationFrame(()=>heading.current?.focus());
  }
  function chooseCount() {
    if(!count) return;
    setDrafts(rows=>rows.length>=count?rows:[...rows,...Array.from({length:count-rows.length},emptyBall)]);
    go(1,Math.min(active,count-1));
  }
  function setPackage(which:'qualification'|'repurchase',p?:PackageDraft) {
    setDrafts(rows=>rows.map((item,i)=>i!==active?item:which==='qualification'?{...item,qualification:p??emptyPackage()}:{...item,repurchase:p}));
  }
  function accept(result:BundleReceipt) {
    setReceipt(result);setUncertain(false);setError('');onCreated?.(result);
  }
  async function checkProgress() {
    if(flight.current)return;
    flight.current=true;setBusy(true);setError('');
    try {
      const previous=await getBundle(applicationId);
      if(previous)accept(previous);
      else {setUncertain(false);setError('尚未找到已建立的整組訂單。您可以保留原選擇再送一次。');}
    }catch(e){setError(bundleError(e));}finally{setBusy(false);flight.current=false;}
  }
  async function submit() {
    if(flight.current||!canSubmit||receipt)return;
    const payload:BundleRequest={...(sponsor&&candidate.data?{sponsorCode:candidate.data.ballNo}:{}),...(hasProducts?{fulfillmentMethod:deliveryMethod}:{}),
      ...(hasProducts&&deliveryMethod==='DELIVERY'&&delivery.data?.updatedAt?{deliveryUpdatedAt:delivery.data.updatedAt}:{}),
      balls:visible.map(b=>({qualification:asOrder(b.qualification),...(b.repurchase?{repurchase:asOrder(b.repurchase)}:{})}))};
    const content=JSON.stringify(payload);
    if(!sessionKey.current||sessionKey.current.payload!==content)sessionKey.current={payload:content,key:crypto.randomUUID()};
    flight.current=true;setBusy(true);setError('');
    try {accept(await createBundle(applicationId,payload,sessionKey.current.key));}
    catch(e){
      try {const previous=await getBundle(applicationId);if(previous){accept(previous);return;}}
      catch {setUncertain(true);}
      setError(bundleError(e));
    }finally{setBusy(false);flight.current=false;}
  }
  if(receipt)return <section className="eb eb-progress"><h2>多球訂單已建立</h2><ReceiptDetails receipt={receipt}/><button type="button" onClick={onClose}>返回申請</button></section>;
  const errorBox=(message:string,retry:()=>void)=><div role="alert"><p>{message}</p><button type="button" onClick={retry}>重新載入</button></div>;
  return <section className="eb" aria-label="一次申購多顆球"><div className="eb-title"><div><h2 tabIndex={-1} ref={heading}>一次申購多顆球</h2>
    <p>同一份申請，為每顆球選擇資格與重銷套組。</p></div>
    <button type="button" disabled={busy||uncertain} className="eb-link" onClick={onClose}>返回申請</button></div>
    <ol className="eb-steps" aria-label="多球購買步驟">{steps.map((title,i)=><li key={title} aria-current={i===step?'step':undefined}><span>{i+1}</span>{title}</li>)}</ol>
    <fieldset className="eb-body" disabled={busy||uncertain}>
    {step===0&&<>
      <div className="eb-origin"><label className="eb-label">本次資格球數<input inputMode="numeric" type="number" min="2" max={MAX_BUNDLE_BALLS} step="1" value={countInput} onChange={e=>setCountInput(e.target.value)}/></label>
      <label className="eb-label">第 1 球推薦球號（選填）<input value={sponsor} maxLength={40} autoCapitalize="characters" placeholder="填入推薦人的球號" onChange={e=>setSponsor(e.target.value.trim().toUpperCase())}/></label></div>
      {!count&&<p role="alert">本次申購可輸入 2 至 {MAX_BUNDLE_BALLS} 顆球。</p>}
      {sponsor&&(candidate.error?<p role="alert">{candidate.error}</p>:candidate.data?<p role="status">推薦球已核對　{sponsorDescription(candidate.data)}</p>:<p role="status">請輸入完整的有效推薦球號。</p>)}
      {!sponsor&&<p className="eb-note">第 1 球的推薦球號可於建立訂單後補填，由後台在收款前核對。組內位置會在實際安置時確認。</p>}
      {count&&<TreePreview count={count}/>}
      <button type="button" className="eb-primary" disabled={!count||!!sponsor&&!candidate.data} onClick={chooseCount}>下一步，逐球選購</button>
    </>}
    {step===1&&count&&ball&&<>
      <label className="eb-label">正在設定<select aria-label="正在設定的球" value={active} onChange={e=>setActive(Number(e.target.value))}>{visible.map((b,i)=><option key={i} value={i}>第 {i+1} 球 · {placementLabel(i+1)}{completeBall(b)?' · 已選齊':''}</option>)}</select></label>
      {active>0&&completeBall(visible[active-1])&&<button type="button" className="eb-link" onClick={()=>setDrafts(rows=>rows.map((item,i)=>i===active?copyBall(rows[i-1]):item))}>套用上一球的套組與商品</button>}
      <p className="eb-note">{parentPosition(active+1)?'內部推薦球與二元上線皆為第 '+parentPosition(active+1)+' 球。':'第 1 球連接組外推薦人。'}</p>
      {qualificationOffers.error?errorBox(qualificationOffers.error,qualificationOffers.retry):qualificationOffers.data?
        <PackageEditor key={'q'+active} title="會員資格套組" choice={ball.qualification} offers={qualificationOffers.data} change={p=>setPackage('qualification',p)}/>:<p role="status">正在載入資格套組…</p>}
      {repurchaseOffers.error?errorBox(repurchaseOffers.error,repurchaseOffers.retry):repurchaseOffers.data?
        <PackageEditor key={'r'+active} optional title={'第 '+(active+1)+' 球的重銷套組（選購）'} choice={ball.repurchase} offers={repurchaseOffers.data} change={p=>setPackage('repurchase',p)}/>:<p role="status">正在載入重銷套組…</p>}
      {!!blankBalls&&completeBall(ball)&&<button type="button" className="eb-link" onClick={()=>setDrafts(rows=>rows.map((item,i)=>i<count&&i!==active&&!item.qualification.version&&!item.repurchase?copyBall(ball):item))}>將本球套組與商品套用到其餘 {blankBalls} 顆空白球</button>}
      <div className="eb-actions"><button type="button" onClick={()=>active?go(1,active-1):go(0)}>上一步</button>
        <button type="button" className="eb-primary" disabled={!completeBall(ball)} onClick={()=>{
          const missing=visible.findIndex(b=>!completeBall(b));
          if(missing>=0)go(1,missing);else go(2);
        }}>{visible.some((b,i)=>i!==active&&!completeBall(b))?'繼續設定其他球':'核對整組訂單'}</button></div>
      <p className="eb-note">{visible.filter(completeBall).length}／{count} 顆已選齊</p>
    </>}
    {step===2&&allReady&&<>
      <h3>核對組織與費用</h3><p>第 1 球的推薦球號　{candidate.data?sponsorDescription(candidate.data):'待確認'}</p>
      {visible.map((b,index)=><ReviewItem key={index} ball={b} index={index} edit={()=>go(1,index)}/>)}
      {hasProducts&&<section><h3>本組訂單取貨方式</h3><label className="eb-label">取貨方式<select aria-label="取貨方式" value={deliveryMethod} onChange={e=>setDeliveryMethod(e.target.value as typeof deliveryMethod)}><option value="DELIVERY">宅配</option><option value="COMPANY_PICKUP">公司自取</option></select></label>
        {deliveryMethod==='DELIVERY'&&(delivery.error?errorBox(delivery.error,delivery.retry):delivery.data?.complete?<details><summary>{delivery.data.recipientName} · {delivery.data.phone}</summary><p>{[delivery.data.region,delivery.data.city,delivery.data.address].filter(Boolean).join(' ')}</p>
          <DeliveryProfileEditor profile={delivery.data} refresh={delivery.retry}/></details>:delivery.data?<DeliveryProfileEditor profile={delivery.data} refresh={delivery.retry}/>:<p>正在載入收件資料…</p>)}</section>}
      <dl className="eb-totals"><dt><strong>本次合併付款</strong><small>全部資格套組與建立費</small></dt><dd>NT$ {money(sumAmounts(visible.map(b=>b.qualification.quote!.total)))}</dd>
      <dt>各球生效後另付重銷</dt><dd>NT$ {money(sumAmounts(visible.flatMap(b=>b.repurchase?[b.repurchase.quote!.total]:[])))}</dd>
      </dl>
      <p className="eb-note">全部資格套組合併繳付一筆款項。重銷先保留在各自球下，待該球生效後再付款。</p>
      <div className="eb-actions"><button type="button" onClick={()=>go(1)}>返回選購</button><button type="button" className="eb-primary" disabled={!canSubmit} onClick={submit}>{busy?'正在建立訂單…':'確認送出 '+count+' 顆球的訂單'}</button></div>
    </>}
    </fieldset>
    {error&&<p role="alert">{error}</p>}{uncertain&&<button type="button" disabled={busy} onClick={checkProgress}>查詢送出結果</button>}
  </section>;
}
