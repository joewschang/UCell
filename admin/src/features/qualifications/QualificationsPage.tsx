import {QualificationDetail} from './QualificationDetail';
import {useQuery} from '@tanstack/react-query';
import {useEffect,useState} from 'react';
import {get,qs} from '../../lib/api';
import {Qualification} from '../../types/domain';
import {Badge,Card,ErrorBox,PageHeader} from '../../components/ui';
import {dateTime,holderName,qNo} from '../../lib/format';
import {useSearchParams} from 'react-router-dom';

export function QualificationsPage(){
 const [params]=useSearchParams();
 const [search,setSearch]=useState(''),[status,setStatus]=useState('EFFECTIVE'),[selected,setSelected]=useState<string|null>(null);
 const list=useQuery({queryKey:['qualifications',search,status],queryFn:()=>get<any>('/admin/qualifications'+qs({q:search,status:status||undefined,take:100}))});
 const rows:Qualification[]=list.data?.data??[];

 useEffect(()=>{
   const id=params.get('qualificationId');
   if(id)setSelected(id);
 },[params]);
 return <><PageHeader title="會員資格（球）" subtitle="Qualification是UCell制度運算、組織、PV、Carry、Award與Payout的獨立單位。"/>
 <div className="toolbar"><input aria-label="Qualification 搜尋" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Qualification ID／持有人姓名／手機／Email"/><select aria-label="Qualification 狀態" value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部狀態</option><option>EFFECTIVE</option><option>CLOSED</option><option>SUSPENDED</option></select></div>
 <ErrorBox error={list.error}/><div className="uc-master-detail"><Card title={`Qualifications (${rows.length})`}>{rows.map(x=><button className={`list-row ${selected===x.qualificationId?'selected':''}`} key={x.qualificationId} onClick={()=>setSelected(x.qualificationId)}><strong>Q#{qNo(x.qualificationNo)} · {x.currentHolder?.legalName??'—'}</strong><span>{x.planLevelCode} · <Badge tone={x.activeFlag?'ok':'neutral'}>{x.activeFlag?'ACTIVE':'NOT ACTIVE'}</Badge></span><small>{x.qualificationId}</small></button>)}</Card>
 <Card title="Qualification詳情">{selected?<QualificationDetail key={selected} id={selected}/>:<p className="muted">請選擇一顆會員資格。</p>}</Card></div></>
}
