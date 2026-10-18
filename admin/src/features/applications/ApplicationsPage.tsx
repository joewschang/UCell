import {PaperScanUpload} from './PaperScanUpload';
import {FormalDocumentPreview} from './FormalDocumentPreview';
import {FormalDocumentComparison} from './FormalDocumentComparison';
import {ConfirmAction} from '../../components/ConfirmAction';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {command,get,getBlob,qs} from '../../lib/api';
import {MembershipApplication} from '../../types/domain';
import {Badge,Card,ErrorBox,PageHeader} from '../../components/ui';
import {dateTime,holderName} from '../../lib/format';
import {Link} from 'react-router-dom';
import {AdminTable} from '../../components/AdminTable';
import {openPrivateDocument} from '../../lib/privateDocument';

function tone(s:string){return s==='EFFECTIVE'?'ok':s==='SUBMITTED'?'warn':s==='DRAFT'?'neutral':'danger'}

export function ApplicationsPage(){
 const [receiptReference,setReceiptReference]=useState(''),[reviewNote,setReviewNote]=useState('');
 const qc=useQueryClient();const [status,setStatus]=useState('SUBMITTED'),[search,setSearch]=useState('');
 const [formalSearch,setFormalSearch]=useState('');
 const [formalStatus,setFormalStatus]=useState(''),[selectedFormal,setSelectedFormal]=useState<string|null>(()=>new URLSearchParams(typeof window!=="undefined"?window.location.search:"").get("formalApplicationId"));
 const [selected,setSelected]=useState<string|null>(null);const [error,setError]=useState<unknown>(null);const [busy,setBusy]=useState(false);
 const list=useQuery({queryKey:['applications',status,search],queryFn:()=>get<any>('/admin/membership-applications'+qs({status:status||undefined,q:search,take:100}))});
 const formalList=useQuery({queryKey:['formal-applications',formalStatus,formalSearch],queryFn:()=>get<{data:any[]}>('/admin/formal-member-applications'+qs({status:formalStatus||undefined,q:formalSearch,take:100}))});
 const detail=useQuery({queryKey:['application',selected],queryFn:()=>get<any>(`/admin/membership-applications/${selected}`),enabled:!!selected});
 const formalDetail=useQuery({queryKey:['formal-application-detail',selectedFormal],queryFn:()=>get<any>(`/admin/formal-member-applications/${selectedFormal}/detail`),enabled:!!selectedFormal});
 const formalDocuments=useQuery({queryKey:['formal-application-documents',selectedFormal],queryFn:()=>get<any>(`/admin/formal-member-applications/${selectedFormal}/documents`),enabled:!!selectedFormal});
 const rows:MembershipApplication[]=list.data?.data??[];const formalRows=formalList.data?.data??[];const a:MembershipApplication|undefined=detail.data?.data;
 async function formalAction(kind:'spouse-verification'|'cross-line-review'|'begin-review'|'approve'){
  if(!selectedFormal)return;setBusy(true);setError(null);
  try{await command(`/admin/formal-member-applications/${selectedFormal}/${kind}`);await qc.invalidateQueries({queryKey:['formal-applications']});await qc.invalidateQueries({queryKey:['formal-application-detail',selectedFormal]});await qc.invalidateQueries({queryKey:['formal-application-documents',selectedFormal]});}
  catch(e){setError(e)}finally{setBusy(false)}
 }
 async function cashReceipt(andApprove=false){
  const d=formalDetail.data?.data;if(!selectedFormal||!d||busy)return;setBusy(true);setError(null);
  try{
   if(d.feeOrder?.status!=='PAID'&&!d.feeCoveredByPackage){
    if(!d.feeOrder?.orderId)throw new Error('會員尚未送出申請，沒有待收款訂單。');
    await command('/admin/orders/'+d.feeOrder.orderId+'/payment-confirmations',{amount:'600.00',paymentMethod:'CASH',referenceNo:receiptReference.trim(),occurredAt:new Date().toISOString(),note:'現場收取正式會員申請費'});
   }
   if(andApprove){if(d.status!=='UNDER_REVIEW')await command('/admin/formal-member-applications/'+selectedFormal+'/begin-review');await command('/admin/formal-member-applications/'+selectedFormal+'/approve');}
  }catch(e){setError(e)}finally{await qc.invalidateQueries({queryKey:['formal-application-detail',selectedFormal]});await qc.invalidateQueries({queryKey:['formal-applications']});setBusy(false);}
 }
 async function requestMoreInfo(){
  if(!selectedFormal||!reviewNote.trim()||busy)return;setBusy(true);setError(null);
  try{await command('/admin/formal-member-applications/'+selectedFormal+'/request-more-info',{note:reviewNote});await qc.invalidateQueries({queryKey:['formal-applications']});await qc.invalidateQueries({queryKey:['formal-application-detail',selectedFormal]});}catch(e){setError(e)}finally{setBusy(false);}
 }
 async function reviewPaperEvidence(type:string,note?:string){
  if(!selectedFormal)return;setBusy(true);setError(null);
  try{await command(`/admin/formal-member-applications/${selectedFormal}/paper-evidence`,{evidenceType:type,decision:'REVIEWED',...(note?{note}: {})});await qc.invalidateQueries({queryKey:['formal-application-detail',selectedFormal]});}
  catch(e){setError(e);throw e}finally{setBusy(false)}
 }
 async function action(kind:'submit'|'approve'){
  if(!selected)return;setBusy(true);setError(null);
  try{await command(`/admin/membership-applications/${selected}/${kind}`);await qc.invalidateQueries({queryKey:['applications']});await qc.invalidateQueries({queryKey:['application',selected]})}
  catch(e){setError(e)}finally{setBusy(false)}
 }
 return <>
  <PageHeader title="會員申請待審" subtitle="Draft → Submitted → Effective；Approve時才正式建立Qualification、Sponsor Relationship與Binary Placement。" actions={<div className="button-row"><Link className="button-link" to="/applications/new">＋ 新增球位申請</Link><Link className="button-link" to="/applications/formal-paper">＋ 紙本正式會員建檔</Link></div>}/>
  <div className="toolbar"><select aria-label="申請狀態" value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部狀態</option><option>DRAFT</option><option>SUBMITTED</option><option>EFFECTIVE</option></select><input value={search} onChange={e=>setSearch(e.target.value)} aria-label="姓名／手機／Email" placeholder="姓名／手機／Email"/></div>
  <ErrorBox error={list.error}/><ErrorBox error={error}/>
  <div className="split-view"><Card title={`申請佇列 (${rows.length})`}><div>{rows.map(x=><button className={`list-row ${selected===x.applicationId?'selected':''}`} key={x.applicationId} onClick={()=>setSelected(x.applicationId)}><strong>{x.legalEntity?.registeredName??x.person?.legalName??x.legalEntityId??x.personId??'—'}</strong><span>{x.requestedPlanLevelCode} · <Badge tone={tone(x.status) as any}>{x.status}</Badge></span><small>{dateTime(x.createdAt)} · {x.applicationId}</small></button>)}</div></Card>
  <Card title="申請詳情">{!a?<p className="muted">請從左側選擇一筆申請。</p>:<>
   <div className="status-strip"><Badge tone={tone(a.status) as any}>{a.status}</Badge><span>{a.requestedPlanLevelCode}</span></div>
   <dl className="detail-grid">
    <dt>申請主體</dt><dd>{a.legalEntity?.registeredName??a.person?.legalName??'—'}</dd><dt>會員編號</dt><dd>{a.legalEntity?.memberNo??a.person?.memberNo??'—'}</dd><dt>手機</dt><dd>{a.person?.mobile??'—'}</dd><dt>Owner ID</dt><dd className="mono">{a.legalEntityId??a.personId??'—'}</dd>
    <dt>Sponsor</dt><dd>{holderName(a.sponsorQualification)}<br/><span className="mono">{a.sponsorQualificationId}</span></dd>
    <dt>Binary Parent</dt><dd>{holderName(a.binaryParentQualification)}<br/><span className="mono">{a.binaryParentQualificationId}</span></dd>
    <dt>Side</dt><dd>{a.binarySide}</dd><dt>Submitted</dt><dd>{dateTime(a.submittedAt)}</dd><dt>Approved</dt><dd>{dateTime(a.approvedAt)}</dd>
    {a.createdQualificationId&&<><dt>Created Qualification</dt><dd className="mono">{a.createdQualificationId}</dd></>}
   </dl>
   <div className="sticky-actions button-row">
    {a.status==='DRAFT'&&<button className="primary" disabled={busy} onClick={()=>action('submit')}>Submit申請</button>}
    {a.status==='SUBMITTED'&&<ConfirmAction className="primary" disabled={busy} onConfirm={()=>action('approve')}>Approve並建立Qualification</ConfirmAction>}
    {a.status==='EFFECTIVE'&&<><Badge tone="ok">Qualification已生效</Badge>{a.createdQualificationId&&<Link className="button-link" to={`/orders?qualificationId=${a.createdQualificationId}`}>建立入會訂單</Link>}</>}
   </div>
  </>}</Card></div>
  <Card title="正式會員 KYC／紙本審查">
   <p className="muted">佇列只顯示遮罩與證據狀態；只有選取單筆後，才透過受權限與 Audit 控制的 KYC Detail 讀取申請資料。核准正式會員不自動建立 Ball。</p>
   <div className="toolbar"><input placeholder="會員編號／姓名／手機" aria-label="搜尋正式會員申請" value={formalSearch} onChange={e=>setFormalSearch(e.target.value)}/><select aria-label="正式會員申請狀態" value={formalStatus} onChange={e=>setFormalStatus(e.target.value)}><option value="">全部狀態</option><option>DRAFT</option><option>SUBMITTED</option><option>UNDER_REVIEW</option><option>NEEDS_MORE_INFO</option><option>APPROVED</option></select></div>
   <ErrorBox error={formalList.error}/>
   <div className="table-wrap"><AdminTable><thead><tr><th>申請人</th><th>類型／來源</th><th>會員狀態</th><th>申請狀態</th><th>配偶／跨線</th><th>更新時間</th></tr></thead><tbody>{formalRows.map(row=><tr key={row.id}><td><button className="text-link" onClick={()=>{setSelectedFormal(row.id);setReceiptReference('');setReviewNote('')}}>{row.memberNo} · {row.personNameMasked}</button><br/><small className="mono">{row.id}</small></td><td>{row.applicantType}<br/><small>{row.sourceChannel??'—'}</small></td><td>{row.membershipState??'—'}</td><td><Badge tone={row.status==='APPROVED'?'ok':row.status==='DRAFT'?'neutral':'warn'}>{row.status}</Badge></td><td>{row.spouseVerificationStatus??'—'}<br/><small>{row.crossLineReviewStatus??'—'}</small></td><td>{dateTime(row.updatedAt)}</td></tr>)}</tbody></AdminTable></div>
   {!formalList.isLoading&&!formalRows.length&&<p>目前沒有正式會員申請。</p>}
  </Card>
  {selectedFormal&&<Card title="正式會員審查詳情">
   <ErrorBox error={formalDetail.error}/><ErrorBox error={formalDocuments.error}/><button type="button" onClick={()=>qc.invalidateQueries({queryKey:['formal-application-documents',selectedFormal]})}>更新照片與檢查狀態</button>
   {!formalDetail.data?.data?<p className="muted">正在載入受保護 KYC 詳情…</p>:(()=>{const d=formalDetail.data.data,p=d.payload??{},docs=formalDocuments.data?.data??[];return <>
    <div className="status-strip"><Badge tone={d.status==='APPROVED'?'ok':d.status==='UNDER_REVIEW'?'warn':'neutral'}>{d.status}</Badge><span>{d.applicantType} · {d.sourceChannel}</span></div>
    <section><h3>{d.sourceChannel==='ADMIN_PAPER'?'簽署申請書掃描檔':'會員電子簽名'}</h3>{docs.filter((x:any)=>x.type==='SIGNED_APPLICATION_AGREEMENT'&&x.status!=='SUPERSEDED').map((x:any)=><FormalDocumentPreview key={x.id} document={x} autoLoad/>)}{!docs.some((x:any)=>x.type==='SIGNED_APPLICATION_AGREEMENT'&&x.status==='PRESENT')&&<p>尚未收到簽名／申請書附件；既有申請可能尚未補存。</p>}{d.sourceChannel==='ADMIN_PAPER'&&!['APPROVED','REJECTED'].includes(d.status)&&<PaperScanUpload key={selectedFormal} applicationId={selectedFormal} onUploaded={()=>{void formalDocuments.refetch();}}/>}</section>
    {d.sourceChannel==='ADMIN_PAPER'?<section><h3>紙本 Evidence</h3>{(d.paperEvidence??[]).map((x:any)=><p key={x.id}>{x.type} · <Badge tone={x.status==='REVIEWED'?'ok':x.status==='REJECTED'?'danger':'warn'}>{x.status}</Badge> {x.status==='PENDING'&&<button disabled={busy} onClick={()=>reviewPaperEvidence(x.type)}>確認已核對</button>}</p>)}</section>:<FormalDocumentComparison applicationId={selectedFormal} payload={p} documents={docs} evidence={d.paperEvidence??[]} busy={busy} locked={['APPROVED','REJECTED'].includes(d.status)} onPhysicalReview={reviewPaperEvidence}/>}
    <details><summary>其他申請資料與審查狀態</summary><dl className="detail-grid">
     <dt>會員編號</dt><dd>{d.legalEntity?.memberNo??d.person?.memberNo??'—'}</dd>
     <dt>申請主體</dt><dd>{d.legalEntity?.registeredName??p.legalName??d.person?.legalName??'—'}</dd>
     <dt>推薦球號</dt><dd>{p.sponsorBallNo??'未填寫（舊申請請確認）'}</dd>
     <dt>性別／生日</dt><dd>{({MALE:'男性',FEMALE:'女性',OTHER:'其他',UNDISCLOSED:'不揭露'} as Record<string,string>)[p.gender]??p.gender??'—'} ／ {p.birthDate??'—'}</dd>
     <dt>電話</dt><dd>{p.phone??'—'}</dd><dt>Email</dt><dd>{p.email??'—'}</dd>
     <dt>通訊地址</dt><dd>{p.communicationAddress??'—'}</dd>
     <dt>銀行代碼</dt><dd>{p.bankCode??'—'}</dd><dt>銀行帳號</dt><dd className="mono">{p.bankAccount??'—'}</dd><dt>帳戶名</dt><dd>{p.accountHolder??'—'}</dd>
     <dt>配偶國籍／證件類型</dt><dd>{p.hasSpouse?(p.spouseNationalityCode+' ／ '+p.spouseIdentityDocumentType):'不適用'}</dd><dt>配偶證件號碼</dt><dd>{p.hasSpouse?p.spouseIdentityDocumentNumber??'—':'不適用'}</dd>
     <dt>紙本編號</dt><dd>{d.paperApplicationReference??'—'}</dd>
     <dt>國籍／登記國</dt><dd>{p.nationalityCode??p.legalEntityRegistrationCountryCode??p.representativeNationalityCode??'—'}</dd>
     <dt>身分文件類型</dt><dd>{p.identityDocumentType??p.representativeIdentityDocumentType??'—'}</dd>
     <dt>身分證明號碼</dt><dd className="mono">{p.identityDocumentNumber??p.representativeIdentityDocumentNumber??'—'}</dd>
     <dt>配偶</dt><dd>{p.hasSpouse?p.spouseName??'已申報':'無'}</dd>
     <dt>配偶核驗</dt><dd>{d.spouseVerificationStatus}</dd>
     <dt>跨線審查</dt><dd>{d.crossLineReviewStatus}{d.crossLineConflictCode?' · '+d.crossLineConflictCode:''}</dd>
    </dl>

    </details>

    <section><h3>申請付款與審核</h3>{(d.packageOrders??[]).map((order:any)=><div key={order.orderId}><strong>{order.packageName}</strong><p>NT$ {Number(order.amount).toLocaleString('zh-TW')} · {order.status==='PAID'?'已確認付款':order.status==='CONFIRMED'?'待現場收款':order.status}</p><Link to={'/orders?orderId='+order.orderId}>查看套組訂單與確認收款</Link>{order.status==='CONFIRMED'&&<p>請依套組訂單金額收款；套組付款後包含本次會員申請資格，不另收 600 元。付款後仍須完成資料審核。</p>}</div>)}<p>{d.feeCoveredByPackage?'已付款資格套組包含申請資格，不另收 600 元。':d.feeOrder?.status==='PAID'?'已收款 NT$600，請勿重複收費。':(d.packageOrders??[]).some((o:any)=>o.status==='CONFIRMED')?'已選資格套組，請先確認套組訂單收款。':d.feeOrder?'待現場收款 NT$600':'尚無申請費訂單，請會員先送出申請。'}</p>
    {d.feeOrder&&<p>訂單編號：{d.feeOrder.orderId} · <Link to={'/orders?orderId='+d.feeOrder.orderId}>訂單付款紀錄</Link></p>}
    {d.feeOrder?.status==='CONFIRMED'&&!d.feeCoveredByPackage&&!(d.packageOrders??[]).some((o:any)=>o.status==='CONFIRMED')&&<><label>ERP 憑證號碼（可後補）<input maxLength={120} value={receiptReference} onChange={e=>setReceiptReference(e.target.value)}/></label><ConfirmAction disabled={busy} onConfirm={()=>cashReceipt()}>確認現金收款 600 元，保留待審</ConfirmAction><ConfirmAction disabled={busy} onConfirm={()=>cashReceipt(true)}>確認收款 600 元並核准</ConfirmAction><p>核對未完成時，收款紀錄會保留，申請仍待審核。</p></>}
    </section>
    {['SUBMITTED','UNDER_REVIEW'].includes(d.status)&&<section><label>補件說明<input maxLength={200} value={reviewNote} onChange={e=>setReviewNote(e.target.value)}/></label><button disabled={busy||!reviewNote.trim()} onClick={requestMoreInfo}>通知會員補件（保留已收款）</button></section>}
    <div className="sticky-actions button-row">
     {p.hasSpouse&&d.spouseVerificationStatus!=='VERIFIED'&&<button disabled={busy} onClick={()=>formalAction('spouse-verification')}>確認配偶資料</button>}
     {d.crossLineReviewStatus!=='CLEAR'&&<button disabled={busy} onClick={()=>formalAction('cross-line-review')}>執行跨線審查</button>}
     {['DRAFT','SUBMITTED','NEEDS_MORE_INFO'].includes(d.status)&&<button className="primary" disabled={busy} onClick={()=>formalAction('begin-review')}>開始正式審查</button>}
     {d.status==='UNDER_REVIEW'&&<ConfirmAction className="primary" disabled={busy} onConfirm={()=>formalAction('approve')}>核准正式會員</ConfirmAction>}
    </div>
    <p className="muted">核准只建立／更新正式會員身分。法人或自然人要取得新 Ball，仍必須另行購買核准的資格套組並完成 Sponsor／Binary 流程。</p>
   </>})()}
  </Card>}
 </>
}
