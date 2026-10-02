import {CompanyLogo} from '@ucell/design-system';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { bootstrapLiff, startWebLineLogin, restartLineLogin, LineReauthenticationRequired } from './liff';
import { QualificationProvider } from './QualificationContext';
import App from './App';
import { SessionBoundary } from './SessionBoundary';
import { AppErrorBoundary } from './AppErrorBoundary';
import WebMemberEntry from './WebMemberEntry';
import './styles.css';
import 'bootstrap/dist/css/bootstrap-grid.min.css';
import '@ucell/design-system/styles';
import './ucell-theme.css';

function Bootstrap() {
    const [state, setState] = useState<'loading' | 'ready' | 'redirect' | 'web-login'>('loading');
    const [error, setError] = useState('');
    const [reauthRequired,setReauthRequired]=useState(false);
    const [referralWarning,setReferralWarning]=useState<string|undefined>();
    const [attempt, setAttempt] = useState(0);
    const [startingWebLogin,setStartingWebLogin]=useState(false);

    useEffect(() => {
        let alive = true;
        setError('');
        setReauthRequired(false);
        setReferralWarning(undefined);
        setState('loading');
        bootstrapLiff().then(result => {
            if (!alive) return;
            setReferralWarning('referralWarning' in result?result.referralWarning:undefined);
            setState(result.mode === 'redirect' ? 'redirect' : result.mode === 'web-login' ? 'web-login' : 'ready');
        }).catch(e => {
            if (alive){setReauthRequired(e instanceof LineReauthenticationRequired);setError(e instanceof Error ? e.message : '登入失敗');}
        });
        return () => { alive = false; };
    }, [attempt]);

    const webLogin=async(forceRefresh=false)=>{
        setStartingWebLogin(true);setError('');
        try{
            const result=await (forceRefresh?restartLineLogin():startWebLineLogin());
            setState(result.mode==='redirect'?'redirect':'loading');
            if(result.mode==='connected')setAttempt(n=>n+1);
        }catch(e){
            setError(e instanceof Error?e.message:'登入失敗');
        }finally{
            setStartingWebLogin(false);
        }
    };

    if (error)
        return <main className="loading" role="alert"><section className="card uc-web-entry"><CompanyLogo className="uc-company-logo-entry"/><h1>UCell 會員中心</h1><p>{error}</p><button disabled={startingWebLogin} onClick={() => reauthRequired?void webLogin(true):setAttempt(n => n + 1)}>{reauthRequired?'重新登入 LINE':'重新連線'}</button></section></main>;

    if (state === 'web-login')
        return <WebMemberEntry onLineLogin={async()=>{await webLogin();}} onAuthenticated={()=>setAttempt(n=>n+1)}/>;

    if (state !== 'ready')
        return <main className="loading" role="status">{state === 'redirect' ? '正在前往 LINE 登入…' : 'UCell 會員中心載入中…'}</main>;

    return <SessionBoundary>{referralWarning&&<p role="alert" className="card">{referralWarning}</p>}<QualificationProvider><App /></QualificationProvider></SessionBoundary>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><BrowserRouter><Bootstrap /></BrowserRouter></AppErrorBoundary></React.StrictMode>);
