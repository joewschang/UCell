import {QualificationDetail} from './QualificationDetail';
import {useQuery} from '@tanstack/react-query';
import {useEffect,useState} from 'react';
import {get,qs} from '../../lib/api';
import {Qualification} from '../../types/domain';
import {Badge,Card,PageHeader} from '../../components/ui';
import {holderName} from '../../lib/format';
import {useSearchParams} from 'react-router-dom';
import {EmptyState,ErrorState,LoadingState,QualificationEmblem} from '@ucell/design-system';

type ListActivity={label:string;tone:'ok'|'neutral'};

/** The list endpoint does not include the bounded Company bootstrap binding. */
export function listPlanLabel(qualification:Qualification){
 if(qualification.kind==='COMPANY_BOOTSTRAP')return '方案請於 Ball 360 確認';
 return qualification.kind==='MEMBER_ORIGIN'&&qualification.planLevelCode?qualification.planLevelCode:'Plan 未提供';
}

/** Never convert a raw Company owner field into an Always Active assertion. */
export function listActivityLabel(qualification:Qualification):ListActivity{
 if(qualification.kind==='COMPANY_BOOTSTRAP'||qualification.currentCompanyPrincipalId)return {label:'Active 狀態請於 Ball 360 確認',tone:'neutral'};
 return qualification.activeFlag?{label:'ACTIVE',tone:'ok'}:{label:'INACTIVE',tone:'neutral'};
}

export function QualificationsPage(){
 const [params]=useSearchParams();
 const [search,setSearch]=useState(''),[status,setStatus]=useState('EFFECTIVE'),[selected,setSelected]=useState<string|null>(null);
 const list=useQuery({queryKey:['qualifications',search,status],queryFn:()=>get<any>('/admin/qualifications'+qs({q:search,status:status||undefined,take:100}))});
 const rows:Qualification[]=list.data?.data??[];

 useEffect(()=>{
   const id=params.get('qualificationId');
   if(id)setSelected(id);
 },[params]);
 return <><PageHeader title="Ball 管理（Qualification 360）" subtitle="每顆 Ball 是制度運算、組織、PV、Carry、Award 與 Payout 的獨立單位；畫面以 Ball Number 與 Member Number 呈現。"/>
 <div className="toolbar" role="search" aria-label="Ball 搜尋"><input value={search} onChange={e=>{setSearch(e.target.value);setSelected(null)}} aria-label="Ball Number／會員編號／持有人姓名／手機／Email" placeholder="Ball Number／會員編號／持有人姓名／手機／Email"/><select aria-label="Qualification 狀態" value={status} onChange={e=>{setStatus(e.target.value);setSelected(null)}}><option value="">全部狀態</option><option>EFFECTIVE</option><option>CLOSED</option><option>SUSPENDED</option></select></div>
 <div className="uc-master-detail"><Card title={`Ball 清單${list.isSuccess?' ('+rows.length+')':''}`}><section aria-live="polite" aria-busy={list.isPending}>{list.isPending?<LoadingState label="正在載入 Ball 清單…"/>:list.error?<ErrorState message={String(list.error)} retry={()=>void list.refetch()}/>:rows.length?<>{rows.map(x=>{const activity=listActivityLabel(x);return <button type="button" aria-pressed={selected===x.qualificationId} aria-controls="ball-detail" className={`list-row ${selected===x.qualificationId?'selected':''}`} key={x.qualificationId} onClick={()=>setSelected(x.qualificationId)}><strong><QualificationEmblem code={x.planLevelCode??''} compact/> {x.ballNo??'未放置 Ball'} · {holderName(x)}</strong><span>{x.currentHolder?.memberNo??'會員編號未提供'} · {listPlanLabel(x)} · <Badge tone={activity.tone}>{activity.label}</Badge></span></button>})}</>:<EmptyState title="沒有符合條件的 Ball"><p>請調整 Ball Number、Member Number 或狀態條件。空白結果不會被推定為零或不存在的歷史資料。</p></EmptyState>}</section></Card>
 <Card title="Ball 360"><section id="ball-detail" aria-live="polite">{selected?<QualificationDetail key={selected} id={selected}/>:<EmptyState title="請選擇一顆 Ball"><p>清單使用公開的 Ball Number 與 Member Number；內部 Qualification UUID 不會在正常營運畫面顯示。</p></EmptyState>}</section></Card></div></>
}
