import {useQuery} from '@tanstack/react-query';
import {useState} from 'react';
import {Link} from 'react-router-dom';
import {get,qs} from '../../lib/api';
import {useAuth} from '../auth/auth';
import {placementDate,placementStatus} from '../../../../shared/placement-copy';
import {ErrorState,LoadingState} from '@ucell/design-system';
type Row={ballNo:string;memberNo?:string;sponsorBallNo?:string;treeId?:string;status:string;requestedAt:string|null;dueAt:string|null;placedAt:string|null};
type Page={items:Row[];total:number;nextCursor:string|null;counts:{pending:number;overdue:number;placed:number};observedAt:string};
export function PlacementMonitor(){
 const {user}=useAuth(),allowed=['SUPER_ADMIN','MEMBERSHIP_OPS','COMPLIANCE_AUDIT','QUALIFICATION_PLACEMENT_OVERRIDE'].includes(user?.role??'');
 const [status,setStatus]=useState('PLACEMENT_PENDING'),[cursor,setCursor]=useState(''),[previous,setPrevious]=useState<string[]>([]);
 const query=useQuery({queryKey:['placement-monitor',status,cursor],queryFn:()=>get<{data:Page}>('/admin/qualification-placements/dashboard'+qs({status,after:cursor||undefined})),enabled:allowed,refetchInterval:60000});
 if(!allowed)return null;const page=query.data?.data;
 function filter(value:string){setStatus(value);setCursor('');setPrevious([])}
 return <section className="ct-monitor" aria-label="安置狀態監控"><header className="ct-heading"><div><h2>安置狀態監控</h2><p>確認付款與正式會員資格 → 推薦球持有人選位 → 完成安置。逾期由公司追蹤協助，不會自動任意分配位置。</p></div><button disabled={query.isFetching} onClick={()=>void query.refetch()}>更新監控</button></header>
 <nav className="ct-tabs" aria-label="安置狀態篩選">{[['PLACEMENT_PENDING','待安置',page?.counts.pending],['PLACEMENT_OVERDUE','已逾期',page?.counts.overdue],['PLACED','已完成',page?.counts.placed],['','全部',undefined]].map(([code,label,count])=><button key={String(code)} aria-pressed={status===code} onClick={()=>filter(String(code))}>{label}{count!==undefined?`（${count}）`:''}</button>)}</nav>
 {query.isPending?<LoadingState label="正在載入安置監控…"/>:query.error?<ErrorState message="安置監控讀取失敗，請重試。" retry={()=>void query.refetch()}/>:page&&<><p>符合條件 {page.total} 筆 · 每分鐘自動更新 · 最後更新 {placementDate(page.observedAt)}</p><div className="ct-monitor-table"><table><thead><tr><th>球號／會員</th><th>推薦球</th><th>狀態</th><th>等待起始／截止</th><th>完成時間</th><th>操作</th></tr></thead><tbody>{page.items.map(r=><tr key={r.ballNo}><td><strong>{r.ballNo??'球號待確認'}</strong><br/>{r.memberNo??'會員待確認'}</td><td>{r.sponsorBallNo??'尚未確認'}</td><td>{placementStatus[r.status]??'待確認'}</td><td>{placementDate(r.requestedAt)}<br/>{placementDate(r.dueAt)}</td><td>{r.placedAt?placementDate(r.placedAt):'尚未完成'}</td><td>{r.treeId&&r.ballNo?<Link to={`/admin/organization/trees/${r.treeId}?${r.status==='PLACED'?'ballNo':'candidateBallNo'}=${encodeURIComponent(r.ballNo)}`}>{r.status==='PLACED'?'查看組織位置':'查看限制／協助安置'}</Link>:'請先補正球號或所屬樹'}</td></tr>)}</tbody></table></div>{!page.items.length&&<p>目前沒有符合此狀態的資料。</p>}<div className="ct-actions"><button disabled={!previous.length} onClick={()=>{setCursor(previous.at(-1)!);setPrevious(p=>p.slice(0,-1))}}>上一頁</button><button disabled={!page.nextCursor} onClick={()=>{setPrevious(p=>[...p,cursor]);setCursor(page.nextCursor!)}}>下一頁</button></div></>}
 </section>;
}
