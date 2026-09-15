import {NavLink,Outlet} from 'react-router-dom';
import {nav} from './nav';
import {useAuth} from '../features/auth/auth';
import {canOpen} from '../features/auth/permissions';

export function AppShell(){
  const {user,logout}=useAuth();
  return <div className="app">
    <aside className="sidebar">
      <div className="brand"><div className="brand-mark small">U</div><div><strong>UCell</strong><span>Admin MVP</span></div></div>
      <nav>{nav.filter(([,to])=>canOpen(user?.role,to)).map(([label,to])=><NavLink end={to==='/'} key={to} to={to}>{label}</NavLink>)}</nav>
      <div className="sidebar-foot"><span>{user?.name}</span><small>{user?.role}</small><button onClick={logout}>登出</button></div>
    </aside>
    <main className="content">
      {import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_FULL_ACCESS==='true' &&
        <div className="callout warning" role="status">本機 Super Admin 完整操作測試：資料寫入獨立 ucell_admin_test；legacy settlement adjustment 未完成。Production / RC Gate 仍 BLOCKED。</div>}
      {import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_READ_ONLY==='true' &&
        <div className="callout warning" role="status">本機 Admin DEV 只讀模式：查詢真實 DEV 資料；新增、核准、付款與其他寫入均停用。Production / RC Gate 仍 BLOCKED。</div>}
      <Outlet/>
    </main>
  </div>
}
