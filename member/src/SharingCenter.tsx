import SharingProgress from './SharingProgress';
import {useRef,useState} from 'react';
import {Link} from 'react-router-dom';
import {ErrorState,LoadingState} from '@ucell/design-system';
import type {Qualification} from './api';
import {memberApi} from './memberApi';
import {useResource} from './useResource';
import {MemberPageHeader} from './MemberPageHeader';
import ReferralShare from './ReferralShare';
type Insights={since:string;asOf:string;officialPaidOrders:number;rows:{contentId:string|null;targetType?:string;targetReference?:string;title:string|null;links:number;visitors:number;boundMembers:number;registrations:number}[];links:{id:string;status:string;createdAt:string;expiresAt:string}[]};
const labels:Record<string,string>={PRODUCT:'商品',EVENT:'活動',CONTENT:'影音',INVITE:'會員邀請'};
const date=(v:string)=>new Date(v).toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});
export default function SharingCenter({q}:{q:Qualification}){return <Sharing key={q.id} q={q}/>}
function Sharing({q}:{q:Qualification}){
 const s=useResource('sharing:'+q.id,signal=>memberApi<Insights>('/member/content-insights?qualificationId='+encodeURIComponent(q.id),{signal}));
 const [progressVersion,setProgressVersion]=useState(0);
 const [busy,setBusy]=useState(''),[error,setError]=useState(''),[confirm,setConfirm]=useState(''),[notice,setNotice]=useState(''),[filter,setFilter]=useState('ALL'),lock=useRef(false);
 async function revoke(id:string){if(lock.current)return;lock.current=true;setBusy(id);setError('');try{await memberApi('/member/content-share-links/'+id+'/revoke',{method:'POST',body:JSON.stringify({qualificationId:q.id})});setConfirm('');setNotice('連結已停用，既有推薦紀錄會保留。');s.retry();}catch(e){setError(e instanceof Error?e.message:'停用未完成，請重試');}finally{lock.current=false;setBusy('');}}
 const d=s.data,rows=d?.rows.filter(r=>filter==='ALL'||(r.targetType??'CONTENT')===filter)??[];
 return <><MemberPageHeader title="我的分享成效" q={q}/><section className="uc-content-intro"><div><small>從分享開始</small><h2>選擇內容，帶朋友前往正確頁面</h2><p>目前推薦球：<strong>{q.code}</strong>。在商品、活動或影音詳情建立專屬連結，再透過 LINE、複製連結或 二維條碼 分享。</p><div className="uc-content-actions"><Link className="button" to="/shop">挑選商品</Link><Link className="button" to="/events">探索活動</Link><Link className="button" to="/content">挑選影音</Link></div></div></section>
 <SharingProgress qualificationId={q.id} refreshKey={progressVersion}/>
 <details className="card"><summary>一般會員邀請（不指定商品或活動）</summary><ReferralShare q={q}/></details>
 <div className="uc-content-toolbar"><h2>分享紀錄與成效</h2><button onClick={()=>{s.retry();setProgressVersion(v=>v+1);}}>更新成效</button><label>分享類型<select value={filter} onChange={e=>setFilter(e.target.value)}><option value="ALL">全部</option>{Object.entries(labels).map(([code,label])=><option key={code} value={code}>{label}</option>)}</select></label></div>
 {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{s.error?<ErrorState message={s.error} retry={s.retry}/>:!d?<LoadingState label="正在讀取分享成效…"/>:<><p>近 30 天建立的連結與累積成效，更新於 {date(d.asOf)}。不同內容的訪客可能重複，不可直接加總為總人數。</p>
 <div className="uc-content-grid">{rows.length?rows.map(row=><section className="card" key={row.targetType+':'+(row.targetReference??row.contentId??'invite')}><small>{labels[row.targetType??'CONTENT']??'分享'}</small><h2>{row.title??(row.targetType==='INVITE'?'一般會員邀請':'內容名稱未提供')}</h2><dl className="uc-share-metrics">{[['分享連結',row.links],['有效造訪',row.visitors],['已連結會員',row.boundMembers],['新註冊會員',row.registrations]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>{row.targetType==='PRODUCT'&&row.targetReference&&<Link to={'/shop?sku='+encodeURIComponent(row.targetReference)}>查看商品／再次分享 →</Link>}{row.targetType==='EVENT'&&row.targetReference&&<Link to={'/events?event='+encodeURIComponent(row.targetReference)}>查看活動／再次分享 →</Link>}{row.contentId&&<Link to={'/content/'+row.contentId}>查看影音／再次分享 →</Link>}</section>):<section className="card"><h3>{d.rows.length?'此類型尚無分享紀錄':'從第一份分享開始'}</h3><p>使用上方入口挑選內容，建立的專屬連結及成效會顯示在這裡。</p></section>}</div>
 <section className="card"><h2>正式推薦訂單</h2><strong className="uc-share-number">{d.officialPaidOrders}</strong><p>近 30 天已付款且有此球位正式推薦快照的訂單數，排除取消與全額退款。此數字不是某個分享連結直接帶來的成交數，也不代表已結算獎金。</p><Link to="/bonuses">查看正式獎金明細 →</Link></section>
 <details className="card"><summary>管理最近 50 個分享連結（{d.links.length}）</summary>{!d.links.length&&<p>目前沒有可管理的分享連結。</p>}{d.links.map(l=>{const active=l.status==='ACTIVE'&&Date.parse(l.expiresAt)>Date.now();return <div className="uc-share-link-row" key={l.id}><div><strong>{date(l.createdAt)}</strong><p>到期：{date(l.expiresAt)} · {active?'有效':l.status==='REVOKED'?'已停用':'已過期'}</p><small>識別碼：{l.id.slice(-8)}</small></div>{active&&(confirm===l.id?<div><p>停用後無法再使用此連結，既有推薦紀錄會保留。</p><button disabled={!!busy} onClick={()=>void revoke(l.id)}>{busy===l.id?'正在停用…':'確認停用'}</button><button disabled={!!busy} onClick={()=>setConfirm('')}>取消</button></div>:<button disabled={!!busy} onClick={()=>setConfirm(l.id)}>停用</button>)}</div>})}</details>
 <p><small>有效造訪是系統接受推薦來源的去重瀏覽器紀錄，不是影片觀看完成數。「已連結會員」包含既有會員；「新註冊會員」僅計入造訪後新建立且完成來源連結的會員。</small></p></>}
 </>;
}
