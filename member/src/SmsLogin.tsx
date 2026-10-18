import {FormEvent,useEffect,useRef,useState} from 'react';
import {smsLogin,smsLoginPolicy,smsLoginRequest} from './webAuth';
export default function SmsLogin({onAuthenticated}:{onAuthenticated:()=>Promise<void>|void}){
 const [enabled,setEnabled]=useState(false),[mobile,setMobile]=useState(''),[code,setCode]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const [challenge,setChallenge]=useState<{challengeId:string;resendAt:string;expiresAt:string}>(),[now,setNow]=useState(Date.now());
 const key=useRef<string>();
 useEffect(()=>{let active=true;smsLoginPolicy().then(p=>{if(active)setEnabled(p.enabled)}).catch(()=>{});return()=>{active=false}},[]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
 if(!enabled)return <p className="muted">手機 OTP 登入將於簡訊供應商 API 完成後開放。</p>;
 const cooldown=challenge?Math.max(0,Math.ceil((Date.parse(challenge.resendAt)-now)/1000)):0;
 async function send(){setBusy(true);setError('');try{if(!key.current||challenge&&cooldown===0)key.current=crypto.randomUUID();setChallenge(await smsLoginRequest(mobile,key.current));setCode('');}catch(e){setError(e instanceof Error?e.message:'簡訊發送失敗');}finally{setBusy(false)}}
 async function login(e:FormEvent){e.preventDefault();if(!challenge)return;setBusy(true);setError('');try{await smsLogin(mobile,challenge.challengeId,code);await onAuthenticated();}catch(e){setError(e instanceof Error?e.message:'登入失敗');}finally{setBusy(false)}}
 return <details className="uc-sms-login"><summary>使用手機簡訊驗證碼登入</summary><p>請使用已在會員資料完成驗證的手機。尚未驗證者，請先用 LINE、Google 或密碼登入後驗證手機。</p><form className="uc-auth-form" onSubmit={login}><label>手機號碼<input type="tel" autoComplete="tel" disabled={busy} value={mobile} onChange={e=>{setMobile(e.target.value);setChallenge(undefined);setCode('');key.current=undefined}} required placeholder="0912345678"/></label><button type="button" disabled={busy||!mobile.trim()||cooldown>0} onClick={()=>void send()}>{cooldown?`${cooldown} 秒後可重送`:'傳送登入驗證碼'}</button>{challenge&&<><p role="status">若此手機已完成會員驗證，將收到 5 分鐘有效的驗證碼。</p><label>簡訊驗證碼<input inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} value={code} onChange={e=>setCode(e.target.value)} required/></label><button disabled={busy||code.length!==6||Date.parse(challenge.expiresAt)<=now}>驗證並登入</button></>}{error&&<p role="alert">{error}</p>}</form></details>;
}
