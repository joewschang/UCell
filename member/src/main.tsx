import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { bootstrapLiff } from './liff';
import { QualificationProvider } from './QualificationContext';
import App from './App';
import { SessionBoundary } from './SessionBoundary';
import { AppErrorBoundary } from './AppErrorBoundary';
import './styles.css';
import 'bootstrap/dist/css/bootstrap-grid.min.css';
import '@ucell/design-system/styles';
import './ucell-theme.css';
function Bootstrap() {
    const [state, setState] = useState<'loading' | 'ready' | 'redirect'>('loading');
    const [error, setError] = useState('');
    const [attempt, setAttempt] = useState(0);
    useEffect(() => { let alive = true; setError(''); setState('loading'); bootstrapLiff().then(result => { if (alive)
        setState(result.mode === 'redirect' ? 'redirect' : 'ready'); }).catch(e => { if (alive)
        setError(e instanceof Error ? e.message : '登入失敗'); }); return () => { alive = false; }; }, [attempt]);
    if (error)
        return <main className="loading" role="alert"><h1>UCell 會員中心</h1><p>{error}</p><button onClick={() => setAttempt(n => n + 1)}>重新連線</button></main>;
    if (state !== 'ready')
        return <main className="loading" role="status">{state === 'redirect' ? '正在前往 LINE 登入…' : 'UCell 會員中心載入中…'}</main>;
    return <SessionBoundary><QualificationProvider><App /></QualificationProvider></SessionBoundary>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><AppErrorBoundary><BrowserRouter><Bootstrap /></BrowserRouter></AppErrorBoundary></React.StrictMode>);
