import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {command,get,qs} from '../../lib/api';
import {Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {EmptyState,ErrorState,LoadingState,StatusBadge} from '@ucell/design-system';
import {SearchOption,SearchSelect} from '../../components/SearchSelect';

export function PaperIntakePage(){
 const [status,setStatus]=useState(''),qc=useQueryClient();
 const [person,setPerson]=useState<SearchOption|null>(null),[paperApplicationNo,setPaperApplicationNo]=useState(''),[receivedAt,setReceivedAt]=useState(''),[evidenceDocumentRef,setEvidenceDocumentRef]=useState('');
 const query=useQuery({queryKey:['paper-applications',status],queryFn:()=>get<any>('/admin/paper-applications'+qs({status:status||undefined,take:100}))});
 const create=useMutation({mutationFn:()=>command<any>('/admin/paper-applications',{personId:person!.id,paperApplicationNo,receivedAt:new Date(receivedAt).toISOString(),evidenceDocumentRef:evidenceDocumentRef||undefined}),onSuccess:()=>{setPaperApplicationNo('');setEvidenceDocumentRef('');setReceivedAt('');void qc.invalidateQueries({queryKey:['paper-applications']});}});
 const rows=query.data?.data??[];
 async function searchPerson(q:string){const response:any=await get('/admin/persons'+qs({q,take:20}));return (response.data??[]).map((x:any)=>({id:x.personId,primary:x.memberNo,secondary:x.legalName??undefined}));}
 return <><PageHeader title="紙本申請 Intake" subtitle="僅處理已存在的 Person。紙本證件原文與敏感身分資料不會顯示於此頁。"/>
 <Card title="建立紙本申請"><div className="form"><SearchSelect label="既有會員" value={person} onChange={setPerson} search={searchPerson} placeholder="輸入會員編號、姓名或聯絡資料"/><Field label="紙本申請編號"><input value={paperApplicationNo} onChange={e=>setPaperApplicationNo(e.target.value)} maxLength={80}/></Field><Field label="收件時間"><input type="datetime-local" value={receivedAt} onChange={e=>setReceivedAt(e.target.value)}/></Field><Field label="受控文件參照（選填）"><input value={evidenceDocumentRef} onChange={e=>setEvidenceDocumentRef(e.target.value)} maxLength={500}/></Field><small className="muted">找不到既有會員時，請依正式 duplicate-review 流程處理；此頁不建立新 Person。</small><button className="primary" disabled={!person||!paperApplicationNo.trim()||!receivedAt||create.isPending} onClick={()=>create.mutate()}>建立紙本申請</button><ErrorBox error={create.error}/>{create.isSuccess&&<p role="status">紙本申請已建立。</p>}</div></Card>
 <Card title="紙本申請與訂單"><label>狀態 <select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部</option><option>OPEN</option><option>ORDER_CREATED</option></select></label>
 {query.isPending?<LoadingState label="正在載入紙本申請…"/>:query.error?<ErrorState message={String(query.error)} retry={()=>void query.refetch()}/>:!rows.length?<EmptyState title="目前沒有紙本申請"/>:<div className="table-wrap"><table><thead><tr><th>紙本申請編號</th><th>會員編號</th><th>收件時間</th><th>狀態</th><th>訂單</th><th>付款</th></tr></thead><tbody>{rows.map((row:any)=><tr key={row.paperApplicationNo}><td>{row.paperApplicationNo}</td><td>{row.memberNo}</td><td>{row.receivedAt}</td><td><StatusBadge status={row.status}/></td><td>{row.order?`#${row.order.orderNo} · ${row.order.purpose}`:'—'}</td><td>{row.order?.status??'—'}</td></tr>)}</tbody></table></div>}
 </Card></>;
}
