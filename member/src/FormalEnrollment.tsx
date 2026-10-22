import {useState,useRef,useEffect} from 'react';
import {Link} from 'react-router-dom';
import {ErrorState,LoadingState} from '@ucell/design-system';
import {getFormalEnrollment,submitFormalEnrollment} from './memberData';
import {useResource} from './useResource';
import FormalUpgrade from './FormalUpgrade';
import QualificationPackageShop from './QualificationPackageShop';
import './enrollment.css';
import MembershipSignature from './MembershipSignature';
export default function FormalEnrollment(){
 const state=useResource('formal-enrollment',getFormalEnrollment,true,true);
 const [signatureReady,setSignatureReady]=useState(false);
 const [paymentMethod,setPaymentMethod]=useState(''),[paymentOrder,setPaymentOrder]=useState('');
 const [step,setStep]=useState(1),[saved,setSaved]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=useRef(crypto.randomUUID()),heading=useRef<HTMLHeadingElement>(null),initialized=useRef(false);
 useEffect(()=>{if(!state.data||initialized.current)return;initialized.current=true;const e=state.data;if(e.application)setStep(e.paidPackages.length?4:e.pendingPackages?.length?3:2);},[state.data]);
 useEffect(()=>{heading.current?.focus();heading.current?.scrollIntoView?.({block:'start'});},[step]);
 if(state.error&&!state.data)return <ErrorState message={state.error} retry={state.retry}/>;
 if(!state.data)return <LoadingState label="申請進度載入中…"/>;
 const e=state.data,paid=e.paidPackages.length>0,appId=saved||e.application?.id,pending=e.pendingPackages??[],canSubmit=paid||!!paymentMethod&&pending.some(p=>p.orderId===paymentOrder),submitted=e.application&&['SUBMITTED','UNDER_REVIEW','APPROVED'].includes(e.application.status);
 if(e.membershipState==='FORMAL_MEMBER')return <section><h1>新增會員資格</h1><p>每個新資格另收建立費 600 元；資格升級不收此費用。活躍與領獎條件另行判定。</p><QualificationPackageShop onCreated={state.retry}/></section>;
 return <section className="enrollment"><h1 ref={heading} tabIndex={-1}>申請正式會員</h1>{state.error&&<p role="alert">進度更新失敗，已保留資料。請重新查詢。</p>}<p>先準備資料，再選擇適合的資格套組。付款與審核完成前，資格不會自動生效。</p>
 <ol className="enrollment-steps" aria-label="申請步驟">{['會員資料','資格套組','付款確認','送出審核'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined}><button disabled={busy||i>0&&!appId||i===2&&!paid&&!pending.length||i===3&&!canSubmit} onClick={()=>setStep(i+1)}><span>{i+1}</span>{label}</button></li>)}</ol>
 {submitted?<section className="card" role="status"><h2>申請已送出</h2><p>目前等待資料與文件審核，您可以返回會員首頁查看進度。</p>{!paid&&<p>付款狀態：待收款確認。送審不代表已付款，完成收款與審核後才會取得正式會員資格。</p>}</section>:<>
 {step===1&&<p>資料以加密草稿保存；請備妥身分文件與收款帳戶資料。選擇套組前需先儲存。</p>}
 <div hidden={step!==1}><FormalUpgrade initial={e} draftOnly onSaved={id=>{setSaved(id);setStep(paid?4:pending.length?3:2);state.retry();}}/>{appId&&<button className="primary" onClick={()=>setStep(paid?4:pending.length?3:2)}>資料已儲存，繼續 →</button>}</div>
 {step===2&&<><h2>選擇會員資格套組</h2><p>套組價款與每資格 600 元建立費分開計收。優惠碼套用成功後，請再次確認可選商品盒數。</p>{paid?<p>已有付款套組，請繼續送審。</p>:pending.length?<><p>您有尚待付款的資格套組訂單，請先確認該筆訂單。</p><button onClick={()=>setStep(3)}>查看待付款訂單</button></>:<QualificationPackageShop onCreated={()=>{state.retry();setStep(3);}}/>}</>}
 {step===3&&<section className="card"><h2>付款與訂單確認</h2>{paid?<><p role="status">已確認套組付款。</p><button className="primary" onClick={()=>setStep(4)}>繼續送出申請 →</button></>:pending.length?pending.map(p=><article className="enrollment-order" key={p.orderId}><h3>{p.packageName}</h3><dl><dt>套組商品</dt><dd>NT$ {p.goodsAmount}／{p.selectableProductQuantity} 盒</dd><dt>資格建立費</dt><dd>NT$ {p.qualificationFee}</dd><dt>應付總額</dt><dd>NT$ {p.total}</dd></dl>{p.couponCode&&<p>優惠碼：{p.couponCode}</p>}<p>付款截止：{new Date(p.paymentDeadline).toLocaleString('zh-TW',{timeZone:'Asia/Taipei',hour12:false})}（台北時間）</p><p>請依公司既有收款方式完成付款並提供訂單編號；實際收款確認前不會視為已付款。</p><p>訂單編號：{p.orderId}</p><label>付款方式<select value={paymentOrder===p.orderId?paymentMethod:''} onChange={event=>{setPaymentOrder(p.orderId);setPaymentMethod(event.target.value);key.current=crypto.randomUUID();}}><option value="">請選擇付款方式</option><option value="BANK_TRANSFER">銀行匯款</option><option value="CASH">現金</option></select></label><p>選擇付款方式後可先送出審核，實際收款另由公司確認。</p><button className="primary" disabled={paymentOrder!==p.orderId||!paymentMethod} onClick={()=>setStep(4)}>繼續下一步：送出審核 →</button><Link to="/orders">查看我的訂單 →</Link></article>):<><p>目前沒有有效的待付款訂單。過期訂單無法繼續套用優惠，請重新選購。</p><button onClick={()=>setStep(2)}>重新選擇套組</button></>}<button onClick={state.retry}>重新查詢付款狀態</button></section>}
 {step===4&&<section className="card"><h2>確認並送出審核</h2><p>申請套組：{paid?e.paidPackages.map(p=>p.packageName).join('、'):pending.find(p=>p.orderId===paymentOrder)?.packageName}</p><p>付款狀態：{paid?'已確認付款':(paymentMethod==='BANK_TRANSFER'?'銀行匯款':'現金')+'／待收款確認'}</p><p>送出後仍需完成資料與文件審核；各資格須符合活躍及其他領獎條件。</p><MembershipSignature applicationId={appId!} onReady={setSignatureReady}/><button className="primary" disabled={busy||!canSubmit||!appId||!signatureReady} onClick={async()=>{setBusy(true);setError('');try{await submitFormalEnrollment(appId!,key.current,paid?undefined:{orderId:paymentOrder,paymentMethod});state.retry();}catch(err){setError(err instanceof Error?err.message:'送出失敗，請重試');}finally{setBusy(false);}}}>{busy?'送出中…':'確認送出正式會員申請'}</button></section>}
 </>}{error&&<p role="alert">{error}</p>}<Link to="/">返回會員首頁</Link></section>;
}
