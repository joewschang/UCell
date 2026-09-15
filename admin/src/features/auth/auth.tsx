import React,{createContext,useContext,useEffect,useMemo,useState} from 'react';
import {clearAdminToken,get,post,setAdminToken} from '../../lib/api';
import {acquireEntraIdToken,entraLogout} from './entra';
import type {AdminRole} from './permissions';

interface User{
  name:string;role:AdminRole;personId?:string;provider?:string;expiresAt?:string;
}
interface AuthState{
  user:User|null;ready:boolean;busy:boolean;error:string|null;
  loginEntra:()=>Promise<void>;loginDemo:(role:AdminRole)=>void;logout:()=>Promise<void>;
}
const C=createContext<AuthState|null>(null);

function savedUser():User|null{
  const raw=sessionStorage.getItem('ucell_admin_user');
  try{return raw?JSON.parse(raw):null}catch{return null}
}
function persistUser(u:User|null){
  if(u)sessionStorage.setItem('ucell_admin_user',JSON.stringify(u));
  else sessionStorage.removeItem('ucell_admin_user');
}

export function AuthProvider({children}:{children:React.ReactNode}){
  const [user,setUser]=useState<User|null>(savedUser);
  const [ready,setReady]=useState(false);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState<string|null>(null);

  function clear(){
    clearAdminToken();persistUser(null);setUser(null);
  }

  useEffect(()=>{
    const onUnauthorized=()=>clear();
    window.addEventListener('ucell:admin-unauthorized',onUnauthorized);
    return()=>window.removeEventListener('ucell:admin-unauthorized',onUnauthorized);
  },[]);

  useEffect(()=>{
    (async()=>{
      const token=sessionStorage.getItem('ucell_admin_token');
      if(!token){
        const cached=savedUser();
        if(!import.meta.env.DEV || import.meta.env.VITE_ENABLE_DEMO_LOGIN!=='true' || cached?.provider!=='DEV_BYPASS') clear();
        setReady(true);return;
      }
      try{
        const r:any=await get('/auth/admin/me');
        const d=r.data;
        const u:User={
          name:d.person?.preferredName||d.person?.legalName||d.subject,
          role:d.role,personId:d.person?.personId,provider:d.provider,expiresAt:d.expiresAt
        };
        setUser(u);persistUser(u);
      }catch{clear()}
      finally{setReady(true)}
    })();
  },[]);

  const value=useMemo<AuthState>(()=>({
    user,ready,busy,error,
    loginEntra:async()=>{
      setBusy(true);setError(null);
      try{
        const idToken=await acquireEntraIdToken();
        const r:any=await post('/auth/admin/entra/exchange',{idToken},{skipUnauthorizedEvent:true});
        const d=r.data;
        setAdminToken(d.accessToken,d.expiresAt);
        const u:User={
          name:d.user?.preferredName||d.user?.legalName||'Admin',
          role:d.user.role,personId:d.user.personId,
          provider:d.user.provider,expiresAt:d.expiresAt
        };
        setUser(u);persistUser(u);
      }catch(e:any){
        clear();setError(e?.message??'Microsoft登入失敗');
        throw e;
      }finally{setBusy(false)}
    },
    loginDemo:(role:AdminRole)=>{
      if(import.meta.env.VITE_ENABLE_DEMO_LOGIN!=='true')throw new Error('Demo login disabled');
      if(import.meta.env.PROD)throw new Error('Demo login is forbidden in production');
      const u={name:'DEV Admin',role,provider:'DEV_BYPASS'};
      setUser(u);persistUser(u);
    },
    logout:async()=>{
      setBusy(true);
      try{
        if(sessionStorage.getItem('ucell_admin_token')){
          await post('/auth/admin/logout',{}, {skipUnauthorizedEvent:true}).catch(()=>undefined);
        }
        await entraLogout().catch(()=>undefined);
      }finally{clear();setBusy(false)}
    }
  }),[user,ready,busy,error]);

  return <C.Provider value={value}>{children}</C.Provider>
}
export function useAuth(){
  const v=useContext(C);if(!v)throw new Error('AuthProvider missing');return v;
}
