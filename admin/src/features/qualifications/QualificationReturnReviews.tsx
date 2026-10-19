import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {get,command} from '../../lib/api';
import {useAuth} from '../auth/auth';
import {Card} from '../../components/ui';
import {LoadingState,ErrorState} from '@ucell/design-system';

type Review={qualificationId:string;orderNo:string;memberNo:string|null;originalPackageType:string;remainingAmount:string};
const plans=[{code:'STARTER',name:'啟航',price:14400},{code:'ELITE',name:'菁英',price:43200},{code:'LEADER',name:'領袖',price:72000}];
function ReviewRow({row,done}:{row:Review;done:()=>void}){
 const [plan,setPlan]=useState(''),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function approve(){setBusy(true);setError('');try{await command(`/admin/qualification-placements/${row.qualificationId}/return-review`,{planLevelCode:plan,reasonCode:reason.trim()});done();}catch(e){setError(String(e));}finally{setBusy(false);}}
 return <div className="list-row"><strong>訂單 {row.orderNo} · 會員 {row.memberNo??'編號未提供'}</strong><p>原套組：{plans.find(p=>p.code===row.originalPackageType)?.name??'未提供'}；保留金額 NT$ {Number(row.remainingAmount).toLocaleString('zh-TW')}</p>
 <label>重新核准級別<select value={plan} onChange={e=>setPlan(e.target.value)} disabled={busy}><option value="">請選擇</option>{plans.filter(p=>p.price<=Number(row.remainingAmount)).map(p=><option key={p.code} value={p.code}>{p.name}</option>)}</select></label>
 {Number(row.remainingAmount)<14400?<p>保留金額未達啟航門檻，無法核准建球。</p>:<><label>審核理由<input maxLength={120} value={reason} onChange={e=>setReason(e.target.value)} disabled={busy}/></label><button type="button" disabled={busy||!plan||!reason.trim()} onClick={()=>void approve()}>{busy?'核准中…':'核准資格級別'}</button></>}
 {error&&<p role="alert">{error}</p>}</div>;
}
export function QualificationReturnReviews(){
 const {user}=useAuth(),allowed=!!user&&['SUPER_ADMIN','MEMBERSHIP_OPS'].includes(user.role);
 const query=useQuery({queryKey:['qualification-return-reviews'],queryFn:()=>get<{data:Review[]}>('/admin/qualification-placements/return-reviews'),enabled:allowed});
 if(!allowed)return null;
 return <Card title="資格套組退貨待審"><p>未建球前部分退貨須重新核准級別；完成審核後才能繼續安排球位。</p>{query.isPending?<LoadingState label="正在載入待審清單…"/>:query.error?<ErrorState message={String(query.error)} retry={()=>void query.refetch()}/>:query.data?.data?.length?query.data.data.map(row=><ReviewRow key={row.qualificationId} row={row} done={()=>void query.refetch()}/>):<p>目前沒有退貨待審資格。</p>}</Card>;
}
