import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useForm} from 'react-hook-form';
import {get,post} from '../../lib/api';
import {ProductReference} from '../../types/domain';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {money} from '../../lib/format';
import approvedProducts from '../../../../shared/products.json';
import poster from '../../../../shared/brand/ucell-products.png';
import '../../../../shared/brand/brand.css';

export function ProductsPage(){
 const qc=useQueryClient();
 const q=useQuery({queryKey:['products'],queryFn:()=>get<any>('/admin/products')});
 const {register,handleSubmit,reset}=useForm<{sku:string;displayName:string;price:string;gpvRate?:string}>();
 const create=useMutation({mutationFn:(v:any)=>post('/admin/products',v),onSuccess:()=>{reset();qc.invalidateQueries({queryKey:['products']})}});
 const rows:ProductReference[]=q.data?.data??[];
 return <><PageHeader title="商品參照" subtitle="Pre-ERP Product Reference；商品價格與GPV Rule Profile由Backend保存快照。"/>
 <Card title="公司主商品 · 已提供資料"><p>以下為公司提供的商品與 PV 資料，不代表已寫入正式商品庫。PV 與 GPV／BV 分開處理；目前 API 尚無獨立 PV 寫入欄位。</p><div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(170px,1fr))',gap:16}}>{approvedProducts.map(p=><article key={p.sku}><div className="ucell-product-photo" role="img" aria-label={`${p.name} 商品包裝`} style={{backgroundImage:`url(${poster})`,backgroundPosition:`${p.panel*25}% 48.5%`}}/><h3>{p.name}</h3><p>{p.sku} · NT$ {p.price.toLocaleString('zh-TW')}／盒</p><p>PV {p.pv.toLocaleString('zh-TW')}</p><button onClick={()=>reset({sku:p.sku,displayName:p.name,price:String(p.price),gpvRate:''})}>填入建檔資料</button></article>)}</div></Card>
 <div className="grid two"><Card title="新增／更新Product Reference"><form className="form" onSubmit={handleSubmit(v=>create.mutate({...v,ruleVersionCode:'R1.0B'}))}>
 <Field label="SKU"><input {...register('sku',{required:true})}/></Field><Field label="商品名稱"><input {...register('displayName',{required:true})}/></Field><Field label="售價"><input {...register('price',{required:true})}/></Field><Field label="GPV Rate（依核准規則填寫）" hint="來源海報的 PV 2,880 不會自動轉成 GPV Rate。"><input required {...register('gpvRate',{required:true})}/></Field>
 <button className="primary">儲存</button><ErrorBox error={create.error}/></form></Card><Card title="ERP邊界"><p>庫存、採購、成本、會計不在UCell Core重做；此處只維持制度引擎所需Product Reference。</p></Card></div>
 <Card title="商品清單"><div className="table-wrap"><table><thead><tr><th>SKU</th><th>名稱</th><th>售價</th><th>GPV Rate</th></tr></thead><tbody>{rows.map(x=><tr key={x.productId}><td>{x.sku}</td><td>{x.displayName}</td><td>{money(x.currentPrice)}</td><td>{x.ruleProfiles?.[0]?.gpvRate??'—'}</td></tr>)}</tbody></table></div></Card></>
}
