import {NavLink,Outlet,useLocation} from 'react-router-dom';
import {nav} from './nav';
import {useAuth} from '../features/auth/auth';
import {canOpen} from '../features/auth/permissions';
import Brand from '../components/Brand';

export function AppShell(){
  const {user,logout}=useAuth();
  const {pathname}=useLocation();
  return <div className={`app${pathname==='/'?' command-shell':''}`}>
    <aside className="sidebar">
      <div className="brand"><div><Brand/><span>宇生國際 · 管理中心</span></div></div>
      <nav>{nav.filter(([,to])=>canOpen(user?.role,to)).map(([label,to])=><NavLink end={to==='/'} key={to} to={to}>{label}</NavLink>)}</nav>
      <div className="sidebar-foot"><span>{user?.name}</span><small>{user?.role}</small><button onClick={logout}>登出</button></div>
    </aside>
    <main className="content"><Outlet/></main>
  </div>
}
