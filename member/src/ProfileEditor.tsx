import { useState } from 'react';
import { isMock, updateProfile } from './memberData';
export default function ProfileEditor({refresh}:{refresh:()=>void}){
 const [name,setName]=useState(''),[email,setEmail]=useState(''),[phone,setPhone]=useState('');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
 if(isMock)return null;
 async function submit(e:React.FormEvent){
  e.preventDefault();if(busy)return;
  const input={...(name.trim()?{name:name.trim()}:{}),...(email.trim()?{email:email.trim()}:{}),...(phone.trim()?{phone:phone.trim()}: {})};
  if(!Object.keys(input).length){setError('請至少填寫一個要更新的欄位');return;}
  setBusy(true);setError('');setMessage('');
  try{await updateProfile(input);setName('');setEmail('');setPhone('');setMessage('會員資料已更新');refresh();}
  catch(e){setError(e instanceof Error?e.message:'更新失敗，請稍後重試');}
  finally{setBusy(false);}
 }
 return <form className="card" onSubmit={submit}><h3>更新聯絡資料</h3><p>空白欄位保留原資料。顯示名稱不變更法定姓名；聯絡資料不作為登入身分。</p><label>顯示名稱<input maxLength={80} value={name} onChange={e=>setName(e.target.value)} disabled={busy}/></label><label>電子郵件<input type="email" maxLength={254} value={email} onChange={e=>setEmail(e.target.value)} disabled={busy}/></label><label>電話<input type="tel" maxLength={32} value={phone} onChange={e=>setPhone(e.target.value)} disabled={busy}/></label>{error&&<p role="alert">{error}</p>}{message&&<p role="status">{message}</p>}<button disabled={busy}>{busy?'更新中…':'儲存聯絡資料'}</button></form>;
}
