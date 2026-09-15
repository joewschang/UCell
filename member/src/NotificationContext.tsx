import { createContext, useContext, useState, type ReactNode } from 'react';

export type NoticeCategory = 'SERVICE' | 'ORDER' | 'ACCOUNT';
export type Notice = { id: string; qualificationId: string | null; category: NoticeCategory; title: string; body: string; timeLabel: string; readAt?:string|null };
// Deliberately fictitious messages. Null scope is a Person-wide demo announcement.
export const demoNotices: readonly Notice[] = [
  { id: 'demo-welcome', qualificationId: null, category: 'SERVICE', title: '歡迎體驗會員中心（示範）', body: '這是介面操作示範，不是公司正式公告。購物車與通知已讀狀態只保存在目前頁面，重新整理後即重設。', timeLabel: '示範通知' },
  { id: 'demo-order-q1', qualificationId: 'q1', category: 'ORDER', title: '訂單狀態查看提醒（示範）', body: '您可以前往「我的訂單」展開付款與配送狀態。這則示範訊息不代表付款成功，也不會觸發出貨。', timeLabel: '示範通知' },
  { id: 'demo-account-q2', qualificationId: 'q2', category: 'ACCOUNT', title: '資格切換提醒（示範）', body: '您正在查看球 2。請先確認頁首資格編號，再查閱此資格的組織、業績與訂單。', timeLabel: '示範通知' },
];
export const visibleNotices = (q: string | undefined) => q ? demoNotices.filter(n => n.qualificationId === null || n.qualificationId === q) : [];
type State = { enabled: boolean; readIds: ReadonlySet<string>; markRead: (q: string, ids: string[]) => void };
const Context = createContext<State | null>(null);
export function NotificationProvider({ enabled, children }: { enabled: boolean; children: ReactNode }) {
  const [readIds, setReadIds] = useState<ReadonlySet<string>>(() => new Set());
  const markRead = (q: string, ids: string[]) => {
    if (!enabled) throw Error('正式通知服務尚未串接');
    const allowed = new Set(visibleNotices(q).map(n => n.id));
    if (ids.some(id => !allowed.has(id))) throw Error('通知不屬於目前範圍');
    setReadIds(previous => new Set([...previous, ...ids]));
  };
  return <Context.Provider value={{ enabled, readIds, markRead }}>{children}</Context.Provider>;
}
export function useNotifications(q?: string) {
  const state = useContext(Context);
  if (!state) throw Error('NotificationProvider missing');
  const notices = state.enabled ? visibleNotices(q) : [];
  return { ...state, notices, unread: notices.filter(n => !state.readIds.has(n.id)).length };
}
