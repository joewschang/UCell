import {uiText} from "../../../../shared/design-system/i18n";
import {CompanyLogo} from '@ucell/design-system';
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
      <CompanyLogo className="uc-company-logo-entry"/>
      <h1>{uiText("UCell Admin")}</h1>
      <p className="muted">安全登入管理後台</p>

      <div className="callout info">
        使用已獲授權的 Microsoft 帳號登入。驗證會在同一分頁完成，請勿中途切換瀏覽器或複製 Microsoft 驗證網址。</div>

      {(error||localError)&&<div className="callout danger">{error||localError}</div>}

      <div className="stack">
        <button className="primary" disabled={busy||!entraConfigured} onClick={()=>loginEntra().catch(e=>setLocalError(e.message))}>
          {busy?'登入中…':uiText("使用 Microsoft 帳號登入")}
        </button>
        {!entraConfigured&&<small className="muted">{uiText("尚未設定 VITE_ENTRA_CLIENT_ID / VITE_ENTRA_TENANT_ID。")}</small>}
      </div>

      {demo&&<>
        <hr/>
        <div className="callout warning">{uiText("Temporary UAT：下列登入不建立正式Backend Session，只能搭配非production的 ADMIN_AUTH_BYPASS。")}</div>
        <div className="stack">
          {localUat&&<button onClick={loginLocalUat}>{uiText("DEV：Local UAT Super Admin")}</button>}
          <button onClick={()=>loginDemo('SUPER_ADMIN')}>{uiText("DEV：Super Admin")}</button>
          <button onClick={()=>loginDemo('MEMBERSHIP_OPS')}>{uiText("DEV：Membership Ops")}</button>
          <button onClick={()=>loginDemo('FINANCE')}>{uiText("DEV：Finance")}</button>
          <button onClick={()=>loginDemo('COMPLIANCE_AUDIT')}>{uiText("DEV：Compliance Audit")}</button>
        </div>
      </>}
    </section>
  </main>
}
