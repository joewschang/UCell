import './enrollment-forms.css';
import {validTaiwanNationalId,validEmail} from './enrollmentValidation';
import {uiValue,uiText} from "../../shared/design-system/i18n";
import {useRef,useState,useEffect} from 'react';
import {ErrorState,LoadingState} from '@ucell/design-system';
import {consentFormalContract,getFormalRequiredContracts,saveFormalDraft,uploadFormalDocument,submitFormalEnrollment,type FormalEnrollmentState,type FormalDocumentType} from './memberData';
import {useResource} from './useResource';
import {countryOptions} from './countryOptions';

export default function FormalUpgrade({onSubmitted,onSaved,draftOnly=false,initial}:{initial?:FormalEnrollmentState;onSubmitted?:()=>void;onSaved?:(id:string)=>void;draftOnly?:boolean}={}){
 const contracts=useResource('formal-contracts',getFormalRequiredContracts,true,true);
 const [accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[submitted,setSubmitted]=useState(false);
 const [saved,setSaved]=useState<{id:string;version:number;identityDocumentNumberMasked:string|null;spouseIdentityDocumentNumberMasked:string|null;bankAccountMasked:string;applicantType:string}|null>(null);
 const [files,setFiles]=useState<Partial<Record<FormalDocumentType,File>>>({}),[uploaded,setUploaded]=useState<Partial<Record<FormalDocumentType,string>>>({});
 const key=useRef(crypto.randomUUID()),hydrated=useRef(false);
 const [progress,setProgress]=useState('');
 const [form,setForm]=useState({
  applicantType:'INDIVIDUAL' as const,
  legalName:'',gender:'UNDISCLOSED',birthDate:'',nationalityCode:'TW',identityDocumentType:'NATIONAL_ID' as 'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER',identityDocumentNumber:'',
  hasSpouse:false,spouseName:'',spouseNationalityCode:'TW',spouseIdentityDocumentType:'NATIONAL_ID' as 'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER',spouseIdentityDocumentNumber:'',
  communicationAddress:'',phone:'',email:'',bankCode:'',bankAccount:'',accountHolder:''
 });
 useEffect(()=>{if(!initial||hydrated.current)return;hydrated.current=true;setForm(current=>({...current,...(initial.draft?.payload??initial.prefill??{})}));if(initial.draft)setUploaded(Object.fromEntries(initial.draft.documents.map(type=>[type,'PRESENT'])));},[initial]);
 if(contracts.error)return <ErrorState message={contracts.error} retry={contracts.retry}/>;
 if(!contracts.data)return <LoadingState/>;
 const contract=contracts.data[0];
 if(!contract)return <section className="card"><h3>升級正式會員</h3><p>正式會員合約與隱私告知尚未完成正式配置，因此目前無法建立申請草稿。</p></section>;

 const set=(name:keyof typeof form,value:string|boolean)=>setForm(current=>({...current,[name]:value}));
 const setFile=(type:FormalDocumentType,file?:File)=>{setFiles(current=>({...current,[type]:file}));setUploaded(current=>{const next={...current};delete next[type];return next;});};
 async function submit(event:React.FormEvent){
  event.preventDefault();if(!(accepted||contract.acceptedAt)||busy)return;
  const required=['legalName','birthDate','communicationAddress','phone','email','bankCode','bankAccount','accountHolder','identityDocumentNumber'] as const;
  if(required.some(k=>!form[k].trim())){setError('請完整填寫會員、聯絡與銀行資料');return;}
  if(form.identityDocumentType==='NATIONAL_ID'&&!validTaiwanNationalId(form.identityDocumentNumber)){setError('身分證號碼格式或檢查碼不正確，請確認後再試');return;}
  if(form.hasSpouse&&(!form.spouseName.trim()||!form.spouseIdentityDocumentNumber.trim()||form.spouseIdentityDocumentType==='NATIONAL_ID'&&!validTaiwanNationalId(form.spouseIdentityDocumentNumber))){setError('請檢查配偶姓名及身分證明號碼');return;}
  if(!validEmail(form.email)){setError('請輸入正確的 Email，例如 name@example.com');return;}
  const documentTypes:FormalDocumentType[]=['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'];
  if(draftOnly&&documentTypes.some(type=>!files[type]&&!uploaded[type])){setError('請備妥身分證明文件正面、反面及存摺封面，再前往下一步');return;}
  if(Object.values(files).some(file=>file&&(!['image/jpeg','image/png'].includes(file.type)||file.size>10*1024*1024))){setError('證件檔案須為 JPG 或 PNG，且每份不超過 10 MB');return;}
  setBusy(true);setError('');setProgress('正在儲存會員資料…');
  let uploadingLabel='';
  try{
   if(!contract.acceptedAt)await consentFormalContract(contract.id,key.current);
   const common={
    formalContractVersionId:contract.id,applicantType:form.applicantType,
    communicationAddress:form.communicationAddress,phone:form.phone,email:form.email.trim(),
    bankCode:form.bankCode,bankAccount:form.bankAccount,accountHolder:form.accountHolder,
    hasSpouse:form.hasSpouse,
    ...(form.hasSpouse?{spouseName:form.spouseName,spouseNationalityCode:form.spouseNationalityCode,spouseIdentityDocumentType:form.spouseIdentityDocumentType,spouseIdentityDocumentNumber:form.spouseIdentityDocumentNumber}:{})
   };
   const identity={legalName:form.legalName,gender:form.gender,birthDate:form.birthDate,nationalityCode:form.nationalityCode,identityDocumentType:form.identityDocumentType,identityDocumentNumber:form.identityDocumentNumber};
   const result=await saveFormalDraft({...common,...identity},key.current);
   setSaved(result);
   key.current=crypto.randomUUID();
   const nextUploaded:Partial<Record<FormalDocumentType,string>>={...uploaded};
   for(const type of ['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'] as FormalDocumentType[]){
    const file=files[type];if(!file||nextUploaded[type])continue;
    uploadingLabel=type==='IDENTITY_FRONT'?'身分證明文件正面':type==='IDENTITY_BACK'?'身分證明文件反面':'存摺封面';
    setProgress(`資料已儲存，正在上傳${uploadingLabel}（${documentTypes.indexOf(type)+1}/3）…請稍候，完成後會自動前往下一步。`);
    const doc=await uploadFormalDocument(result.id,type,file);
    nextUploaded[type]=doc.scanStatus;
    setUploaded({...nextUploaded});
   }
   setUploaded(nextUploaded);onSaved?.(result.id);key.current=crypto.randomUUID();contracts.retry();
  }catch(reason){setError(uploadingLabel?`${uploadingLabel}上傳未完成。會員資料與已完成的文件已保留，請確認網路後再次按「儲存資料並前往下一步」重試。`:(reason instanceof Error?reason.message:'草稿儲存失敗'));}
  finally{setBusy(false);setProgress('');}
 }

 return <form className="card formal-profile" onSubmit={submit} onInvalid={()=>setError('請檢查必填欄位與 Email 格式，並依提示修正後再繼續。')} aria-busy={busy}><fieldset disabled={busy} style={{border:0,padding:0,margin:0,minWidth:0}}><h3>會員資料與文件</h3>{error&&<p role="alert">{error}</p>}
 <p>{uiText("線上正式會員申請限自然人。草稿不會送審、核准、建立球位或改變會員狀態；配偶與身分資料僅供 KYC 與跨線審查。")}</p>
 <details><summary>{contract.title}（{contract.version}）</summary><p>{contract.content}</p><small>內容雜湊：{contract.contentHash}</small></details>
 <label><input type="checkbox" checked={accepted||!!contract.acceptedAt} disabled={!!contract.acceptedAt||busy} onChange={e=>setAccepted(e.target.checked)}/> 我已閱讀並同意上述正式會員合約與隱私告知</label>

 <section className="card"><strong>線上申請限自然人</strong><p>法人正式會員目前採紙本申請，由公司後台建立並審查公司登記、代表人、銀行與其他法人文件。</p></section>
 <label>姓名<input required maxLength={120} autoComplete="name" value={form.legalName} onChange={e=>set('legalName',e.target.value)}/></label>
 <label>性別<select required value={form.gender} onChange={e=>set('gender',e.target.value)}><option value="FEMALE">女性</option><option value="MALE">男性</option><option value="OTHER">其他</option><option value="UNDISCLOSED">不揭露</option></select></label>
 <label>出生年月日<input required type="date" value={form.birthDate} onChange={e=>set('birthDate',e.target.value)}/></label>
 <label>國籍<select value={form.nationalityCode} onChange={e=>set('nationalityCode',e.target.value)}>{countryOptions.map(option=><option key={option.code} value={option.code}>{uiValue((option.label))}</option>)}</select></label>
 <label>身分證明文件類型<select value={form.identityDocumentType} onChange={e=>set('identityDocumentType',e.target.value)}><option value="NATIONAL_ID">身分證號</option><option value="RESIDENCE_PERMIT">居留證號</option><option value="PASSPORT">護照號碼</option><option value="OTHER">其他</option></select></label>
 <label>身分證明號碼<input required maxLength={64} autoComplete="off" value={form.identityDocumentNumber} onChange={e=>set('identityDocumentNumber',e.target.value.toUpperCase())}/></label>

 <fieldset><legend>配偶資料／跨線審查</legend>
  <label><input type="checkbox" checked={form.hasSpouse} onChange={e=>set('hasSpouse',e.target.checked)}/> 有配偶</label>
  {form.hasSpouse&&<><label>配偶姓名<input required maxLength={120} value={form.spouseName} onChange={e=>set('spouseName',e.target.value)}/></label><label>配偶國籍<select value={form.spouseNationalityCode} onChange={e=>set('spouseNationalityCode',e.target.value)}>{countryOptions.map(option=><option key={option.code} value={option.code}>{uiValue((option.label))}</option>)}</select></label><label>配偶身分證明文件類型<select value={form.spouseIdentityDocumentType} onChange={e=>set('spouseIdentityDocumentType',e.target.value)}><option value="NATIONAL_ID">身分證號</option><option value="RESIDENCE_PERMIT">居留證號</option><option value="PASSPORT">護照號碼</option><option value="OTHER">其他</option></select></label><label>配偶身分證明號碼<input required maxLength={64} autoComplete="off" value={form.spouseIdentityDocumentNumber} onChange={e=>set('spouseIdentityDocumentNumber',e.target.value.toUpperCase())}/></label></>}
  <small>夫妻於婚姻關係存續期間視為單一正式經營單位；配偶仍可保有一般會員／消費者資格，但不得另行取得獨立正式傳銷經營權。</small>
 </fieldset>
 <fieldset><legend>身分與銀行文件</legend>
  <p>{uiText("線上正式會員送審前必須完成身分證明文件正面、反面及存摺封面上傳。JPG/PNG，單檔上限 10 MB。")}</p>
  <label>身分證明文件正面<input type="file" accept="image/jpeg,image/png" onChange={e=>setFile('IDENTITY_FRONT',e.target.files?.[0])}/>{uploaded.IDENTITY_FRONT&&<small>已上傳</small>}</label>
  <label>身分證明文件反面<input type="file" accept="image/jpeg,image/png" onChange={e=>setFile('IDENTITY_BACK',e.target.files?.[0])}/>{uploaded.IDENTITY_BACK&&<small>已上傳</small>}</label>
  <label>存摺封面<input type="file" accept="image/jpeg,image/png" onChange={e=>setFile('BANKBOOK_COVER',e.target.files?.[0])}/>{uploaded.BANKBOOK_COVER&&<small>已上傳</small>}</label>
  <small>上傳後由後台進行文件與資料比對；審核完成後才會核准正式會員。</small>
 </fieldset>

 <label>通訊地址<textarea required maxLength={500} autoComplete="street-address" value={form.communicationAddress} onChange={e=>set('communicationAddress',e.target.value)}/></label>
 <label>電話<input required maxLength={32} autoComplete="tel" value={form.phone} onChange={e=>set('phone',e.target.value)}/></label>
 <label>{uiText("Email")}<input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={e=>set('email',e.target.value)}/></label>
 <label>銀行別／代碼<input required maxLength={16} value={form.bankCode} onChange={e=>set('bankCode',e.target.value)}/></label>
 <label>銀行帳號<input required maxLength={34} autoComplete="off" value={form.bankAccount} onChange={e=>set('bankAccount',e.target.value)}/></label>
 <label>帳戶名<input required maxLength={120} value={form.accountHolder} onChange={e=>set('accountHolder',e.target.value)}/></label>
 <button className="primary" disabled={busy||!(accepted||!!contract.acceptedAt)}>{busy?'儲存／上傳中…':draftOnly?'儲存資料並前往下一步':'儲存資料與文件'}</button>
 {busy&&<p role="status" aria-live="polite">{progress}</p>}
 {!(accepted||contract.acceptedAt)&&<p>請先勾選上方的正式會員合約與隱私告知同意欄位。</p>}
 {saved&&<p role="status">已保存第 {saved.version} 版自然人草稿；身分證明號碼 {saved.identityDocumentNumberMasked??'未提供'}{saved.spouseIdentityDocumentNumberMasked?'，配偶身分證明號碼 '+saved.spouseIdentityDocumentNumberMasked:''}，帳號 {saved.bankAccountMasked}。</p>}
 {saved&&!draftOnly&&<button type="button" disabled={busy||submitted} onClick={async()=>{setBusy(true);setError('');try{await submitFormalEnrollment(saved.id,key.current);setSubmitted(true);onSubmitted?.();}catch(e){setError(e instanceof Error?e.message:'送出失敗');}finally{setBusy(false);}}}>{submitted?'申請已送出，等待審核':'送出正式會員申請'}</button>}
 {error&&<p role="alert">{error}</p>}</fieldset></form>;
}
