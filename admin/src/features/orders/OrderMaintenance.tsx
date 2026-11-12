import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {get,post} from '../../lib/api';
import {ErrorBox} from '../../components/ui';
import {ConfirmAction} from '../../components/ConfirmAction';
import {useAuth} from '../auth/auth';
import {money,dateTime} from '../../lib/format';
import {orderNumber} from '../../../../shared/order-identity';

const actionNames:Record<string,string>={EXCHANGE:'更換等價商品',NOTE:'修改作業備註',VOID:'作廢未付款訂單',REPLACE:'修改訂單並建立更正單',ARCHIVE:'移至「已封存或作廢」',RESTORE:'恢復顯示'};
export function OrderMaintenance({order,onBusy}:{order:any;onBusy?:(v:boolean)=>void}){
 const id=order.orderId,{user}=useAuth(),qc=useQueryClient(),canEdit=['SUPER_ADMIN','ORDER_OPS'].includes(user?.role??'');
 const [open,setOpen]=useState(true),[mode,setMode]=useState(''),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null),[notice,setNotice]=useState(''),[replacementId,setReplacementId]=useState('');
 const [versionId,setVersionId]=useState(''),[coupon,setCoupon]=useState(''),[quantities,setQuantities]=useState<Record<string,number>>({}),[items,setItems]=useState<any[]>([]);
 const command=useRef<{body:string;key:string}|null>(null);
 const context=useQuery({queryKey:['order-maintenance',id],queryFn:()=>get<any>(`/admin/orders/${id}/maintenance`),enabled:open});const d=context.data?.data;
 const packages=useQuery({queryKey:['packages'],queryFn:()=>get<any>('/admin/packages'),enabled:open&&mode==='REPLACE'&&!!order.packagePurchase});
 const products=useQuery({queryKey:['products'],queryFn:()=>get<any>('/admin/products'),enabled:open&&mode==='REPLACE'&&!order.packagePurchase});
 const options=useQuery({queryKey:['order-replacement-options',id,versionId,d?.version],queryFn:()=>get<any>(`/admin/orders/${id}/replacement-options?versionId=${encodeURIComponent(versionId)}`),enabled:open&&mode==='REPLACE'&&!!versionId&&!!d?.canReplace});
 const opts=options.data?.data,quote=coupon?opts?.coupons.find((c:any)=>c.code===coupon)?.quote:opts?.baseQuote;
 const versions=(packages.data?.data??[]).filter((p:any)=>p.packageClass==='QUALIFICATION'&&p.status==='ACTIVE').flatMap((p:any)=>p.versions.filter((v:any)=>v.status==='ACTIVE'));
 useEffect(()=>{if(d)setNote(d.note??'');},[d?.version]);
 function selectedQuantities():Record<string,number>{
  const totals:Record<string,number>={};
  const lines=order.lines??[];
  if(lines.length&&lines.every((line:any)=>line.ruleProfileSnapshot?.profileId)){
   for(const line of lines){const snapshot=line.ruleProfileSnapshot;const profile='exchangeProductRuleProfileId' in snapshot?snapshot.exchangeProductRuleProfileId:snapshot.profileId;if(!profile)continue;totals[profile]=(totals[profile]??0)+Number(line.quantity);}
   return totals;
  }
  return Object.fromEntries((order.packagePurchase?.selections??[]).map((s:any)=>[s.productRuleProfileId,s.quantity]));
 }
 function choose(next:string){setMode(next);setError(null);setNotice('');setVersionId(order.packagePurchase?.packageProfileVersionId??'');setCoupon(order.packagePurchase?.couponCode??'');setQuantities(selectedQuantities());setItems((order.lines??[]).map((l:any)=>({productId:l.productId,quantity:Number(l.quantity)})));}
 const count=Object.values(quantities).reduce((a,b)=>a+b,0),valid=order.packagePurchase?!!quote&&count===quote.selectableProductQuantity&&Object.values(quantities).every(n=>Number.isSafeInteger(n)&&n>=0):items.length>0&&items.every(i=>i.productId&&Number.isSafeInteger(i.quantity)&&i.quantity>0&&i.quantity<=99);
 async function save(action:string,reason:string){
  if(busy||!d)return;setBusy(true);onBusy?.(true);setError(null);setNotice('');
  const replacement=order.packagePurchase?{packageVersionId:versionId,couponCode:coupon||undefined,quoteHash:quote?.quoteHash,selections:Object.entries(quantities).filter(([,n])=>n>0).map(([productRuleProfileId,quantity])=>({productRuleProfileId,quantity}))}:{items:items.map(i=>({...i,quantity:String(i.quantity)})),expectedTotal:items.reduce((sum,i)=>sum+Number((products.data?.data??[]).find((p:any)=>p.productId===i.productId)?.currentPrice??0)*i.quantity,0).toFixed(2)};
  const input={action,version:d.version,reason,...(action==='NOTE'?{note}:{}),...(action==='REPLACE'?{replacement}:{})},body=JSON.stringify(input);if(command.current?.body!==body)command.current={body,key:crypto.randomUUID()};
  try{const r=await post<any>(`/admin/orders/${id}/maintenance`,input,{idempotencyKey:command.current.key});command.current=null;setReplacementId(r.data?.replacementOrderId??'');setMode('');setNotice(action==='RESTORE'?'已恢復清單顯示；付款與作廢狀態維持原紀錄。':action==='REPLACE'?'更正完成：原單已保留，新訂單待重新核對付款。':action==='NOTE'?'備註已儲存。':'已移至「已封存或作廢」，原始明細與帳務保留。');await Promise.all(['order-maintenance','orders','order','paper-order-pending','qualifications'].map(k=>qc.invalidateQueries({queryKey:[k]})));}
  catch(e){setError(e);}finally{setBusy(false);onBusy?.(false);}
 }
 return <section className="card" aria-label="訂單修改與作廢"><button disabled={busy} aria-expanded={open} onClick={()=>setOpen(v=>!v)}>{open?'收合維護選項':'展開維護選項'}</button>{open&&<><h3>訂單 {orderNumber(order)} 維護</h3><ErrorBox error={context.error||error}/>{context.isError&&<button type="button" onClick={()=>void context.refetch()}>重試載入維護選項</button>}{context.isLoading?<p>正在核對付款、出貨與資格狀態…</p>:d&&<>
 <p>更正商品會保留原單並建立更正單。作廢與封存後，可在「已封存或作廢」查詢原單。已收款訂單請先辦理退貨或退款。</p>
 {d.archived&&<p role="status">此單已列入「已封存或作廢」。恢復顯示後可從一般清單查詢，原作廢與資格狀態仍會保留。</p>}
 {(replacementId||d.replacementOrderId)&&<p><Link to={'/orders?orderId='+(replacementId||d.replacementOrderId)}>查看更正後的新訂單 →</Link></p>}
 {notice&&<p role="status">{notice}</p>}
 {canEdit?<><div className="button-row"><button disabled={busy} onClick={()=>choose('NOTE')}>修改作業備註</button>{d.canReplace&&<button disabled={busy} onClick={()=>choose('REPLACE')}>修改商品／套組</button>}{d.canVoid&&<button disabled={busy} onClick={()=>choose('VOID')}>作廢未付款訂單</button>}{d.canArchive&&<button disabled={busy} onClick={()=>choose('ARCHIVE')}>封存已退回訂單</button>}{d.archived&&<ConfirmAction reasonRecorded disabled={busy} onConfirm={r=>save('RESTORE',r)}>恢復清單顯示</ConfirmAction>}</div>
 {mode==='NOTE'&&<label>作業備註（不更改收款或商品）<textarea maxLength={2000} disabled={busy} value={note} onChange={e=>setNote(e.target.value)}/></label>}
 {mode==='REPLACE'&&<fieldset disabled={busy}><legend>更正訂單內容</legend><p>會員與推薦人沿用原單；原球號保留於作廢紀錄，新資格另編球號。新單金額以目前有效商品／優惠重新計算。</p>
 {order.packagePurchase?<><ErrorBox error={packages.error||options.error}/><label>資格套組<select value={versionId} onChange={e=>{setVersionId(e.target.value);setCoupon('');setQuantities({})}}><option value="">選擇套組</option>{versions.map((v:any)=><option key={v.packageProfileVersionId} value={v.packageProfileVersionId}>{v.displayName}</option>)}</select></label>{options.isFetching?<p>正在核對價格與優惠…</p>:opts&&<><label>優惠碼<select value={coupon} onChange={e=>{setCoupon(e.target.value);setQuantities({})}}><option value="">不使用優惠碼</option>{opts.coupons.map((c:any)=><option key={c.code} value={c.code}>{c.code} · {c.name}</option>)}</select></label>{coupon&&!quote&&<p role="alert">原優惠目前不可用，請重新選擇優惠或不使用優惠碼。</p>}{quote&&<><button type="button" onClick={()=>setQuantities({})}>清除商品選擇</button><p>原單 {money(order.netAmount)} → 更正單 <strong>{money(quote.total)}</strong>；商品 {quote.selectableProductQuantity} 盒（已選 {count}）。</p>{opts.products.filter((p:any)=>p.available).map((p:any)=><label key={p.productRuleProfileId}>{p.displayName}<input type="number" min="0" max={p.maxQty??quote.selectableProductQuantity} step={p.selectionIncrement||1} value={quantities[p.productRuleProfileId]??0} onChange={e=>setQuantities(v=>({...v,[p.productRuleProfileId]:Number(e.target.value)}))}/></label>)}</>}</>}</>:<><ErrorBox error={products.error}/>{items.map((i,n)=><div className="order-builder-row" key={n}><select aria-label={'商品 '+(n+1)} value={i.productId} onChange={e=>setItems(a=>a.map((x,k)=>k===n?{...x,productId:e.target.value}:x))}><option value="">選擇商品</option>{(products.data?.data??[]).filter((p:any)=>p.isActive).map((p:any)=><option key={p.productId} value={p.productId}>{p.displayName} · {money(p.currentPrice)}</option>)}</select><input aria-label={'數量 '+(n+1)} type="number" min="1" max="99" value={i.quantity} onChange={e=>setItems(a=>a.map((x,k)=>k===n?{...x,quantity:Number(e.target.value)}:x))}/><button onClick={()=>setItems(a=>a.filter((_,k)=>k!==n))}>移除此商品</button></div>)}<button onClick={()=>setItems(a=>[...a,{productId:'',quantity:1}])}>加入商品</button><p>新單依目前商品價格計算：{money(items.reduce((sum,i)=>sum+Number((products.data?.data??[]).find((p:any)=>p.productId===i.productId)?.currentPrice??0)*i.quantity,0))}。正式金額以伺服器確認為準。</p></>}
 </fieldset>}
 {['VOID','ARCHIVE'].includes(mode)&&<p role="alert">確認後此單會移至「已封存或作廢」。{mode==='VOID'?'未付款資格將作廢，優惠保留次數會釋出；紙本申請可重新建單。':d.canRebuild?'紙本申請將重新開放建單。':'已安置資格仍依原退出審查流程處理。'}</p>}
 {mode&&<div className="button-row"><ConfirmAction reasonRecorded disabled={busy||context.isFetching||mode==='REPLACE'&&(!valid||options.isFetching||!!options.error||!!products.error)} onConfirm={r=>save(mode,r)}>確認{actionNames[mode]}</ConfirmAction><button disabled={busy} onClick={()=>setMode('')}>取消修改</button></div>}</>:<p>目前可檢視紀錄；修改需管理員或訂單作業權限。</p>}
 {!d.archived&&!d.canVoid&&<div className="callout info">{d.blockers.map((s:string)=><p key={s}>{s}</p>)}{['PAID','FULFILLED','PARTIAL_RETURN','RETURNED'].includes(order.status)&&<><p>已付款未出貨的等價換品可從「商品明細」操作。需要退款時：先辦理商品退貨；有資格建立費者，再於本頁下方登錄已實際完成的退款。完成後可移至「已封存或作廢」，符合條件的紙本申請可重新建單。</p>{order.lines.some((l:any)=>Number(l.remainingReversibleQuantity)>0)&&<Link to={'/returns?orderId='+id}>帶入此訂單辦理商品退貨 →</Link>}{!order.lines.length&&<p>本單沒有商品，請使用下方「資格建立費退款登錄」。</p>}</>}</div>}
 {d.replaceHint&&<p>{d.replaceHint}</p>}{d.released&&<Link to="/paper-intake">前往紙本申請重新建立訂單 →</Link>}
 <details><summary>訂單異動歷程（最近 20 筆）</summary>{d.history.length?d.history.map((h:any,n:number)=><p key={n}>{dateTime(h.createdAt)} · {actionNames[h.action.replace('ORDER_MAINTENANCE_','')]} · {h.afterData?.exchange&&<>{h.afterData.exchange.from} → {h.afterData.exchange.to} × {h.afterData.exchange.quantity} · </>}{h.afterData?.reason}<br/><small>操作人識別：{h.actorId}</small></p>):<p>尚無維護紀錄。</p>}</details>
 </>}<button disabled={busy} onClick={()=>{setMode('');void context.refetch()}}>重新核對訂單狀態</button></>}</section>;
}
