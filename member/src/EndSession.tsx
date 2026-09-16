import { useRef,useState } from 'react';
import {revokeMemberSession} from './memberData';
import { sessionGuard, type SessionGuard } from './session';

/** Local end and optionally verified UCell revocation; neither logs out LINE. */
export default function EndSession({ guard = sessionGuard,connected=false }: { guard?: SessionGuard;connected?:boolean }) {
  const [confirming, setConfirming] = useState(false);
  const [busy,setBusy]=useState(false),[error,setError]=useState('');const pending=useRef(false),key=useRef('');
  async function logout(){if(pending.current)return;pending.current=true;setBusy(true);setError('');key.current||=crypto.randomUUID();try{await revokeMemberSession(key.current);guard.expire('revoked');}catch{setError('無法確認伺服器登出，可重試或結束本頁工作階段。');}finally{pending.current=false;setBusy(false);}}
  return <section className="card" aria-label="工作階段管理">
    <h3>工作階段管理</h3>
    {connected&&<><p>登出會員服務會撤銷目前 UCell session，不會登出 LINE 或其他工作階段。</p><button disabled={busy} onClick={logout}>{busy?'登出中…':'登出會員服務'}</button>{error&&<p role="alert">{error}</p>}</>}
    <p>結束後會清除本頁會員資料、未送出的示範購物車與通知已讀狀態，不影響已成立的正式訂單。</p>
    <p>僅作用於本頁，不會登出 LINE、撤銷伺服器 token 或關閉其他分頁。</p>
    {confirming ? <div role="group" aria-label="確認結束工作階段">
      <p role="status">確定要結束本頁工作階段？未保留的示範資料將清除。</p>
      <button onClick={() => setConfirming(false)}>取消，繼續使用</button>{' '}
      <button onClick={() => guard.expire('ended')}>確認結束本頁工作階段</button>
    </div> : <button onClick={() => setConfirming(true)}>結束本頁工作階段</button>}
  </section>;
}
