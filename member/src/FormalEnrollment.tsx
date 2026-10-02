import {useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ErrorState,LoadingState} from '@ucell/design-system';
import {getFormalEnrollment,payFormalEnrollmentFee} from './memberData';
import {useResource} from './useResource';
import FormalUpgrade from './FormalUpgrade';
import QualificationPackageShop from './QualificationPackageShop';

export default function FormalEnrollment(){
 const state=useResource('formal-enrollment',getFormalEnrollment),key=useRef(crypto.randomUUID());
 const [route,setRoute]=useState<'FEE'|'PACKAGE'|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState('');
 async function pay(){if(busy)return;setBusy(true);setError('');try{await payFormalEnrollmentFee(key.current);setRoute('FEE');state.retry();}catch(e){setError(e instanceof Error?e.message:'付款失敗，請重試。');}finally{setBusy(false);}}
 if(state.error)return <ErrorState message={state.error} retry={state.retry}/>;
 if(!state.data)return <LoadingState label="正式會員申請載入中…"/>;
 const enrollment=state.data,paid=!!enrollment.feeReceipt||enrollment.paidPackages.length>0;
 return <section><h1>申請正式會員</h1><p>選擇申請方式 → 完成付款 → 補齊正式會員資料與文件 → 送出審核。核准後成為正式會員；經營球位由資格套組及後續設定取得。</p>
 {enrollment.membershipState==='FORMAL_MEMBER'?<section className="card"><h2>您已是正式會員</h2><p>可選購資格套組取得經營資格。</p></section>:<>
 <div className="card"><h2>方式一：選購會員資格套組</h2><p>依套組內容選擇商品，付款後繼續正式會員申請，不另外收取本次 600 元申請費。</p><button disabled={busy} onClick={()=>setRoute('PACKAGE')}>選擇會員資格套組</button></div>
 <div className="card"><h2>方式二：先申請正式會員</h2><p>申請費 NT$ {enrollment.feeAmount}。此費用不包含資格套組或經營球位；日後可另購資格套組。</p>{enrollment.feeReceipt?<p role="status">600 元申請費已付款，不需重複繳費。</p>:enrollment.paidPackages.length?<p>已購套組包含正式會員申請資格，不需另繳 600 元。</p>:<button disabled={busy||!enrollment.stagePaymentEnabled} onClick={pay}>{busy?'處理中…':'繳交 600 元並開始申請'}</button>}</div></>}
 {enrollment.stagePaymentEnabled&&<p>Stage 測試：付款直接通過，不會扣款；正式會員仍需完成資料及審核。</p>}
 {!enrollment.stagePaymentEnabled&&!paid&&<p>付款功能尚未開放，請聯絡客服。</p>}
 {error&&<p role="alert">{error}</p>}
 {enrollment.feeReceipt&&<section className="card"><h2>申請費付款紀錄</h2><p>NT$ {enrollment.feeReceipt.amount} · 已付款</p><small>付款時間：{enrollment.feeReceipt.paidAt}</small></section>}
 {enrollment.paidPackages.map(p=><p key={p.orderId}>已付款套組：{p.packageName}</p>)}
 {(route==='PACKAGE'||enrollment.membershipState==='FORMAL_MEMBER')&&<QualificationPackageShop onCreated={state.retry}/>}
 {enrollment.application&&<p>申請進度：{({DRAFT:'資料草稿',SUBMITTED:'已送出，等待審核',UNDER_REVIEW:'審核中',NEEDS_MORE_INFO:'請補件',APPROVED:'已核准',REJECTED:'未通過'} as Record<string,string>)[enrollment.application.status]??enrollment.application.status}</p>}
 {paid&&['NETWORK_MEMBER','FORMAL_PENDING'].includes(enrollment.membershipState??'')&&(!enrollment.application||['DRAFT','NEEDS_MORE_INFO'].includes(enrollment.application.status))&&<FormalUpgrade onSubmitted={state.retry}/>}
 <Link to="/">返回會員首頁</Link></section>;
}
