import {useEffect,useRef,useState} from 'react';
import {contactVerificationRequest} from './webAuth';
type Tokens={googleIdToken?:string;lineIdToken?:string};
export default function ContactVerifier({channel,value,purpose,onVerified,registrationTokens,disabled=false}:{channel:'SMS'|'EMAIL';value:string;purpose:'REGISTRATION'|'PROFILE';onVerified:(proof:string|undefined)=>void;registrationTokens?:()=>Tokens;disabled?:boolean}){
 const [challenge,setChallenge]=useState<{challengeId:string;expiresAt:string;resendAt:string}>(),[code,setCode]=useState(''),[proof,setProof]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[now,setNow]=useState(Date.now());
 const request=useRef<{body:string;key:string}>(),valueRef=useRef(value);valueRef.current=value;
 useEffect(()=>{setChallenge(undefined);setCode('');setProof('');setError('');request.current=undefined;onVerified(undefined);},[value]);
 useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer)},[]);
 useEffect(()=>{if(proof&&challenge&&Date.parse(challenge.expiresAt)<=now){setProof('');onVerified(undefined);setError('驗證已過期，請重新申請。');}},[now,proof,challenge]);
 const label=channel==='SMS'?'手機':'Email';
 function payload(){const identity=registrationTokens?.();if(identity&&!identity.googleIdToken&&!identity.lineIdToken)throw new Error('請先完成 Google 或 LINE 登入驗證。');return {channel,destination:value,...(identity??{purpose})} as Record<string,string>;}
 async function send(){
  if(busy||disabled||!value.trim())return;const requestedValue=value;setBusy(true);setError('');
  try{const body=payload(),serialized=JSON.stringify(body);if(request.current?.body!==serialized||challenge&&now>=Date.parse(challenge.resendAt))request.current={body:serialized,key:crypto.randomUUID()};
   const result=await contactVerificationRequest('challenges',body,Boolean(registrationTokens),request.current.key) as {challengeId:string;expiresAt:string;resendAt:string;status:string};
   if(valueRef.current!==requestedValue)return;
   if(result.status!=='SENT')throw new Error('發送處理中，請稍後重試。');
   setChallenge(result);setProof('');setCode('');onVerified(undefined);
  }catch(e){if(valueRef.current===requestedValue)setError(e instanceof Error?e.message:'驗證碼發送失敗');}finally{setBusy(false);}
 }
 async function verify(){
  if(busy||disabled||!challenge)return;const requestedValue=value;setBusy(true);setError('');
  try{const result=await contactVerificationRequest('verify',{...payload(),challengeId:challenge.challengeId,code},Boolean(registrationTokens)) as {proof:string};if(valueRef.current!==requestedValue)return;if(!/^[a-f0-9]{64}$/.test(result.proof))throw new Error('驗證回應異常，請重新申請。');setProof(result.proof);setCode('');onVerified(result.proof);}
  catch(e){if(valueRef.current===requestedValue)setError(e instanceof Error?e.message:'驗證失敗');}finally{setBusy(false);}
 }
 const remaining=challenge?Math.max(0,Math.ceil((Date.parse(challenge.resendAt)-now)/1000)):0;
 return <fieldset disabled={disabled||busy}><legend>{label}驗證</legend>{proof?<p role="status">{label}已驗證</p>:<><button type="button" disabled={!value.trim()||remaining>0} onClick={()=>void send()}>{remaining?`${remaining} 秒後可重送`:challenge?'重送驗證碼':`發送${label}驗證碼`}</button>{challenge&&<><label>{label}驗證碼<input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={e=>setCode(e.target.value.replace(/\D/g,''))}/></label><button type="button" disabled={!/^\d{6}$/.test(code)||Date.parse(challenge.expiresAt)<=now} onClick={()=>void verify()}>確認{label}驗證碼</button><p>驗證碼 5 分鐘內有效，修改聯絡資料後需重新驗證。</p></>}</>}{error&&<p role="alert">{error}</p>}</fieldset>;
}
