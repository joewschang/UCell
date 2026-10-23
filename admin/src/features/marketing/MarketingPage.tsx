import {useEffect,useRef,useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {Link} from 'react-router-dom';
import {useAuth} from '../auth/auth';
import {ApiError,command,get} from '../../lib/api';
import {Card,ErrorBox,Metric,PageHeader} from '../../components/ui';
import './marketing.css';
type Row={id:string;ballNo:string|null;memberNo:string;links:number;visitors:number;boundMembers:number;registrations:number;segment:string;lastSharedAt:string|null;lastEncouragedAt:string|null;lastMessage:string|null;readAt:string|null};
type Dashboard={since:string;asOf:string;page:number;pageSize:number;total:number;summary:{balls:number;members:number;sharingBalls:number;links:number;visitors:number;boundMembers:number;registrations:number};segments:Record<string,number>;rows:Row[]};
const segments:Record<string,{label:string;description:string;message:string}>={
 START:{label:'陪伴起步',description:'尚未建立連結，協助找到適合分享的內容。',message:'分享可以從一個小步驟開始：挑選一項您熟悉的商品、活動或影音，在「我的分享成效」建立專屬連結，分享給有興趣的朋友。需要協助時，歡迎與我們聯繫。'},
 REACH:{label:'協助觸及',description:'已建立連結，尚未記錄有效造訪。',message:'謝謝您開始分享！可以先確認連結是否已傳送，搭配自己的使用心得，讓朋友知道為什麼推薦這份內容。尊重朋友的意願，合適的分享比大量轉傳更有價值。'},
 CONNECT:{label:'支持交流',description:'已有有效造訪，尚未帶來新註冊。',message:'您的分享已帶來造訪，謝謝您的用心！可以在朋友有需要時，協助說明內容或回答問題。請依對方意願交流，不必急著要求註冊或購買。'},
 CELEBRATE:{label:'肯定成果',description:'已有分享後完成來源連結的新註冊會員。',message:'您的分享已迎來新註冊會員，謝謝您用心介紹！接下來可以陪伴朋友熟悉會員服務，協助找到適合的內容。持續真誠交流，讓每一次分享都有幫助。'},
};
const date=(v:string|null)=>v?new Date(v).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'}):'尚無紀錄';
export function MarketingPage(){
 const {user}=useAuth(),client=useQueryClient(),canSend=['SUPER_ADMIN','MEMBERSHIP_OPS','ORDER_OPS'].includes(user?.role??'');
 const [search,setSearch]=useState(''),[filter,setFilter]=useState(''),[segment,setSegment]=useState('ALL'),[page,setPage]=useState(1),[tab,setTab]=useState('MEMBERS');
 const [selected,setSelected]=useState<Row|null>(null),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState<unknown>(null),[notice,setNotice]=useState('');
 const lock=useRef(false),key=useRef(''),returnFocus=useRef<HTMLElement|null>(null);
 useEffect(()=>{if(!selected)return;return()=>returnFocus.current?.focus();},[selected]);
 const query=useQuery({queryKey:['marketing',filter,segment,page],queryFn:({signal})=>get<{data:Dashboard}>('/admin/marketing?'+new URLSearchParams({search:filter,segment,page:String(page)}),{signal})});
 const contents=useQuery({queryKey:['marketing-content'],queryFn:()=>get<{data:{rows:{targetType?:string;targetReference?:string;contentId:string|null;title:string|null;links:number;visitors:number;boundMembers:number;registrations:number}[]}}>('/admin/content-insights'),enabled:tab==='CONTENT'});
 const d=query.data?.data;
 function choose(row:Row){returnFocus.current=typeof document==='undefined'?null:document.activeElement as HTMLElement;key.current=crypto.randomUUID();setSelected(row);setBody(segments[row.segment].message);setError(null);setNotice('');}
 async function send(){if(!selected||lock.current||!body.trim())return;lock.current=true;setBusy(true);setError(null);try{
  await command('/admin/marketing/encouragements',{qualificationId:selected.id,memberNo:selected.memberNo,body:body.trim()},key.current);
  setNotice(`已將鼓勵存入會員 ${selected.memberNo} 的站內訊息中心。`);setSelected(null);await client.invalidateQueries({queryKey:['marketing']});
 }catch(e){setError(e instanceof ApiError&&e.status===409?new Error('這位會員可能在近七天已收到鼓勵，或資料已更新。請更新看板確認；連線中斷時可保留原文重試。'):e);}finally{lock.current=false;setBusy(false);}}
 return <div className="marketing-page"><PageHeader title="分享行銷看板" subtitle="了解分享進展，給會員恰當的支持" actions={<button disabled={query.isFetching} onClick={()=>{void query.refetch();if(tab==='CONTENT')void contents.refetch();}}>更新看板</button>}/>
 <section className="marketing-intro"><div><small>觀察 · 陪伴 · 鼓勵</small><h2>每一次分享，都有下一步</h2><p>先看需要協助的會員，再選擇合適的鼓勵。以有用的交流與會員成長為目標。</p></div><Link to="/content">管理可分享內容 →</Link></section>
 {notice&&<p role="status" className="marketing-success">{notice}</p>}
 {query.isPending?<p role="status">正在整理分享成效…</p>:query.error?<><ErrorBox error={query.error}/><button onClick={()=>void query.refetch()}>重新載入</button></>:d&&<>
 <p className="marketing-period">近 30 天建立的連結及截至目前累積的成效 · 更新：{date(d.asOf)}</p>
 <div className="marketing-metrics"><Metric label="參與分享的球" value={`${d.summary.sharingBalls} / ${d.summary.balls}`} helper={`目前 ${d.summary.members} 位持有人`}/><Metric label="建立的連結" value={d.summary.links} helper="建立不等於已傳送"/><Metric label="有效造訪" value={d.summary.visitors} helper="跨連結去重的瀏覽器紀錄"/><Metric label="新註冊會員" value={d.summary.registrations} helper={`已連結會員共 ${d.summary.boundMembers} 位，包含既有會員`}/></div>
 <div className="marketing-segments" aria-label="依支持階段篩選">{Object.entries(segments).map(([code,s])=><button key={code} aria-pressed={segment===code} onClick={()=>{setSegment(segment===code?'ALL':code);setPage(1);setTab('MEMBERS');}}><span>{s.label}</span><strong>{d.segments[code]??0}<small> 球</small></strong><small>{s.description}</small></button>)}</div>
 <div className="marketing-tabs" aria-label="看板內容"><button aria-pressed={tab==='MEMBERS'} onClick={()=>setTab('MEMBERS')}>會員陪伴</button><button aria-pressed={tab==='CONTENT'} onClick={()=>setTab('CONTENT')}>內容成效</button></div>
 {tab==='MEMBERS'?<Card title="會員分享進展"><form className="marketing-toolbar" onSubmit={e=>{e.preventDefault();setFilter(search.trim());setPage(1);}}><label>會員編號或球號<input maxLength={50} value={search} onChange={e=>setSearch(e.target.value)} placeholder="輸入編號搜尋"/></label><button type="submit">搜尋</button><button type="button" onClick={()=>{setSearch('');setFilter('');setSegment('ALL');setPage(1);}}>顯示全部</button><p>{segment==='ALL'?'全部階段':segments[segment].label} · 共 {d.total} 球</p></form>
 <div className="table-wrap"><table><thead><tr><th>會員／球號</th><th>支持階段</th><th>連結／造訪</th><th>新註冊</th><th>上次鼓勵</th><th>操作</th></tr></thead><tbody>{d.rows.map(row=>{const cooling=!!row.lastEncouragedAt&&Date.now()-Date.parse(row.lastEncouragedAt)<7*86400000;return <tr key={row.id}><td><strong>{row.memberNo}</strong><br/>{row.ballNo??'尚無球號'}<br/><small>最近建立：{date(row.lastSharedAt)}</small></td><td>{segments[row.segment].label}</td><td>{row.links} ／ {row.visitors}</td><td>{row.registrations}<br/><small>來源連結會員 {row.boundMembers}</small></td><td>{date(row.lastEncouragedAt)}<br/>{row.lastEncouragedAt&&(row.readAt?'已讀 · '+date(row.readAt):'已存入站內訊息 · 尚未讀取')}{row.lastMessage&&<details><summary>查看上次內容</summary><p className="marketing-message">{row.lastMessage}</p></details>}</td><td>{canSend?<button disabled={cooling} onClick={()=>choose(row)}>{cooling?'七天內已鼓勵':'預覽鼓勵'}</button>:<small>唯讀檢視</small>}</td></tr>})}</tbody></table></div>
 {!d.rows.length&&<p className="marketing-empty">{d.summary.balls?'目前篩選條件沒有符合的球，請調整搜尋或顯示全部。':'目前尚無持有有效會員球的正式會員。會員建立球後會出現在這裡。'}</p>}
 <div className="marketing-toolbar"><button disabled={page===1} onClick={()=>setPage(v=>v-1)}>上一頁</button><span>第 {page} 頁／共 {Math.max(1,Math.ceil(d.total/d.pageSize))} 頁</span><button disabled={page*d.pageSize>=d.total} onClick={()=>setPage(v=>v+1)}>下一頁</button></div>
 <p><small>依球歸屬統計，顯示目前持有人；轉讓前的分享也保留在原球。不同球可能接觸相同訪客，表格不可直接加總為總人數。鼓勵以會員為單位，每七天最多一則。</small></p></Card>:<Card title="哪些內容帶來交流？">{contents.isPending?<p role="status">正在載入內容成效…</p>:contents.error?<><ErrorBox error={contents.error}/><button onClick={()=>void contents.refetch()}>重試</button></>:<><div className="table-wrap"><table><thead><tr><th>類型／內容</th><th>連結</th><th>有效造訪</th><th>來源連結會員</th><th>新註冊</th></tr></thead><tbody>{contents.data?.data.rows.map((r,i)=><tr key={i}><td><small>{{PRODUCT:'商品',EVENT:'活動',CONTENT:'影音',INVITE:'會員邀請'}[r.targetType??'CONTENT']}</small><br/>{r.title??'一般會員邀請'}</td><td>{r.links}</td><td>{r.visitors}</td><td>{r.boundMembers}</td><td>{r.registrations}</td></tr>)}</tbody></table></div>{!contents.data?.data.rows.length&&<p className="marketing-empty">還沒有分享紀錄。先準備適合介紹的商品、活動與影音，再陪伴會員開始分享。</p>}<p>此表涵蓋所有分享來源；各內容人數可能重複，不可加總。影音造訪不等於觀看完成，活動造訪不等於報名。</p></>}</Card>}
 <details className="card"><summary>指標定義與統計範圍</summary><p>會員陪伴僅統計目前由正式會員持有的有效會員球，包含尚未分享的球；不含公司球與法人球。有效造訪依推薦來源紀錄去重，並非裝置背後的真實人數。</p><p>新註冊會員須在首次造訪後建立帳戶，並在 30 天內完成相同推薦來源連結。已連結會員包含既有會員。這些指標不是成交、活動出席、獎金或鼓勵造成的成長證明。</p><p>鼓勵須由營運人員預覽確認，僅送至站內訊息中心；已讀表示會員開啟訊息。未讀不能視為不活躍，請避免頻繁催促。</p></details>
 </>}
 {selected&&<div className="marketing-overlay"><section role="dialog" aria-modal="true" aria-labelledby="encouragement-title" className="marketing-dialog" onKeyDown={e=>{if(e.key==='Escape'&&!busy)setSelected(null);if(e.key==='Tab'){const nodes=Array.from(e.currentTarget.querySelectorAll<HTMLElement>('textarea,button')).filter(n=>!(n as HTMLButtonElement).disabled);const first=nodes[0],last=nodes[nodes.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}}}><h2 id="encouragement-title">預覽個別鼓勵</h2><p>會員 <strong>{selected.memberNo}</strong> · 球號 {selected.ballNo??'尚無球號'}</p><p>{segments[selected.segment].description}</p><label>鼓勵內容<textarea autoFocus rows={7} maxLength={600} value={body} disabled={busy} onChange={e=>{setBody(e.target.value);key.current=crypto.randomUUID();}}/></label><small>{body.length}／600 字 · 站內訊息，每位會員七天最多一則。</small><ErrorBox error={error}/><div className="marketing-toolbar"><button disabled={busy||!body.trim()} onClick={()=>void send()}>{busy?'正在存入訊息…':'確認送出站內鼓勵'}</button><button disabled={busy} onClick={()=>setSelected(null)}>取消</button></div></section></div>}
 </div>;
}
