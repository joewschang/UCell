import React,{useRef,useState} from 'react';
import {completeLineBinding,requestLineBinding} from './lineBinding';
import './line-binding.css';

export function LineBinding({onComplete,onRecheck,onBack}:{onComplete:()=>void;onRecheck:()=>void;onBack?:()=>void}){
 const [memberNo,setMemberNo]=useState(''),[reference,setReference]=useState(''),[requestId,setRequestId]=useState(''),[token,setToken]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const pending=useRef<{input:string;key:string}>();
 async function submit(event:React.FormEvent,complete:boolean){
  event.preventDefault();if(busy)return;setBusy(true);setMessage('');
  try{
   if(complete){await completeLineBinding(requestId.trim(),token.trim());setToken('');onComplete();}
   else{
    const input=JSON.stringify([memberNo.trim(),reference.trim()]);
    if(pending.current?.input!==input)pending.current={input,key:crypto.randomUUID()};
    setRequestId(await requestLineBinding(memberNo.trim(),reference.trim(),pending.current.key));
    setMessage('申請已送出。請聯絡客服完成公司核驗，取得核准憑證後再完成綁定。');
   }
  }catch(error){setMessage(error instanceof Error?error.message:'服務暫時無法使用，請重試。');}finally{setBusy(false);}
 }
 return <div className="line-binding-shell"><main className="card line-binding">
  <h1>綁定 UCell 會員</h1><p>此 LINE 尚未綁定會員。既有會員須經公司核驗及核准；會員編號本身不會完成綁定。</p>
  {onBack&&<><p>新會員可直接登錄；已用 Google 或 Web 註冊的會員，可登入原帳號自助連結 LINE。</p><button type="button" disabled={busy} onClick={onBack}>返回會員登錄與 Google／Web 連結</button></>}
  <form onSubmit={event=>void submit(event,false)}>
   <label>會員編號<input required inputMode="numeric" pattern="[0-9]{10}" maxLength={10} value={memberNo} onChange={e=>setMemberNo(e.target.value)}/></label>
   <label>客服核驗案件參考<input required minLength={8} maxLength={160} value={reference} onChange={e=>setReference(e.target.value)}/></label>
   <button disabled={busy} type="submit">送出綁定申請</button>
  </form>
  <h2>已有公司核准憑證</h2><p>請使用提出申請時的同一 LINE 帳號。憑證限時且只能使用一次。</p>
  <form onSubmit={event=>void submit(event,true)}>
   <label>申請編號<input required value={requestId} onChange={e=>setRequestId(e.target.value)} maxLength={36}/></label>
   <label>核准憑證<input required type="password" autoComplete="off" minLength={20} maxLength={200} value={token} onChange={e=>setToken(e.target.value)}/></label>
   <button disabled={busy} type="submit">完成綁定並進入會員中心</button>
  </form>
  <p>若已完成綁定但畫面未更新，可重新檢查登入狀態。</p>
  <button type="button" disabled={busy} onClick={onRecheck}>重新檢查綁定狀態</button>
  {message&&<p role="status">{message}</p>}
 </main></div>;
}
