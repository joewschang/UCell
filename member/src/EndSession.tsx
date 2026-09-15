import { useState } from 'react';
import { sessionGuard, type SessionGuard } from './session';

/** Local-page control only. Never claim LINE logout or server revocation. */
export default function EndSession({ guard = sessionGuard }: { guard?: SessionGuard }) {
  const [confirming, setConfirming] = useState(false);
  return <section className="card" aria-label="工作階段管理">
    <h3>工作階段管理</h3>
    <p>結束後會清除本頁會員資料、未送出的示範購物車與通知已讀狀態，不影響已成立的正式訂單。</p>
    <p>僅作用於本頁，不會登出 LINE、撤銷伺服器 token 或關閉其他分頁。</p>
    {confirming ? <div role="group" aria-label="確認結束工作階段">
      <p role="status">確定要結束本頁工作階段？未保留的示範資料將清除。</p>
      <button onClick={() => setConfirming(false)}>取消，繼續使用</button>{' '}
      <button onClick={() => guard.expire('ended')}>確認結束本頁工作階段</button>
    </div> : <button onClick={() => setConfirming(true)}>結束本頁工作階段</button>}
  </section>;
}
