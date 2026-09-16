import {AdminDataGrid} from '../../components/AdminDataGrid';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useForm} from 'react-hook-form';
import {command,get,qs} from '../../lib/api';
import {Person} from '../../types/domain';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {useState} from 'react';
import {DetailDrawer,StatusBadge,EmptyState,LoadingState} from '@ucell/design-system';
import {Link} from 'react-router-dom';

export function PeoplePage(){
 const qc=useQueryClient();const [search,setSearch]=useState('');
 const [selected,setSelected]=useState<Person|null>(null);
 const people=useQuery({queryKey:['persons',search],queryFn:()=>get<any>('/admin/persons'+qs({q:search,take:50}))});
 const {register,handleSubmit,reset}=useForm<{legalName:string;preferredName?:string;birthDate?:string;mobile?:string;email?:string}>();
 const create=useMutation({
  mutationFn:(v:any)=>command('/admin/persons',{
   legalName:v.legalName,
   preferredName:v.preferredName||undefined,
   birthDate:v.birthDate||undefined,
   mobile:v.mobile||undefined,
   email:v.email||undefined
  }),
  onSuccess:()=>{reset();qc.invalidateQueries({queryKey:['persons']})}
 });
 const rows:Person[]=people.data?.data ?? [];
 return <>
  <PageHeader title="會員／自然人" subtitle="Person只代表自然人；同一成年自然人可擁有多個Qualification。"/>
  <div className="grid two"><Card title="新增自然人"><details><summary>開啟 Person 建立表單</summary><form className="form" onSubmit={handleSubmit(v=>create.mutate(v))}>
   <Field label="法定姓名"><input {...register('legalName',{required:true})}/></Field>
   <Field label="慣用名稱"><input {...register('preferredName')}/></Field>
   <Field label="生日"><input type="date" {...register('birthDate')}/></Field>
   <Field label="手機"><input {...register('mobile')}/></Field>
   <Field label="Email"><input type="email" {...register('email')}/></Field>
   <button className="primary" disabled={create.isPending}>建立Person</button><ErrorBox error={create.error}/>
  </form></details></Card>
  <Card title="搜尋"><div className="form"><Field label="姓名／手機／Email"><input value={search} onChange={e=>setSearch(e.target.value)}/></Field><p className="muted">搜尋結果可在會員申請Wizard中直接選取。</p></div></Card></div>
  <Card title="Person清單"><ErrorBox error={people.error}/>{people.isPending?<LoadingState/>:!people.error&&<AdminDataGrid rows={rows} rowId={x=>x.personId} label="Person 清單" columns={[{key:'legalName',label:'法定姓名',value:x=>x.legalName},{key:'preferredName',label:'慣用名稱',value:x=>x.preferredName??'—'},{key:'mobile',label:'手機',value:x=>x.mobile??'—'},{key:'email',label:'Email',value:x=>x.email??'—'},{key:'id',label:'Person ID',value:x=>x.personId},{key:'detail',label:'詳細',value:x=>x.legalName,render:x=><button aria-label={'查看 '+x.legalName} onClick={()=>setSelected(x)}>查看</button>}]}/>}</Card>
  <DetailDrawer open={!!selected} title="Person Identity" onClose={()=>setSelected(null)}>{selected&&<><dl className="detail-grid"><dt>Person ID</dt><dd>{selected.personId}</dd><dt>姓名</dt><dd>{selected.legalName}</dd><dt>Person 狀態</dt><dd><StatusBadge status={selected.status??'UNAVAILABLE'}/></dd><dt>Email</dt><dd>{selected.email??'未提供'}</dd><dt>手機</dt><dd>{selected.mobile??'未提供'}</dd></dl><EmptyState title="LINE／KYC／完整 Qualifications 待接入"><p>目前 Person read API 未提供這些欄位，不由姓名推定資格持有人。</p><Link to="/qualifications">開啟 Qualification 管理</Link></EmptyState></>}</DetailDrawer>
 </>
}
