import React,{useEffect,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {initLiff} from './liff';
import './styles.css';

type Q={id:string;code:string;rank:string;active:boolean;ballLabel:string};
const qs:Q[]=[{id:'q1',code:'Q-000123',rank:'領袖',active:true,ballLabel:'球 1'},{id:'q2',code:'Q-000124',rank:'菁英',active:true,ballLabel:'球 2'}];
const money=(v:number|null)=>v===null?'結算中':`NT$ ${v.toLocaleString()}`;
function App(){
 const [q,setQ]=useState(qs[0]); const [ready,setReady]=useState(false);
 useEffect(()=>{initLiff().finally(()=>setReady(true));},[]);
 if(!ready) return <main className="loading">UCell 會員中心載入中…</main>;
 return <div className="app">
  <header><div><b>UCell</b><small>會員中心</small></div><span className="badge">{q.active?'Active':'Inactive'}</span></header>
  <main>
   <section className="hero"><p>目前資格</p><select value={q.id} onChange={e=>setQ(qs.find(x=>x.id===e.target.value)!) }>{qs.map(x=><option key={x.id} value={x.id}>{x.code}｜{x.rank}｜{x.ballLabel}</option>)}</select><h2>您好，UCell 會員</h2><small>所有組織、業績與獎金依目前選定資格獨立顯示</small></section>
   <section className="grid"><article><span>本月重購</span><strong>已啟用</strong></article><article><span>PV</span><strong>2,880</strong></article><article><span>RPV</span><strong>1,200</strong></article><article><span>EPV</span><strong>1,680</strong></article></section>
   <section className="card"><div><span>本期獎金</span><em>結算中</em></div><h2>{money(null)}</h2><small>正式結算完成前不以 NT$0 顯示</small></section>
   <h3>快速服務</h3><section className="actions"><button>我的組織</button><button>我的業績</button><button>獎金明細</button><button>商品商城</button><button>我的訂單</button><button>通知中心</button></section>
  </main>
  <nav><button>首頁</button><button>組織</button><button>商城</button><button>獎金</button><button>我的</button></nav>
 </div>
}
createRoot(document.getElementById('root')!).render(<React.StrictMode><BrowserRouter><App/></BrowserRouter></React.StrictMode>);
