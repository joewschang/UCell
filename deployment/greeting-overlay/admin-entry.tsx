import React from 'react';
import {createRoot} from 'react-dom/client';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {AuthProvider,useAuth} from '../../admin/src/features/auth/auth';
import {GreetingPublishing} from '../../admin/src/features/content/GreetingPublishing';
function Screen(){const {user,ready}=useAuth();return <main><a href="/">返回 UCell 後台</a><h1>每日問候圖上稿</h1>{!ready?<p>驗證登入中…</p>:user?<GreetingPublishing/>:<p>請先回到後台登入，再開啟本頁。</p>}</main>}
createRoot(document.getElementById('greeting-admin')!).render(<QueryClientProvider client={new QueryClient()}><AuthProvider><Screen/></AuthProvider></QueryClientProvider>);
