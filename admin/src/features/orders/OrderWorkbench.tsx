import {useEffect, useRef, useState, type ReactNode} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useSearchParams} from 'react-router-dom';
import {command, get, qs} from '../../lib/api';

const PAGE = 8;
const purposes: Record<string,string> = {RETAIL: '零售', ENTRY: '入會', REPURCHASE: '重銷', SUBSCRIPTION_PREPAY: '訂閱預付', UPGRADE: '升級'};
const states: Record<string,string> = {CONFIRMED:'待收款', PAID:'已付款', FULFILLED:'已履約', PARTIAL_RETURN:'部分退貨', RETURNED:'已退貨', VOIDED:'已作廢', ARCHIVED:'已封存或作廢'};
export const canCreateOrder = (role?: string) => ['SUPER_ADMIN','ORDER_OPS','FINANCE'].includes(role ?? '');
type Page<T> = {data:T[]; meta?:{hasNext:boolean;total?:number}};
type OrderRow = {orderId:string; displayOrderNo?:string|null; publicOrderNo?:string|null; orderNo?:string|number|null; status:string; purpose:string; netAmount:string; createdAt:string;
  purchaser?: {legalName?:string;mobile?:string}; qualification?: {currentHolder?:{legalName?:string;mobile?:string};currentHolderLegalEntity?:{registeredName?:string}};
  packagePurchase?:{packageName?:string}; packageDownstreamStatus?:string};
type Ball = {qualificationId:string; ballNo?:string|null; planLevelCode?:string; currentHolder?:{legalName?:string;memberNo?:string}; currentHolderLegalEntity?:{registeredName?:string;memberNo?:string};currentCompanyPrincipalId?:string|null};
type Product = {productId:string;displayName:string;sku:string;currentPrice:string;currency?:string;isActive?:boolean};
type Line = {product:Product;quantity:string};
const ballName = (ball:Ball) => ball.currentHolderLegalEntity?.registeredName || ball.currentHolder?.legalName || (ball.currentCompanyPrincipalId ? '公司球' : '持有人未提供');
const orderNo = (row:OrderRow) => String(row.displayOrderNo || row.publicOrderNo || row.orderNo || '待編號');
const orderOwner = (row:OrderRow) => row.purchaser?.legalName || row.qualification?.currentHolder?.legalName || row.qualification?.currentHolderLegalEntity?.registeredName || '未提供';
const price = (value:string) => new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD',maximumFractionDigits:2}).format(Number(value));
function scaled(value:string, places:number) {
  if(!/^\d+(?:\.\d+)?$/.test(value))return null;
  const [whole,fraction='']=value.split('.');
  if(whole.length>18 || fraction.length>places)return null;
  return BigInt(whole+fraction.padEnd(places,'0'));
}
function lineAmount(line:Line) {
  const cents=scaled(line.product.currentPrice,2), quantity=scaled(line.quantity,4);
  if(cents===null||quantity===null||quantity<=0n||quantity>=10n**18n)return null;
  return cents*quantity;
}
// The database stores the sum of the unrounded products as a two-decimal order total.
const roundedCents = (amount:bigint) => (amount+5000n)/10000n;
function money(cents:bigint, currency='TWD') {
  return currency+' '+(cents/100n).toLocaleString('zh-TW')+'.'+String(cents%100n).padStart(2,'0');
}
const date = (value:string) => new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',dateStyle:'short',timeStyle:'short'});
function useText(value:string) {
  const [settled,setSettled] = useState(value.trim());
  useEffect(() => { const timeout = setTimeout(() => setSettled(value.trim()),220); return () => clearTimeout(timeout); },[value]);
  return settled;
}
export function useOrderRoute() {
  const [params,setParams] = useSearchParams();
  const id = params.get('orderId');
  const qualificationId = params.get('qualificationId');
  const mode = id ? 'detail' : (qualificationId || params.has('new')) ? 'create' : 'list';
  const go = (view:'list'|'create'|'detail',orderId?:string) => setParams(old => {
    const next = new URLSearchParams(old); ['orderId','qualificationId','feeRefund','new'].forEach(key=>next.delete(key));
    if(view==='create')next.set('new','1');
    if(view==='detail' && orderId)next.set('orderId',orderId);
    return next;
  },{preventScrollReset:true});
  return {id,qualificationId,mode,go};
}
type Route = ReturnType<typeof useOrderRoute>;

function Pager({page,hasNext,busy,setPage,label,total}:{page:number;hasNext:boolean;busy:boolean;setPage:(p:number)=>void;label:string;total?:number}) {
  return <nav aria-label={label} className="ow-pages">
    <button type="button" disabled={page<=1||busy} onClick={()=>setPage(page-1)}>上一頁</button>
    <span aria-live="polite">第 {page} 頁{total!=null?'／共 '+total+' 筆':''}</span>
    <button type="button" disabled={!hasNext||busy} onClick={()=>setPage(page+1)}>下一頁</button>
  </nav>;
}
const feedback = (error:unknown) => error instanceof Error ? error.message : '請重新載入後再試。';

export function OrdersWorkbench({route,role,busy,children,displayNo=orderNo,displayOwner=orderOwner,displayState=(s)=>states[s]??s}:{route:Route;role?:string;busy:boolean;children:ReactNode;displayNo?:(r:OrderRow)=>string;displayOwner?:(r:OrderRow)=>string;displayState?:(s:string)=>string}) {
  const [draft,setDraft] = useState(''), search = useText(draft);
  const [status,setStatus] = useState(''), [page,setPage] = useState(1);
  const [posting,setPosting] = useState(false);
  const heading=useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  useEffect(()=>{if(!first.current){heading.current?.focus();} first.current=false;},[route.mode,route.id]);
  const query = useQuery({queryKey:['orders','directory',status,search,page],enabled:route.mode==='list',queryFn:({signal})=>
    get<Page<OrderRow>>('/admin/orders'+qs({q:search,status:status==='ARCHIVED'?undefined:status||undefined,archived:status==='ARCHIVED'?'true':undefined,page,take:PAGE}),{signal})});
  const rows=query.data?.data??[], loading=query.isPending||search!==draft.trim();
  const create=route.mode==='create' && canCreateOrder(role);
  return <section className="ow-workbench" aria-label="訂單管理">
    <header className="ow-heading"><h1 tabIndex={-1} ref={heading}>{create?'新增訂單':route.mode==='detail'?'訂單明細':'訂單管理'}</h1>
    {route.mode==='list' ? canCreateOrder(role)&&<button className="primary" onClick={()=>route.go('create')}>新增訂單</button> :
      <button disabled={busy||posting} onClick={()=>route.go('list')}>返回訂單清單</button>}</header>
    {create ? <CreateOrder qualificationId={route.qualificationId} onBusy={setPosting} onCreated={id=>route.go('detail',id)}/> :
      route.mode==='create' ? <p role="alert">此帳號可查閱訂單。如需建立訂單，請洽訂單承辦人。</p> :
      route.mode==='detail' ? children : <div className="ow-card">
        <div className="ow-directory-tools" role="search" aria-label="訂單搜尋">
          <label>搜尋訂單<input type="search" value={draft} placeholder="訂單號、會員姓名或手機" onChange={e=>{setPage(1);setDraft(e.target.value);}}/></label>
          <label>訂單狀態<select value={status} onChange={e=>{setPage(1);setStatus(e.target.value);}}><option value="">全部狀態</option>{Object.entries(states).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
        </div>
        {loading?<p role="status">正在載入訂單…</p>:query.isError?<p role="alert">訂單清單載入失敗。 <button onClick={()=>void query.refetch()}>重試</button></p>:
         rows.length?<ul className="ow-orders" aria-label="訂單清單">{rows.map(row=><li key={row.orderId}>
           <button type="button" className="ow-order" aria-label={'查看訂單 '+displayNo(row)} onClick={()=>route.go('detail',row.orderId)}>
             <span><strong>{displayNo(row)}</strong><small>{displayOwner(row)}{(row.purchaser?.mobile||row.qualification?.currentHolder?.mobile) && ' · '+(row.purchaser?.mobile||row.qualification?.currentHolder?.mobile)}</small></span>
             <span>{row.packagePurchase?.packageName||purposes[row.purpose]||displayState(row.purpose)}<small>{date(row.createdAt)}</small></span>
             <span className="ow-summary"><strong>{price(row.netAmount)}</strong><small>{displayState(row.status)}{row.packageDownstreamStatus&&' · '+displayState(row.packageDownstreamStatus)}</small></span>
           </button></li>)}</ul>:<p role="status">此頁沒有符合條件的訂單。</p>}
        <Pager page={page} hasNext={!!query.data?.meta?.hasNext} busy={loading} setPage={setPage} label="訂單清單分頁" total={query.data?.meta?.total}/>
      </div>}
  </section>;
}

function CreateOrder({qualificationId,onBusy,onCreated}:{qualificationId:string|null;onBusy:(busy:boolean)=>void;onCreated:(id:string)=>void}) {
  const [step,setStep] = useState(0), [draft,setDraft] = useState(''), search=useText(draft), [page,setPage]=useState(1);
  const [ball,setBall]=useState<Ball|null>(null), [purpose,setPurpose]=useState('RETAIL'), [lines,setLines]=useState<Line[]>([]);
  const [pending,setPending]=useState(false), [error,setError]=useState('');
  const inFlight=useRef(false), key=useRef<{hash:string;value:string}>();
  const qc=useQueryClient();
  const options=useQuery({queryKey:['order-qualification-options',search,page],enabled:step===0,queryFn:({signal})=>get<Page<Ball>>('/admin/orders/qualification-options'+qs({q:search,page,take:6}),{signal})});
  const linked=useQuery({queryKey:['order-qualification-options','id',qualificationId],enabled:!!qualificationId,queryFn:({signal})=>get<Page<Ball>>('/admin/orders/qualification-options'+qs({id:qualificationId}),{signal})});
  const initialBall=useRef(false);
  useEffect(()=>{if(!initialBall.current&&linked.data){initialBall.current=true;setBall(current=>current??linked.data.data[0]??null);}},[linked.data]);
  const catalog=useQuery({queryKey:['order-product-options'],enabled:step===1,queryFn:({signal})=>get<{data:Product[]}>('/admin/orders/product-options',{signal})});
  const amounts=lines.map(lineAmount);
  const total=amounts.length && amounts.every(a=>a!==null) ? roundedCents(amounts.reduce<bigint>((sum,a)=>sum+(a??0n),0n)) : null;
  const valid=total!==null&&total<10n**18n;
  const optionsForSale=catalog.data?.data.filter(p=>p.isActive!==false && (p.currency??'TWD')==='TWD')??[];
  function add(id:string) {
    const product=optionsForSale.find(p=>p.productId===id);
    if(!product)return;
    setLines(old=>{
      if(!old.some(x=>x.product.productId===id))return [...old,{product,quantity:'1'}];
      return old.map(line=>{
        if(line.product.productId!==id)return line;
        const quantity=(scaled(line.quantity,4)??0n)+10000n;
        const fraction=String(quantity%10000n).padStart(4,'0').replace(/0+$/,'');
        return {...line,quantity:String(quantity/10000n)+(fraction?'.'+fraction:'')};
      });
    });
  }
  async function submit() {
    if(inFlight.current||!valid||!ball)return;
    inFlight.current=true;setPending(true);onBusy(true);setError('');
    const payload={qualificationId:ball.qualificationId,purpose,items:lines.map(l=>({productId:l.product.productId,quantity:l.quantity}))};
    const hash=JSON.stringify(payload);
    try {
      if(key.current?.hash!==hash)key.current={hash,value:crypto.randomUUID()};
      const response=await command<{data:{orderId:string}}>('/admin/orders',payload,key.current.value);
      if(!response.data?.orderId)throw new Error('未取得訂單編號。請重新查詢訂單。');
      void qc.invalidateQueries({queryKey:['orders']});
      onCreated(response.data.orderId);
    } catch(e){setError(feedback(e));} finally{inFlight.current=false;setPending(false);onBusy(false);}
  }
  const steps=['會員與用途','選擇商品','核對訂單'];
  return <article className="ow-card ow-create">
    <ol className="ow-steps" aria-label="建單步驟">{steps.map((name,i)=><li key={name} aria-current={step===i?'step':undefined}>{i+1}. {name}</li>)}</ol>
    <h2>{steps[step]}</h2>
    {step===0&&<>
      <label>歸屬球位<input type="search" value={draft} placeholder="輸入球號、會員姓名或手機" onChange={e=>{setDraft(e.target.value);setPage(1);}}/></label>
      {options.isError?<p role="alert">球位載入失敗。 <button onClick={()=>void options.refetch()}>重試</button></p>:options.isPending||draft.trim()!==search?<p role="status">正在查詢球位…</p>:
       <><ul className="ow-ball-options">{options.data?.data.map(q=><li key={q.qualificationId}><button type="button" aria-pressed={ball?.qualificationId===q.qualificationId} onClick={()=>setBall(q)}>{ballName(q)} · {q.ballNo||'尚未編配球號'}</button></li>)}</ul>{!options.data?.data.length&&<p>沒有符合條件的有效球位。</p>}</>}
      <Pager page={page} setPage={setPage} label="可選球位分頁" busy={options.isPending} hasNext={!!options.data?.meta?.hasNext}/>
      {linked.isError&&<p role="alert">無法讀取連結中的球位。 <button onClick={()=>void linked.refetch()}>重試</button></p>}
      {ball&&<p className="ow-selection" role="status">已選 {ballName(ball)} · {ball.ballNo}</p>}
      <label>訂單用途<select value={purpose} onChange={e=>setPurpose(e.target.value)}>{Object.entries(purposes).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
    </>}
    {step===1&&<>
      {catalog.isError?<p role="alert">商品目錄載入失敗。 <button onClick={()=>void catalog.refetch()}>重試</button></p>:
        <label>加入商品<select disabled={catalog.isPending} value="" onChange={e=>add(e.target.value)}><option value="">{catalog.isPending?'正在載入商品…':'選擇要加入的商品'}</option>
        {optionsForSale.map(p=><option key={p.productId} value={p.productId}>{p.sku} · {p.displayName} · {money(scaled(p.currentPrice,2)??0n,p.currency)}</option>)}</select></label>}
      {catalog.isSuccess&&!optionsForSale.length&&<p role="status">目前沒有可加入訂單的商品。</p>}
      <ul className="ow-lines">{lines.map((l,i)=><li key={l.product.productId}><span><strong>{l.product.displayName}</strong><small>{l.product.sku} · 單價 {money(scaled(l.product.currentPrice,2)??0n,l.product.currency)}</small></span>
        <label>數量<input aria-label={l.product.displayName+' 數量'} type="text" inputMode="decimal" value={l.quantity} onChange={e=>setLines(old=>old.map(x=>x===l?{...x,quantity:e.target.value}:x))}/></label>
        <span className="ow-subtotal"><small>小計</small><strong>{amounts[i]===null?'—':money(roundedCents(amounts[i]),l.product.currency)}</strong></span>
        <button aria-label={'移除 '+l.product.displayName} onClick={()=>setLines(old=>old.filter(x=>x!==l))}>移除</button></li>)}</ul>
      {lines.length>0&&!valid&&<p role="status">{total===null?'請檢查數量。數量須大於零，最多可填四位小數。':'金額已超過訂單可處理的範圍。'}</p>}
    </>}
    {step===2&&ball&&<>
      <dl><dt>歸屬球位</dt><dd>{ballName(ball)} · {ball.ballNo}</dd><dt>訂單用途</dt><dd>{purposes[purpose]}</dd></dl>
      <ul className="ow-lines">{lines.map((l,i)=><li key={l.product.productId}><span><strong>{l.product.displayName}</strong><small>{l.product.sku} · 單價 {money(scaled(l.product.currentPrice,2)??0n,l.product.currency)} × {l.quantity}</small></span>
        <span className="ow-subtotal"><small>小計</small><strong>{amounts[i]!==null&&money(roundedCents(amounts[i]),l.product.currency)}</strong></span></li>)}</ul>
    </>}
    {step>0&&lines.length>0&&<div className="ow-estimate"><span>預估訂單總額</span><strong>{valid&&total!==null?money(total):'—'}</strong></div>}
    {step===2&&<p>送出後將建立待收款訂單。實際金額以建單當下的商品價格為準。</p>}
    {error&&<p role="alert">{error}</p>}
    <div className="ow-step-actions">{step>0&&<button type="button" disabled={pending} onClick={()=>{setStep(step-1);setError('');}}>上一步</button>}
    {step===2?<button className="primary" disabled={pending} onClick={()=>void submit()}>{pending?'建立中…':error?'重試建立訂單':'確認建立訂單'}</button>:
      <button className="primary" disabled={step===0?!ball:!valid} onClick={()=>setStep(step+1)}>{step===0?'下一步，選商品':'下一步，核對訂單'}</button>}</div>
  </article>;
}

export function OrderNextAction({order,role,onOpen,disabled}:{order:{status:string;enrollmentBundlePayment?:{receipt?:unknown}|null};role?:string;onOpen:(tab:string)=>void;disabled:boolean}) {
  const group=order.enrollmentBundlePayment;
  const next=order.status==='CONFIRMED' ? {tab:'收款',name:group?group.receipt?'查看整組核帳紀錄':'核對整組收款':'查看收款進度'} :
    order.status==='PAID' && ['SUPER_ADMIN','ORDER_OPS','COMPLIANCE_AUDIT'].includes(role??'') ? {tab:'出貨',name:'查看出貨進度'} :
    ['RETURNED','PARTIAL_RETURN','VOIDED'].includes(order.status) ? {tab:'管理',name:'查看異動紀錄'} : null;
  return next?<button className="ow-next" type="button" disabled={disabled} onClick={()=>onOpen(next.tab)}>{next.name}</button>:null;
}
