import {QualificationDetail} from '../qualifications/QualificationDetail';
import {AdminDataGrid} from '../../components/AdminDataGrid';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useForm} from 'react-hook-form';
import {command,get,qs} from '../../lib/api';
import {Person} from '../../types/domain';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {useState} from 'react';
import {DetailDrawer,StatusBadge,EmptyState,LoadingState,ErrorState} from '@ucell/design-system';
import {ConfirmAction} from '../../components/ConfirmAction';

type CreatePersonForm={legalName:string;preferredName?:string;birthDate?:string;mobile?:string;email?:string};
type Admin360={
 organization?:{status?:string;treeCode?:string|null};
 owner?:{status?:string;ownerType?:'MEMBER'|'COMPANY'|null;memberNo?:string|null;companyCode?:string|null};
 plan?:{status?:string;planCode?:string|null};
 globalRank?:{status?:string;highestRank?:string|null};
};

function memberLabel(person:Person){return person.memberNo??'會員編號未提供'}
function ballLabel(qualification:any){return qualification?.ballNo??'未完成 Binary 放置'}
function admin360(qualification:any):Admin360|undefined{return qualification?.admin360}
function planLabel(qualification:any){const plan=admin360(qualification)?.plan;return plan?plan.status==='AVAILABLE'&&plan.planCode?plan.planCode:'方案資料未提供':qualification?.planLevelCode??'方案資料未提供'}
function treeLabel(qualification:any){const organization=admin360(qualification)?.organization;return organization?organization.status==='AVAILABLE'&&organization.treeCode?`樹號 ${organization.treeCode}`:'樹資料未提供':'樹資料未提供'}
function rankLabel(qualification:any){const rank=admin360(qualification)?.globalRank;return rank?rank.status==='AVAILABLE'&&rank.highestRank?`全球累積階級 ${rank.highestRank}`:'全球累積階級未提供':'全球累積階級未提供'}
function ownerLabel(qualification:any){const owner=admin360(qualification)?.owner;if(!owner)return qualification?.currentCompanyPrincipalId?'公司持有（歷史讀取）':qualification?.currentHolder?.memberNo?`會員持有 · ${qualification.currentHolder.memberNo}`:'持有證據未提供';if(owner.status!=='AVAILABLE'||!owner.ownerType)return '持有證據未提供';if(owner.ownerType==='COMPANY')return owner.companyCode?`公司持有 · ${owner.companyCode}`:'公司持有';return owner.memberNo?`會員持有 · ${owner.memberNo}`:'會員持有'}

export function PeoplePage(){
 const qc=useQueryClient();
 const [search,setSearch]=useState('');
 const [selected,setSelected]=useState<Person|null>(null);
 const [selectedQualification,setSelectedQualification]=useState<string|null>(null);
 const [qualificationSkip,setQualificationSkip]=useState(0);
 const [createNotice,setCreateNotice]=useState('');
 const [verificationReference,setVerificationReference]=useState('');
 const owned=useQuery({
  queryKey:['person-owned-qualifications',selected?.personId,qualificationSkip],
  queryFn:()=>get<any>('/admin/persons/'+selected!.personId+'/qualifications'+qs({take:20,skip:qualificationSkip})),
  enabled:!!selected
 });
 const people=useQuery({queryKey:['persons',search],queryFn:()=>get<any>('/admin/persons'+qs({q:search,take:50}))});
 const security=useQuery({queryKey:['person-account-security',selected?.personId],queryFn:()=>get<any>('/admin/persons/'+selected!.personId+'/account-security'),enabled:!!selected});
 const securityCommand=useMutation({mutationFn:({path,body}:{path:string;body:Record<string,string>})=>command<any>(path,body),onSuccess:()=>void qc.invalidateQueries({queryKey:['person-account-security',selected?.personId]})});
 const {register,handleSubmit,reset}=useForm<CreatePersonForm>();
 const create=useMutation({
  mutationFn:(v:CreatePersonForm)=>command<any>('/admin/persons',{
   legalName:v.legalName,
   preferredName:v.preferredName||undefined,
   birthDate:v.birthDate||undefined,
   mobile:v.mobile||undefined,
   email:v.email||undefined
  }),
  onSuccess:(response)=>{
   reset();
   const memberNo=response?.data?.memberNo;
   setCreateNotice(memberNo?`Person 已建立，會員編號為 ${memberNo}。`:'Person 已建立，清單已重新載入。');
   void qc.invalidateQueries({queryKey:['persons']});
  }
 });
 const rows:Person[]=people.data?.data??[];
 const ownedRows=owned.data?.data??[];
 const ownedTotal=owned.data?.meta?.total;
 function selectPerson(person:Person){
  setSelected(person);setSelectedQualification(null);setQualificationSkip(0);
 }
 function closeDrawer(){setSelected(null);setSelectedQualification(null)}
 return <>
  <PageHeader title="會員／自然人（Person 360）" subtitle="Person 是自然人身分；每顆 Ball（Qualification）各自擁有組織、PV、Carry、Award 與 Payout 證據。"/>
  <Card title="新增自然人">
   <details>
    <summary>開啟 Person 建立表單</summary>
    <form className="form" onSubmit={handleSubmit(v=>create.mutate(v))} aria-describedby="person-create-hint">
     <p id="person-create-hint" className="muted">建立後由伺服器分配不可變的十位會員編號。建立 Person 不會自動建立 Ball。</p>
     <Field label="法定姓名"><input required autoComplete="name" {...register('legalName',{required:true})}/></Field>
     <Field label="慣用名稱"><input autoComplete="nickname" {...register('preferredName')}/></Field>
     <Field label="生日"><input type="date" autoComplete="bday" {...register('birthDate')}/></Field>
     <Field label="手機"><input inputMode="tel" autoComplete="tel" {...register('mobile')}/></Field>
     <Field label="Email"><input type="email" autoComplete="email" {...register('email')}/></Field>
     <div className="button-row"><button className="primary" type="submit" disabled={create.isPending}>建立 Person</button><button type="button" disabled={create.isPending} onClick={()=>{reset();setCreateNotice('')}}>清除欄位</button></div>
     <ErrorBox error={create.error}/>
    </form>
   </details>
   {createNotice&&<p role="status" aria-live="polite" className="tree-notice">{createNotice}</p>}
  </Card>

  <Card title="Person 清單">
   {people.isPending?<LoadingState label="正在載入 Person 清單…"/>:people.error?<ErrorState message={String(people.error)} retry={()=>void people.refetch()}/>:<AdminDataGrid key={search} toolbar={<Field label="會員編號／姓名／手機／Email"><input value={search} onChange={e=>{setSearch(e.target.value);closeDrawer()}} placeholder="輸入 Member Number 或聯絡資料"/></Field>} rows={rows} rowId={x=>x.personId} label="Person 清單" columns={[
    {key:'memberNo',label:'會員編號',value:x=>memberLabel(x)},
    {key:'legalName',label:'法定姓名',value:x=>x.legalName},
    {key:'preferredName',label:'慣用名稱',value:x=>x.preferredName??'—'},
    {key:'mobile',label:'手機',value:x=>x.mobile??'—'},
    {key:'email',label:'Email',value:x=>x.email??'—'},
    {key:'status',label:'狀態',value:x=>x.status??'UNAVAILABLE',render:x=><StatusBadge status={x.status??'UNAVAILABLE'}/>},
    {key:'detail',label:'詳細',value:x=>x.legalName,render:x=><button type="button" aria-label={'查看 '+x.legalName+' 的會員 360'} aria-expanded={selected?.personId===x.personId} onClick={()=>selectPerson(x)}>查看會員 360</button>}
   ]}/>}</Card>

  <DetailDrawer open={!!selected} title={selected?'會員 360 · '+memberLabel(selected):'會員 360'} onClose={closeDrawer}>
   {selected&&<section aria-live="polite">
    <dl className="detail-grid"><dt>會員編號</dt><dd>{memberLabel(selected)}</dd><dt>姓名</dt><dd>{selected.legalName}</dd><dt>會員狀態</dt><dd><StatusBadge status={selected.status??'UNAVAILABLE'}/></dd><dt>Ball 數量</dt><dd>{owned.isPending?'讀取中':ownedTotal??'未提供'}</dd><dt>Email</dt><dd>{selected.email??'未提供'}</dd><dt>手機</dt><dd>{selected.mobile??'未提供'}</dd></dl>
    <section aria-labelledby="person-ball-portfolio"><h3 id="person-ball-portfolio">Ball Portfolio</h3>
     {owned.isPending?<LoadingState label="正在載入此會員的 Ball…"/>:owned.error?<ErrorState message={String(owned.error)} retry={()=>void owned.refetch()}/>:ownedRows.length?<><p className="uc-muted">權威清單共 {ownedTotal??'—'} 顆 Ball；依目前持有人查詢。Ball 的歷史持有人與獎金主張請於各 Ball 詳情查看。</p>{ownedRows.map((q:any)=><button type="button" className={`list-row ${selectedQualification===q.qualificationId?'selected':''}`} key={q.qualificationId} aria-label={`開啟球編號 ${ballLabel(q)} 的 Ball 360`} aria-pressed={selectedQualification===q.qualificationId} onClick={()=>setSelectedQualification(q.qualificationId)}><strong>{ballLabel(q)} · {planLabel(q)}</strong><span>{treeLabel(q)} · {rankLabel(q)} · {q.status??'狀態未提供'} · {ownerLabel(q)}</span></button>)}<div className="button-row"><button type="button" disabled={!qualificationSkip} onClick={()=>setQualificationSkip(s=>Math.max(0,s-20))}>上一批 Ball</button><button type="button" disabled={ownedTotal===undefined||qualificationSkip+20>=ownedTotal} onClick={()=>setQualificationSkip(s=>s+20)}>下一批 Ball</button></div></>:<EmptyState title="此會員尚無 Ball"><p>建立 Person 不會自動產生 Ball；請依正式申請與核准流程建立資格。</p></EmptyState>}
    </section>
    {selectedQualification&&<section aria-label="已選取 Ball 詳情"><QualificationDetail key={selectedQualification} id={selectedQualification}/></section>}
    <section aria-labelledby="person-account-security"><h3 id="person-account-security">帳號安全</h3>
     {security.isPending?<LoadingState label="正在讀取帳號安全狀態…"/>:security.error?<ErrorState message={String(security.error)} retry={()=>void security.refetch()}/>:<>{(()=>{const value=security.data?.data;const links=value?.identityLinks??[];const masked=(subject:string)=>subject.length<7?'已綁定 LINE':subject.slice(0,3)+'•••'+subject.slice(-3);return <>
      <dl className="detail-grid"><dt>安全狀態</dt><dd><StatusBadge status={value?.securityStatus??'UNAVAILABLE'}/></dd><dt>LINE 綁定</dt><dd>{links.length?links.map((link:any)=><span key={link.identityLinkId}>{masked(link.providerSubject)} · {link.status}<br/></span>):'尚無 LINE 綁定'}</dd><dt>換綁申請</dt><dd>{value?.accountRecoveryRequests?.[0]?.status??'無'}</dd></dl>
      <h4>安全稽核紀錄</h4>{value?.timeline?.length?<ul>{value.timeline.map((event:any,index:number)=><li key={index}>{event.occurredAt} · {event.action}{event.reasonCode?` · ${event.reasonCode}`:''}</li>)}</ul>:<p className="uc-muted">尚無帳號安全稽核紀錄。</p>}
      <div className="button-row"><ConfirmAction reasonRecorded disabled={securityCommand.isPending} onConfirm={reason=>securityCommand.mutateAsync({path:'/admin/persons/'+selected.personId+'/account-security/lock',body:{reasonCode:reason}})}>鎖定帳號</ConfirmAction><ConfirmAction reasonRecorded disabled={securityCommand.isPending} onConfirm={reason=>securityCommand.mutateAsync({path:'/admin/persons/'+selected.personId+'/account-security/line-binding/revoke',body:{reasonCode:reason}})}>撤銷 LINE 綁定</ConfirmAction></div>
      <Field label="換綁驗證參考編號"><input value={verificationReference} onChange={e=>setVerificationReference(e.target.value)} maxLength={160} placeholder="例如 CASE-20260924-001"/></Field>
      <ConfirmAction reasonRecorded disabled={securityCommand.isPending||verificationReference.trim().length<8} onConfirm={reason=>securityCommand.mutateAsync({path:'/admin/persons/'+selected.personId+'/account-security/line-rebind-requests',body:{reasonCode:reason,verificationReference}})}>建立 LINE 換綁申請</ConfirmAction><ErrorBox error={securityCommand.error}/>
     </>})()}</>}
    </section>
   </section>}
  </DetailDrawer>
 </>;
}
