import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Qualification } from './api';
import { useNotifications, type NoticeCategory } from './NotificationContext';
import { getNotifications } from './memberData';
import { useResource } from './useResource';
const categories: Record<NoticeCategory, string> = { SERVICE: '服務公告', ORDER: '訂單提醒', ACCOUNT: '資格提醒' };
export default function Notifications({ q }: { q: Qualification }) {
  const { enabled, notices, readIds, unread, markRead } = useNotifications(q.id);
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [category, setCategory] = useState<NoticeCategory | 'ALL'>('ALL');
  const [expanded, setExpanded] = useState<string | null>(null);
  if (!enabled) return <ConnectedNotifications q={q}/>;
  const filtered = notices.filter(n => (category === 'ALL' || n.category === category) && (!onlyUnread || !readIds.has(n.id)));
  return <><h2>通知中心</h2><p>目前顯示全會員示範公告及 {q.code} 的示範通知。</p><p className="muted">已讀狀態只限目前頁面，不同步 LINE 或其他裝置；重新整理後重設。</p>
    <section className="card notice-controls"><p role="status">{unread} 則未讀示範通知</p>
      <label>通知分類<select value={category} onChange={e => { setCategory(e.target.value as NoticeCategory | 'ALL'); setExpanded(null); }}><option value="ALL">全部分類</option>{Object.entries(categories).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
      <button aria-pressed={onlyUnread} onClick={() => { setOnlyUnread(!onlyUnread); setExpanded(null); }}>{onlyUnread ? '顯示全部' : '只看未讀'}</button>
      <button disabled={!unread} onClick={() => markRead(q.id, notices.map(n => n.id))}>目前範圍全部標為已讀（示範）</button>
    </section>
    {filtered.length ? filtered.map(n => <article className="card" key={n.id}><p>{categories[n.category]} · {n.qualificationId === null ? '全會員公告' : q.code} · {readIds.has(n.id) ? '已讀' : '未讀'}</p><h3>{n.title}</h3><small>{n.timeLabel}</small>
      <div className="notice-actions"><button aria-expanded={expanded === n.id} aria-controls={`notice-${n.id}`} onClick={() => setExpanded(expanded === n.id ? null : n.id)}>{expanded === n.id ? '收合通知' : '查看通知'}</button>{!readIds.has(n.id) && <button onClick={() => markRead(q.id, [n.id])}>標為已讀（示範）</button>}</div>
      {expanded === n.id && <div id={`notice-${n.id}`}><p>{n.body}</p>{n.category === 'ORDER' && <Link className="text-link" to="/orders">查看我的訂單 →</Link>}</div>}
    </article>) : <p role="status">目前篩選條件下沒有通知</p>}
  </>;
}
function ConnectedNotifications({q}:{q:Qualification}){
 const state=useResource(`notifications:${q.id}`,s=>getNotifications(q,s));
 return <><h2>通知中心</h2><p>目前資格：{q.code} · {q.ballLabel}</p><p className="muted">站內通知；LINE 推播與已讀同步尚未啟用。</p>{state.error?<section role="alert" className="card"><p>{state.error}</p><button onClick={state.retry}>重新載入</button></section>:!state.data?<p role="status">通知載入中…</p>:state.data.length?state.data.map(n=><article className="card" key={n.id}><p>{categories[n.category]} · {n.qualificationId===null?'會員通知':q.code}</p><h3>{n.title}</h3><small>{n.timeLabel}</small><p>{n.body}</p></article>):<p role="status">目前沒有通知</p>}</>;
}
