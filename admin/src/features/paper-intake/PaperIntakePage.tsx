import {useQuery} from '@tanstack/react-query';
import {useState} from 'react';
import {get,qs} from '../../lib/api';
import {Card,PageHeader} from '../../components/ui';
import {EmptyState,ErrorState,LoadingState,StatusBadge} from '@ucell/design-system';

export function PaperIntakePage(){
 const [status,setStatus]=useState('');
 const query=useQuery({queryKey:['paper-applications',status],queryFn:()=>get<any>('/admin/paper-applications'+qs({status:status||undefined,take:100}))});
 const rows=query.data?.data??[];
 return <><PageHeader title="紙本申請 Intake" subtitle="僅處理已存在的 Person。紙本證件原文與敏感身分資料不會顯示於此頁。"/>
 <Card title="紙本申請與訂單"><label>狀態 <select value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部</option><option>OPEN</option><option>ORDER_CREATED</option></select></label>
 {query.isPending?<LoadingState label="正在載入紙本申請…"/>:query.error?<ErrorState message={String(query.error)} retry={()=>void query.refetch()}/>:!rows.length?<EmptyState title="目前沒有紙本申請"/>:<div className="table-wrap"><table><thead><tr><th>紙本申請編號</th><th>會員編號</th><th>收件時間</th><th>狀態</th><th>訂單</th><th>付款</th></tr></thead><tbody>{rows.map((row:any)=><tr key={row.paperApplicationNo}><td>{row.paperApplicationNo}</td><td>{row.memberNo}</td><td>{row.receivedAt}</td><td><StatusBadge status={row.status}/></td><td>{row.order?`#${row.order.orderNo} · ${row.order.purpose}`:'—'}</td><td>{row.order?.status??'—'}</td></tr>)}</tbody></table></div>}
 </Card></>;
}
