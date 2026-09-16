import {useRef,useState,type FormEvent} from 'react';
import type {Person} from './api';
import {getRequiredContracts,registerNetworkMember} from './memberData';
import {useResource} from './useResource';

export default function NetworkRegistration({person,refresh}:{person:Person;refresh:()=>void}){
 const contracts=useResource('network-registration-contracts',getRequiredContracts);
 const [legalName,setLegalName]=useState(''),[alias,setAlias]=useState(person.alias??person.name),[gender,setGender]=useState(''),[birthDate,setBirthDate]=useState(''),[mobile,setMobile]=useState(person.phone??''),[email,setEmail]=useState(person.email??''),[accepted,setAccepted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[done,setDone]=useState(false);
 const pending=useRef<{body:string;key:string}|null>(null),flight=useRef(false);
 const contract=contracts.data?.[0];
 async function submit(event:FormEvent){
  event.preventDefault();if(flight.current||!contract)return;
  const input={contractVersionId:contract.id,accepted:true as const,legalName:legalName.trim(),alias:alias.trim(),gender,birthDate,mobile:mobile.trim(),email:email.trim()};
  if(!accepted){setError('請先閱讀並同意合約與隱私告知');return;}
  if(!input.legalName||!input.alias||!input.gender||!input.birthDate||!/^\+[1-9][0-9]{7,14}$/.test(input.mobile)||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)){setError('請完整填寫姓名、別名、性別、出生日期、手機與 Email');return;}
  const body=JSON.stringify(input);if(pending.current?.body!==body)pending.current={body,key:crypto.randomUUID()};
  flight.current=true;setBusy(true);setError('');
  try{const result=await registerNetworkMember(input,pending.current.key);if(result.personId!==person.memberNo)throw new Error('註冊身分回應不符，已停止更新');pending.current=null;setDone(true);refresh();}
  catch(reason){setError(reason instanceof Error?reason.message:'註冊失敗，請保留資料後重試');}
  finally{flight.current=false;setBusy(false);}
 }
 if(contracts.error)return <section className="card" role="alert"><h3>完成網路會員註冊</h3><p>{contracts.error}</p><button onClick={contracts.retry}>重新載入合約</button></section>;
 if(!contracts.data)return <section className="card" role="status">載入會員合約中…</section>;
 if(!contract)return <section className="card" role="alert"><h3>目前無法註冊</h3><p>尚無有效的正式會員合約版本，系統已停止送出。</p></section>;
 if(done)return <section className="card" role="status"><h3>網路會員註冊完成</h3><p>會員資料正在重新載入。此流程不會自動建立經營資格或球位。</p></section>;
 return <form className="card" onSubmit={submit}><h3>完成網路會員註冊</h3><p>目前以 LINE 身分登入。手機與 Email 是聯絡資料，不作為登入或 KYC 證明；本流程不會建立經營資格或球位。</p>
  <label>姓名<input value={legalName} maxLength={80} autoComplete="name" onChange={e=>setLegalName(e.target.value)} disabled={busy}/></label>
  <label>別名<input value={alias} maxLength={80} onChange={e=>setAlias(e.target.value)} disabled={busy}/></label>
  <label>性別<select value={gender} onChange={e=>setGender(e.target.value)} disabled={busy}><option value="">請選擇</option><option value="FEMALE">女性</option><option value="MALE">男性</option><option value="OTHER">其他／自行描述</option><option value="UNDISCLOSED">不揭露</option></select></label>
  <label>出生年月日<input type="date" value={birthDate} onChange={e=>setBirthDate(e.target.value)} disabled={busy}/></label>
  <label>手機（含國碼）<input type="tel" value={mobile} placeholder="+886912345678" autoComplete="tel" onChange={e=>setMobile(e.target.value)} disabled={busy}/></label>
  <label>Email<input type="email" value={email} maxLength={254} autoComplete="email" onChange={e=>setEmail(e.target.value)} disabled={busy}/></label>
  <details><summary>{contract.title}（{contract.version}）</summary><p>{contract.content}</p><small>內容雜湊：{contract.contentHash}</small></details>
  <label><input type="checkbox" checked={accepted} onChange={e=>setAccepted(e.target.checked)} disabled={busy}/>我已閱讀並同意上述合約與隱私告知</label>
  {error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?'送出中…':'同意並完成註冊'}</button>
 </form>;
}
