import { useSyncExternalStore, type ReactNode } from 'react';
import { sessionGuard, type SessionGuard } from './session';
export function SessionBoundary({ children, guard = sessionGuard }: { children: ReactNode; guard?: SessionGuard }) {
  const expired = useSyncExternalStore(guard.subscribe, guard.getSnapshot, guard.getSnapshot);
  if (expired) return <main className="loading" role="alert"><h1>會員工作階段已失效</h1><p>已停止載入並清除本頁會員資料，請重新連線驗證登入。</p><button onClick={() => window.location.reload()}>重新連線</button></main>;
  return <>{children}</>;
}
