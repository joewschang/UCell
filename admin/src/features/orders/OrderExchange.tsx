import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {get,post} from '../../lib/api';
import {ErrorBox} from '../../components/ui';
import {ConfirmAction} from '../../components/ConfirmAction';

type Line={id:string;sku:string;name:string;quantity:string;options:{quantities:number[];id:string;name:string;sku:string}[]};
export function OrderExchange({id,onBusy}:{id:string;onBusy:(v:boolean)=>void}){
 const qc=useQueryClient(),[open,setOpen]=useState(false),[lineId,setLine]=useState(''),[quantity,setQuantity]=useState(0),[target,setTarget]=useState(''),[error,setError]=useState<unknown>(),[notice,setNotice]=useState(''),[saving,setSaving]=useState(false);
 const attempt=useRef({body:'',key:''});
 const query=useQuery({queryKey:['order-exchanges',id],queryFn:()=>get<{data:{version:string;blocked:string|null;lines:Line[]}}>('/admin/orders/'+id+'/exchanges'),enabled:open});
 const data=query.data?.data,line=data?.lines.find(l=>l.id===lineId),option=line?.options.find(o=>o.id===target);
 async function save(reason:string){
  if(!line||!option||!data||saving)return;
  const input={action:'EXCHANGE',version:data.version,reason,replacement:{lineId:line.id,profileId:option.id,quantity}};
  const body=JSON.stringify(input);
  if(attempt.current.body!==body)attempt.current={body,key:crypto.randomUUID()};
  onBusy(true);setSaving(true);setError(null);
  try{await post('/admin/orders/'+id+'/maintenance',input,{idempotencyKey:attempt.current.key});setNotice('已將 '+line.sku+' × '+quantity+' 更換為 '+option.sku+'。');setOpen(false);setTarget('');setLine('');await Promise.all(['order','orders','order-maintenance','order-exchanges','fulfillment-order'].map(k=>qc.invalidateQueries({queryKey:[k]})));}
  catch(e){setError(e);await query.refetch();}finally{onBusy(false);setSaving(false);}
 }
 return <section><button type="button" disabled={saving} aria-expanded={open} onClick={()=>{setOpen(!open);setNotice('')}}>{open?'收合換品表單':'更換等價商品'}</button>{notice&&<p role="status">{notice}</p>}{open&&<><ErrorBox error={error||query.error}/>{query.isLoading?<p>正在核對出貨與商品…</p>:data?.blocked?<p>{data.blocked}</p>:data&&<div className="form"><label>原訂單商品<select value={lineId} onChange={e=>{setLine(e.target.value);setTarget('')}}><option value="">選擇商品</option>{data.lines.map(l=><option key={l.id} value={l.id}>{l.sku} · {l.name} × {l.quantity}</option>)}</select></label>{line&&(!line.options.length?<p>此商品目前沒有符合條件的等價品。</p>:<label>換成<select value={target} onChange={e=>{setTarget(e.target.value);setQuantity(line.options.find(o=>o.id===e.target.value)?.quantities[0]??0)}}><option value="">選擇同幣別、同單價的商品</option>{line.options.map(o=><option key={o.id} value={o.id}>{o.sku} · {o.name}</option>)}</select></label>)}{line&&option&&<><label>換品數量<select value={quantity} onChange={e=>setQuantity(Number(e.target.value))}>{option.quantities.map(n=><option key={n} value={n}>{n}</option>)}</select></label><p>應收差額 $0</p><ConfirmAction reasonRecorded disabled={saving||query.isFetching} onConfirm={save}>確認將 {line.sku} × {quantity} 換成 {option.sku}</ConfirmAction></>}</div>}</>}</section>;
}
