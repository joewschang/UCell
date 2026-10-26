import {FormalApprovalAction} from './FormalApprovalAction';
import {ReviewDocument} from './ReviewDocument';
import {currentDocuments,documentLabel} from './reviewDocuments';
import {FormalApplicationEditor} from './FormalApplicationEditor';
import './formal-review.css';
import {uiValue,uiText,domainLabel} from "../../../../shared/design-system/i18n";
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
 const qc=useQueryClient();const [moreInfoNote,setMoreInfoNote]=useState(''),[moreInfoNotice,setMoreInfoNotice]=useState('');const [editingFormal,setEditingFormal]=useState(false);const [status,setStatus]=useState('SUBMITTED'),[search,setSearch]=useState('');
 const [formalStatus,setFormalStatus]=useState(''),[selectedFormal,setSelectedFormal]=useState<string|null>(null);
 const [selected,setSelected]=useState<string|null>(null);const [error,setError]=useState<unknown>(null);const [busy,setBusy]=useState(false);
 const list=useQuery({queryKey:['applications',status,search],queryFn:()=>get<any>('/admin/membership-applications'+qs({status:status||undefined,q:search,take:100}))});
 const formalList=useQuery({queryKey:['formal-applications',formalStatus],queryFn:()=>get<{data:any[]}>('/admin/formal-member-applications'+qs({status:formalStatus||undefined,take:100}))});
 const detail=useQuery({queryKey:['application',selected],queryFn:()=>get<any>(`/admin/membership-applications/${selected}`),enabled:!!selected});
 const formalDetail=useQuery({queryKey:['formal-application-detail',selectedFormal],queryFn:()=>get<any>(`/admin/formal-member-applications/${selectedFormal}/detail`),enabled:!!selectedFormal});
 const formalDocuments=useQuery({queryKey:['formal-application-documents',selectedFormal],queryFn:()=>get<any>(`/admin/formal-member-applications/${selectedFormal}/documents`),enabled:!!selectedFormal});
 const rows:MembershipApplication[]=list.data?.data??[];const formalRows=formalList.data?.data??[];const a:MembershipApplication|undefined=detail.data?.data;
 async function formalAction(kind:'spouse-verification'|'cross-line-review'|'begin-review'){
  if(!selectedFormal||editingFormal)return;setBusy(true);setError(null);
  try{await command(`/admin/formal-member-applications/${selectedFormal}/${kind}`);await qc.invalidateQueries({queryKey:['formal-applications']});await qc.invalidateQueries({queryKey:['formal-application-detail',selectedFormal]});await qc.invalidateQueries({queryKey:['formal-application-documents',selectedFormal]});}
  catch(e){setError(e)}finally{setBusy(false)}
 }
 async function viewKycDocument(documentId:string){
  setBusy(true);setError(null);
  try{
   await openPrivateDocument(()=>getBlob(`/admin/formal-member-applications/documents/${documentId}/content`));
  }catch(e){setError(e)}finally{setBusy(false)}
 }
 async function reviewPaperEvidence(type:string){
  if(!selectedFormal)return;setBusy(true);setError(null);
  try{await command(`/admin/formal-member-applications/${selectedFormal}/paper-evidence`,{evidenceType:type,decision:'REVIEWED'});await qc.invalidateQueries({queryKey:['formal-application-detail',selectedFormal]});}
  catch(e){setError(e)}finally{setBusy(false)}
 }
 async function action(kind:'submit'|'approve'){
  if(!selected)return;setBusy(true);setError(null);
  try{await command(`/admin/membership-applications/${selected}/${kind}`);await qc.invalidateQueries({queryKey:['applications']});await qc.invalidateQueries({queryKey:['application',selected]})}
  catch(e){setError(e)}finally{setBusy(false)}
 }
 return <>
  <PageHeader title="會員申請待審" subtitle={uiText("Draft → Submitted → Effective；Approve時才正式建立Qualification、Sponsor Relationship與Binary Placement。")} actions={<div className="button-row"><Link className="button-link" to="/applications/new">＋ 新增球位申請</Link><Link className="button-link" to="/applications/formal-paper">＋ 紙本正式會員建檔</Link></div>}/>
  <div className="toolbar"><select aria-label="申請狀態" value={status} onChange={e=>setStatus(e.target.value)}><option value="">全部狀態</option><option value={"DRAFT"}>{uiText("DRAFT")}</option><option value={"SUBMITTED"}>{uiText("SUBMITTED")}</option><option value={"EFFECTIVE"}>{uiText("EFFECTIVE")}</option></select><input value={search} onChange={e=>setSearch(e.target.value)} aria-label={uiText("姓名／手機／Email")} placeholder={uiText("姓名／手機／Email")}/></div>
  <ErrorBox error={list.error}/><ErrorBox error={error}/>
  <div className="split-view"><Card title={`申請佇列 (${rows.length})`}><div>{rows.map(x=><button className={`list-row ${selected===x.applicationId?'selected':''}`} key={x.applicationId} onClick={()=>setSelected(x.applicationId)}><strong>{x.legalEntity?.registeredName??x.person?.legalName??x.legalEntityId??x.personId??'—'}</strong><span>{x.requestedPlanLevelCode} · <Badge tone={tone(x.status) as any}>{domainLabel(x.status)}</Badge></span><small>{dateTime(x.createdAt)} · {x.applicationId}</small></button>)}</div></Card>
  <Card title="申請詳情">{!a?<p className="muted">請從左側選擇一筆申請。</p>:<>
   <div className="status-strip"><Badge tone={tone(a.status) as any}>{domainLabel(a.status)}</Badge><span>{a.requestedPlanLevelCode}</span></div>
   <dl className="detail-grid">
    <dt>申請主體</dt><dd>{a.legalEntity?.registeredName??a.person?.legalName??'—'}</dd><dt>會員編號</dt><dd>{a.legalEntity?.memberNo??a.person?.memberNo??'—'}</dd><dt>手機</dt><dd>{a.person?.mobile??'—'}</dd><dt>{uiText("Owner ID")}</dt><dd className="mono">{a.legalEntityId??a.personId??'—'}</dd>
    <dt>{uiText("Sponsor")}</dt><dd>{holderName(a.sponsorQualification)}<br/><span className="mono">{a.sponsorQualificationId}</span></dd>
    <dt>{uiText("Binary Parent")}</dt><dd>{holderName(a.binaryParentQualification)}<br/><span className="mono">{a.binaryParentQualificationId}</span></dd>
    <dt>{uiText("Side")}</dt><dd>{a.binarySide}</dd><dt>{uiText("Submitted")}</dt><dd>{dateTime(a.submittedAt)}</dd><dt>{uiText("Approved")}</dt><dd>{dateTime(a.approvedAt)}</dd>
    {a.createdQualificationId&&<><dt>{uiText("Created Qualification")}</dt><dd className="mono">{a.createdQualificationId}</dd></>}
   </dl>
   <div className="sticky-actions button-row">
    {a.status==='DRAFT'&&<button className="primary" disabled={busy} onClick={()=>action('submit')}>{uiText("Submit申請")}</button>}
    {a.status==='SUBMITTED'&&<ConfirmAction className="primary" disabled={busy} onConfirm={()=>action('approve')}>{uiText("Approve並建立Qualification")}</ConfirmAction>}
    {a.status==='EFFECTIVE'&&<><Badge tone="ok">{uiText("Qualification已生效")}</Badge>{a.createdQualificationId&&<Link className="button-link" to={`/orders?qualificationId=${a.createdQualificationId}`}>建立入會訂單</Link>}</>}
   </div>
  </>}</Card></div>
  <Card title={uiText("正式會員 KYC／紙本審查")}>
   <p className="muted">{uiText("清單顯示申請人姓名；選取後可核對證件、修正資料及通知補件。核准正式會員不自動建立球位。")}</p>
   <div className="toolbar"><select aria-label="正式會員申請狀態" value={formalStatus} onChange={e=>setFormalStatus(e.target.value)}><option value="">全部狀態</option><option value={"DRAFT"}>{uiText("DRAFT")}</option><option value={"SUBMITTED"}>{uiText("SUBMITTED")}</option><option value={"UNDER_REVIEW"}>{uiText("UNDER_REVIEW")}</option><option value={"NEEDS_MORE_INFO"}>{uiText("NEEDS_MORE_INFO")}</option><option value={"APPROVED"}>{uiText("APPROVED")}</option></select></div>
   <ErrorBox error={formalList.error}/>
   <div className="table-wrap"><AdminTable><thead><tr><th>申請人</th><th>類型／來源</th><th>會員狀態</th><th>申請狀態</th><th>配偶／跨線</th><th>更新時間</th></tr></thead><tbody>{formalRows.map(row=><tr key={row.id}><td><button className="text-link" disabled={busy} onClick={()=>{setSelectedFormal(row.id);setEditingFormal(false);setMoreInfoNote('');setMoreInfoNotice('');}}>{row.personName??row.personNameMasked}</button><br/><small className="mono">{row.id}</small></td><td>{row.applicantType}<br/><small>{row.sourceChannel??'—'}</small></td><td>{row.membershipState??'—'}</td><td><Badge tone={row.status==='APPROVED'?'ok':row.status==='DRAFT'?'neutral':'warn'}>{domainLabel(row.status)}</Badge></td><td>{uiValue(row.spouseVerificationStatus??'—')}<br/><small>{uiValue(row.crossLineReviewStatus??'—')}</small></td><td>{dateTime(row.updatedAt)}</td></tr>)}</tbody></AdminTable></div>
   {!formalList.isLoading&&!formalRows.length&&<p>目前沒有正式會員申請。</p>}
  </Card>
  {selectedFormal&&<Card title="正式會員審查詳情">
   <ErrorBox error={formalDetail.error}/><ErrorBox error={formalDocuments.error}/>
   {!formalDetail.data?.data?<p className="muted">{uiText("正在載入受保護 KYC 詳情…")}</p>:(()=>{const d=formalDetail.data.data,p=d.payload??{},docs=formalDocuments.data?.data??[];return <>
    <div className="status-strip"><Badge tone={d.status==='APPROVED'?'ok':d.status==='UNDER_REVIEW'?'warn':'neutral'}>{domainLabel(d.status)}</Badge><span>{d.applicantType} · {d.sourceChannel}</span></div>
    <FormalApplicationEditor key={selectedFormal} detail={d} documents={docs} onEditingChange={setEditingFormal} onSaved={async()=>{await qc.invalidateQueries({queryKey:['formal-applications']});await qc.invalidateQueries({queryKey:['formal-application-detail',selectedFormal]});}}/>
    <dl className="detail-grid">
     <dt>會員編號</dt><dd>{d.legalEntity?.memberNo??d.person?.memberNo??'—'}</dd>
     <dt>申請主體</dt><dd>{d.legalEntity?.registeredName??p.legalName??d.person?.legalName??'—'}</dd>
     <dt>紙本編號</dt><dd>{d.paperApplicationReference??'—'}</dd>
     <dt>國籍／登記國</dt><dd>{p.nationalityCode??p.legalEntityRegistrationCountryCode??p.representativeNationalityCode??'—'}</dd>
     <dt>身分文件類型</dt><dd>{p.identityDocumentType??p.representativeIdentityDocumentType??'—'}</dd>
     <dt>身分證明號碼</dt><dd className="mono">{p.identityDocumentNumber??p.representativeIdentityDocumentNumber??'—'}</dd>
     <dt>配偶</dt><dd>{p.hasSpouse?p.spouseName??'已申報':'無'}</dd>
     <dt>配偶核驗</dt><dd>{domainLabel(d.spouseVerificationStatus)}</dd>
     <dt>跨線審查</dt><dd>{domainLabel(d.crossLineReviewStatus)}{d.crossLineConflictCode?' · '+d.crossLineConflictCode:''}</dd>
    </dl>
    {d.sourceChannel==='ADMIN_PAPER'?<section><h3>{uiText("紙本 Evidence")}</h3>{(d.paperEvidence??[]).map((x:any)=><p key={x.id}>{documentLabel(x.type)} · <Badge tone={x.status==='REVIEWED'?'ok':x.status==='REJECTED'?'danger':'warn'}>{domainLabel(x.status)}</Badge> {x.status==='PENDING'&&<button disabled={busy} onClick={()=>reviewPaperEvidence(x.type)}>確認已核對</button>}</p>)}</section>:<section><h3>{uiText("線上 KYC 文件")}</h3>{currentDocuments(docs).filter(x=>!['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'].includes(x.type)).map(x=><ReviewDocument key={x.id} document={x}/>)}</section>}
    {['SUBMITTED','UNDER_REVIEW'].includes(d.status)&&<section className="card"><h3>退回補件並通知會員</h3><label>需補正的資料或文件<textarea value={moreInfoNote} maxLength={500} onChange={e=>setMoreInfoNote(e.target.value)} placeholder="請說明需補傳的文件或更正內容"/></label><button disabled={busy||editingFormal||!moreInfoNote.trim()} onClick={async()=>{setBusy(true);setError(null);try{await command('/admin/formal-member-applications/'+selectedFormal+'/request-more-info',{note:moreInfoNote.trim()});setMoreInfoNotice('已退回補件，並建立會員通知中心訊息。');await qc.invalidateQueries({queryKey:['formal-applications']});await qc.invalidateQueries({queryKey:['formal-application-detail',selectedFormal]});}catch(err){setError(err);}finally{setBusy(false);}}}>退回補件並發送站內通知</button>{editingFormal&&<p>請先儲存或還原修改資料，再退回補件。</p>}</section>}{moreInfoNotice&&<p role="status">{moreInfoNotice}</p>}
    <div className="sticky-actions button-row">
     {p.hasSpouse&&d.spouseVerificationStatus!=='VERIFIED'&&<button disabled={busy||editingFormal} onClick={()=>formalAction('spouse-verification')}>確認配偶資料</button>}
     {d.crossLineReviewStatus!=='CLEAR'&&<button disabled={busy||editingFormal} onClick={()=>formalAction('cross-line-review')}>執行跨線審查</button>}
     {['DRAFT','SUBMITTED','NEEDS_MORE_INFO'].includes(d.status)&&<button className="primary" disabled={busy||editingFormal} onClick={()=>formalAction('begin-review')}>開始正式審查</button>}
     {['UNDER_REVIEW','APPROVED'].includes(d.status)&&<FormalApprovalAction key={selectedFormal} applicationId={selectedFormal!} status={d.status} disabled={busy||editingFormal} onBusy={setBusy} onApproved={()=>{
      qc.setQueryData(['formal-application-detail',selectedFormal],(old:any)=>old?{...old,data:{...old.data,status:'APPROVED'}}:old);
      qc.setQueriesData({queryKey:['formal-applications']},(old:any)=>old?{...old,data:old.data.map((row:any)=>row.id===selectedFormal?{...row,status:'APPROVED',membershipState:'FORMAL_MEMBER'}:row)}:old);
      void qc.invalidateQueries({queryKey:['formal-applications']});
      void qc.invalidateQueries({queryKey:['formal-application-detail',selectedFormal]});
     }}/>}
     {editingFormal&&d.status==='UNDER_REVIEW'&&<p>請先儲存或還原修改資料，再核准正式會員。</p>}
    </div>
    <p className="muted">{uiText("核准只建立／更新正式會員身分。法人或自然人要取得新 Ball，仍必須另行購買核准的資格套組並完成 Sponsor／Binary 流程。")}</p>
   </>})()}
  </Card>}
 </>
}
