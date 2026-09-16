import { useSyncExternalStore, type ReactNode } from 'react';
import { sessionGuard, type SessionGuard } from './session';
export function SessionBoundary({ children, guard = sessionGuard }: { children: ReactNode; guard?: SessionGuard }) {
  const expired = useSyncExternalStore(guard.subscribe, guard.getSnapshot, guard.getSnapshot);
  if (expired) return <main className="loading" role="alert"><h1>{guard.getReason()==='revoked'?'已登出會員服務':guard.getReason() === 'ended' ? '已結束本頁工作階段' : '會員工作階段已失效'}</h1><p>已停止載入並清除本頁會員資料。</p><p>{guard.getReason()==='revoked'?'目前 UCell session 已由伺服器撤銷；不會登出 LINE 或其他工作階段。':'此操作不會登出 LINE 或撤銷伺服器登入。'}重新連線會重新執行登入流程；示範模式則重新開始。</p><button onClick={() => window.location.reload()}>重新連線</button></main>;
  return <>{children}</>;
}
