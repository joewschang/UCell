import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {initLiff} from './liff';
import {QualificationProvider} from './QualificationContext';
import App from './App';
import './styles.css';

function Bootstrap(){
 const [ready,setReady]=useState(false);
 useEffect(()=>{initLiff().finally(()=>setReady(true));},[]);
 if(!ready)return <main className="loading">UCell 會員中心載入中…</main>;
 return <QualificationProvider><App/></QualificationProvider>;
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><Bootstrap/></BrowserRouter></React.StrictMode>);
