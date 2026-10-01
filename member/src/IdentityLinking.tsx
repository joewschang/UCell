import {useEffect,useRef,useState} from 'react';
import {linkGoogleIdentity,renderGoogleRegistrationButton} from './webAuth';

export default function IdentityLinking(){
 const googleRef=useRef<HTMLDivElement>(null);
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 useEffect(()=>{
  if(!googleRef.current)return;
  void renderGoogleRegistrationButton(googleRef.current,async token=>{
   setMessage('');setError('');
   try{await linkGoogleIdentity(token);setMessage('Google 帳號已連結，可用 Google 登入同一個 UCell 會員帳號。');}
   catch(e){setError(e instanceof Error?e.message:'Google 帳號連結失敗');}
  },setError);
 },[]);
 return <section className="card uc-identity-linking"><h3>登入方式</h3><p>可將 Google 帳號連結到目前的 UCell 會員。連結不會建立新會員、球或新的會員編號。</p><div ref={googleRef} className="uc-google-button" aria-label="連結 Google 帳號"/>{error&&<p role="alert" className="uc-auth-error">{error}</p>}{message&&<p role="status" className="uc-auth-message">{message}</p>}</section>;
}
