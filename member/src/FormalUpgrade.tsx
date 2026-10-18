import {MemberSignature} from './MemberSignature';
import {useRef,useState} from 'react';
import {ErrorState,LoadingState} from '@ucell/design-system';
import {consentFormalContract,getFormalRequiredContracts,saveFormalDraft,uploadFormalDocument,submitFormalEnrollment,type FormalDocumentType} from './memberData';
import {useResource} from './useResource';
import {countryOptions} from './countryOptions';

export default function FormalUpgrade({onSubmitted,prefill,onDraftSaved}:{onDraftSaved?:(draft:{id:string;name:string;sponsorBallNo:string;identity:string;bank:string})=>void;onSubmitted?:()=>void;prefill?:{legalName:string;gender:string;birthDate:string;nationalityCode:string;phone:string;email:string}}={}){
 const contracts=useResource('formal-contracts',getFormalRequiredContracts);
 const [accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[submitted,setSubmitted]=useState(false);
 const [saved,setSaved]=useState<{id:string;version:number;identityDocumentNumberMasked:string|null;spouseIdentityDocumentNumberMasked:string|null;bankAccountMasked:string;applicantType:string}|null>(null);
 const [files,setFiles]=useState<Partial<Record<FormalDocumentType,File>>>({}),[uploaded,setUploaded]=useState<Partial<Record<FormalDocumentType,string>>>({});
 const [signature,setSignature]=useState<File>(),[signatureReset,setSignatureReset]=useState(0);
 const key=useRef(crypto.randomUUID());
 const draftRequest=useRef<{body:string;key:string}|null>(null);
 const [form,setForm]=useState({
  applicantType:'INDIVIDUAL' as const,
  legalName:'',gender:'UNDISCLOSED',birthDate:'',nationalityCode:'TW',identityDocumentType:'NATIONAL_ID' as 'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER',identityDocumentNumber:'',
  sponsorBallNo:'',hasSpouse:false,spouseName:'',spouseNationalityCode:'TW',spouseIdentityDocumentType:'NATIONAL_ID' as 'NATIONAL_ID'|'RESIDENCE_PERMIT'|'PASSPORT'|'OTHER',spouseIdentityDocumentNumber:'',
  communicationAddress:'',phone:'',email:'',bankCode:'',bankAccount:'',accountHolder:'',...prefill
 });
 if(contracts.error)return <ErrorState message={contracts.error} retry={contracts.retry}/>;
 if(!contracts.data)return <LoadingState/>;
 const contract=contracts.data[0];
 if(!contract)return <section className="card"><h3>升級正式會員</h3><p>正式會員合約與隱私告知尚未完成正式配置，因此目前無法建立申請草稿。</p></section>;

 const set=(name:keyof typeof form,value:string|boolean)=>{setForm(current=>({...current,[name]:value}));setSignature(undefined);setSignatureReset(n=>n+1);setSaved(null);setSubmitted(false);};
 const setFile=(type:FormalDocumentType,file?:File)=>{setSaved(null);setFiles(current=>({...current,[type]:file}));setUploaded(current=>{const next={...current};delete next[type];return next;});};
 async function submit(event:React.FormEvent){
  event.preventDefault();if(!(accepted||contract.acceptedAt)||busy)return;setBusy(true);setError('');setSaved(null);
  try{
   if(!signature)throw new Error('請先完成會員本人簽名。');
   if(!contract.acceptedAt)await consentFormalContract(contract.id,key.current);
   const common={
    formalContractVersionId:contract.id,applicantType:form.applicantType,sponsorBallNo:form.sponsorBallNo,
    communicationAddress:form.communicationAddress,phone:form.phone,email:form.email,
    bankCode:form.bankCode,bankAccount:form.bankAccount,accountHolder:form.accountHolder,
    hasSpouse:form.hasSpouse,
    ...(form.hasSpouse?{spouseName:form.spouseName,spouseNationalityCode:form.spouseNationalityCode,spouseIdentityDocumentType:form.spouseIdentityDocumentType,spouseIdentityDocumentNumber:form.spouseIdentityDocumentNumber}:{})
   };
   const identity={legalName:form.legalName,gender:form.gender,birthDate:form.birthDate,nationalityCode:form.nationalityCode,identityDocumentType:form.identityDocumentType,identityDocumentNumber:form.identityDocumentNumber};
   const input={...common,...identity},body=JSON.stringify(input);
   if(draftRequest.current?.body!==body)draftRequest.current={body,key:crypto.randomUUID()};
   const result=await saveFormalDraft(input,draftRequest.current.key);

   const nextUploaded:Partial<Record<FormalDocumentType,string>>={...uploaded};
   for(const type of ['IDENTITY_FRONT','IDENTITY_BACK','BANKBOOK_COVER'] as FormalDocumentType[]){
    const file=files[type];if(!file||nextUploaded[type])continue;
    let doc;try{doc=await uploadFormalDocument(result.id,type,file);}catch(reason){throw new Error(({IDENTITY_FRONT:'身分證明正面',IDENTITY_BACK:'身分證明反面',BANKBOOK_COVER:'存摺封面',SIGNED_APPLICATION_AGREEMENT:'會員簽名'}[type])+'上傳未完成：'+(reason instanceof Error?reason.message:'請重試')+'。請重新按儲存，完成照片上傳後再送出申請。');}
    nextUploaded[type]=doc.scanStatus;setUploaded({...nextUploaded});
   }
   try{await uploadFormalDocument(result.id,'SIGNED_APPLICATION_AGREEMENT',signature);}catch(reason){throw new Error('簽名上傳未完成，請保留畫面重新儲存：'+(reason instanceof Error?reason.message:'請重試'));}
   setSaved(result);setUploaded(nextUploaded);onDraftSaved?.({id:result.id,name:form.legalName,sponsorBallNo:form.sponsorBallNo,identity:result.identityDocumentNumberMasked??'已填寫',bank:result.bankAccountMasked});key.current=crypto.randomUUID();contracts.retry();
  }catch(reason){setError(reason instanceof Error?reason.message:'草稿儲存失敗');}
  finally{setBusy(false);}
 }

 return <form className="card" onSubmit={submit}><h3>補齊正式會員申請資料</h3><p><span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span> 為必填欄位；勾選有配偶後，配偶資料亦須填寫。</p>
 <p>線上正式會員申請限自然人。填妥資料並儲存後，繼續選擇套組與確認送出；配偶與身分資料僅供 KYC 與跨線審查。</p>
 <details><summary>{contract.title}（{contract.version}）</summary><p>{contract.content}</p><small>內容雜湊：{contract.contentHash}</small></details>
 <label><input type="checkbox" checked={accepted||!!contract.acceptedAt} disabled={!!contract.acceptedAt||busy} onChange={e=>setAccepted(e.target.checked)}/> 我已閱讀並同意上述正式會員合約與隱私告知</label>

 <section className="card"><strong>線上申請限自然人</strong><p>法人正式會員目前採紙本申請，由公司後台建立並審查公司登記、代表人、銀行與其他法人文件。</p></section>
 <label>推薦球號（送出申請前必填）<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required aria-label="推薦球號" maxLength={48} value={form.sponsorBallNo} onChange={e=>set('sponsorBallNo',e.target.value.trim().toUpperCase())} placeholder="請填寫推薦人的完整球號"/></label><p>請向推薦人取得球號；送出時會確認球號有效。此欄用於申請審核，不會直接變更組織安置。</p>
 <label>姓名<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={120} autoComplete="name" value={form.legalName} onChange={e=>set('legalName',e.target.value)}/></label>
 <label>性別<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><select required value={form.gender} onChange={e=>set('gender',e.target.value)}><option value="FEMALE">女性</option><option value="MALE">男性</option><option value="OTHER">其他</option><option value="UNDISCLOSED">不揭露</option></select></label>
 <label>出生年月日<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required type="date" value={form.birthDate} onChange={e=>set('birthDate',e.target.value)}/></label>
 <label>國籍<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><select required value={form.nationalityCode} onChange={e=>set('nationalityCode',e.target.value)}>{countryOptions.map(option=><option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
 <label>身分證明文件類型<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><select required value={form.identityDocumentType} onChange={e=>set('identityDocumentType',e.target.value)}><option value="NATIONAL_ID">身分證號</option><option value="RESIDENCE_PERMIT">居留證號</option><option value="PASSPORT">護照號碼</option><option value="OTHER">其他</option></select></label>
 <label>身分證明號碼<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={64} autoComplete="off" value={form.identityDocumentNumber} onChange={e=>set('identityDocumentNumber',e.target.value)}/></label>

 <fieldset><legend>配偶資料／跨線審查</legend>
  <label><input type="checkbox" checked={form.hasSpouse} onChange={e=>set('hasSpouse',e.target.checked)}/> 有配偶</label>
  {form.hasSpouse&&<><label>配偶姓名<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={120} value={form.spouseName} onChange={e=>set('spouseName',e.target.value)}/></label><label>配偶國籍<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><select required value={form.spouseNationalityCode} onChange={e=>set('spouseNationalityCode',e.target.value)}>{countryOptions.map(option=><option key={option.code} value={option.code}>{option.label}</option>)}</select></label><label>配偶身分證明文件類型<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><select required value={form.spouseIdentityDocumentType} onChange={e=>set('spouseIdentityDocumentType',e.target.value)}><option value="NATIONAL_ID">身分證號</option><option value="RESIDENCE_PERMIT">居留證號</option><option value="PASSPORT">護照號碼</option><option value="OTHER">其他</option></select></label><label>配偶身分證明號碼<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={64} autoComplete="off" value={form.spouseIdentityDocumentNumber} onChange={e=>set('spouseIdentityDocumentNumber',e.target.value)}/></label></>}
  <small>夫妻於婚姻關係存續期間視為單一正式經營單位；配偶仍可保有一般會員／消費者資格，但不得另行取得獨立正式傳銷經營權。</small>
 </fieldset>
 <fieldset><legend>身分與銀行文件</legend>
  <p>可上傳身分證明文件正反面與存摺封面，或攜帶正本至現場讓工作人員核對。JPG/PNG，單檔上限 10 MB。</p>
  <label>身分證明文件正面<input type="file" accept="image/jpeg,image/png" onChange={e=>setFile('IDENTITY_FRONT',e.target.files?.[0])}/>{uploaded.IDENTITY_FRONT?<small>照片已上傳成功，等待核對</small>:files.IDENTITY_FRONT&&<small>已選取：{files.IDENTITY_FRONT!.name}；尚未上傳，請按下方儲存按鈕。</small>}</label>
  <label>身分證明文件反面<input type="file" accept="image/jpeg,image/png" onChange={e=>setFile('IDENTITY_BACK',e.target.files?.[0])}/>{uploaded.IDENTITY_BACK?<small>照片已上傳成功，等待核對</small>:files.IDENTITY_BACK&&<small>已選取：{files.IDENTITY_BACK!.name}；尚未上傳，請按下方儲存按鈕。</small>}</label>
  <label>存摺封面<input type="file" accept="image/jpeg,image/png" onChange={e=>setFile('BANKBOOK_COVER',e.target.files?.[0])}/>{uploaded.BANKBOOK_COVER?<small>照片已上傳成功，等待核對</small>:files.BANKBOOK_COVER&&<small>已選取：{files.BANKBOOK_COVER!.name}；尚未上傳，請按下方儲存按鈕。</small>}</label>
  <small>工作人員會核對資料與文件；完成收款與審核後才會成為正式會員。</small>
 </fieldset>

 <label>通訊地址<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><textarea required maxLength={500} autoComplete="street-address" value={form.communicationAddress} onChange={e=>set('communicationAddress',e.target.value)}/></label>
 <label>電話<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={32} autoComplete="tel" value={form.phone} onChange={e=>set('phone',e.target.value)}/></label>
 <label>Email<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required type="email" maxLength={254} autoComplete="email" value={form.email} onChange={e=>set('email',e.target.value)}/></label>
 <label>銀行別／代碼<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={16} value={form.bankCode} onChange={e=>set('bankCode',e.target.value)}/></label>
 <label>銀行帳號<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={34} autoComplete="off" value={form.bankAccount} onChange={e=>set('bankAccount',e.target.value)}/></label>
 <label>帳戶名<span style={{color:"#e34b59",marginInlineStart:4}} aria-label="必填">*</span><input required maxLength={120} value={form.accountHolder} onChange={e=>set('accountHolder',e.target.value)}/></label>
 <MemberSignature name={form.legalName} contract={contract} resetKey={signatureReset} disabled={busy} onChange={file=>{setSignature(file);setSaved(null);}}/>
 <button className="primary" disabled={busy||!(accepted||!!contract.acceptedAt)}>{busy?'儲存／上傳中…':onDraftSaved?'儲存資料，下一步選擇套組':'儲存申請資料（文件可現場核對）'}</button>
 {saved&&<p role="status">已保存第 {saved.version} 版自然人草稿；身分證明號碼 {saved.identityDocumentNumberMasked??'未提供'}{saved.spouseIdentityDocumentNumberMasked?'，配偶身分證明號碼 '+saved.spouseIdentityDocumentNumberMasked:''}，帳號 {saved.bankAccountMasked}。</p>}
 {saved&&!onDraftSaved&&<button type="button" disabled={busy||submitted||!form.sponsorBallNo.trim()} onClick={async()=>{setBusy(true);setError('');try{await submitFormalEnrollment(saved.id,key.current);setSubmitted(true);onSubmitted?.();}catch(e){setError(e instanceof Error?e.message:'送出失敗');}finally{setBusy(false);}}}>{submitted?'申請已送出，等待審核':'送出正式會員申請'}</button>}
 {error&&<p role="alert">{error}</p>}</form>;
}
