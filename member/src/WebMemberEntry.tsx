import React,{FormEvent,useEffect,useRef,useState} from 'react';
import {completeRegistration,forgotPassword,otpLogin,otpLoginChallenge,passwordLogin,registrationContract,registrationOtpChallenge,renderGoogleButton,resetPassword,verifyRegistrationOtp,type RegistrationContract} from './webAuth';

type Mode='login'|'forgot'|'register'|'reset';
export default function WebMemberEntry({onLineLogin,onAuthenticated}:{onLineLogin:()=>Promise<void>;onAuthenticated:()=>void}){
 const resetToken=new URLSearchParams(window.location.search).get('token')||'';
 const [mode,setMode]=useState<Mode>(resetToken?'reset':'login');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 const googleRef=useRef<HTMLDivElement>(null);
 const [memberNo,setMemberNo]=useState(''),[password,setPassword]=useState('');
 const [mobile,setMobile]=useState(''),[otpChallengeId,setOtpChallengeId]=useState(''),[otpCode,setOtpCode]=useState('');
 const [identifier,setIdentifier]=useState('');
 const [newPassword,setNewPassword]=useState('');
 const [contract,setContract]=useState<RegistrationContract>();
 const [registrationSessionId]=useState(()=>crypto.randomUUID());
 const [regChallengeId,setRegChallengeId]=useState(''),[regCode,setRegCode]=useState(''),[regVerified,setRegVerified]=useState(false);
 const [accepted,setAccepted]=useState(false);
 const [legalName,setLegalName]=useState(''),[alias,setAlias]=useState(''),[gender,setGender]=useState('UNSPECIFIED'),[birthDate,setBirthDate]=useState(''),[email,setEmail]=useState('');

 useEffect(()=>{if(mode==='login'&&googleRef.current)void renderGoogleButton(googleRef.current,onAuthenticated,setError);},[mode,onAuthenticated]);
 useEffect(()=>{if(mode==='register'&&!contract)registrationContract().then(setContract).catch(e=>setError(e instanceof Error?e.message:'無法載入契約'));},[mode,contract]);

 const run=async(work:()=>Promise<unknown>,success?:string)=>{setBusy(true);setError('');setMessage('');try{await work();if(success)setMessage(success);}catch(e){setError(e instanceof Error?e.message:'操作失敗');}finally{setBusy(false);}};

 const submitPassword=(e:FormEvent)=>{e.preventDefault();void run(async()=>{await passwordLogin(memberNo,password);onAuthenticated();});};
 const sendOtp=()=>void run(async()=>{const c=await otpLoginChallenge(mobile);setOtpChallengeId(c.challengeId);},'驗證碼已送出');
 const submitOtp=(e:FormEvent)=>{e.preventDefault();void run(async()=>{await otpLogin(otpChallengeId,otpCode);onAuthenticated();});};
 const submitForgot=(e:FormEvent)=>{e.preventDefault();void run(()=>forgotPassword(identifier),'若帳號資料符合條件，系統將寄送密碼重設信。');};
 const submitReset=(e:FormEvent)=>{e.preventDefault();void run(async()=>{await resetPassword(resetToken,newPassword);window.history.replaceState({},'',window.location.pathname);setMode('login');setNewPassword('');},'密碼已更新，請重新登入。');};
 const sendRegOtp=()=>void run(async()=>{const c=await registrationOtpChallenge(registrationSessionId,mobile);setRegChallengeId(c.challengeId);},'註冊驗證碼已送出');
 const verifyRegOtp=()=>void run(async()=>{await verifyRegistrationOtp(regChallengeId,regCode);setRegVerified(true);},'手機驗證完成');
 const submitRegister=(e:FormEvent)=>{e.preventDefault();if(!contract){setError('契約尚未載入');return;}if(!accepted){setError('請先同意會員契約與隱私條款');return;}if(!regVerified){setError('請先完成手機 OTP 驗證');return;}void run(async()=>{await completeRegistration({registrationSessionId,challengeId:regChallengeId,contractVersionId:contract.contractVersionId,legalName,alias,gender,birthDate,mobile,email});onAuthenticated();});};

 return <main className="loading"><section className="card uc-web-entry" aria-labelledby="ucell-web-login-title">
  <small>WEB MEMBER ENTRY</small><h1 id="ucell-web-login-title">UCell 會員中心</h1>
  {error&&<p role="alert" className="uc-auth-error">{error}</p>}{message&&<p role="status" className="uc-auth-message">{message}</p>}
  {mode==='login'&&<>
   <p>請選擇登入方式。所有方式登入後都會進入同一個會員帳號與球資料。</p>
   <button className="primary" disabled={busy} onClick={()=>void run(onLineLogin)}>使用 LINE 登入</button>
   <div ref={googleRef} className="uc-google-button" aria-label="Google 登入"/>
   <div className="uc-auth-divider"><span>或</span></div>
   <form onSubmit={submitPassword} className="uc-auth-form"><label>會員編號<input inputMode="numeric" pattern="\d{10}" value={memberNo} onChange={e=>setMemberNo(e.target.value)} required/></label><label>密碼<input type="password" minLength={12} maxLength={256} value={password} onChange={e=>setPassword(e.target.value)} required/></label><button disabled={busy}>會員編號 + 密碼登入</button></form>
   <details className="uc-auth-details"><summary>使用手機 OTP 登入</summary><form onSubmit={submitOtp} className="uc-auth-form"><label>手機號碼（國際格式）<input placeholder="+886912345678" value={mobile} onChange={e=>setMobile(e.target.value)} required/></label>{!otpChallengeId?<button type="button" onClick={sendOtp} disabled={busy}>取得驗證碼</button>:<><label>6 位數驗證碼<input inputMode="numeric" pattern="\d{6}" value={otpCode} onChange={e=>setOtpCode(e.target.value)} required/></label><button disabled={busy}>OTP 登入</button></>}</form></details>
   <div className="uc-auth-links"><button type="button" onClick={()=>setMode('register')}>註冊會員</button><button type="button" onClick={()=>setMode('forgot')}>忘記密碼</button></div>
  </>}
  {mode==='forgot'&&<form onSubmit={submitForgot} className="uc-auth-form"><h2>忘記密碼</h2><p>請輸入會員編號或 Email。為保護帳號安全，系統不會揭露帳號是否存在。</p><label>會員編號或 Email<input value={identifier} onChange={e=>setIdentifier(e.target.value)} required/></label><button disabled={busy}>寄送密碼重設連結</button><button type="button" onClick={()=>setMode('login')}>返回登入</button></form>}
  {mode==='reset'&&<form onSubmit={submitReset} className="uc-auth-form"><h2>設定新密碼</h2><label>新密碼<input type="password" minLength={12} maxLength={256} value={newPassword} onChange={e=>setNewPassword(e.target.value)} required/></label><button disabled={busy}>更新密碼</button></form>}
  {mode==='register'&&<form onSubmit={submitRegister} className="uc-auth-form"><h2>Web 會員註冊</h2><p>完成註冊只建立會員帳號，不會自動建立資格球。</p><label>姓名<input value={legalName} onChange={e=>setLegalName(e.target.value)} required/></label><label>顯示名稱<input value={alias} onChange={e=>setAlias(e.target.value)} required/></label><label>性別代碼<input value={gender} onChange={e=>setGender(e.target.value)} required/></label><label>生日<input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)} required/></label><label>手機號碼（國際格式）<input value={mobile} onChange={e=>setMobile(e.target.value)} required/></label><label>Email<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required/></label>
   {!regChallengeId?<button type="button" onClick={sendRegOtp} disabled={busy}>取得手機驗證碼</button>:!regVerified?<div className="uc-auth-inline"><input aria-label="註冊 OTP" inputMode="numeric" pattern="\d{6}" value={regCode} onChange={e=>setRegCode(e.target.value)} required/><button type="button" onClick={verifyRegOtp} disabled={busy}>驗證手機</button></div>:<p className="uc-auth-message">手機已驗證</p>}
   {contract?<details className="uc-contract"><summary>{contract.title}（{contract.versionCode}）</summary><div>{contract.contentText}</div></details>:<p>正在載入會員契約…</p>}
   <label className="uc-auth-check"><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)}/>我已閱讀並同意上述契約與隱私條款</label>
   <button disabled={busy||!regVerified||!accepted}>完成會員註冊</button><button type="button" onClick={()=>setMode('login')}>返回登入</button>
  </form>}
 </section></main>;
}
