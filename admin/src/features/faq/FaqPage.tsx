import {useEffect,useState} from 'react';
import {api} from '../../lib/api';
type Category={id:string;label:string;sortOrder:number;published:boolean;version:number};
type Item={id:string;category:string;question:string;answer:string;keywords:string;sortOrder:number;published:boolean;version:number};
type Data={categories:Category[];items:Item[]};
export function FaqPage(){
 const [data,setData]=useState<Data>(),[error,setError]=useState(''),[message,setMessage]=useState(''),[busy,setBusy]=useState(false),[query,setQuery]=useState(''),[filter,setFilter]=useState('');
 const [category,setCategory]=useState<Category>(),[item,setItem]=useState<Item>();
 useEffect(()=>{if(category||item)document.getElementById('faq-editor')?.scrollIntoView({behavior:'smooth',block:'start'});},[category?.id,item?.id]);
 const load=()=>api<{data:Data}>('/admin/faq',{cache:'no-store'}).then(response=>setData(response.data));
 useEffect(()=>{load().catch(e=>setError(e.message));},[]);
 async function save(kind:'categories'|'items',value:Category|Item){
  setBusy(true);setError('');setMessage('');
  try{const {id,...body}=value;await api('/admin/faq/'+kind+'/'+encodeURIComponent(id),{method:'PUT',body:JSON.stringify(body)});setCategory(undefined);setItem(undefined);setMessage('已儲存；發布中的內容已同步至前台。');await load();}
  catch(e){setError(e instanceof Error?e.message:'儲存失敗，請重試。');}finally{setBusy(false);}
 }
 return <main><h1>常見問答管理</h1><p>分類與問答皆發布後才會出現在前台。排序數字越小越前面。</p><a href="https://member.ucell.life/faq" target="_blank" rel="noreferrer">查看前台常見問答 ↗</a>
 {error&&<p role="alert">{error} 若資料已被其他人修改，請重新載入後再編輯。<button onClick={()=>{setError('');void load().catch(e=>setError(e.message));}}>重新載入</button></p>}{message&&<p role="status">{message}</p>}
 {!data?<p role="status">載入中…</p>:<>
 <section className="card"><h2>分類管理</h2><button disabled={busy||!!category||!!item} onClick={()=>setCategory({id:crypto.randomUUID(),label:'',sortOrder:data.categories.length*10,published:false,version:0})}>新增分類</button>
 <ul>{data.categories.map(c=><li key={c.id}><strong>{c.label}</strong> · {c.published?'已發布':'未發布'} · {data.items.filter(i=>i.category===c.id).length} 題 · 排序 {c.sortOrder} <button disabled={busy||!!category||!!item} onClick={()=>{setCategory({...c});setMessage('')}}>編輯分類</button></li>)}</ul></section>
 <section className="card"><h2>問答內容</h2><div><label>搜尋<input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="問題或答案關鍵字"/></label><label>分類<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="">全部分類</option>{data.categories.map(c=><option key={c.id} value={c.id}>{c.label}</option>)}</select></label></div>
 <button disabled={busy||!data.categories.length||!!category||!!item} onClick={()=>setItem({id:crypto.randomUUID(),category:filter||data.categories[0].id,question:'',answer:'',keywords:'',sortOrder:data.items.length*10,published:false,version:0})}>新增問答</button>
 {data.items.filter(i=>(!filter||i.category===filter)&&(!query||(i.question+i.answer+i.keywords).includes(query))).map(i=><article key={i.id} style={{borderBottom:'1px solid #526973',padding:'16px 0'}}><h3>{i.question}</h3><p>{data.categories.find(c=>c.id===i.category)?.label} · {i.published?'已發布':'草稿'} · 排序 {i.sortOrder}</p><p style={{whiteSpace:'pre-wrap'}}>{i.answer}</p><button disabled={busy||!!category||!!item} onClick={()=>{setItem({...i});setMessage('')}}>編輯問答</button></article>)}</section>
 {category&&<form id="faq-editor" className="card" onSubmit={e=>{e.preventDefault();void save('categories',category)}}><h2>{category.version?'編輯':'新增'}分類</h2><label>分類名稱 *<input required maxLength={80} value={category.label} onChange={e=>setCategory({...category,label:e.target.value})}/></label><label>排序<input type="number" min={0} max={10000} required value={category.sortOrder} onChange={e=>setCategory({...category,sortOrder:Number(e.target.value)})}/></label><label><input type="checkbox" checked={category.published} onChange={e=>setCategory({...category,published:e.target.checked})}/>發布分類（取消勾選會隱藏整個分類）</label><button disabled={busy}>{busy?'儲存中…':'儲存分類'}</button><button type="button" disabled={busy} onClick={()=>setCategory(undefined)}>取消</button></form>}
 {item&&<form id="faq-editor" className="card" onSubmit={e=>{e.preventDefault();void save('items',item)}}><h2>{item.version?'編輯':'新增'}問答</h2><label>分類 *<select required value={item.category} onChange={e=>setItem({...item,category:e.target.value})}>{data.categories.map(c=><option key={c.id} value={c.id}>{c.label}{c.published?'':'（未發布）'}</option>)}</select></label><label>問題 *<input required maxLength={200} value={item.question} onChange={e=>setItem({...item,question:e.target.value})}/></label><label>答案 *<textarea required maxLength={12000} rows={8} value={item.answer} onChange={e=>setItem({...item,answer:e.target.value})}/></label><label>搜尋關鍵字<input maxLength={500} value={item.keywords} onChange={e=>setItem({...item,keywords:e.target.value})}/></label><label>排序<input required type="number" min={0} max={10000} value={item.sortOrder} onChange={e=>setItem({...item,sortOrder:Number(e.target.value)})}/></label><label><input type="checkbox" checked={item.published} onChange={e=>setItem({...item,published:e.target.checked})}/>發布問答</label><button disabled={busy}>{busy?'儲存中…':'儲存問答'}</button><button type="button" disabled={busy} onClick={()=>setItem(undefined)}>取消</button></form>}
 </>}
 </main>;
}
