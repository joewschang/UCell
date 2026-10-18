import {PaperScanUpload,uploadPaperScan} from './PaperScanUpload';
import {useEffect,useState} from 'react';
import {command,get,qs} from '../../lib/api';
import {bankOptions} from '../../lib/bankOptions';
import {countryOptions} from '../../lib/countryOptions';
import {Card,ErrorBox,PageHeader} from '../../components/ui';
import {SearchOption,SearchSelect} from '../../components/SearchSelect';
import type {Person} from '../../types/domain';

type ApplicantType='INDIVIDUAL'|'LEGAL_ENTITY';
type IdentityDocumentType='NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';

export function PaperFormalApplicationPage(){
 const [scanFile,setScanFile]=useState<File>();
 const [otherBank,setOtherBank]=useState(false);
 const [representative,setRepresentative]=useState<SearchOption|null>(null);
 const [contracts,setContracts]=useState<any[]>([]);
 const [contractVersionId,setContractVersionId]=useState('');
 const [applicantType,setApplicantType]=useState<ApplicantType>('INDIVIDUAL');
 const [paperApplicationReference,setPaperApplicationReference]=useState('');
 const [legalName,setLegalName]=useState(''),[gender,setGender]=useState(''),[birthDate,setBirthDate]=useState('');
 const [nationalityCode,setNationalityCode]=useState('TW'),[identityDocumentType,setIdentityDocumentType]=useState<IdentityDocumentType>('NATIONAL_ID'),[identityDocumentNumber,setIdentityDocumentNumber]=useState('');
 const [legalEntityName,setLegalEntityName]=useState(''),[legalEntityRegistrationNo,setLegalEntityRegistrationNo]=useState(''),[legalEntityRegisteredAddress,setLegalEntityRegisteredAddress]=useState(''),[legalEntityRegistrationCountryCode,setLegalEntityRegistrationCountryCode]=useState('TW');
 const [representativeLegalName,setRepresentativeLegalName]=useState(''),[representativeNationalityCode,setRepresentativeNationalityCode]=useState('TW'),[representativeIdentityDocumentType,setRepresentativeIdentityDocumentType]=useState<IdentityDocumentType>('NATIONAL_ID'),[representativeIdentityDocumentNumber,setRepresentativeIdentityDocumentNumber]=useState('');
 const [hasSpouse,setHasSpouse]=useState(false),[spouseName,setSpouseName]=useState(''),[spouseNationalityCode,setSpouseNationalityCode]=useState('TW'),[spouseIdentityDocumentType,setSpouseIdentityDocumentType]=useState<IdentityDocumentType>('NATIONAL_ID'),[spouseIdentityDocumentNumber,setSpouseIdentityDocumentNumber]=useState('');
 const [communicationAddress,setCommunicationAddress]=useState(''),[phone,setPhone]=useState(''),[email,setEmail]=useState(''),[bankCode,setBankCode]=useState(''),[bankAccount,setBankAccount]=useState(''),[accountHolder,setAccountHolder]=useState('');
 const [busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null),[created,setCreated]=useState<any>(null);

 useEffect(()=>{get<any>('/admin/formal-member-applications/contracts/required').then(r=>{const rows=r.data??[];setContracts(rows);if(rows[0])setContractVersionId(rows[0].id)}).catch(setError)},[]);

 async function personSearch(q:string){
  const r:any=await get('/admin/persons'+qs({q,take:20}));
  return (r.data as Person[]).map(x=>({id:x.personId,primary:x.legalName,secondary:[x.memberNo,x.mobile,x.email].filter(Boolean).join(' · '),meta:x}));
 }

 async function submit(e:React.FormEvent){
  e.preventDefault();if(!representative||!contractVersionId||busy)return;setError(null);setBusy(true);
  try{
   const common={
    representativePersonId:representative.id,paperApplicationReference,formalContractVersionId:contractVersionId,applicantType,
    communicationAddress,phone,email,bankCode,bankAccount,accountHolder,hasSpouse,
    ...(hasSpouse?{spouseName,spouseNationalityCode,spouseIdentityDocumentType,spouseIdentityDocumentNumber}:{})
   };
   const identity=applicantType==='INDIVIDUAL'
    ?{legalName,gender,birthDate,nationalityCode,identityDocumentType,identityDocumentNumber}
    :{legalEntityName,legalEntityRegistrationNo,legalEntityRegisteredAddress,legalEntityRegistrationCountryCode,representativeLegalName,representativeNationalityCode,representativeIdentityDocumentType,representativeIdentityDocumentNumber};
   const r:any=await command('/admin/formal-member-applications/paper',{...common,...identity});

   if(scanFile){try{await uploadPaperScan(r.data.id,scanFile);setScanFile(undefined);}catch{setCreated(r.data);throw new Error('會員申請已建立，但申請書上傳未完成。請在下方重試附件上傳，無須重新建檔。');}}
   setCreated(r.data);
  }catch(err){setError(err)}finally{setBusy(false)}
 }

 const countrySelect=(value:string,setter:(v:string)=>void)=><select required value={value} onChange={e=>setter(e.target.value)}>{countryOptions.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}</select>;
 const docSelect=(value:IdentityDocumentType,setter:(v:IdentityDocumentType)=>void)=><select required value={value} onChange={e=>setter(e.target.value as IdentityDocumentType)}><option value="NATIONAL_ID">身分證號</option><option value="RESIDENCE_PERMIT">居留證號</option><option value="PASSPORT">護照號碼</option><option value="OTHER">其他</option></select>;

 return <>
  <PageHeader title="紙本正式會員建檔" subtitle="在同一頁依紙本登錄，確認後建立待處理申請，再接續文件核對、收款與資格審查。"/>
  <ErrorBox error={error}/>
  {created?<Card title="紙本申請已建立"><p>Application ID：<span className="mono">{created.id}</span></p><p>類型：{created.applicantType} · 來源：{created.sourceChannel}</p>{created.memberNo&&<p>會員編號：{created.memberNo}</p>}<p>資料已建檔，尚未核准正式會員。請依序核對紙本文件、完成配偶與跨線審查，並確認應收款項。</p><PaperScanUpload applicationId={created.id} initialFile={scanFile}/><a className="primary" href={"/applications?formalApplicationId="+encodeURIComponent(created.id)}>前往此筆申請核對與審查</a></Card>:
  <form onSubmit={submit}><p><span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span> 為必填。資料在最後確認前尚未保存；請勿關閉頁面。</p><fieldset disabled={busy} style={{border:0,padding:0}}>
   <Card title="1. 收件與選會員"><p>先搜尋既有會員，避免重複建檔。若已有未完成申請，請至申請待審續辦；尚無會員資料者，先完成會員註冊。</p><p>紙本申請編號請使用可回查原件的收件號碼；契約版本須與紙本簽署內容一致。</p>
    <label>申請書掃描檔（可後補）<input type="file" accept="image/jpeg,image/png,application/pdf" onChange={e=>setScanFile(e.target.files?.[0])}/></label><small>含簽名的申請書，支援 JPG、PNG 或 PDF，單檔上限 10 MB；建立申請時一併上傳。</small>
    <label>紙本申請編號<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={120} value={paperApplicationReference} onChange={e=>setPaperApplicationReference(e.target.value)}/></label>
    <label>正式會員契約版本<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><select required value={contractVersionId} onChange={e=>setContractVersionId(e.target.value)}>{contracts.map(x=><option key={x.id} value={x.id}>{x.title} · {x.version}</option>)}</select></label>
    <label>申請類型<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><select required value={applicantType} onChange={e=>setApplicantType(e.target.value as ApplicantType)}><option value="INDIVIDUAL">自然人</option><option value="LEGAL_ENTITY">法人</option></select></label>
    <p><span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span> 請搜尋並選取會員</p><SearchSelect label={applicantType==='LEGAL_ENTITY'?'主要經營代表人（必選）':'紙本申請人（必選）'} value={representative} onChange={setRepresentative} search={personSearch}/>
   </Card>

   </fieldset><fieldset disabled={busy} style={{border:0,padding:0}}><Card title={applicantType==='LEGAL_ENTITY'?'2. 法人與代表人身分':'2. 自然人身分'}>
    {applicantType==='INDIVIDUAL'?<>
      <label>姓名<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required value={legalName} onChange={e=>setLegalName(e.target.value)}/></label>
      <label>性別<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><select required value={gender} onChange={e=>setGender(e.target.value)}><option value="">請選擇</option><option value="FEMALE">女性</option><option value="MALE">男性</option><option value="OTHER">其他</option><option value="UNDISCLOSED">不揭露</option></select></label>
      <label>出生日期<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label>
      <label>國籍<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span>{countrySelect(nationalityCode,setNationalityCode)}</label>
      <label>身分證明文件類型<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span>{docSelect(identityDocumentType,setIdentityDocumentType)}</label>
      <label>身分證明號碼<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={64} value={identityDocumentNumber} onChange={e=>setIdentityDocumentNumber(e.target.value)}/></label>
    </>:<>
      <label>法人名稱<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required value={legalEntityName} onChange={e=>setLegalEntityName(e.target.value)}/></label>
      <label>統一編號／法人登記號碼<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required value={legalEntityRegistrationNo} onChange={e=>setLegalEntityRegistrationNo(e.target.value)}/></label>
      <label>法人登記國<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span>{countrySelect(legalEntityRegistrationCountryCode,setLegalEntityRegistrationCountryCode)}</label>
      <label>法人登記地址<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><textarea required value={legalEntityRegisteredAddress} onChange={e=>setLegalEntityRegisteredAddress(e.target.value)}/></label>
      <label>主要經營代表人姓名<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required value={representativeLegalName} onChange={e=>setRepresentativeLegalName(e.target.value)}/></label>
      <label>代表人國籍<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span>{countrySelect(representativeNationalityCode,setRepresentativeNationalityCode)}</label>
      <label>代表人身分證明文件類型<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span>{docSelect(representativeIdentityDocumentType,setRepresentativeIdentityDocumentType)}</label>
      <label>代表人身分證明號碼<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={64} value={representativeIdentityDocumentNumber} onChange={e=>setRepresentativeIdentityDocumentNumber(e.target.value)}/></label>
    </>}
   </Card>

   </fieldset><fieldset disabled={busy} style={{border:0,padding:0}}><Card title="3. 配偶與聯絡／銀行資料">
    <label>配偶狀態<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><select required value={hasSpouse?"YES":"NO"} onChange={e=>setHasSpouse(e.target.value==="YES")}><option value="NO">無配偶</option><option value="YES">有配偶</option></select></label>
    {hasSpouse&&<><label>配偶姓名<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required value={spouseName} onChange={e=>setSpouseName(e.target.value)}/></label><label>配偶國籍<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span>{countrySelect(spouseNationalityCode,setSpouseNationalityCode)}</label><label>配偶身分證明文件類型<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span>{docSelect(spouseIdentityDocumentType,setSpouseIdentityDocumentType)}</label><label>配偶身分證明號碼<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={64} value={spouseIdentityDocumentNumber} onChange={e=>setSpouseIdentityDocumentNumber(e.target.value)}/></label></>}
    <label>通訊地址<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><textarea required value={communicationAddress} onChange={e=>setCommunicationAddress(e.target.value)}/></label>
    <label>電話<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required value={phone} onChange={e=>setPhone(e.target.value)}/></label>
    <label>Email<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>銀行代碼<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><select required value={otherBank?"OTHER":bankCode} onChange={e=>{setOtherBank(e.target.value==="OTHER");setBankCode(e.target.value==="OTHER"?"":e.target.value)}}><option value="">請選擇銀行／郵局</option>{bankOptions.map(bank=><option key={bank.code} value={bank.code}>{bank.code} · {bank.name}</option>)}<option value="OTHER">其他金融機構（清單未列出）</option></select></label>
    {otherBank&&<label>其他金融機構代碼<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={16} value={bankCode} onChange={e=>setBankCode(e.target.value.trim())}/><small>僅清單未列出的金融機構需依存摺填寫代碼。</small></label>}
    <label>銀行帳號<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required value={bankAccount} onChange={e=>setBankAccount(e.target.value)}/></label>
    <label>帳戶名<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required value={accountHolder} onChange={e=>setAccountHolder(e.target.value)}/></label>
    <p className="muted">紙本建檔後，仍須逐項記錄申請書、身分文件、銀行文件與法人文件的人工核對結果。</p>

   </Card>
  </fieldset><Card title="4. 送出前核對"><dl><dt>紙本申請編號</dt><dd>{paperApplicationReference}</dd><dt>申請會員／代表人</dt><dd>{representative?.primary} {representative?.secondary}</dd><dt>契約版本</dt><dd>{contracts.find(x=>x.id===contractVersionId)?.version}</dd><dt>申請類型與姓名</dt><dd>{applicantType==='INDIVIDUAL'?'自然人：'+legalName:'法人：'+legalEntityName+'／代表人：'+representativeLegalName}</dd><dt>配偶資料</dt><dd>{hasSpouse?spouseName:'無配偶'}</dd><dt>聯絡資料</dt><dd>{phone}／{email}<br/>{communicationAddress}</dd><dt>銀行資料</dt><dd>{bankCode}／末四碼 {bankAccount.slice(-4)}／{accountHolder}</dd></dl><p>建立後請在審查頁逐項登錄已核對的簽署申請書、身分證正反面與存摺；法人另核對公司登記與代表人文件。缺件時登記補件原因。</p><p>收款須核對實際款項與訂單，ERP 憑證號碼可後補。建檔不代表收款或核准，也不會產生球位資格。</p></Card><div style={{display:'flex',gap:12,marginTop:20}}><button className="primary" disabled={busy||!representative||!contractVersionId}>{busy?'建立中…':'確認建立紙本正式會員申請'}</button></div></form>}
 </>;
}
