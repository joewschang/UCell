import {Link} from 'react-router-dom';
import {ErrorState,LoadingState} from '@ucell/design-system';
import {getFormalEnrollment,type FormalEnrollmentState} from './memberData';
import {useResource} from './useResource';
export const applicationLabels:Record<string,string>={DRAFT:'資料草稿，尚未送出',SUBMITTED:'已送出，待審核',UNDER_REVIEW:'審核中',NEEDS_MORE_INFO:'待補件',APPROVED:'已核准',REJECTED:'未通過'};
export function MembershipProgressView({state,refresh,showLink=true}:{state:FormalEnrollmentState;refresh:()=>void;showLink?:boolean}){
 const formal=state.membershipState==='FORMAL_MEMBER',app=state.application,needs=app?.status==='NEEDS_MORE_INFO';
 return <section className="card membership-progress"><h2>{needs?'會員補件中心':formal?'正式會員服務':app?'正式會員申請進度':'申請正式會員'}</h2>
 <p>會員身分：{formal?'正式會員':state.membershipState==='FORMAL_PENDING'?'正式會員申請中':'網路會員'}</p>
 {app&&<p>資料審核：{applicationLabels[app.status]??app.status}</p>}
 {app?.reviewNote&&<p role="status">{needs?'補件要求':'審核說明'}：{app.reviewNote}</p>}
 {!formal&&<p>收款：{state.feeReceipt||state.paidPackages.length?'已確認付款':(state.packageOrders??[]).some(o=>o.status==='CONFIRMED')?'套組待付款，請至現場繳費':state.feeOrder?'申請費待付款':'尚未建立付款訂單'}</p>}
 {(state.packageOrders??[]).map(order=><div className="cart-line" key={order.orderId}><strong>{order.packageName}</strong><p>NT$ {Number(order.amount).toLocaleString('zh-TW')} · {({CONFIRMED:'待收款確認',PAID:'已付款',CANCELLED:'已取消',REFUNDED:'已退款'} as Record<string,string>)[order.status]??order.status}</p><small>訂單編號：{order.orderId}</small>{order.status==='CONFIRMED'&&<p>訂單已成立，尚未取得經營資格。</p>}{order.status==='PAID'&&<p>{formal?'經營資格須完成設定與安置後啟用。':'付款已確認，仍須通過正式會員審核。'}</p>}</div>)}
 {showLink&&(!formal||needs)&&<Link className="membership-action" to="/membership/upgrade">{needs?'前往補件':app?'查看申請與付款進度':'開始正式會員申請'}</Link>}
 {formal&&!needs&&<p>正式會員資格已核准。經營球位另依套組付款、資格設定與安置進度啟用。</p>}
 <button type="button" onClick={()=>{refresh();window.dispatchEvent(new Event('ucell-membership-refresh'));}}>更新會員與審核狀態</button></section>;
}
export default function MembershipProgress(){const resource=useResource('membership-progress',getFormalEnrollment);return resource.error?<ErrorState message={resource.error} retry={resource.retry}/>:!resource.data?<LoadingState label="會員申請進度載入中…"/>:<MembershipProgressView state={resource.data} refresh={resource.retry}/>;}
