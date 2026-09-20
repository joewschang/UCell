import {useState} from 'react';
import {Navigate} from 'react-router-dom';
import {useAuth} from './auth';
import {entraConfigured} from './entra';

export function LoginPage(){
  const {user,ready,busy,error,loginEntra,loginDemo}=useAuth();
  const [localError,setLocalError]=useState<string|null>(null);
  if(!ready)return <main className="login-shell"><section className="login-card"><p>驗證登入狀態…</p></section></main>;
  if(user)return <Navigate to="/" replace/>;

  const demo=import.meta.env.VITE_ENABLE_DEMO_LOGIN==='true'&&(!import.meta.env.PROD||import.meta.env.VITE_STAGE_UAT_DEMO_LOGIN==='true');
  const localUatActor=import.meta.env.VITE_LOCAL_UAT_ADMIN_SUPER_ID;
  const localUat=import.meta.env.DEV&&['127.0.0.1','localhost'].includes(window.location.hostname)&&!!localUatActor;
  const loginLocalUat=()=>{
    if(!localUatActor) return;
    sessionStorage.setItem('ucell_dev_actor_id',localUatActor);
    loginDemo('SUPER_ADMIN');
  };

  return <main className="login-shell">
    <section className="login-card">
      <div className="brand-mark">U</div>
      <h1>UCell Admin</h1>
      <p className="muted">R1.0B FROZEN · Admin MVP v0.6.0</p>

      <div className="callout info">
        正式管理員採 Microsoft Entra 身分驗證。Microsoft Token驗證後，Backend只對有ACTIVE AdminAccessGrant的人員簽發短效UCell Session。
      </div>

      {(error||localError)&&<div className="callout danger">{error||localError}</div>}

      <div className="stack">
        <button className="primary" disabled={busy||!entraConfigured} onClick={()=>loginEntra().catch(e=>setLocalError(e.message))}>
          {busy?'登入中…':'使用 Microsoft 帳號登入'}
        </button>
        {!entraConfigured&&<small className="muted">尚未設定 VITE_ENTRA_CLIENT_ID / VITE_ENTRA_TENANT_ID。</small>}
      </div>

      {demo&&<>
        <hr/>
        <div className="callout warning">Temporary UAT：下列登入不建立正式Backend Session，只能搭配非production的 ADMIN_AUTH_BYPASS。</div>
        <div className="stack">
          {localUat&&<button onClick={loginLocalUat}>DEV：Local UAT Super Admin</button>}
          <button onClick={()=>loginDemo('SUPER_ADMIN')}>DEV：Super Admin</button>
          <button onClick={()=>loginDemo('MEMBERSHIP_OPS')}>DEV：Membership Ops</button>
          <button onClick={()=>loginDemo('FINANCE')}>DEV：Finance</button>
          <button onClick={()=>loginDemo('COMPLIANCE_AUDIT')}>DEV：Compliance Audit</button>
        </div>
      </>}
    </section>
  </main>
}
