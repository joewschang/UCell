import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {command,get} from '../../lib/api';
import {Badge,Card,ErrorBox,Field,PageHeader} from '../../components/ui';
import {AdminTable} from '../../components/AdminTable';
import {useAuth} from '../auth/auth';

type Job={id:string;kind:string;periodStart:string;periodEnd:string;ruleVersionCode:string;approvalReference:string;createdAt:string;status:string;attemptCount:number;availableAt:string;lastError?:string|null;completedAt?:string|null};
const tone=(status:string)=>status==='PROCESSED'?'ok':status==='DEAD'?'danger':status==='PROCESSING'?'warn':'neutral';
const when=(value?:string|null)=>value?new Date(value).toLocaleString('zh-TW'):'—';

export function SettlementJobsPage(){
 const {user}=useAuth(),client=useQueryClient();
 const [status,setStatus]=useState(''),[reason,setReason]=useState('人工確認來源已就緒，重新排程執行。');
 const query=useQuery({queryKey:['settlement-jobs',status],queryFn:()=>get<{data:Job[]}>(`/admin/settlement-jobs?take=100${status?'&status='+status:''}`),refetchInterval:15000});
 const retry=useMutation({mutationFn:(id:string)=>command(`/admin/settlement-jobs/${id}/retry`,{reason}),onSuccess:()=>client.invalidateQueries({queryKey:['settlement-jobs']})});
 const rows=query.data?.data??[],canRetry=['SUPER_ADMIN','FINANCE'].includes(user?.role??'');
 return <><PageHeader title="結算工作" subtitle="查看受治理的 period-close 工作、依賴等待、Worker 狀態與完成時間；重新排程不會改寫既有結算或歷史證據。" actions={<button onClick={()=>query.refetch()} disabled={query.isFetching}>重新整理</button>}/>
 <ErrorBox error={query.error??retry.error}/><Card title="篩選與安全重試"><div className="filter-grid"><Field label="執行狀態"><select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部</option>{['PENDING','PROCESSING','PROCESSED','DEAD'].map(x=><option key={x}>{x}</option>)}</select></Field><Field label="重試原因" hint="只會重新排程尚未完成的工作；Worker 仍會重驗依賴、參數與 fenced lease。"><input value={reason} minLength={3} maxLength={500} onChange={e=>setReason(e.target.value)}/></Field></div></Card>
 <Card title={`近期工作（${rows.length}）`}>{query.isPending?<p>正在載入結算工作…</p>:rows.length===0?<p>目前沒有符合條件的結算工作。</p>:<div className="table-wrap"><AdminTable><thead><tr><th>種類／期間</th><th>規則／核准</th><th>狀態</th><th>嘗試</th><th>可執行／完成</th><th>操作</th></tr></thead><tbody>{rows.map(row=><tr key={row.id}><td><strong>{row.kind}</strong><br/><small>{when(row.periodStart)} → {when(row.periodEnd)}</small></td><td>{row.ruleVersionCode}<br/><small>{row.approvalReference}</small></td><td><Badge tone={tone(row.status)}>{row.status}</Badge>{row.lastError&&<><br/><small>上次執行失敗；詳細技術證據請由 Audit 查閱。</small></>}</td><td>{row.attemptCount}</td><td>{row.completedAt?when(row.completedAt):when(row.availableAt)}</td><td><button disabled={!canRetry||retry.isPending||!reason.trim()||row.status==='PROCESSED'||(row.status==='PROCESSING'&&new Date(row.availableAt)>new Date())} onClick={()=>retry.mutate(row.id)}>重新排程</button></td></tr>)}</tbody></AdminTable></div>}<p className="muted">頁面不顯示工作 UUID、來源 snapshot UUID 或 Worker lease owner；Compliance 可唯讀，只有 Finance／Super Admin 可重新排程。</p></Card></>;
}
