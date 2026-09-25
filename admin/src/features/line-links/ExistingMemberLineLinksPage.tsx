import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {command,get,qs} from '../../lib/api';
import {Card,ErrorBox,PageHeader} from '../../components/ui';
import {EmptyState,ErrorState,LoadingState,StatusBadge} from '@ucell/design-system';

export function ExistingMemberLineLinksPage(){
 const [status,setStatus]=useState('PENDING'),qc=useQueryClient();
 const queue=useQuery({queryKey:['existing-member-line-links',status],queryFn:()=>get<any>('/admin/existing-member-line-links'+qs({status:status||undefined}))});
 const approve=useMutation({mutationFn:(id:string)=>command<any>('/admin/existing-member-line-links/'+id+'/approve',{}),onSuccess:()=>void qc.invalidateQueries({queryKey:['existing-member-line-links']})});
 const rows=queue.data?.data??[];
 return <><PageHeader title="既有會員 LINE 補綁" subtitle="僅處理已驗證 LINE subject 的補綁申請；completion token 不會顯示、保存或寫入瀏覽器。"/><Card title="補綁申請佇列"><label>狀態 <select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部</option><option>PENDING</option><option>APPROVED</option><option>COMPLETED</option></select></label>{queue.isPending?<LoadingState label="正在載入補綁申請…"/>:queue.error?<ErrorState message={String(queue.error)} retry={()=>void queue.refetch()}/>:!rows.length?<EmptyState title="目前沒有補綁申請"/>:<table><thead><tr><th>會員編號</th><th>姓名</th><th>核驗參考</th><th>建立時間</th><th>狀態</th><th>操作</th></tr></thead><tbody>{rows.map((row:any)=><tr key={row.requestId}><td>{row.memberNo}</td><td>{row.memberName}</td><td>{row.verificationReference??'—'}</td><td>{row.createdAt}</td><td><StatusBadge status={row.status}/></td><td>{row.status==='PENDING'?<button disabled={approve.isPending} onClick={()=>approve.mutate(row.requestId)}>核准並依受控流程交付</button>:'—'}</td></tr>)}</tbody></table>}<ErrorBox error={approve.error}/>{approve.isSuccess&&<p role="status">已核准。請依受控 out-of-band 流程交付；此頁不顯示或保存 token。</p>}</Card></>;
}
