import {Navigate,useLocation} from 'react-router-dom';
import {useAuth} from './auth';
import {canOpen} from './permissions';

export function RequirePageRole({children}:{children:React.ReactNode}){
  const {user}=useAuth(); const loc=useLocation();
  if(!user) return <Navigate to="/login" replace/>;
  if(!canOpen(user.role,loc.pathname)) return <Navigate to="/" replace/>;
  return <>{children}</>;
}
