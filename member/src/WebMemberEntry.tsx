import React,{FormEvent,useEffect,useRef,useState} from 'react';
import {CompanyLogo} from '@ucell/design-system';
import {countryOptions} from './countryOptions';
import ContactVerifier from './ContactVerifier';
import {completeRegistration,forgotPassword,passwordLogin,registrationContract,renderGoogleButton,renderGoogleRegistrationButton,resetPassword,linkLineIdentity,type RegistrationContract} from './webAuth';

type Mode='login'|'forgot'|'register'|'reset';
export default function WebMemberEntry({onLineLogin,onAuthenticated,lineRegistrationToken,onExistingMemberBinding}:{onLineLogin:()=>Promise<void>;onAuthenticated:()=>void;lineRegistrationToken?:()=>string;onExistingMemberBinding?:()=>void}){
 const resetToken=new URLSearchParams(window.location.search).get('token')||'';
 const [mode,setMode]=useState<Mode>(lineRegistrationToken?'register':resetToken?'reset':'login');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const [linkExisting,setLinkExisting]=useState(false);
 const [mobileProof,setMobileProof]=useState<string>(),[emailProof,setEmailProof]=useState<string>();
 const finishExistingLogin=async()=>{
  try{if(linkExisting&&lineRegistrationToken)await linkLineIdentity(lineRegistrationToken());onAuthenticated();}
  catch(e){setError(e instanceof Error?e.message:'LINE 連結失敗');}
 };
 const googleRef=useRef<HTMLDivElement>(null),googleRegisterRef=useRef<HTMLDivElement>(null);
 const [memberNo,setMemberNo]=useState(''),[password,setPassword]=useState(''),[confirmPassword,setConfirmPassword]=useState('');
 const [identifier,setIdentifier]=useState(''),[newPassword,setNewPassword]=useState('');
 const [contract,setContract]=useState<RegistrationContract>();
 const [contractError,setContractError]=useState(''),[contractAttempt,setContractAttempt]=useState(0);
 const [accepted,setAccepted]=useState(false),[pendingGoogleIdToken,setPendingGoogleIdToken]=useState('');
 const [legalName,setLegalName]=useState(''),[alias,setAlias]=useState(''),[gender,setGender]=useState('UNDISCLOSED'),[birthDate,setBirthDate]=useState(''),[mobile,setMobile]=useState(''),[email,setEmail]=useState(''),[registerPassword,setRegisterPassword]=useState('');
 const [nationalityCode,setNationalityCode]=useState('TW'),[identityDocumentType,setIdentityDocumentType]=useState('NATIONAL_ID'),[identityDocumentNumber,setIdentityDocumentNumber]=useState('');

 useEffect(()=>{if(mode==='login'&&googleRef.current)void renderGoogleButton(googleRef.current,()=>void finishExistingLogin(),(token)=>{if(linkExisting){setError('此 Google 尚未註冊會員，請使用原先註冊的 Google 帳號或會員密碼。');return;}setPendingGoogleIdToken(token);setError('');setMessage('Google 身分驗證完成，請補完登錄資料，即可成為一般網路會員。');setMode('register');},setError);},[mode,onAuthenticated,linkExisting]);
 useEffect(()=>{
  if(mode!=='register'||contract)return;
  let active=true;setContractError('');
  registrationContract().then(value=>{if(active)setContract(value)}).catch(e=>{if(active)setContractError(e instanceof Error&&e.message==='NETWORK_CONTRACT_NOT_CONFIGURED'?'會員契約尚未開放，請稍後重試或聯絡客服。':'無法載入會員契約，請重新載入。')});
  return()=>{active=false};
 },[mode,contract,contractAttempt]);
 useEffect(()=>{if(mode==='register'&&!lineRegistrationToken&&!pendingGoogleIdToken&&googleRegisterRef.current)void renderGoogleRegistrationButton(googleRegisterRef.current,(token)=>{setPendingGoogleIdToken(token);setMessage('Google 身分驗證完成，請填寫會員資料。');},setError);},[mode,pendingGoogleIdToken,lineRegistrationToken]);

 const run=async(work:()=>Promise<unknown>,success?:string)=>{setBusy(true);setError('');setMessage('');try{await work();if(success)setMessage(success);}catch(e){setError(e instanceof Error?e.message:'操作失敗');}finally{setBusy(false);}};
 const submitPassword=(e:FormEvent)=>{e.preventDefault();void run(async()=>{await passwordLogin(memberNo,password);await finishExistingLogin();});};
 const submitForgot=(e:FormEvent)=>{e.preventDefault();void run(()=>forgotPassword(identifier),'若帳號資料符合條件，系統將寄送密碼重設信。');};
 const submitReset=(e:FormEvent)=>{e.preventDefault();void run(async()=>{await resetPassword(resetToken,newPassword);window.history.replaceState({},'',window.location.pathname);setMode('login');setNewPassword('');},'密碼已更新，請重新登入。');};
 const submitRegister=(e:FormEvent)=>{e.preventDefault();if(registerPassword!==confirmPassword){setError('兩次輸入的密碼不一致，請重新確認。');return;}if(!contract){setError('契約尚未載入');return;}if(!pendingGoogleIdToken&&!lineRegistrationToken){setError('請先完成 Google 身分驗證');return;}if(!accepted){setError('請先同意會員契約與隱私條款');return;}if(!mobileProof||!emailProof){setError('請先完成手機與 Email 驗證。');return;}void run(async()=>{await completeRegistration({contractVersionId:contract.contractVersionId,legalName,alias,gender,birthDate,nationalityCode,identityDocumentType,identityDocumentNumber,mobile,email,password:registerPassword,mobileVerificationProof:mobileProof,emailVerificationProof:emailProof,...(lineRegistrationToken?{lineIdToken:lineRegistrationToken()}:{googleIdToken:pendingGoogleIdToken})});onAuthenticated();});};

 return <main className="loading"><section className="card uc-web-entry" aria-labelledby="ucell-web-login-title">
  <CompanyLogo className="uc-company-logo-entry"/><small>WEB MEMBER ENTRY</small><h1 id="ucell-web-login-title">UCell 會員中心</h1>
  {error&&<p role="alert" className="uc-auth-error">{error}</p>}{message&&<p role="status" className="uc-auth-message">{message}</p>}
  {mode==='login'&&<>
   <p>{linkExisting?'登入原先的會員帳號，即可把目前 LINE 連結到同一會員；不會建立新會員。':'請選擇登入方式。所有方式登入後都會進入同一個會員帳號與球資料。'}</p>
   {!linkExisting&&<button className="primary" disabled={busy} onClick={()=>void run(onLineLogin)}>使用 LINE 登入</button>}
   <div ref={googleRef} className="uc-google-button" aria-label="Google 登入"/>
   <div className="uc-auth-divider"><span>或</span></div>
   <form onSubmit={submitPassword} className="uc-auth-form"><label>會員編號、Email 或手機號碼<input autoComplete="username" maxLength={254} value={memberNo} onChange={e=>setMemberNo(e.target.value)} required/></label><label>密碼<input type="password" autoComplete="current-password" minLength={12} maxLength={256} value={password} onChange={e=>setPassword(e.target.value)} required/></label><button disabled={busy}>登入</button></form>
   <p className="muted">手機 OTP 登入將於簡訊供應商 API 完成後開放。</p>
   <div className="uc-auth-links"><button type="button" onClick={()=>{setLinkExisting(false);setMode('register')}}>{linkExisting?'返回新會員登錄':'註冊會員'}</button><button type="button" onClick={()=>setMode('forgot')}>忘記密碼</button></div>
  </>}
  {mode==='forgot'&&<form onSubmit={submitForgot} className="uc-auth-form"><h2>忘記密碼</h2><p>請輸入會員編號或 Email。為保護帳號安全，系統不會揭露帳號是否存在。</p><label>會員編號或 Email<input value={identifier} onChange={e=>setIdentifier(e.target.value)} required/></label><button disabled={busy}>寄送密碼重設連結</button><button type="button" onClick={()=>setMode('login')}>返回登入</button></form>}
  {mode==='reset'&&<form onSubmit={submitReset} className="uc-auth-form"><h2>設定新密碼</h2><label>新密碼<input type="password" minLength={12} maxLength={256} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/></label><button disabled={busy}>更新密碼</button></form>}
  {mode==='register'&&<form onSubmit={submitRegister} className="uc-auth-form"><h2>登錄會員資料</h2><p>完成身分驗證、補完資料並同意會員契約後，即成為一般網路會員，進入會員首頁。</p>
   {lineRegistrationToken?<p className="uc-auth-message">使用 LINE 註冊，請補完以下會員資料。</p>:!pendingGoogleIdToken?<div ref={googleRegisterRef} className="uc-google-button" aria-label="使用 Google 註冊"/>:<p className="uc-auth-message">Google 身分已驗證</p>}
   <label>姓名<input value={legalName} onChange={e=>setLegalName(e.target.value)} required/></label><label>顯示名稱<input value={alias} onChange={e=>setAlias(e.target.value)} required/></label><label>性別<select value={gender} onChange={e=>setGender(e.target.value)} required><option value="FEMALE">女性</option><option value="MALE">男性</option><option value="OTHER">其他</option><option value="UNDISCLOSED">不揭露</option></select></label><label>生日<input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)} required/></label><label>國籍<select value={nationalityCode} onChange={e=>setNationalityCode(e.target.value)}>{countryOptions.map(x=><option key={x.code} value={x.code}>{x.label}</option>)}</select></label><label>身分證明文件類型<select value={identityDocumentType} onChange={e=>setIdentityDocumentType(e.target.value)}><option value="NATIONAL_ID">身分證號</option><option value="RESIDENCE_PERMIT">居留證號</option><option value="PASSPORT">護照號碼</option><option value="OTHER">其他</option></select></label><label>身分證明號碼<input required maxLength={64} value={identityDocumentNumber} autoComplete="off" onChange={e=>setIdentityDocumentNumber(e.target.value)}/></label><label>手機號碼（聯絡資料）<input placeholder="+886912345678" value={mobile} onChange={e=>setMobile(e.target.value)} required/></label><label>{lineRegistrationToken?'Email（聯絡資料）':'Email（需與 Google 已驗證 Email 相同）'}<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label><label>設定登入密碼<input type="password" minLength={12} maxLength={256} value={registerPassword} onChange={e=>setRegisterPassword(e.target.value)} required/></label>
   <label>確認密碼<input type="password" autoComplete="new-password" minLength={12} maxLength={256} value={confirmPassword} onChange={e=>setConfirmPassword(e.target.value)} required/></label>
   <ContactVerifier channel="SMS" value={mobile} purpose="REGISTRATION" disabled={busy} onVerified={setMobileProof} registrationTokens={()=>lineRegistrationToken?{lineIdToken:lineRegistrationToken()}:{googleIdToken:pendingGoogleIdToken}}/>
   <ContactVerifier channel="EMAIL" value={email} purpose="REGISTRATION" disabled={busy} onVerified={setEmailProof} registrationTokens={()=>lineRegistrationToken?{lineIdToken:lineRegistrationToken()}:{googleIdToken:pendingGoogleIdToken}}/>
   {contract?<details className="uc-contract"><summary>{contract.title}（{contract.versionCode}）</summary><div>{contract.contentText}</div></details>:contractError?<div role="alert"><p>{contractError}</p><button type="button" onClick={()=>setContractAttempt(n=>n+1)}>重新載入會員契約</button></div>:<p>正在載入會員契約…</p>}
   <label className="uc-auth-check"><input type="checkbox" disabled={!contract} checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>我已閱讀並同意上述契約與隱私條款</label>
   <button disabled={busy||!contract||(!pendingGoogleIdToken&&!lineRegistrationToken)||!accepted}>完成登錄並進入會員首頁</button>{lineRegistrationToken?<><button type="button" onClick={()=>{setLinkExisting(true);setError('');setMode('login')}}>已用 Google 或 Web 註冊，登入並連結 LINE</button><button type="button" onClick={onExistingMemberBinding}>我是既有會員，改用安全綁定</button></>:<button type="button" onClick={()=>setMode('login')}>返回登入</button>}
  </form>}
 </section></main>;
}

