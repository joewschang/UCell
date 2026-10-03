import {useEffect,useState} from 'react';
import {command,get,qs} from '../../lib/api';
import {countryOptions} from '../../lib/countryOptions';
import {Card,ErrorBox,PageHeader} from '../../components/ui';
import {SearchOption,SearchSelect} from '../../components/SearchSelect';
import type {Person} from '../../types/domain';

type ApplicantType='INDIVIDUAL'|'LEGAL_ENTITY';
type IdentityDocumentType='NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER';

export function PaperFormalApplicationPage(){
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
  e.preventDefault();if(!representative||!contractVersionId||busy)return;setBusy(true);setError(null);
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
   setCreated(r.data);
  }catch(err){setError(err)}finally{setBusy(false)}
 }

 const countrySelect=(value:string,setter:(v:string)=>void)=><select value={value} onChange={e=>setter(e.target.value)}>{countryOptions.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}</select>;
 const docSelect=(value:IdentityDocumentType,setter:(v:IdentityDocumentType)=>void)=><select value={value} onChange={e=>setter(e.target.value as IdentityDocumentType)}><option value="NATIONAL_ID">身分證號</option><option value="RESIDENCE_PERMIT">居留證號</option><option value="PASSPORT">護照號碼</option><option value="OTHER">其他</option></select>;

 return <>
  <PageHeader title="紙本正式會員建檔" subtitle="自然人與法人紙本申請由後台建檔。法人僅接受紙本申請；建檔不會自動建立 Ball。"/>
  <ErrorBox error={error}/>
  {created?<Card title="紙本申請已建立"><p>Application ID：<span className="mono">{created.id}</span></p><p>類型：{created.applicantType} · 來源：{created.sourceChannel}</p>{created.memberNo&&<p>會員編號：{created.memberNo}</p>}<p>下一步請回申請待審頁完成文件核對、配偶核驗、跨線審查與正式核准。</p></Card>:
  <form onSubmit={submit}>
   <Card title="1. 紙本來源與申請主體">
    <label>紙本申請編號<input required maxLength={120} value={paperApplicationReference} onChange={e=>setPaperApplicationReference(e.target.value)}/></label>
    <label>正式會員契約版本<select required value={contractVersionId} onChange={e=>setContractVersionId(e.target.value)}>{contracts.map(x=><option key={x.id} value={x.id}>{x.title} · {x.version}</option>)}</select></label>
    <label>申請類型<select value={applicantType} onChange={e=>setApplicantType(e.target.value as ApplicantType)}><option value="INDIVIDUAL">自然人</option><option value="LEGAL_ENTITY">法人</option></select></label>
    <SearchSelect label={applicantType==='LEGAL_ENTITY'?'主要經營代表人 Person':'紙本申請人 Person'} value={representative} onChange={setRepresentative} search={personSearch}/>
   </Card>

   <Card title={applicantType==='LEGAL_ENTITY'?'2. 法人與代表人身分':'2. 自然人身分'}>
    {applicantType==='INDIVIDUAL'?<>
      <label>姓名<input required value={legalName} onChange={e=>setLegalName(e.target.value)}/></label>
      <label>性別<input required value={gender} onChange={e=>setGender(e.target.value)}/></label>
      <label>出生日期<input required type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)}/></label>
      <label>國籍{countrySelect(nationalityCode,setNationalityCode)}</label>
      <label>身分證明文件類型{docSelect(identityDocumentType,setIdentityDocumentType)}</label>
      <label>身分證明號碼<input required maxLength={64} value={identityDocumentNumber} onChange={e=>setIdentityDocumentNumber(e.target.value)}/></label>
    </>:<>
      <label>法人名稱<input required value={legalEntityName} onChange={e=>setLegalEntityName(e.target.value)}/></label>
      <label>統一編號／法人登記號碼<input required value={legalEntityRegistrationNo} onChange={e=>setLegalEntityRegistrationNo(e.target.value)}/></label>
      <label>法人登記國{countrySelect(legalEntityRegistrationCountryCode,setLegalEntityRegistrationCountryCode)}</label>
      <label>法人登記地址<textarea required value={legalEntityRegisteredAddress} onChange={e=>setLegalEntityRegisteredAddress(e.target.value)}/></label>
      <label>主要經營代表人姓名<input required value={representativeLegalName} onChange={e=>setRepresentativeLegalName(e.target.value)}/></label>
      <label>代表人國籍{countrySelect(representativeNationalityCode,setRepresentativeNationalityCode)}</label>
      <label>代表人身分證明文件類型{docSelect(representativeIdentityDocumentType,setRepresentativeIdentityDocumentType)}</label>
      <label>代表人身分證明號碼<input required maxLength={64} value={representativeIdentityDocumentNumber} onChange={e=>setRepresentativeIdentityDocumentNumber(e.target.value)}/></label>
    </>}
   </Card>

   <Card title="3. 配偶與聯絡／銀行資料">
    <label><input type="checkbox" checked={hasSpouse} onChange={e=>setHasSpouse(e.target.checked)}/> 有配偶</label>
    {hasSpouse&&<><label>配偶姓名<input required value={spouseName} onChange={e=>setSpouseName(e.target.value)}/></label><label>配偶國籍{countrySelect(spouseNationalityCode,setSpouseNationalityCode)}</label><label>配偶身分證明文件類型{docSelect(spouseIdentityDocumentType,setSpouseIdentityDocumentType)}</label><label>配偶身分證明號碼<input required maxLength={64} value={spouseIdentityDocumentNumber} onChange={e=>setSpouseIdentityDocumentNumber(e.target.value)}/></label></>}
    <label>通訊地址<textarea required value={communicationAddress} onChange={e=>setCommunicationAddress(e.target.value)}/></label>
    <label>電話<input required value={phone} onChange={e=>setPhone(e.target.value)}/></label>
    <label>Email<input required type="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
    <label>銀行代碼<input required value={bankCode} onChange={e=>setBankCode(e.target.value)}/></label>
    <label>銀行帳號<input required value={bankAccount} onChange={e=>setBankAccount(e.target.value)}/></label>
    <label>帳戶名<input required value={accountHolder} onChange={e=>setAccountHolder(e.target.value)}/></label>
    <p className="muted">紙本建檔後，仍須逐項記錄申請書、身分文件、銀行文件與法人文件的人工核對結果。</p>
    <button className="primary" disabled={busy||!representative||!contractVersionId}>{busy?'建立中…':'建立紙本正式會員申請'}</button>
   </Card>
  </form>}
 </>;
}
