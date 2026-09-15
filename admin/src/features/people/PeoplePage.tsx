import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useForm} from 'react-hook-form';
import {command,get,qs} from '../../lib/api';
import {Person} from '../../types/domain';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {useState} from 'react';

export function PeoplePage(){
 const qc=useQueryClient();const [search,setSearch]=useState('');
 const people=useQuery({queryKey:['persons',search],queryFn:()=>get<any>('/admin/persons'+qs({q:search,take:50}))});
 const {register,handleSubmit,reset}=useForm<{legalName:string;preferredName?:string;birthDate?:string;mobile?:string;email?:string}>();
 const create=useMutation({
  mutationFn:(v:any)=>command('/admin/persons',v),
  onSuccess:()=>{reset();qc.invalidateQueries({queryKey:['persons']})}
 });
 const rows:Person[]=people.data?.data ?? [];
 return <>
  <PageHeader title="會員／自然人" subtitle="Person只代表自然人；同一成年自然人可擁有多個Qualification。"/>
  <div className="grid two"><Card title="新增自然人"><form className="form" onSubmit={handleSubmit(v=>create.mutate(v))}>
   <Field label="法定姓名"><input {...register('legalName',{required:true})}/></Field>
   <Field label="慣用名稱"><input {...register('preferredName')}/></Field>
   <Field label="生日"><input type="date" {...register('birthDate')}/></Field>
   <Field label="手機"><input {...register('mobile')}/></Field>
   <Field label="Email"><input type="email" {...register('email')}/></Field>
   <button className="primary" disabled={create.isPending}>建立Person</button><ErrorBox error={create.error}/>
  </form></Card>
  <Card title="搜尋"><div className="form"><Field label="姓名／手機／Email"><input value={search} onChange={e=>setSearch(e.target.value)}/></Field><p className="muted">搜尋結果可在會員申請Wizard中直接選取。</p></div></Card></div>
  <Card title="Person清單"><ErrorBox error={people.error}/><div className="table-wrap"><table><thead><tr><th>法定姓名</th><th>慣用名稱</th><th>手機</th><th>Email</th><th>Person ID</th></tr></thead><tbody>{rows.map(x=><tr key={x.personId}><td>{x.legalName}</td><td>{x.preferredName}</td><td>{x.mobile}</td><td>{x.email}</td><td className="mono">{x.personId}</td></tr>)}</tbody></table></div></Card>
 </>
}
