import {AdminAppShell,AdminSidebar,AdminHeader} from '@ucell/design-system';
import {NavLink,Outlet,useLocation} from 'react-router-dom';
import {nav,navGroups} from './nav';
import {useAuth} from '../features/auth/auth';
import {canOpen} from '../features/auth/permissions';
import {useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

export function AppShell(){
  const queryClient=useQueryClient();const {pathname}=useLocation();
  const {user,logout}=useAuth();
  const [devActor,setDevActor]=useState(()=>sessionStorage.getItem('ucell_dev_actor_id')??'');
  return <AdminAppShell>
    <AdminSidebar>
      <div className="brand"><div className="brand-mark small">U</div><div><strong>UCell</strong><span>Operations Console</span></div></div>
      <nav aria-label="後台主要功能">{navGroups.map(group=>{const links=nav.filter(([,to])=>group.paths.includes(to)&&canOpen(user?.role,to));return links.length?<details className="uc-nav-group" key={group.label} open={group.paths.some(path=>pathname===path||path!=='/'&&pathname.startsWith(path+'/'))}><summary>{group.label}</summary>{links.map(([label,to])=><NavLink end={to==='/'} key={to} to={to}>{label}</NavLink>)}</details>:null})}</nav>
      <div className="sidebar-foot"><span>{user?.name}</span><small>{user?.role}</small><button onClick={logout}>登出</button></div>
      {import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_FULL_ACCESS==='true' && <label>DEV Actor Person ID（空白使用 ROOT fixture）<input value={devActor} onChange={e=>{setDevActor(e.target.value);sessionStorage.setItem('ucell_dev_actor_id',e.target.value.trim());queryClient.clear()}}/></label>}
    </AdminSidebar>
    <main className="content">
      <AdminHeader><strong>UCell Operations Console</strong><span>{user?.role} · {import.meta.env.DEV?'Connected DEV':'Operations'}</span></AdminHeader>
      {import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_FULL_ACCESS==='true' &&
        <div className="callout warning" role="status">本機 Super Admin 完整操作測試：資料寫入獨立 ucell_admin_test；legacy settlement adjustment 未完成。Production / RC Gate 仍 BLOCKED。</div>}
      {import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_READ_ONLY==='true' &&
        <div className="callout warning" role="status">本機 Admin DEV 只讀模式：查詢真實 DEV 資料；新增、核准、付款與其他寫入均停用。Production / RC Gate 仍 BLOCKED。</div>}
      <Outlet/>
    </main>
  </AdminAppShell>
}
