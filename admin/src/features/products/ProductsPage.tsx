import {AdminTable} from '../../components/AdminTable';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useForm} from 'react-hook-form';
import {get,post} from '../../lib/api';
import {ProductReference} from '../../types/domain';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {money} from '../../lib/format';
import {QueryFeedback} from '../../components/QueryFeedback';

export function ProductsPage(){
 const qc=useQueryClient();
 const q=useQuery({queryKey:['products'],queryFn:()=>get<any>('/admin/products')});
 const {register,handleSubmit,reset}=useForm<{sku:string;displayName:string;price:string;gpvRate?:string}>();
 const create=useMutation({mutationFn:(v:any)=>post('/admin/products',v),onSuccess:()=>{reset();qc.invalidateQueries({queryKey:['products']})}});
 const rows:ProductReference[]=q.error?[]:q.data?.data??[];
 return <><PageHeader title="商品參照" subtitle="Pre-ERP Product Reference；商品價格與GPV Rule Profile由Backend保存快照。"/>
 <div className="grid two"><Card title="新增／更新Product Reference"><form className="form" onSubmit={handleSubmit(v=>create.mutate({...v,ruleVersionCode:'R1.0B'}))}>
 <Field label="SKU"><input {...register('sku',{required:true})}/></Field><Field label="商品名稱"><input {...register('displayName',{required:true})}/></Field><Field label="售價"><input {...register('price',{required:true})}/></Field><Field label="GPV Rate"><input defaultValue="0.60" {...register('gpvRate')}/></Field>
 <button className="primary" disabled={create.isPending}>{create.isPending?'儲存中…':'儲存'}</button><ErrorBox error={create.error}/></form></Card><Card title="ERP邊界"><p>庫存、採購、成本、會計不在UCell Core重做；此處只維持制度引擎所需Product Reference。</p></Card></div>
 <QueryFeedback query={q} empty={!rows.length}/>
 <Card title="商品清單"><div className="table-wrap"><AdminTable><thead><tr><th>SKU</th><th>名稱</th><th>售價</th><th>GPV Rate</th></tr></thead><tbody>{rows.map(x=><tr key={x.productId}><td>{x.sku}</td><td>{x.displayName}</td><td>{money(x.currentPrice)}</td><td>{x.ruleProfiles?.[0]?.gpvRate??'—'}</td></tr>)}</tbody></AdminTable></div></Card></>
}
