import React from 'react';
import ReactDOM from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {App} from './app/App';
import {AuthProvider} from './features/auth/auth';
import './styles/main.css';
import 'bootstrap/dist/css/bootstrap-grid.min.css';
import '@ucell/design-system/styles';
import './styles/ucell-theme.css';

const client=new QueryClient({defaultOptions:{queries:{retry:1,staleTime:10_000}}});
ReactDOM.createRoot(document.getElementById('root')!).render(
 <React.StrictMode><QueryClientProvider client={client}><BrowserRouter><AuthProvider><App/></AuthProvider></BrowserRouter></QueryClientProvider></React.StrictMode>
);
