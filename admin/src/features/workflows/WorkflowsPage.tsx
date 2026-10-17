import {uiText,domainLabel} from "../../../../shared/design-system/i18n";
import {ConfirmAction} from '../../components/ConfirmAction';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {command,get,qs} from '../../lib/api';
import {Qualification,Person} from '../../types/domain';
import {Badge,Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {SearchOption,SearchSelect} from '../../components/SearchSelect';
import {dateTime,money} from '../../lib/format';

export function WorkflowsPage(){
 const qc=useQueryClient();const [status,setStatus]=useState('SUBMITTED'),[type,setType]=useState(''),[search,setSearch]=useState(''),[selected,setSelected]=useState<string|null>(null);
 const [qualification,setQualification]=useState<SearchOption|null>(null),[newType,setNewType]=useState('UPGRADE'),[receiver,setReceiver]=useState<SearchOption|null>(null),[company,setCompany]=useState<SearchOption|null>(null),[target,setTarget]=useState(''),[feePaid,setFeePaid]=useState(false);
 const [error,setError]=useState<unknown>(null),[busy,setBusy]=useState(false);

 const queue=useQuery({queryKey:['workflow-queue',status,type,search],queryFn:()=>get<any>('/admin/operations/workflows'+qs({status:status||undefined,type:type||undefined,q:search,take:100}))});
 const detail=useQuery({queryKey:['workflow-detail',selected],queryFn:()=>get<any>(`/admin/operations/workflows/${selected}`),enabled:!!selected});
 const rows=queue.data?.data??[];const d=detail.data?.data;

 async function qualSearch(q:string){const r:any=await get('/admin/qualifications'+qs({q,status:'EFFECTIVE',take:20}));return (r.data as Qualification[]).map(x=>({id:x.qualificationId,primary:`${x.ballNo??uiText("未放置 Ball")} · ${x.currentHolder?.legalName??'—'}`,secondary:`${x.currentHolder?.memberNo??'會員編號未提供'} · ${x.planLevelCode}`}))}
 async function personSearch(q:string){const r:any=await get('/admin/persons'+qs({q,take:20}));return (r.data as Person[]).map(x=>({id:x.personId,primary:x.legalName,secondary:[x.memberNo,x.mobile,x.email].filter(Boolean).join(' · ')}))}
 async function submit(){
  if(!qualification)return;setBusy(true);setError(null);
  try{
   const payload:any={reviewFeePaid:feePaid};
   if(newType==='EXIT'&&company)payload.companyHolderPersonId=company.id;
   const r:any=await command('/admin/qualification-workflows',{
    qualificationId:qualification.id,workflowType:newType,
    receivingPersonId:['TRANSFER','COMPANY_RETRANSFER'].includes(newType)?receiver?.id:undefined,
    targetPlanCode:newType==='UPGRADE'?target||undefined:undefined,payload
   });
   setSelected(r.data?.qualificationWorkflowId??null);await qc.invalidateQueries({queryKey:['workflow-queue']});
  }catch(e){setError(e)}finally{setBusy(false)}
 }
 async function approve(){if(!selected)return;setBusy(true);setError(null);try{await command(`/admin/qualification-workflows/${selected}/approve`,{});await qc.invalidateQueries({queryKey:['workflow-queue']});await qc.invalidateQueries({queryKey:['workflow-detail',selected]})}catch(e){setError(e)}finally{setBusy(false)}}

 return <><PageHeader title="升級／轉讓／退出" subtitle={uiText("審核費NT$600；核准後向未來生效。轉讓移轉該 Ball 的全部權利義務，Ball Number 與組織位置不變。")}/>
 <ErrorBox error={error}/>
 <div className="grid two"><Card title={uiText("建立Workflow")}><div className="form">
  <SearchSelect label={uiText("Qualification")} value={qualification} onChange={setQualification} search={qualSearch}/>
  <Field label={uiText("Workflow Type")}><select value={newType} onChange={e=>{setNewType(e.target.value);setReceiver(null);setCompany(null)}}><option value={"UPGRADE"}>{uiText("UPGRADE")}</option><option value={"TRANSFER"}>{uiText("TRANSFER")}</option><option value={"EXIT"}>{uiText("EXIT")}</option><option value={"COMPANY_RETRANSFER"}>{uiText("COMPANY_RETRANSFER")}</option></select></Field>
  {newType==='UPGRADE'&&<Field label={uiText("Target Plan")}><select value={target} onChange={e=>setTarget(e.target.value)}><option value="">選擇…</option><option value={"STARTER"}>{uiText("STARTER")}</option><option value={"ELITE"}>{uiText("ELITE")}</option><option value={"LEADER"}>{uiText("LEADER")}</option></select></Field>}
  {['TRANSFER','COMPANY_RETRANSFER'].includes(newType)&&<SearchSelect label={uiText("Receiving Person")} value={receiver} onChange={setReceiver} search={personSearch}/>}
  {newType==='EXIT'&&<SearchSelect label={uiText("Company Holder Person")} value={company} onChange={setCompany} search={personSearch}/>}
  <label className="checkbox"><input type="checkbox" checked={feePaid} onChange={e=>setFeePaid(e.target.checked)}/> {uiText(" 已確認收取審核費 NT$600")}</label>
  <ConfirmAction className="primary" disabled={!qualification||!feePaid||busy||(newType==='UPGRADE'&&!target)||(['TRANSFER','COMPANY_RETRANSFER'].includes(newType)&&!receiver)||(newType==='EXIT'&&!company)} onConfirm={submit}>{uiText("Submit Workflow")}</ConfirmAction>
 </div></Card>
 <Card title="制度／法務邊界"><p><Badge tone="warn">公司不介入會員間對價</Badge></p><p>轉讓之對價關係由轉讓雙方自行約定；公司只審查會員資格移轉程序。</p><p>{uiText("退出後Qualification由公司持有，公司可再移轉給其他人。")}</p><p>升級只向未來生效，不回溯歷史獎金。</p></Card></div>

 <div className="toolbar"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部狀態</option><option value={"SUBMITTED"}>{uiText("SUBMITTED")}</option><option value={"EFFECTIVE"}>{uiText("EFFECTIVE")}</option><option value={"REJECTED"}>{uiText("REJECTED")}</option><option value={"CANCELLED"}>{uiText("CANCELLED")}</option></select><select value={type} onChange={e=>setType(e.target.value)}><option value="">全部類型</option><option value={"UPGRADE"}>{uiText("UPGRADE")}</option><option value={"TRANSFER"}>{uiText("TRANSFER")}</option><option value={"EXIT"}>{uiText("EXIT")}</option><option value={"COMPANY_RETRANSFER"}>{uiText("COMPANY_RETRANSFER")}</option></select><input value={search} onChange={e=>setSearch(e.target.value)} aria-label={uiText("會員／接收人／Qualification")} placeholder={uiText("會員／接收人／Qualification")}/></div>
 <div className="split-view"><Card title={`Workflow Queue (${rows.length})`}>{rows.map((x:any)=><button key={x.qualificationWorkflowId} className={`list-row ${selected===x.qualificationWorkflowId?'selected':''}`} onClick={()=>setSelected(x.qualificationWorkflowId)}><strong>{domainLabel(x.workflowType)} · {x.qualification?.ballNo??uiText("Ball evidence 未提供")} · {x.qualification?.currentHolder?.legalName??'—'}</strong><span>{x.qualification?.currentHolder?.memberNo??'會員編號未提供'} · {domainLabel(x.status)} {uiText(" · Review Fee ")}{money(x.reviewFee)}</span><small>{dateTime(x.submittedAt??x.createdAt)}</small></button>)}</Card>
 <Card title={uiText("Workflow Detail")}>{!d?<p className="muted">{uiText("選擇Workflow。")}</p>:<><dl className="detail-grid"><dt>{uiText("Type")}</dt><dd>{domainLabel(d.workflowType)}</dd><dt>{uiText("Status")}</dt><dd>{domainLabel(d.status)}</dd><dt>{uiText("Ball")}</dt><dd>{d.qualification?.ballNo??uiText("Ball evidence 未提供")}<br/>{d.qualification?.currentHolder?.memberNo??'會員編號未提供'} · {d.qualification?.currentHolder?.legalName??'—'}</dd><dt>{uiText("Receiver")}</dt><dd>{d.receiver?.legalName??'—'}</dd><dt>{uiText("Target Plan")}</dt><dd>{d.targetPlanCode??'—'}</dd><dt>{uiText("Review Fee")}</dt><dd>{money(d.reviewFee)} · {d.payload?.reviewFeePaid?'已確認':'未確認'}</dd><dt>{uiText("Submitted")}</dt><dd>{dateTime(d.submittedAt)}</dd><dt>{uiText("Effective")}</dt><dd>{dateTime(d.effectiveAt)}</dd></dl>{d.status==='SUBMITTED'&&<button className="primary sticky-actions" disabled={busy||d.payload?.reviewFeePaid!==true} onClick={approve}>{uiText("Approve（Server Time，禁止回溯）")}</button>}</>}</Card></div>
 </>
}
