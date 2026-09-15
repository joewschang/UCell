import { Component, type ReactNode } from 'react';
import { sessionGuard, type SessionGuard } from './session';

/** Render failures unmount all member state. Never display exception contents. */
export class AppErrorBoundary extends Component<{
  children: ReactNode;
  guard?: SessionGuard;
}, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { (this.props.guard ?? sessionGuard).expire(); }
  render() {
    if (this.state.failed) return <main className="loading" role="alert">
      <h1>會員畫面暫時無法顯示</h1>
      <p>已停止本頁操作並清除本頁會員狀態，請重新載入後再試。</p>
      <p>重新載入會清除未保留的示範資料，不會取消已成立的正式訂單。</p>
      <button onClick={() => window.location.reload()}>重新載入會員中心</button>
    </main>;
    return this.props.children;
  }
}
