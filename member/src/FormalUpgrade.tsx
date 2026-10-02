import {useRef,useState} from 'react';
import {ErrorState,LoadingState} from '@ucell/design-system';
import {consentFormalContract,getFormalRequiredContracts,saveFormalDraft,uploadFormalDocument,type FormalDocumentType} from './memberData';
import {useResource} from './useResource';
import {countryOptions} from './countryOptions';

export default function FormalUpgrade(){
 const contracts=useResource('formal-contracts',getFormalRequiredContracts);
 const [accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [saved,setSaved]=useState<{id:string;version:number;identityDocumentNumberMasked:string|null;spouseIdentityDocumentNumberMasked:string|null;bankAccountMasked:string;applicantType:string}|null>(null);
 const [files,setFiles]=useState<Partial<Record<FormalDocumentType,File>>>({}),[uploaded,setUploaded]=useState<Partial<Record<FormalDocumentType,string>>>({});
 const key=useRef(crypto.randomUUID());
 const [form,setForm]=useState({
  applicantType:'INDIVIDUAL' as const,
  legalName:'',gender:'',birthDate:'',nationalityCode:'TW',identityDocumentType:'NATIONAL_ID' as 'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER',identityDocumentNumber:'',
  hasSpouse:false,spouseName:'',spouseNationalityCode:'TW',spouseIdentityDocumentType:'NATIONAL_ID' as 'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER',spouseIdentityDocumentNumber:'',
  communicationAddress:'',phone:'',email:'',bankCode:'',bankAccount:'',accountHolder:''
 });
 if(contracts.error)return <ErrorState message={contracts.error} retry={contracts.retry}/>;
 if(!contracts.data)return <LoadingState/>;
 const contract=contracts.data[0];
 if(!contract)return <section className="card"><h3>升級正式會員</h3><p>正式會員合約與隱私告知尚未完成正式配置，因此目前無法建立申請草稿。</p></section>;

 const set=(name:keyof typeof form,value:string|boolean)=>setForm(current=>({...current,[name]:value}));
 const setFile=(type:FormalDocumentType,file?:File)=>{setFiles(current=>({...current,[type]:file}));setUploaded(current=>{const next={...current};delete next[type];return next;});};
 async function submit(event:React.FormEvent){
  event.preventDefault();if(!accepted||busy)return;setBusy(true);setError('');
  try{
   if(!contract.acceptedAt)await consentFormalContract(contract.id,key.current);
   const common={
    formalContractVersionId:contract.id,applicantType:form.applicantType,
    communicationAddress:form.communicationAddress,phone:form.phone,email:form.email,
    bankCode:form.bankCode,bankAccount:form.bankAccount,accountHolder:form.accountHolder,
    hasSpouse:form.hasSpouse,
    ...(form.hasSpouse?{spouseName:form.spouseName,spouseNationalityCode:form.spouseNationalityCode,spouseIdentityDocumentType:form.spouseIdentityDocumentType,spouseIdentityDocumentNumber:form.spouseIdentityDocumentNumber}:{})
   };
   const identity={legalName:form.legalName,gender:form.gender,birthDate:form.birthDate,nationalityCode:form.nationalityCode,identityDocumentType:form.identityDocumentType,identityDocumentNumber:form.identityDocumentNumber};
   const result=await saveFormalDraft({...common,...identity},key.current);
   setSaved(result);
   const nextUploaded:Partial<Record<FormalDocumentType,string>>={...uploaded};
   for(const type of ['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'] as FormalDocumentType[]){
    const file=files[type];if(!file)continue;
    const doc=await uploadFormalDocument(result.id,type,file);
    nextUploaded[type]=doc.scanStatus;
   }
   setUploaded(nextUploaded);key.current=crypto.randomUUID();contracts.retry();
  }catch(reason){setError(reason instanceof Error?reason.message:'草稿儲存失敗');}
  finally{setBusy(false);}
 }

 return <form className="card" onSubmit={submit}><h3>升級正式會員：加密草稿</h3>
 <p>線上正式會員申請限自然人。草稿不會送審、核准、建立球位或改變會員狀態；配偶與身分資料僅供 KYC 與跨線審查。</p>
 <details><summary>{contract.title}（{contract.version}）</summary><p>{contract.content}</p><small>內容雜湊：{contract.contentHash}</small></details>
 <label><input type="checkbox" checked={accepted||!!contract.acceptedAt} disabled={!!contract.acceptedAt||busy} onChange={e=>setAccepted(e.target.checked)}/> 我已閱讀並同意上述正式會員合約與隱私告知</label>

 <section className="card"><strong>線上申請限自然人</strong><p>法人正式會員目前採紙本申請，由公司後台建立並審查公司登記、代表人、銀行與其他法人文件。</p></section>
 <label>姓名<input required maxLength={120} autoComplete="name" value={form.legalName} onChange={e=>set('legalName',e.target.value)}/></label>
 <label>性別<input required maxLength={32} value={form.gender} onChange={e=>set('gender',e.target.value)}/></label>
 <label>出生年月日<input required type="date" value={form.birthDate} onChange={e=>set('birthDate',e.target.value)}/></label>
 <label>國籍<select value={form.nationalityCode} onChange={e=>set('nationalityCode',e.target.value)}>{countryOptions.map(option=><option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
 <label>身分證明文件類型<select value={form.identityDocumentType} onChange={e=>set('identityDocumentType',e.target.value)}><option value="NATIONAL_ID">身分證號</option><option value="RESIDENCE_PERMIT">居留證號</option><option value="PASSPORT">護照號碼</option><option value="OTHER">其他</option></select></label>
 <label>身分證明號碼<input required maxLength={64} autoComplete="off" value={form.identityDocumentNumber} onChange={e=>set('identityDocumentNumber',e.target.value)}/></label>

 <fieldset><legend>配偶資料／跨線審查</legend>
  <label><input type="checkbox" checked={form.hasSpouse} onChange={e=>set('hasSpouse',e.target.checked)}/> 有配偶</label>
  {form.hasSpouse&&<><label>配偶姓名<input required maxLength={120} value={form.spouseName} onChange={e=>set('spouseName',e.target.value)}/></label><label>配偶國籍<select value={form.spouseNationalityCode} onChange={e=>set('spouseNationalityCode',e.target.value)}>{countryOptions.map(option=><option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>配偶身分證明文件類型<select value={form.spouseIdentityDocumentType} onChange={e=>set('spouseIdentityDocumentType',e.target.value)}><option value="NATIONAL_ID">身分證號</option><option value="RESIDENCE_PERMIT">居留證號</option><option value="PASSPORT">護照號碼</option><option value="OTHER">其他</option></select></label><label>配偶身分證明號碼<input required maxLength={64} autoComplete="off" value={form.spouseIdentityDocumentNumber} onChange={e=>set('spouseIdentityDocumentNumber',e.target.value)}/></label></>}
  <small>夫妻於婚姻關係存續期間視為單一正式經營單位；配偶仍可保有一般會員／消費者資格，但不得另行取得獨立正式傳銷經營權。</small>
 </fieldset>
 <fieldset><legend>身分與銀行文件</legend>
  <p>線上正式會員送審前必須完成身分證明文件正面、反面及存摺封面上傳。JPG/PNG，單檔上限 10 MB。</p>
  <label>身分證明文件正面<input type="file" accept="image/jpeg,image/png" onChange={e=>setFile('IDENTITY_FRONT',e.target.files?.[0])}/>{uploaded.IDENTITY_FRONT&&<small>已上傳 · 安全檢查 {uploaded.IDENTITY_FRONT}</small>}</label>
  <label>身分證明文件反面<input type="file" accept="image/jpeg,image/png" onChange={e=>setFile('IDENTITY_BACK',e.target.files?.[0])}/>{uploaded.IDENTITY_BACK&&<small>已上傳 · 安全檢查 {uploaded.IDENTITY_BACK}</small>}</label>
  <label>存摺封面<input type="file" accept="image/jpeg,image/png" onChange={e=>setFile('BANKBOOK_COVER',e.target.files?.[0])}/>{uploaded.BANKBOOK_COVER&&<small>已上傳 · 安全檢查 {uploaded.BANKBOOK_COVER}</small>}</label>
  <small>上傳後由後台進行文件與資料比對；在安全檢查與審核完成前不會核准正式會員。</small>
 </fieldset>

 <label>通訊地址<textarea required maxLength={500} autoComplete="street-address" value={form.communicationAddress} onChange={e=>set('communicationAddress',e.target.value)}/></label>
 <label>電話<input required maxLength={32} autoComplete="tel" value={form.phone} onChange={e=>set('phone',e.target.value)}/></label>
 <label>Email<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={e=>set('email',e.target.value)}/></label>
 <label>銀行別／代碼<input required maxLength={16} value={form.bankCode} onChange={e=>set('bankCode',e.target.value)}/></label>
 <label>銀行帳號<input required maxLength={34} autoComplete="off" value={form.bankAccount} onChange={e=>set('bankAccount',e.target.value)}/></label>
 <label>帳戶名<input required maxLength={120} value={form.accountHolder} onChange={e=>set('accountHolder',e.target.value)}/></label>
 <button className="primary" disabled={busy||!(accepted||!!contract.acceptedAt)}>{busy?'儲存／上傳中…':'儲存草稿與上傳文件'}</button>
 {saved&&<p role="status">已保存第 {saved.version} 版自然人草稿；身分證明號碼 {saved.identityDocumentNumberMasked??'未提供'}{saved.spouseIdentityDocumentNumberMasked?'，配偶身分證明號碼 '+saved.spouseIdentityDocumentNumberMasked:''}，帳號 {saved.bankAccountMasked}。</p>}
 {error&&<p role="alert">{error}</p>}</form>;
}
