import {useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Card,Field} from '../../components/ui';
import {QueryFeedback} from '../../components/QueryFeedback';
import {ApiError,get,post,qs} from '../../lib/api';
const base='/admin/operations/control';
const roles:Record<string,string>={FINANCE:'財務',COMPLIANCE_AUDIT:'合規稽核',SUPER_ADMIN:'系統管理員'};
const statuses:Record<string,string>={OPEN:'待處理',ACKNOWLEDGED:'已接手',INVESTIGATING:'調查中',COMPLETED:'任務完成',RESOLVED:'例外已結案'};
const date=(value:string|null)=>value?new Date(value).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'未設定';
const localDate=(value:string|null)=>value?new Date(new Date(value).getTime()+8*3600000).toISOString().slice(0,16):'';
type Candidate={stream:string;reference:string;code:string;evidenceHash:string;thresholdHours?:number;cursor?:string;asOf?:string};
export type WorkItem={reference:string;kind:'TASK'|'EXCEPTION';source:{reference:string;link:string|null;orderNo:string|null;fulfillmentKey:string|null};code:string;status:string;priority:string;assigneeRole:string|null;dueAt:string|null;createdAt:string;closedAt:string|null;evidenceHash:string|null};
type Page={items:WorkItem[];nextCursor:string|null;asOf:string;dataThrough:string};
function useWorkCommand(){
 const client=useQueryClient(),last=useRef<{fingerprint:string;key:string}>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(path:string,input:Record<string,unknown>){
  const fingerprint=JSON.stringify([path,input]);if(last.current?.fingerprint!==fingerprint)last.current={fingerprint,key:crypto.randomUUID()};
  setBusy(true);setMessage('');
  try{const response=await post<{data:{value:any;replayed:boolean}}>(path,{...input,commandKey:last.current.key});setMessage(response.data.value.created===false?'相同證據的任務已存在，請在任務佇列檢視。':'已保存處理紀錄。');last.current=undefined;await Promise.all([client.invalidateQueries({queryKey:['operations-work-items']}),client.invalidateQueries({queryKey:['operations-erp-health']})]);return true;}
  catch(error){const code=error instanceof ApiError?(error.body as any)?.code:null;setMessage(code==='OPERATIONS_COMPANY_RECONCILIATION_REQUIRED'?'Company／Reservoir B 證據仍有不一致，請先完成來源對帳再結案。':code==='OPERATIONS_WORKFLOW_COMPLETION_REQUIRED'?'來源工作尚未完成，請先處理結算或月認列，再重新結案。':code==='OPERATIONS_FINANCIAL_RECONCILIATION_REQUIRED'?'來源仍有財務對帳或追回問題，請先完成來源處理再結案。':code==='OPERATIONS_SOURCE_RECONCILIATION_REQUIRED'?'來源尚未完成 ERP 對帳，請先開啟來源證據處理差異，再重新結案。':code==='OPERATIONS_CANDIDATE_STALE'||code==='OPERATIONS_TRANSITION_STALE'?'目前證據或處理狀態已變更，請重新讀取後確認。':error instanceof Error?error.message:'無法保存，請保留輸入後重試。');return false;}
  finally{setBusy(false);}
 }
 return {submit,busy,message};
}
export function CandidateTaskForm({candidate}:{candidate:Candidate}){
 const [role,setRole]=useState('FINANCE'),[due,setDue]=useState(''),command=useWorkCommand();
 return <details><summary>建立處理任務</summary><form onSubmit={async event=>{event.preventDefault();await command.submit(base+'/tasks',{...candidate,assigneeRole:role,...(due?{dueAt:new Date(due+'+08:00').toISOString()}:{})});}}><fieldset disabled={command.busy}><Field label="負責角色"><select value={role} onChange={event=>setRole(event.target.value)}>{Object.entries(roles).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field><Field label="到期日（台北時間，可留白）"><input type="datetime-local" value={due} onChange={event=>setDue(event.target.value)}/></Field><button type="submit">驗證證據並建立任務</button></fieldset><p role="status">{command.message}</p></form></details>;
}
export function WorkItemActions({item}:{item:WorkItem}){
 const [note,setNote]=useState(''),[role,setRole]=useState(item.assigneeRole??'FINANCE'),[due,setDue]=useState(localDate(item.dueAt)),command=useWorkCommand();
 if(['COMPLETED','RESOLVED'].includes(item.status))return <p>結案時間：{date(item.closedAt)}</p>;
 const actions=item.kind==='TASK'?['ACKNOWLEDGED','COMPLETED']:['ACKNOWLEDGED','INVESTIGATING','RESOLVED'],path=base+(item.kind==='TASK'?'/tasks/':'/exceptions/')+item.reference;
 const valid=/^[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}$/.test(note);
 return <details><summary>更新處理紀錄</summary><fieldset disabled={command.busy}><Field label="處理依據參考碼"><input value={note} pattern="[A-Za-z0-9][A-Za-z0-9._:/-]{7,99}" minLength={8} maxLength={100} onChange={event=>setNote(event.target.value)}/></Field><p>填寫 8–100 字元的案件或文件代碼，限英數字及 . _ : / -。</p>{actions.filter(value=>value!==item.status&&(value!=='ACKNOWLEDGED'||item.status==='OPEN')).map(status=><button key={status} disabled={!valid} onClick={()=>void command.submit(path+'/transitions',{status,expectedStatus:item.status,noteReference:note})}>{statuses[status]}</button>)}{item.kind==='TASK'&&<><Field label="改派負責角色"><select value={role} onChange={event=>setRole(event.target.value)}>{Object.entries(roles).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field><Field label="更新到期日（台北時間，留白清除）"><input type="datetime-local" value={due} onChange={event=>setDue(event.target.value)}/></Field><button disabled={!valid} onClick={()=>void command.submit(path+'/assignment',{expectedStatus:item.status,assigneeRole:role,dueAt:due?new Date(due+'+08:00').toISOString():null,noteReference:note})}>保存角色與到期日</button><p>改派以所選角色負責，清除原個別人員指派。</p></>}</fieldset><p role="status">{command.message}</p></details>;
}
export function OperationsWorkItems(){
 const [kind,setKind]=useState<'TASK'|'EXCEPTION'>('TASK'),[status,setStatus]=useState('OPEN'),[cursor,setCursor]=useState<string>(),[asOf,setAsOf]=useState<string>();
 const reset=()=>{setCursor(undefined);setAsOf(undefined);};
 const query=useQuery({queryKey:['operations-work-items',kind,status,cursor,asOf],queryFn:()=>get<{data:Page}>(base+(kind==='TASK'?'/tasks':'/exceptions')+qs({status,take:25,cursor,asOf})),refetchInterval:60_000}),data=query.data?.data;
 return <Card title="營運任務與例外佇列"><p>任務完成僅記錄處理進度。例外結案會重新檢查目前來源對帳證據；來源、付款與會員經濟資料由各自流程更新。</p><div className="filter-grid"><Field label="處理類型"><select value={kind} onChange={event=>{setKind(event.target.value as any);setStatus('OPEN');reset();}}><option value="TASK">任務</option><option value="EXCEPTION">例外</option></select></Field><Field label="處理狀態"><select value={status} onChange={event=>{setStatus(event.target.value);reset();}}><option value="">全部狀態</option>{(kind==='TASK'?['OPEN','ACKNOWLEDGED','COMPLETED']:['OPEN','ACKNOWLEDGED','INVESTIGATING','RESOLVED']).map(value=><option key={value} value={value}>{statuses[value]}</option>)}</select></Field></div><button disabled={query.isFetching} onClick={()=>void query.refetch()}>重新讀取處理佇列</button><QueryFeedback query={query} empty={!!data&&!data.items.length}/>{data&&!query.error&&<><p>建立範圍截至 {date(data.asOf)}；狀態讀取時間 {date(data.dataThrough)}。每頁最多 25 筆。</p><div className="table-wrap"><table><thead><tr><th>來源及處理依據</th><th>進度</th><th>角色／到期日</th><th>操作</th></tr></thead><tbody>{data.items.map(item=><tr key={item.reference}><td>{item.source.orderNo?'訂單 '+item.source.orderNo:'來源證據'}{item.source.link&&<p><a href={item.source.link}>開啟來源證據</a></p>}<details><summary>商業參考碼</summary><p>{item.reference}</p><p>{item.source.reference}</p><p>{item.code}</p><p>{item.evidenceHash}</p></details></td><td>{statuses[item.status]??item.status}<p>{({CRITICAL:'緊急',HIGH:'高',WARNING:'注意',NORMAL:'一般'} as Record<string,string>)[item.priority]??item.priority}</p></td><td>{item.assigneeRole?roles[item.assigneeRole]:'尚未指派角色'}<p>{date(item.dueAt)}</p></td><td><WorkItemActions key={JSON.stringify([item.reference,item.status,item.assigneeRole,item.dueAt])} item={item}/></td></tr>)}</tbody></table></div>{data.nextCursor&&<button onClick={()=>{setCursor(data.nextCursor!);setAsOf(data.asOf);}}>處理佇列下一頁</button>}{cursor&&<button onClick={reset}>處理佇列第一頁</button>}</>}</Card>;
}
