import {AdminTable} from '../../components/AdminTable';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useForm} from 'react-hook-form';
import {get,post} from '../../lib/api';
import {ProductReference} from '../../types/domain';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {money} from '../../lib/format';
import {QueryFeedback} from '../../components/QueryFeedback';
import {useState} from 'react';

export function ProductsPage(){
 const qc=useQueryClient();
 const q=useQuery({queryKey:['products'],queryFn:()=>get<any>('/admin/products')});
 const {register,handleSubmit,reset}=useForm<{sku:string;displayName:string;price:string;gpvRate?:string}>();
 const create=useMutation({mutationFn:(v:any)=>post('/admin/products',v),onSuccess:()=>{reset();qc.invalidateQueries({queryKey:['products']})}});
 const [retail,setRetail]=useState({productId:'',effectiveFrom:'',enabled:false,rate:''});
 const schedule=useMutation({mutationFn:()=>post('/admin/products/retail-referral-profiles',{productId:retail.productId,effectiveFrom:retail.effectiveFrom,enabled:retail.enabled,...(retail.enabled?{rate:retail.rate}:{} )}),onSuccess:()=>{setRetail({productId:'',effectiveFrom:'',enabled:false,rate:''});qc.invalidateQueries({queryKey:['products']})}});
 const rows:ProductReference[]=q.error?[]:q.data?.data??[];
 return <><PageHeader title="商品參照" subtitle="Pre-ERP Product Reference；商品價格與GPV Rule Profile由Backend保存快照。"/>
 <div className="grid two"><Card title="新增／更新Product Reference"><form className="form" onSubmit={handleSubmit(v=>create.mutate({...v,ruleVersionCode:'R1.0B'}))}>
 <Field label="SKU"><input {...register('sku',{required:true})}/></Field><Field label="商品名稱"><input {...register('displayName',{required:true})}/></Field><Field label="售價"><input {...register('price',{required:true})}/></Field><Field label="GPV Rate"><input defaultValue="0.60" {...register('gpvRate')}/></Field>
 <button className="primary" disabled={create.isPending}>{create.isPending?'儲存中…':'儲存'}</button><ErrorBox error={create.error}/></form></Card><Card title="商品推薦獎金版本"><p>建立未來生效的 SKU 規則版本；歷史訂單與獎金快照不會被修改。</p><div className="form"><Field label="商品"><select value={retail.productId} onChange={e=>setRetail(v=>({...v,productId:e.target.value}))}><option value="">請選擇商品</option>{rows.map(product=><option key={product.productId} value={product.productId}>{product.sku} · {product.displayName}</option>)}</select></Field><Field label="生效時間（含時區）"><input value={retail.effectiveFrom} placeholder="2026-10-01T00:00:00+08:00" onChange={e=>setRetail(v=>({...v,effectiveFrom:e.target.value}))}/></Field><label><input type="checkbox" checked={retail.enabled} onChange={e=>setRetail(v=>({...v,enabled:e.target.checked}))}/> 啟用商品推薦獎金</label>{retail.enabled&&<Field label="費率（0–1）"><input inputMode="decimal" value={retail.rate} onChange={e=>setRetail(v=>({...v,rate:e.target.value}))}/></Field>}<p>Base：商品實付淨額；Calculation：Percentage。</p><button className="primary" disabled={!retail.productId||!retail.effectiveFrom||retail.enabled&&!/^\d+(\.\d{1,6})?$/.test(retail.rate)||schedule.isPending} onClick={()=>schedule.mutate()}>{schedule.isPending?'儲存中…':'建立未來規則版本'}</button><ErrorBox error={schedule.error}/></div></Card></div>
 <QueryFeedback query={q} empty={!rows.length}/>
 <Card title="商品清單"><div className="table-wrap"><AdminTable><thead><tr><th>SKU</th><th>名稱</th><th>售價</th><th>GPV Rate</th><th>商品推薦獎金</th></tr></thead><tbody>{rows.map(x=>{const profile:any=x.ruleProfiles?.[0];return <tr key={x.productId}><td>{x.sku}</td><td>{x.displayName}</td><td>{money(x.currentPrice)}</td><td>{profile?.gpvRate??'—'}</td><td>{profile?.retailReferralEnabled?`${profile.retailReferralRate} · 商品實付淨額`:'未啟用'}</td></tr>})}</tbody></AdminTable></div></Card></>
}
