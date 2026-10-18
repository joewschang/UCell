import {useEffect,useRef,useState} from 'react';
import {api} from '../../lib/api';
import {useAuth} from '../auth/auth';
type Campaign={id:string;message:string;status:string;recipientCount:number;recipients:{memberNo:string;mobile:string}[];contentHash:string;providerRef?:string;createdAt:string};
const labels:Record<string,string>={DRAFT:'待確認',SENDING:'提交中（請勿重複發送）',SUBMITTED:'供應商已受理，尚非送達確認',UNKNOWN:'結果未確認，請至 EVERY8D 查詢，勿直接重送',CANCELLED:'已取消'};
export function SmsPage(){
 const {user}=useAuth();
 if(user?.provider==='DEV_BYPASS')return <section><h1>簡訊通知</h1><p role="status">目前使用 Super Admin 測試模式。簡訊通知需使用 Microsoft 正式管理員帳號登入後操作；您可繼續測試其他後台功能。</p></section>;
 return <AuthenticatedSmsPage/>;
}
function AuthenticatedSmsPage(){
 const [message,setMessage]=useState(''),[members,setMembers]=useState(''),[all,setAll]=useState(false),[draft,setDraft]=useState<Campaign>(),[items,setItems]=useState<Campaign[]>([]),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const key=useRef(crypto.randomUUID());
 async function load(){const result=await api<{data:Campaign[]}>('/admin/sms/campaigns');setItems(result.data);}
 useEffect(()=>{void load().catch(e=>setError(e.message));},[]);
 function changed(){setDraft(undefined);key.current=crypto.randomUUID();}
 async function preview(){setBusy(true);setError('');try{const result=await api<{data:Campaign}>('/admin/sms/campaigns',{method:'POST',idempotencyKey:key.current,body:JSON.stringify({message,...(all?{allVerified:true}:{memberNos:members.split(/[\s,，]+/).filter(Boolean)})})});setDraft(result.data);await load();}catch(e){setError(e instanceof Error?e.message:'預覽失敗');}finally{setBusy(false)}}
 async function send(){if(!draft)return;setBusy(true);setError('');try{const result=await api<{data:Campaign}>(`/admin/sms/campaigns/${draft.id}/send`,{method:'POST',body:JSON.stringify({contentHash:draft.contentHash,recipientCount:draft.recipientCount})});setDraft(result.data);await load();}catch(e){setError((e instanceof Error?e.message:'發送未確認')+'；請先重新載入紀錄確認狀態。');}finally{setBusy(false)}}
 return <section><h1>簡訊通知</h1><p>發送會員服務通知。收件對象限手機已驗證的有效會員；同一門號只送一次，每批最多 500 人。僅正式登入的系統管理員或會員營運人員可操作。</p>{error&&<p role="alert">{error}</p>}<div className="card"><label>通知內容（自動加上【UCell】）<textarea rows={5} maxLength={293} value={message} disabled={busy} onChange={e=>{setMessage(e.target.value);changed()}}/></label><p>{message.length} 字；長簡訊可能按多則計費，實際扣點以 EVERY8D 為準。</p><label><input type="checkbox" checked={all} disabled={busy} onChange={e=>{setAll(e.target.checked);changed()}}/>全體手機已驗證會員</label>{!all&&<label>會員編號（個別填一位；群發以換行或逗號分隔）<textarea rows={4} disabled={busy} value={members} onChange={e=>{setMembers(e.target.value);changed()}}/></label>}<button disabled={busy||!message.trim()||!all&&!members.trim()} onClick={()=>void preview()}>建立發送預覽</button></div>{draft&&<div className="card"><h2>發送確認：{draft.recipientCount} 個門號</h2><p style={{whiteSpace:'pre-wrap'}}>{draft.message}</p><ul>{draft.recipients.map(r=><li key={r.memberNo}>{r.memberNo} · {r.mobile}</li>)}</ul><p>{labels[draft.status]||draft.status}</p><button disabled={busy||draft.status!=='DRAFT'} onClick={()=>void send()}>確認扣點並發送給上述 {draft.recipientCount} 個門號</button></div>}<h2>最近發送紀錄</h2><button disabled={busy} onClick={()=>void load().catch(e=>setError(e.message))}>重新載入紀錄</button><table><thead><tr><th>建立時間</th><th>人數</th><th>狀態</th><th>批次編號</th></tr></thead><tbody>{items.map(row=><tr key={row.id}><td>{new Date(row.createdAt).toLocaleString('zh-TW')}</td><td>{row.recipientCount}</td><td>{labels[row.status]||row.status}</td><td>{row.providerRef||'—'}</td></tr>)}</tbody></table></section>;
}
