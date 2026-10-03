import {useEffect,useRef,useState} from 'react';
import {linkGoogleIdentity,linkLineIdentity,loginMethods,renderGoogleRegistrationButton} from './webAuth';
import {prepareLineIdentityLink} from './lineBinding';

export default function IdentityLinking(){
 const googleRef=useRef<HTMLDivElement>(null);
 const [message,setMessage]=useState(''),[error,setError]=useState('');
 const [methods,setMethods]=useState<{google:boolean;line:boolean}>(),[busy,setBusy]=useState(false);
 const refresh=()=>loginMethods().then(setMethods).catch(()=>setError('無法讀取登入方式，請重新載入。'));
 useEffect(()=>{void refresh()},[]);
 async function connectLine(){
  if(busy)return;setBusy(true);setError('');setMessage('');
  try{const token=await prepareLineIdentityLink();if(!token)return;await linkLineIdentity(token);await refresh();setMessage('LINE 已連結，可用 LINE 或 Google 登入同一會員帳號。');}
  catch(e){setError(e instanceof Error?e.message:'LINE 連結失敗');}finally{setBusy(false);}
 }
 useEffect(()=>{
  if(!googleRef.current)return;
  void renderGoogleRegistrationButton(googleRef.current,async token=>{
   setMessage('');setError('');
   try{await linkGoogleIdentity(token);await refresh();setMessage('Google 帳號已連結，可用 Google 登入同一個 UCell 會員帳號。');}
   catch(e){setError(e instanceof Error?e.message:'Google 帳號連結失敗');}
  },setError);
 },[]);
 return <section className="card uc-identity-linking"><h3>登入方式</h3><p>Google 與 LINE 可連結到同一個會員。連結不會建立新會員、球或新的會員編號。</p><p>Google：{methods?(methods.google?'已連結':'未連結'):'載入中'} · LINE：{methods?(methods.line?'已連結':'未連結'):'載入中'}</p><div ref={googleRef} className="uc-google-button" aria-label="連結 Google 帳號"/><p>連結 LINE 時，請確認使用自己的 LINE 帳號；完成 LINE 登入返回此頁後，點選下方按鈕完成連結。</p><button type="button" disabled={busy||!methods||methods.line} onClick={()=>void connectLine()}>{methods?.line?'LINE 已連結':'驗證並連結我的 LINE'}</button>{error&&<p role="alert" className="uc-auth-error">{error}</p>}{message&&<p role="status" className="uc-auth-message">{message}</p>}</section>;
}
