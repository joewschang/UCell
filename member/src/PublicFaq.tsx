import {useEffect,useState} from 'react';
type Data={categories:{id:string;label:string}[];items:{id:string;category:string;question:string;answer:string;keywords:string}[]};
export default function PublicFaq(){
 const [data,setData]=useState<Data>(),[error,setError]=useState(''),[query,setQuery]=useState(''),[category,setCategory]=useState(''),[attempt,setAttempt]=useState(0);
 useEffect(()=>{const controller=new AbortController();setError('');fetch((import.meta.env.VITE_API_BASE_URL||'/api/v1')+'/public/faq',{cache:'no-store',signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('暫時無法載入常見問答。');const body=await r.json();setData(body.data??body)}).catch(e=>{if(!controller.signal.aborted)setError(e.message)});return()=>controller.abort();},[attempt]);
 const items=data?.items.filter(i=>(!category||i.category===category)&&(!query||(i.question+i.answer+i.keywords).toLowerCase().includes(query.trim().toLowerCase())))||[];
 return <main className="card" style={{maxWidth:800,margin:'24px auto',padding:24}}><a href="/">← 返回會員中心</a><h1>常見問答</h1><p>不需登入，也不需正式會員資格即可瀏覽。</p><label>搜尋問題<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="輸入問題或關鍵字"/></label><label>問題分類<select value={category} onChange={e=>setCategory(e.target.value)}><option value="">全部分類</option>{data?.categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label>
 {error?<p role="alert">{error}<button onClick={()=>setAttempt(n=>n+1)}>重新載入</button></p>:!data?<p role="status">載入中…</p>:<><p role="status">找到 {items.length} 個問題</p>{items.map(i=><details key={i.id} style={{padding:'16px 0',borderBottom:'1px solid #cad8da'}}><summary style={{fontWeight:600,cursor:'pointer'}}>{i.question}</summary><p style={{whiteSpace:'pre-wrap'}}>{i.answer}</p></details>)}{!items.length&&<p>沒有符合的問題，請換個關鍵字或分類。</p>}</>}
 <p>仍需要協助？<a href="https://lin.ee/pqS11xX">聯絡 LINE 官方帳號</a></p></main>;
}
