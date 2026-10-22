import {uiValue,uiText} from "../../../../shared/design-system/i18n";
import {QualificationDetail} from './QualificationDetail';
import {QualificationReturnReviews} from './QualificationReturnReviews';
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
 if(qualification.kind==='COMPANY_BOOTSTRAP')return uiText("方案請於 Ball 360 確認");
 return qualification.kind==='MEMBER_ORIGIN'&&qualification.planLevelCode?qualification.planLevelCode:uiText("Plan 未提供");
}

/** Never convert a raw Company owner field into an Always Active assertion. */
export function listActivityLabel(qualification:Qualification):ListActivity{
 if(qualification.kind==='COMPANY_BOOTSTRAP'||qualification.currentCompanyPrincipalId)return {label:uiText("Active 狀態請於 Ball 360 確認"),tone:'neutral'};
 return qualification.activeFlag?{label:uiText("ACTIVE"),tone:'ok'}:{label:uiText("INACTIVE"),tone:'neutral'};
}

export function QualificationsPage(){
 const [params]=useSearchParams();
 const [search,setSearch]=useState(''),[status,setStatus]=useState(''),[selected,setSelected]=useState<string|null>(null);
 const list=useQuery({queryKey:['qualifications',search,status],queryFn:()=>get<any>('/admin/qualifications'+qs({q:search,status:status||undefined,take:100}))});
 const rows:Qualification[]=list.data?.data??[];

 useEffect(()=>{
   const id=params.get('qualificationId');
   if(id)setSelected(id);
 },[params]);
 return <><PageHeader title={uiText("Ball 管理（Qualification 360）")} subtitle={uiText("每顆 Ball 是制度運算、組織、PV、Carry、Award 與 Payout 的獨立單位；畫面以 Ball Number 與 Member Number 呈現。")}/><QualificationReturnReviews/>
 <div className="toolbar" role="search" aria-label={uiText("Ball 搜尋")}><input value={search} onChange={e=>{setSearch(e.target.value);setSelected(null)}} aria-label={uiText("Ball Number／會員編號／持有人姓名／手機／Email")} placeholder={uiText("Ball Number／會員編號／持有人姓名／手機／Email")}/><select aria-label={uiText("Qualification 狀態")} value={status} onChange={e=>{setStatus(e.target.value);setSelected(null)}}><option value="">全部狀態</option><option value="DRAFT">待建球／待安置</option><option value={"EFFECTIVE"}>{uiText("EFFECTIVE")}</option><option value={"CLOSED"}>{uiText("CLOSED")}</option><option value={"SUSPENDED"}>{uiText("SUSPENDED")}</option></select></div>
 <div className="uc-master-detail"><Card title={`Ball 清單${list.isSuccess?' ('+rows.length+')':''}`}><section aria-live="polite" aria-busy={list.isPending}>{list.isPending?<LoadingState label={uiText("正在載入 Ball 清單…")}/>:list.error?<ErrorState message={String(list.error)} retry={()=>void list.refetch()}/>:rows.length?<>{rows.map(x=>{const activity=listActivityLabel(x);return <button type="button" aria-pressed={selected===x.qualificationId} aria-controls="ball-detail" className={`list-row ${selected===x.qualificationId?'selected':''}`} key={x.qualificationId} onClick={()=>setSelected(x.qualificationId)}><strong>{x.kind==='MEMBER_ORIGIN'&&<QualificationEmblem code={x.planLevelCode??''} compact/>} {x.ballNo??"尚未編配球號"} · {holderName(x)}</strong><span>{x.currentHolder?.memberNo??'會員編號未提供'} · {listPlanLabel(x)} · <Badge tone="neutral">{x.status==='DRAFT'?'待建球／待安置':uiValue(x.status)}</Badge> · <Badge tone={activity.tone}>{uiValue((activity.label))}</Badge></span></button>})}</>:<EmptyState title={uiText("沒有符合條件的 Ball")}><p>{uiText("請調整 Ball Number、Member Number 或狀態條件。空白結果不會被推定為零或不存在的歷史資料。")}</p></EmptyState>}</section></Card>
 <Card title={uiText("Ball 360")}><section id="ball-detail" aria-live="polite">{selected?<QualificationDetail key={selected} id={selected}/>:<EmptyState title={uiText("請選擇一顆 Ball")}><p>{uiText("清單使用公開的 Ball Number 與 Member Number；內部 Qualification UUID 不會在正常營運畫面顯示。")}</p></EmptyState>}</section></Card></div></>
}
