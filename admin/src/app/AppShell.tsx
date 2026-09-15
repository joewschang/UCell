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
    <main className="content"><Outlet/></main>
  </div>
}
