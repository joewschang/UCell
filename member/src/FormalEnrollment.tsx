import {Link} from 'react-router-dom';
import {ErrorState,LoadingState} from '@ucell/design-system';
import {getFormalEnrollment} from './memberData';
import {useResource} from './useResource';
import {MembershipProgressView} from './MembershipProgress';
import FormalEnrollmentWizard from './FormalEnrollmentWizard';
import FormalUpgrade from './FormalUpgrade';
import FormalSupplement from './FormalSupplement';
import QualificationPackageShop from './QualificationPackageShop';
export default function FormalEnrollment(){
 const resource=useResource('formal-enrollment',getFormalEnrollment);
 if(resource.error)return <ErrorState message={resource.error} retry={resource.retry}/>;
 if(!resource.data)return <LoadingState label="會員申請進度載入中…"/>;
 const state=resource.data,formal=state.membershipState==='FORMAL_MEMBER',status=state.application?.status;
 const draft=!formal&&['NETWORK_MEMBER','FORMAL_PENDING'].includes(state.membershipState??'')&&(!status||status==='DRAFT');
 return <section><h1>{draft?'申請成為正式會員':'會員資格與申請進度'}</h1>
 {draft?<FormalEnrollmentWizard state={state} onSubmitted={resource.retry}/>:<MembershipProgressView state={state} refresh={resource.retry} showLink={false}/>}
 {state.application&&<p className="muted">申請編號：{state.application.id}</p>}
 {status==='NEEDS_MORE_INFO'&&<><FormalSupplement applicationId={state.application!.id} onSubmitted={resource.retry}/><details><summary>需要更正申請欄位？展開完整資料表</summary><FormalUpgrade prefill={state.prefill} onSubmitted={resource.retry}/></details></>}
 {formal&&<QualificationPackageShop onCreated={resource.retry}/>}
 <Link to="/">返回會員首頁</Link></section>;
}
