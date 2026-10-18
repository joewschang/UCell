import {useEffect,useRef,useState} from 'react';
import FormalUpgrade from './FormalUpgrade';
import QualificationPackageShop,{type PackageChoice} from './QualificationPackageShop';
import {createPackageOrder,submitFormalEnrollment,type FormalEnrollmentState} from './memberData';
type Draft={id:string;name:string;sponsorBallNo:string;identity:string;bank:string};
export default function FormalEnrollmentWizard({state,onSubmitted}:{state:FormalEnrollmentState;onSubmitted:()=>void}){
 const [step,setStep]=useState(1),[draft,setDraft]=useState<Draft|null>(null),[choice,setChoice]=useState<PackageChoice|null>(null),[busy,setBusy]=useState(false),[locked,setLocked]=useState(false),[error,setError]=useState('');
 const flight=useRef(false),keys=useRef({order:crypto.randomUUID(),submit:crypto.randomUUID()}),order=useRef<{id:string;total:string}|null>(null);
 useEffect(()=>{if(typeof window!=='undefined')window.scrollTo?.({top:0,behavior:'smooth'});},[step]);
 const existing=(state.packageOrders??[]).find(o=>['CONFIRMED','PAID'].includes(o.status));
 async function send(){if(!draft||flight.current)return;flight.current=true;setBusy(true);setLocked(true);setError('');try{
  if(choice&&!order.current){const saved=await createPackageOrder(choice.offer.packageVersionId,choice.selections,keys.current.order,undefined,undefined,choice.sponsorCode);order.current={id:saved.id,total:saved.total};}
  await submitFormalEnrollment(draft.id,keys.current.submit);setStep(4);onSubmitted();
 }catch(e){setError((e instanceof Error?e.message:'送出未完成')+'。請按重新送出，系統會沿用本次申請與訂單，避免重複建立。');}finally{flight.current=false;setBusy(false);}}
 return <section className="enrollment-wizard"><ol className="enrollment-steps" aria-label="申請步驟">{['填寫申請資料','選擇套組與商品','確認送出'].map((label,i)=><li key={label} aria-current={step===i+1?'step':undefined}><span>{i+1}</span>{label}</li>)}</ol>
 <div hidden={step!==1}><h2>步驟一：填寫申請資料</h2><p>先填寫資料、同意會員合約並上傳照片，也可攜帶正本現場核對。此步只儲存草稿，尚未送審或建立付款訂單。</p><FormalUpgrade prefill={state.prefill} onDraftSaved={d=>{setDraft(d);setStep(2);setError('');}}/></div>
 <div hidden={step!==2}><h2>步驟二：選擇套組與主商品組合</h2>{existing?<section className="card"><h3>沿用已建立的套組訂單</h3><p>{existing.packageName} · NT$ {Number(existing.amount).toLocaleString('zh-TW')} · {existing.status==='PAID'?'已付款':'待現場繳費'}</p><p>已有訂單將保留，本次不再建立套組訂單或另收 600 元。若需變更既有訂單，請洽工作人員。</p><button onClick={()=>{setChoice(null);setStep(3);}}>沿用此訂單，下一步</button></section>:<><section className="card enrollment-later"><h3>稍後購買套組</h3><p>{state.feeReceipt?'申請費已付款，不需重複繳費。':'先申請正式會員，現場繳交 NT$600 申請費。'}不含經營球位，核准後可再選購套組。</p><button onClick={()=>{setChoice(null);setStep(3);}}>稍後購買，前往確認</button></section>{<QualificationPackageShop onCreated={()=>{}} onSelect={selected=>{setChoice(selected);setStep(3);}}/>}</>}</div>
 {step===2&&<button onClick={()=>setStep(1)}>上一步：修改申請資料</button>}
 {step===3&&draft&&<section className="card"><h2>最後確認：申請與付款內容</h2><dl><dt>申請人</dt><dd>{draft.name}</dd><dt>推薦球號</dt><dd>{draft.sponsorBallNo}</dd><dt>身分證明號碼</dt><dd>{draft.identity}</dd><dt>銀行帳號</dt><dd>{draft.bank}</dd></dl>
 <h3>{choice?choice.offer.displayName:existing?existing.packageName:'套組稍後購買'}</h3>{choice&&<ul>{choice.products.map((p,i)=><li key={i}>{p.name} × {p.quantity} 盒</li>)}</ul>}
 <p className="enrollment-total">{existing?.status==='PAID'||!choice&&!existing&&state.feeReceipt?'已付款金額':'現場應繳金額'}：NT$ {Number(choice?.offer.priceAmount??existing?.amount??state.feeAmount).toLocaleString('zh-TW')}</p>
 <p>{choice||existing?'套組包含本次正式會員申請資格，不另收 600 元申請費。':'申請費不含商品及經營球位。'}付款狀態由現場工作人員確認；送出不代表已付款或審核通過。</p><p>資料與文件核對、付款確認及審核通過後，才會成為正式會員。經營球位另須完成資格設定與安置。</p>
 {order.current&&<p>套組訂單已保留：{order.current.id} · NT$ {order.current.total}</p>}{error&&<p role="alert">{error}</p>}
 <button disabled={busy||locked} onClick={()=>setStep(2)}>上一步：修改套組選擇</button><button className="primary" disabled={busy} onClick={send}>{busy?'送出中…':locked?'重新送出申請':'確認並送出正式會員申請'}</button></section>}
 {step===4&&<section className="card" role="status"><h2>申請已送出</h2><p>請依訂單金額現場繳費，並等待工作人員核對與審核。可在「我的」查看申請進度。</p></section>}
 </section>;
}
