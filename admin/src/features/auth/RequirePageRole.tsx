import {Link,Navigate,useLocation} from 'react-router-dom';
import {useAuth} from './auth';
import {canOpen} from './permissions';
import {Card,PageHeader} from '../../components/ui';

export function ForbiddenPage({role,path}:{role:string;path:string}){
  return <div role="alert" aria-live="polite">
    <PageHeader title="無權存取此後台頁面" subtitle="此功能受管理員角色權限保護；系統未執行頁面查詢或任何寫入操作。"/>
    <Card title="403 · 權限不足">
      <p>目前角色 <strong>{role}</strong> 沒有開啟 <code>{path}</code> 的權限。</p>
      <p className="muted">如工作職責需要此功能，請由權限管理者檢查正式 RBAC 指派；請勿共用其他管理員帳號。</p>
      <Link className="button-link" to="/">返回營運總覽</Link>
    </Card>
  </div>;
}

export function RequirePageRole({children}:{children:React.ReactNode}){
  const {user}=useAuth(); const loc=useLocation();
  if(!user) return <Navigate to="/login" replace/>;
  if(!canOpen(user.role,loc.pathname)) return <ForbiddenPage role={user.role} path={loc.pathname}/>;
  return <>{children}</>;
}
