import {QualificationDetail} from '../qualifications/QualificationDetail';
import {AdminDataGrid} from '../../components/AdminDataGrid';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useForm} from 'react-hook-form';
import {command,get,qs} from '../../lib/api';
import {Person} from '../../types/domain';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {useState} from 'react';
import {DetailDrawer,StatusBadge,EmptyState,LoadingState,ErrorState} from '@ucell/design-system';
import {Link} from 'react-router-dom';

export function PeoplePage(){
 const qc=useQueryClient();const [search,setSearch]=useState('');
 const [selected,setSelected]=useState<Person|null>(null);const [selectedQualification,setSelectedQualification]=useState<string|null>(null);const [qualificationSkip,setQualificationSkip]=useState(0);
 const owned=useQuery({queryKey:['person-owned-qualifications',selected?.personId,qualificationSkip],queryFn:()=>get<any>('/admin/persons/'+selected!.personId+'/qualifications'+qs({take:20,skip:qualificationSkip})),enabled:!!selected});
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
  <Card title="新增自然人"><details><summary>開啟 Person 建立表單</summary><form className="form" onSubmit={handleSubmit(v=>create.mutate(v))}>
   <Field label="法定姓名"><input {...register('legalName',{required:true})}/></Field>
   <Field label="慣用名稱"><input {...register('preferredName')}/></Field>
   <Field label="生日"><input type="date" {...register('birthDate')}/></Field>
   <Field label="手機"><input {...register('mobile')}/></Field>
   <Field label="Email"><input type="email" {...register('email')}/></Field>
   <button className="primary" disabled={create.isPending}>建立Person</button><ErrorBox error={create.error}/>
  </form></details></Card>

  <Card title="Person清單"><ErrorBox error={people.error}/>{people.isPending?<LoadingState/>:!people.error&&<AdminDataGrid key={search} toolbar={<Field label="姓名／手機／Email"><input value={search} onChange={e=>setSearch(e.target.value)}/></Field>} rows={rows} rowId={x=>x.personId} label="Person 清單" columns={[{key:'legalName',label:'法定姓名',value:x=>x.legalName},{key:'preferredName',label:'慣用名稱',value:x=>x.preferredName??'—'},{key:'mobile',label:'手機',value:x=>x.mobile??'—'},{key:'email',label:'Email',value:x=>x.email??'—'},{key:'id',label:'Person ID',value:x=>x.personId},{key:'detail',label:'詳細',value:x=>x.legalName,render:x=><button aria-label={'查看 '+x.legalName} onClick={()=>{setSelected(x);setSelectedQualification(null);setQualificationSkip(0)}}>查看</button>}]}/>}</Card>
  <DetailDrawer open={!!selected} title="Person Identity" onClose={()=>setSelected(null)}>{selected&&<><dl className="detail-grid"><dt>Person ID</dt><dd>{selected.personId}</dd><dt>姓名</dt><dd>{selected.legalName}</dd><dt>Person 狀態</dt><dd><StatusBadge status={selected.status??'UNAVAILABLE'}/></dd><dt>Email</dt><dd>{selected.email??'未提供'}</dd><dt>手機</dt><dd>{selected.mobile??'未提供'}</dd></dl><h3>Qualifications／Balls</h3>{owned.isPending?<LoadingState/>:owned.error?<ErrorState message={String(owned.error)} retry={()=>void owned.refetch()}/>:owned.data?.data?.length?<><p className="uc-muted">Backend total：{owned.data.meta.total}；依 currentHolderPersonId 精確查詢</p>{owned.data.data.map((q:any)=><button className="list-row" key={q.qualificationId} onClick={()=>setSelectedQualification(q.qualificationId)}><strong>Q#{q.qualificationNo??'—'} · {q.planLevelCode}</strong><span>{q.status} · {q.activeFlag?'Active':'Inactive'}</span></button>)}<div className="button-row"><button disabled={!qualificationSkip} onClick={()=>setQualificationSkip(s=>Math.max(0,s-20))}>上一批資格</button><button disabled={qualificationSkip+20>=owned.data.meta.total} onClick={()=>setQualificationSkip(s=>s+20)}>下一批資格</button></div></>:<EmptyState title="此 Person 尚無 Qualifications"/>}{selectedQualification&&<QualificationDetail key={selectedQualification} id={selectedQualification}/>}<p className="uc-unavailable">LINE／KYC：目前 read API 未提供。</p></>}</DetailDrawer>
 </>
}
