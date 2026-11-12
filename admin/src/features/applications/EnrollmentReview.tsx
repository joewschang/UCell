import {useState} from 'react';
import {useQuery} from '@tanstack/react-query';
import {get} from '../../lib/api';
import {useAuth} from '../auth/auth';
import {EnrollmentBundleReceipt, type BundlePayment} from '../orders/EnrollmentBundleReceipt';
import './enrollment-review.css';

type Purchase = {orderId:string; packageName:string; total:string};
type Ball = {position:number; ballNo:string|null; parentPosition:number|null; side:string|null;
  qualificationStatus:string; qualification:Purchase; repurchase:Purchase|null};
type Group = {bundleId:string; planCode?:string; paymentPolicy?:string; paymentVerified:boolean;
  rootSponsor:{name:string|null; ballNo:string|null}|null; balls:Ball[]; total:string; qualificationTotal:string; repurchaseTotal:string};
const amount=(value:string)=>new Intl.NumberFormat('zh-TW',{style:'currency',currency:'TWD',maximumFractionDigits:2}).format(Number(value));

export function EnrollmentReview({group, status, blocked, refresh, onBusy}:{group:Group; status:string; blocked:boolean;
  refresh:()=>Promise<unknown>; onBusy:(busy:boolean)=>void}) {
  const {user}=useAuth();
  const [expanded,setExpanded]=useState(false);
  const root=group.balls[0];
  const canConfirm=['SUPER_ADMIN','ORDER_OPS','FINANCE'].includes(user?.role??'');
  const order=useQuery({queryKey:['enrollment-review-payment',group.bundleId,root?.qualification.orderId],
    queryFn:()=>get<{data:{enrollmentBundlePayment:BundlePayment|null}}>('/admin/orders/'+root.qualification.orderId),
    enabled:expanded&&canConfirm&&!!root,staleTime:0});
  if(!root)return null;
  const combined=group.paymentPolicy==='COMBINED';
  const active=group.balls.filter(ball=>ball.qualificationStatus==='EFFECTIVE').length;
  const next=active===group.balls.length?'整組已生效':!group.paymentVerified?'待確認整組收款':
    status!=='APPROVED'?'待整組審核':!group.rootSponsor?'待確認第 1 球推薦人':'待安置第 1 球';
  return <section id="application-reconciliation" tabIndex={-1} className="card enrollment-review" aria-label="多球申請審核">
    <header><h3>{group.planCode==='EXCELLENCE'?'卓越方案':'自訂多球申請'}</h3><strong role="status">{next}</strong></header>
    <p>本次共 {group.balls.length} 顆球，核准一次涵蓋整組。</p>
    <dl className="enroll-facts"><div><dt>資格合計</dt><dd>{amount(group.qualificationTotal)}</dd></div>
      <div><dt>重銷合計</dt><dd>{amount(group.repurchaseTotal)}</dd></div>
      <div><dt>本次應收</dt><dd>{amount(combined?group.total:group.qualificationTotal)}</dd></div></dl>
    <p>第 1 球外部推薦　<strong>{group.rootSponsor?[group.rootSponsor.ballNo,group.rootSponsor.name].filter(Boolean).join(' · '):'待指定'}</strong></p>
    <details open={group.balls.length<=3}><summary>逐球資格、重銷與安置（{group.balls.length} 顆）</summary>
      <ol>{group.balls.map(ball=><li key={ball.position}><strong>第 {ball.position} 球{ball.ballNo?' · '+ball.ballNo:''}</strong>
        <span>{ball.qualification.packageName} · {ball.repurchase?.packageName??'未加購重銷'}</span>
        <small>{ball.parentPosition?'第 '+ball.parentPosition+' 球推薦，安置於其'+(ball.side==='LEFT'?'左':'右')+'側':'組織起點，組外位置由安置人員確認'}</small></li>)}</ol>
    </details>
    {status==='APPROVED'&&active<group.balls.length&&<p>{group.rootSponsor?'請在「組織安置」選定第 1 球的組外位置，系統會依預排安置整組。':'請會員回到「正式會員申請」，在本組訂單補填第 1 球的外部推薦。指定後即可進入「組織安置」選定位置。'}</p>}
    {canConfirm&&<button type="button" id="open-application-reconciliation" disabled={blocked} aria-expanded={expanded}
      onClick={()=>setExpanded(!expanded)}>{expanded?'收合收款明細':group.paymentVerified?'查看整組收款紀錄':'開啟整組收款核對'}</button>}
    {expanded&&canConfirm&&(order.isPending?<p role="status">正在讀取收款明細…</p>:order.isError||!order.data?.data.enrollmentBundlePayment?
      <p role="alert">無法取得本組收款明細。 <button onClick={()=>void order.refetch()}>重試</button></p>:
      <EnrollmentBundleReceipt bundle={order.data.data.enrollmentBundlePayment} orderId={root.qualification.orderId}
        canConfirm={!blocked} onBusy={onBusy} reload={async()=>{await Promise.all([order.refetch(),refresh()]);}}/>)}
  </section>;
}
