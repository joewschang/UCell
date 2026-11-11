import {uiText} from "../../../shared/design-system/i18n";
import {CompanyLogo,AdminAppShell,AdminSidebar,AdminHeader,ThemePreferenceControl} from '@ucell/design-system';
import {Link,Outlet,useLocation} from 'react-router-dom';
import {activeNavPath} from './nav';
import {OperationsDirectory} from './OperationsDirectory';
import {useAuth} from '../features/auth/auth';
import {canOpen} from '../features/auth/permissions';
import {adminRoleLabel} from '../features/auth/role-label';
import {useState} from 'react';
import {PersonaAvatar} from '../../../shared/ai-assistant/Persona';
import {useQueryClient} from '@tanstack/react-query';

export function AppShell(){
  const queryClient=useQueryClient();const {pathname}=useLocation();
  const {user,logout}=useAuth();
  const selectedPath=activeNavPath(pathname);
  const [devActor,setDevActor]=useState(()=>sessionStorage.getItem('ucell_dev_actor_id')??'');
  return <AdminAppShell>
    <a className="uc-skip-link" href="#admin-main">跳至主要內容</a>
    <AdminSidebar>
      <div className="brand"><CompanyLogo/><div><span>管理後台</span></div></div>
      <OperationsDirectory role={user?.role} current={selectedPath} pathname={pathname}/>
      <div className="sidebar-foot"><span>{user?.name}</span><small>{adminRoleLabel(user?.role)}</small><button onClick={logout}>登出</button></div>
      {import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_FULL_ACCESS==='true' && <label>{uiText("DEV Actor Person ID（空白使用 ROOT fixture）")}<input value={devActor} onChange={e=>{setDevActor(e.target.value);sessionStorage.setItem('ucell_dev_actor_id',e.target.value.trim());queryClient.clear()}}/></label>}
    </AdminSidebar>
    <main className="content" id="admin-main" tabIndex={-1}>
      <AdminHeader><strong>{uiText("UCell 營運後台")}</strong><span>{adminRoleLabel(user?.role)} · {import.meta.env.DEV?'本機開發環境':'營運管理'}</span>{canOpen(user?.role,'/ai-assistant')&&<Link to="/ai-assistant" className="uc-ai-header-link" aria-label="開啟 AI 智慧秘書"><PersonaAvatar/><span>AI 智慧秘書</span></Link>}<ThemePreferenceControl/></AdminHeader>
      {import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_FULL_ACCESS==='true' &&
        <div className="callout warning" role="status">{uiText("本機 Super Admin 完整操作測試：資料寫入獨立 ucell_admin_test；legacy settlement adjustment 未完成。Production / RC Gate 仍 BLOCKED。")}</div>}
      {import.meta.env.DEV && import.meta.env.VITE_ADMIN_DEV_READ_ONLY==='true' &&
        <div className="callout warning" role="status">{uiText("本機 Admin DEV 只讀模式：查詢真實 DEV 資料；新增、核准、付款與其他寫入均停用。Production / RC Gate 仍 BLOCKED。")}</div>}
      <Outlet/>
    </main>
  </AdminAppShell>
}
